"use client"

// Lightspeed warp corridor — fullscreen overlay used during the rift transition
// between universes. Replaces the previous Kali-fractal shader with a cleaner
// hyperspace-jump effect that's cheap to render (no raymarching, just
// analytical math over 3 angular layers of pseudo-random stars).
//
// Choreography (driven by `active` + `duration`, default 4s):
//   t01 in [0.00, 0.20]: invisible — camera flying into the rift
//   t01 in [0.20, 0.45]: fade IN (smooth, ~1s window)
//   t01 in [0.45, 0.55]: full opacity (universe swap fires at t01 = 0.5)
//   t01 in [0.55, 0.80]: fade OUT (smooth, ~1s window)
//   t01 in [0.80, 1.00]: invisible — camera flying out into new system
//
// See `solar-portfolio.tsx` CameraController for the matching camera
// choreography — they were designed together.

import { useEffect, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import type { ShaderMaterial } from "three"

interface RiftCorridorProps {
  active: boolean
  /** Total transition length (camera + corridor) in seconds. */
  duration?: number
  onMidpoint?: () => void
  onComplete?: () => void
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Lock the quad to the far plane in NDC, regardless of mesh transform.
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec2  uResolution;
  varying vec2 vUv;

  // Cheap pseudo-random hash. Plenty unique for our scattered seeds.
  float hash(float n) {
    return fract(sin(n) * 43758.5453);
  }

  void main() {
    // Centered, aspect-corrected coords (-1..1 vertically).
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uResolution.x / max(uResolution.y, 1.0);

    float r = length(uv);
    float a = atan(uv.y, uv.x);

    vec3 col = vec3(0.0);

    // Three layers of star streaks at different angular densities. Keeps the
    // field from marching in lockstep — feels like a richer warp.
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float density = 36.0 + fi * 28.0;

      // Discretize angle into bins, one star per bin per layer.
      float bin = floor((a + 3.14159) * density / 6.28318);
      float seed = hash(bin * 17.31 + fi * 91.7);

      // Phase: 0 = at center, 1 = past edge. Each star travels a full cycle.
      float phase = fract(uTime * mix(0.55, 1.30, seed) + seed);
      float starR = phase * 2.5;

      // Streak: gaussian peak at the head with falloff.
      float streakLen = 0.18 + fi * 0.04;
      float dr = r - starR;
      float streak = exp(-(dr * dr) / (streakLen * streakLen));

      // Soft fade at start of journey + fade as star leaves the screen.
      streak *= smoothstep(0.0, 0.18, phase);
      streak *= 1.0 - smoothstep(0.82, 1.00, phase);

      // Per-star color: soft blue ↔ magenta.
      float ct = hash(bin * 0.731 + fi);
      vec3 c = mix(
        vec3(0.70, 0.78, 1.10),
        vec3(1.05, 0.55, 1.00),
        ct
      );

      col += c * streak * 0.85;
    }

    // Soft purple radial background — keeps the screen from going black where
    // streaks don't cover.
    vec3 bg = mix(
      vec3(0.04, 0.02, 0.14),
      vec3(0.22, 0.08, 0.38),
      smoothstep(0.0, 1.2, r)
    );
    col += bg * 0.85;

    // Subtle vignette so the corners read as "tunnel walls".
    col *= 1.0 - smoothstep(0.7, 1.4, r);

    // Mild gamma correction.
    col = pow(clamp(col, vec3(0.0), vec3(1.0)), vec3(1.05));

    gl_FragColor = vec4(col, uOpacity);
  }
`

export default function RiftCorridor({
  active,
  duration = 4,
  onMidpoint,
  onComplete,
}: RiftCorridorProps) {
  const matRef = useRef<ShaderMaterial>(null)
  const startRef = useRef<number | null>(null)
  const midpointFiredRef = useRef(false)
  const completeFiredRef = useRef(false)
  const { size } = useThree()
  // Internal mount flag — keeps the mesh alive through the fade-out window
  // even after `active` flips back to false.
  const [render, setRender] = useState(false)

  // Reset timing whenever the rift activates.
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
    if (!m || !render) return

    if (startRef.current === null) {
      startRef.current = state.clock.elapsedTime
    }
    const t01 = Math.min(1, (state.clock.elapsedTime - startRef.current) / duration)

    // Midpoint = swap universes. End = release the transition.
    if (!midpointFiredRef.current && t01 >= 0.5) {
      midpointFiredRef.current = true
      onMidpoint?.()
    }
    if (!completeFiredRef.current && t01 >= 1.0) {
      completeFiredRef.current = true
      onComplete?.()
      setRender(false)
    }

    // Smooth opacity envelope — see the file header for the timeline.
    let opacity = 0
    if (t01 >= 0.20 && t01 < 0.45) opacity = (t01 - 0.20) / 0.25
    else if (t01 >= 0.45 && t01 <= 0.55) opacity = 1
    else if (t01 > 0.55 && t01 <= 0.80) opacity = (0.80 - t01) / 0.25
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
