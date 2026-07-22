"use client"

// Star Nest — adapted from Pablo Roman Andrioli (https://www.shadertoy.com/view/XlfGRj)
// License: MIT. Renders a kaleidoscopic volumetric star/galaxy field as a
// full-screen additive backdrop; the CSS Background and 3D nebula clouds
// still show through the dark parts.

import { useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import type { ShaderMaterial } from "three"

interface StarNestProps {
  /** Brightness multiplier (default 0.0015 — original shadertoy value). */
  brightness?: number
  /** Color saturation (default 0.85). */
  saturation?: number
  /** Hue tint baked into the final color (default white = no tint). */
  tint?: [number, number, number]
  /** Deterministic post-boot showcase: when this flips true, the fractal's
   *  clock resets to t=0 (identical opening sequence every load — however
   *  long the shader-compile stall lasted) and brightness is boosted for a
   *  fixed window so the star nest unmistakably announces itself. */
  showcase?: boolean
}

// Showcase choreography (seconds / multiplier).
const SHOWCASE_HOLD = 4.0
const SHOWCASE_EASE = 1.6
const SHOWCASE_BOOST = 2.1

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Place the quad at the far plane in NDC, regardless of mesh transform.
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`

const FRAG = /* glsl */ `
  // Star Nest by Pablo Roman Andrioli — MIT.
  uniform float uTime;
  uniform vec2  uResolution;
  uniform vec2  uMouse;
  uniform float uBrightness;
  uniform float uSaturation;
  uniform vec3  uTint;
  varying vec2 vUv;

  // This is a full-screen shader, so every loop is multiplied by every pixel.
  // 11x11 keeps the same nested galactic structure at substantially lower GPU
  // cost than the original 14x14 march, especially on high-DPI displays.
  #define iterations 11
  #define formuparam 0.53
  #define volsteps 11
  #define stepsize 0.1
  #define zoom   0.800
  #define tile   0.850
  #define speed  0.010
  #define darkmatter 0.300
  #define distfading 0.730

  void main() {
    vec2 uv = vUv - 0.5;
    uv.y *= uResolution.y / max(uResolution.x, 1.0);
    vec3 dir = vec3(uv * zoom, 1.0);

    float a1 = 0.5 + uMouse.x * 2.0 + sin(uTime * 0.17) * 0.42;
    float a2 = 0.8 + uMouse.y * 2.0 + cos(uTime * 0.13) * 0.36;
    mat2 rot1 = mat2(cos(a1), sin(a1), -sin(a1), cos(a1));
    mat2 rot2 = mat2(cos(a2), sin(a2), -sin(a2), cos(a2));
    dir.xz *= rot1;
    dir.xy *= rot2;

    // Bounded Lissajous drift instead of the original linear time*2 drift.
    // The original pulled the camera through the fractal volume, so after
    // a couple minutes you'd end up in a cosmic-void region where almost
    // nothing rendered (the intermittent "stops animating" the user saw).
    // This keeps the camera oscillating inside a single high-density
    // pocket forever while still giving continuous slow motion.
    vec3 from = vec3(1.0, 0.5, 0.5);
    from += vec3(
      sin(uTime * 0.16) * 0.55,
      cos(uTime * 0.12) * 0.42,
      -2.0 + sin(uTime * 0.19) * 0.32
    );
    from.xz *= rot1;
    from.xy *= rot2;

    float s = 0.1, fade = 1.0;
    vec3 v = vec3(0.0);
    for (int r = 0; r < volsteps; r++) {
      vec3 p = from + s * dir * 0.5;
      p = abs(vec3(tile) - mod(p, vec3(tile * 2.0)));
      float pa = 0.0;
      float a  = 0.0;
      for (int i = 0; i < iterations; i++) {
        p = abs(p) / dot(p, p) - formuparam;
        a += abs(length(p) - pa);
        pa = length(p);
      }
      float dm = max(0.0, darkmatter - a * a * 0.001);
      a *= a * a;
      if (r > 6) fade *= 1.0 - dm;
      v += fade;
      v += vec3(s, s * s, s * s * s * s) * a * uBrightness * fade;
      fade *= distfading;
      s += stepsize;
    }
    v = mix(vec3(length(v)), v, uSaturation);
    float breath = 0.9 + 0.1 * sin(uTime * 0.9 + length(uv) * 7.0);
    vec3 color = v * 0.01 * breath * uTint;

    // Additive: alpha based on luminance so dark space stays transparent
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    gl_FragColor = vec4(color, clamp(lum * 6.0, 0.0, 1.0));
  }
`

export default function StarNest({
  brightness = 0.0015,
  saturation = 0.85,
  tint = [1, 1, 1],
  showcase = false,
}: StarNestProps) {
  const { camera, size } = useThree()
  const matRef = useRef<ShaderMaterial>(null)
  const timeRef = useRef(0)
  const prevFrameRef = useRef<number | null>(null)
  const smoothMouseRef = useRef(new THREE.Vector2(0.5, 0.5))
  const targetMouseRef = useRef(new THREE.Vector2(0.5, 0.5))
  // Speed envelope for the fractal boil. The perceived "fast at first, dead
  // after you touch it" came from camera motion (initial damping settle,
  // drags) feeding uMouse, then stopping almost instantly once OrbitControls
  // damping ran out. Instead: uTime advances at `energy` × wall speed —
  // starts hot, camera motion kicks it back up, and it decays SLOWLY toward
  // a floor that keeps the background visibly alive forever.
  const ENERGY_START = 2.4
  const ENERGY_FLOOR = 1.15
  const ENERGY_MAX = 2.6
  const ENERGY_HALF_LIFE = 3.5 // seconds for the boost to decay halfway
  const energyRef = useRef(ENERGY_START)
  const prevQuatRef = useRef<THREE.Quaternion | null>(null)
  // Set on the first RENDERED frame after `showcase` flips true, so the
  // 4-second window never burns while the tab isn't painting.
  const showcaseStartRef = useRef<number | null>(null)

  useFrame(() => {
    if (!matRef.current) return

    const now = performance.now() / 1000
    const prev = prevFrameRef.current ?? now
    const dt = Math.min(now - prev, 0.05)
    prevFrameRef.current = now

    if (showcase && showcaseStartRef.current === null) {
      // Boot just finished: reset the fractal clock — every load opens on
      // the exact same (dense, bright) sequence regardless of how long the
      // shader-compile stall chewed through it.
      showcaseStartRef.current = now
      timeRef.current = 0
      energyRef.current = ENERGY_START
    }

    // Camera angular motion this frame (drag, damping, autorotate) → kick.
    const quat = camera.quaternion
    if (prevQuatRef.current) {
      const angle = 2 * Math.acos(Math.min(1, Math.abs(quat.dot(prevQuatRef.current))))
      energyRef.current = Math.min(ENERGY_MAX, energyRef.current + angle * 8)
    } else {
      prevQuatRef.current = new THREE.Quaternion()
    }
    prevQuatRef.current.copy(quat)

    // Exponential decay toward the floor — never fully still.
    energyRef.current =
      ENERGY_FLOOR +
      (energyRef.current - ENERGY_FLOOR) * Math.pow(0.5, dt / ENERGY_HALF_LIFE)

    timeRef.current += dt * energyRef.current

    const q = camera.quaternion
    targetMouseRef.current.set(
      0.5 + q.y * 0.45 + Math.sin(timeRef.current * 0.09) * 0.08,
      0.5 + q.x * 0.45 + Math.cos(timeRef.current * 0.07) * 0.08,
    )
    smoothMouseRef.current.lerp(targetMouseRef.current, 1 - Math.pow(0.04, dt * 60))

    // Showcase brightness: full boost for SHOWCASE_HOLD seconds after boot,
    // then ease back down to the ambient level.
    let boost = 1
    if (showcaseStartRef.current !== null) {
      const el = now - showcaseStartRef.current
      if (el < SHOWCASE_HOLD) {
        boost = SHOWCASE_BOOST
        energyRef.current = Math.max(energyRef.current, 2.2)
      } else {
        boost = 1 + Math.max(0, 1 - (el - SHOWCASE_HOLD) / SHOWCASE_EASE) * (SHOWCASE_BOOST - 1)
      }
    }

    matRef.current.uniforms.uTime.value = timeRef.current
    matRef.current.uniforms.uBrightness.value = brightness * boost
    matRef.current.uniforms.uResolution.value.set(size.width, size.height)
    matRef.current.uniforms.uMouse.value.copy(smoothMouseRef.current)
  })

  return (
    <mesh frustumCulled={false} renderOrder={-1000}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        transparent
        depthTest={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={{
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uMouse: { value: new THREE.Vector2(0.5, 0.5) },
          uBrightness: { value: brightness },
          uSaturation: { value: saturation },
          uTint: { value: new THREE.Vector3(tint[0], tint[1], tint[2]) },
        }}
      />
    </mesh>
  )
}
