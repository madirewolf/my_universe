"use client"

// Generators Redux by Kali — adapted from https://www.shadertoy.com/view/Xtf3Rn
// License: MIT.
//
// Used as a fullscreen transition when the user clicks the rift portal — the
// camera "flies through" the Kali fractal corridor for ~2.8 seconds before
// emerging in the other universe. Iterations + raymarch steps reduced from
// the original (17/70) to (12/40) to keep frame budget tight; the metallic
// liquid ball and post-process layers from the original are dropped.

import { useEffect, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import type { ShaderMaterial } from "three"

interface RiftCorridorProps {
  active: boolean
  /** Total transition length in seconds (in + corridor + out). */
  duration?: number
  /** Fade-in / fade-out ramp length (each side) as a fraction of duration. */
  edgeFade?: number
  onMidpoint?: () => void
  onComplete?: () => void
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Lock the quad at the far plane in NDC, irrespective of mesh transform
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec2  uResolution;
  varying vec2 vUv;

  #define iterations 11
  #define volsteps 22
  #define zoom    0.85
  #define speed   0.5
  #define distfading 0.78
  #define saturation 0.95

  vec3 path(float ti) {
    return vec3(sin(ti), 0.30 - sin(ti * 0.632) * 0.30, cos(ti * 0.5)) * 0.5;
  }

  vec2 de(vec3 pos) {
    vec3 tpos = pos;
    tpos.xz = abs(0.5 - mod(tpos.xz, 1.0));
    vec4 p = vec4(tpos, 1.0);
    for (int i = 0; i < iterations; i++) {
      p.xyz = abs(p.xyz) - vec3(-0.02, 1.98, -0.02);
      p = p * 2.0 / clamp(dot(p.xyz, p.xyz), 0.4, 1.0) - vec4(0.5, 1.0, 0.4, 0.0);
      p.xz *= mat2(-0.416, -0.91, 0.91, -0.416);
    }
    float fl = pos.y - 3.013;
    float fr = (length(max(abs(p.xyz) - vec3(0.1, 5.0, 0.1), vec3(0.0))) - 0.05) / p.w;
    float d = min(fl, fr);
    d = min(d, -pos.y + 3.95);
    return vec2(d, 0.0);
  }

  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.y *= uResolution.y / max(uResolution.x, 1.0);

    float ti = uTime * speed + 0.25;
    vec3 origin = vec3(0.0, 3.11, 0.0);
    vec3 from = origin + path(ti);
    vec3 advec = normalize(path(ti + 0.7) - path(ti));
    float an = atan(advec.x, advec.z);
    mat2 r1 = mat2(cos(an), sin(an), -sin(an), cos(an));
    an = advec.y * 1.7;
    mat2 r2 = mat2(cos(an), sin(an), -sin(an), cos(an));

    vec3 dir = normalize(vec3(uv * zoom, 1.0));
    dir.yz *= r2;
    dir.xz *= r1;

    // Background gradient — purple→magenta vignette so the corridor never
    // reads as a black void even when raymarch doesn't accumulate energy.
    vec3 backg = mix(
      vec3(0.18, 0.08, 0.30),
      vec3(0.95, 0.45, 0.92),
      smoothstep(-1.0, 1.0, uv.y * 0.6 + 0.4)
    );

    // Volumetric raymarch — accumulate energy at every step (not only on
    // surface hits) so the fractal glows even when the path doesn't graze
    // a wall directly.
    float s = 0.0;
    float fade = 1.0;
    float glow = 0.0;
    vec3 col = vec3(0.0);
    vec2 d = vec2(1.0, 0.0);

    for (int r = 0; r < volsteps; r++) {
      if (d.x > 0.001 && s < 4.0) {
        vec3 p = from + s * dir;
        d = de(p);

        if (d.x < 0.04) {
          glow += max(0.0, 0.04 - d.x) * exp(-s * 0.55) * 1.4;
        }

        // Pulsing energy color along the camera path
        vec3 energyCol = vec3(1.0, 0.55, 0.95)
          * (1.6 + sin(uTime * 9.0 + p.z * 5.0 + p.x * 3.5)) * 0.22;
        // Inverse-distance weighting so close-to-walls is brighter
        float energy = 1.0 / (1.0 + d.x * d.x * 8.0);
        col += energyCol * energy * fade * 0.10;

        s += max(d.x, 0.05);
        fade *= distfading;
      }
    }

    // Surface hit: bright violet flash that fades with distance
    if (d.x <= 0.001) {
      col += vec3(0.85, 0.45, 1.0) * exp(-0.35 * s * s) * 0.6;
      col = mix(col, backg * 0.55, 1.0 - exp(-0.65 * pow(s, 1.5)));
    } else {
      col = mix(col, backg * 0.65, 0.65);
    }

    col += glow * vec3(1.05, 0.55, 1.20) * 0.95;

    // Tunnel vignette
    float r2v = dot(uv, uv);
    col *= 1.0 - clamp(r2v * 0.42, 0.0, 1.0);

    // Saturation + gamma
    col = mix(vec3(length(col)), col, saturation);
    col = pow(clamp(col, vec3(0.0), vec3(1.0)), vec3(1.15));

    gl_FragColor = vec4(col, uOpacity);
  }
`

export default function RiftCorridor({
  active,
  duration = 2.8,
  edgeFade = 0.18,
  onMidpoint,
  onComplete,
}: RiftCorridorProps) {
  const matRef = useRef<ShaderMaterial>(null)
  const startRef = useRef<number | null>(null)
  const midpointFiredRef = useRef(false)
  const completeFiredRef = useRef(false)
  const { size } = useThree()
  // Internal phase to keep the mesh mounted during the fade-out ramp even
  // after `active` has flipped back to false.
  const [render, setRender] = useState(false)

  // Reset state when the trigger goes high
  useEffect(() => {
    if (active) {
      startRef.current = null
      midpointFiredRef.current = false
      completeFiredRef.current = false
      setRender(true)
    }
  }, [active])

  useFrame((state) => {
    const m = matRef.current
    if (!m) return
    if (!render && !active) return

    if (startRef.current === null) {
      startRef.current = state.clock.elapsedTime
    }
    const t = state.clock.elapsedTime - startRef.current
    const t01 = Math.min(1, t / duration)

    // Midpoint and end callbacks
    if (!midpointFiredRef.current && t01 >= 0.5) {
      midpointFiredRef.current = true
      onMidpoint?.()
    }
    if (!completeFiredRef.current && t01 >= 1.0) {
      completeFiredRef.current = true
      onComplete?.()
      setRender(false)
    }

    // Triangular fade — ramp up over edgeFade, hold, ramp down over edgeFade
    let opacity = 1
    if (t01 < edgeFade) opacity = t01 / edgeFade
    else if (t01 > 1 - edgeFade) opacity = (1 - t01) / edgeFade
    opacity = Math.max(0, Math.min(1, opacity))

    m.uniforms.uTime.value = state.clock.elapsedTime
    m.uniforms.uOpacity.value = opacity
    m.uniforms.uResolution.value.set(size.width, size.height)
  })

  if (!render) return null

  return (
    <mesh frustumCulled={false} renderOrder={2000}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        transparent
        depthTest={false}
        depthWrite={false}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={{
          uTime: { value: 0 },
          uOpacity: { value: 0 },
          uResolution: { value: new THREE.Vector2(1, 1) },
        }}
      />
    </mesh>
  )
}
