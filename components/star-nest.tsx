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
}

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

  #define iterations 14
  #define formuparam 0.53
  #define volsteps 14
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

    float a1 = 0.5 + uMouse.x * 2.0;
    float a2 = 0.8 + uMouse.y * 2.0;
    mat2 rot1 = mat2(cos(a1), sin(a1), -sin(a1), cos(a1));
    mat2 rot2 = mat2(cos(a2), sin(a2), -sin(a2), cos(a2));
    dir.xz *= rot1;
    dir.xy *= rot2;

    // Bounded Lissajous drift instead of the original's linear `time * 2`
    // drift. The original pulled the camera through the fractal volume, so
    // after a couple minutes you'd end up in a cosmic-void region where
    // almost nothing rendered (intermittent "stops animating"). This keeps
    // the camera oscillating inside a single high-density pocket forever
    // while still giving continuous slow motion.
    vec3 from = vec3(1.0, 0.5, 0.5);
    from += vec3(
      sin(uTime * 0.07) * 0.35,
      cos(uTime * 0.05) * 0.30,
      -2.0 + sin(uTime * 0.04) * 0.20
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
    vec3 color = v * 0.01 * uTint;

    // Additive: alpha based on luminance so dark space stays transparent
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    gl_FragColor = vec4(color, clamp(lum * 6.0, 0.0, 1.0));
  }
`

export default function StarNest({
  brightness = 0.0015,
  saturation = 0.85,
  tint = [1, 1, 1],
}: StarNestProps) {
  const { camera, size } = useThree()
  const matRef = useRef<ShaderMaterial>(null)

  useFrame((state) => {
    if (!matRef.current) return
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime
    matRef.current.uniforms.uResolution.value.set(size.width, size.height)

    // Drive the shader's mouse-rotation analog from the camera quaternion so
    // the fractal cosmos appears to rotate with the user's view.
    const q = camera.quaternion
    matRef.current.uniforms.uMouse.value.set(q.y * 1.6, q.x * 1.6)
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
