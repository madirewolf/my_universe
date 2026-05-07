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

  #define iterations 12
  #define formuparam 0.53
  #define volsteps 18
  #define stepsize 0.10
  #define zoom    0.85
  #define tile    0.85
  #define speed   0.32
  #define brightness 0.0019
  #define darkmatter 0.30
  #define distfading 0.73
  #define saturation 0.85

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
    vec3 dir = vec3(uv * zoom, 1.0);

    float ti = uTime * speed + 0.25;
    vec3 origin = vec3(0.0, 3.11, 0.0);
    vec3 from = origin + path(ti);
    vec3 advec = normalize(path(ti + 0.7) - path(ti));
    float an = atan(advec.x, advec.z);
    mat2 r1 = mat2(cos(an), sin(an), -sin(an), cos(an));
    an = advec.y * 1.7;
    mat2 r2 = mat2(cos(an), sin(an), -sin(an), cos(an));
    dir.yz *= r2;
    dir.xz *= r1;
    vec3 fromR = from;
    fromR.xz *= r1;
    fromR.xy *= r2;

    // Volumetric raymarch
    float s = 0.1;
    float fade = 1.0;
    float glow = 0.0;
    vec3 v = vec3(0.0);
    vec2 d = vec2(1.0, 0.0);
    float totdist = 0.0;

    for (int r = 0; r < volsteps; r++) {
      if (d.x > 0.001 && totdist < 3.0) {
        vec3 p = from + totdist * dir;
        d = de(p);
        totdist += d.x;
        if (d.x < 0.015) glow += max(0.0, 0.015 - d.x) * exp(-totdist);
        v += vec3(s, s * s, s * s * s * s) * d.x * brightness * fade;
        fade *= distfading;
        s += stepsize;
      }
    }
    v = mix(vec3(length(v)), v, saturation);
    vec3 col = v * 0.01;
    // Pink/violet glow tint to match the rift palette
    col += glow * vec3(1.05, 0.55, 1.20) * 0.45;
    col = pow(clamp(col, vec3(0.0), vec3(1.0)), vec3(1.25)) * 1.05;

    // Subtle vignette so the shader feels like a tunnel
    float r2v = dot(uv, uv);
    col *= 1.0 - clamp(r2v * 0.55, 0.0, 1.0);

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
