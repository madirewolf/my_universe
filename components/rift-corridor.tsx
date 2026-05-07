"use client"

// Lightspeed warp corridor — fullscreen overlay used during the rift transition
// between universes. Replaces the previous Kali-fractal shader with a cleaner
// hyperspace-jump effect that's cheap to render (no raymarching, just
// analytical math over 3 angular layers of pseudo-random stars).
//
// Choreography (driven by `active` + `duration`, default 4s):
//   t01 in [0.00, 0.40]: invisible — camera dollying IN to the rift core
//   t01 in [0.40, 0.46]: fade IN (camera held at rift)
//   t01 in [0.46, 0.54]: full opacity (universe swap fires at t01 = 0.5)
//   t01 in [0.54, 0.85]: LONG fade OUT — crossfades with the camera's
//                        Phase C pull-out (starts at 0.55) so the warp
//                        tunnel dissolves into the new universe's rift
//                        mesh as the camera retreats. User emerges
//                        through the rift instead of teleporting away.
//   t01 in [0.85, 1.00]: invisible — camera continues to overhead
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

      // Phase: 0 = at center, 1 = past edge. Streaks cycle FAST so the
      // screen never feels frozen even at peak opacity.
      float phase = fract(uTime * mix(4.0, 7.0, seed) + seed);
      // Travel past the screen corners (16:9 corner ≈ r=2.04) so streaks
      // exit the frame instead of pinging back.
      float starR = phase * 2.8;

      // Comet-shape streak: gaussian head + long exponential tail BEHIND.
      // Faster speed + the tail combine into a clear hyperspace blur.
      float streakLen = 0.24 + fi * 0.06;
      float dr = r - starR;
      float head = exp(-(dr * dr) / (streakLen * streakLen));
      float tail = (dr < 0.0) ? exp(dr / (streakLen * 3.0)) : 0.0;
      float streak = head + tail * 0.6;

      // Soft fade at start of journey + fade as star leaves the screen.
      streak *= smoothstep(0.0, 0.10, phase);
      streak *= 1.0 - smoothstep(0.90, 1.00, phase);

      // Per-star color: soft blue ↔ magenta.
      float ct = hash(bin * 0.731 + fi);
      vec3 c = mix(
        vec3(0.70, 0.78, 1.10),
        vec3(1.05, 0.55, 1.00),
        ct
      );

      col += c * streak * 0.55;
    }

    // Soft purple radial background — fills the screen edges (and 16:9
    // corners at r≈2.04) so nothing reads as black. Pulses slightly with
    // uTime + a faint outward ripple so the field always reads alive
    // even when individual streaks are off-axis.
    vec3 bg = mix(
      vec3(0.07, 0.03, 0.18),
      vec3(0.32, 0.12, 0.44),
      smoothstep(0.0, 1.6, r)
    );
    float pulse = 0.85 + 0.18 * sin(uTime * 5.0);
    float ripple = 0.5 + 0.5 * sin(r * 6.0 - uTime * 7.0);
    bg *= pulse;
    bg += vec3(0.05, 0.02, 0.08) * ripple * (1.0 - smoothstep(0.4, 1.6, r));
    col += bg;

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
    // Long fade-out (0.54-0.85) overlaps with the camera's Phase C
    // pull-out (starts at 0.55), so the warp tunnel slowly dissolves
    // into the new universe's rift view instead of popping off.
    let opacity = 0
    if (t01 >= 0.40 && t01 < 0.46) opacity = (t01 - 0.40) / 0.06
    else if (t01 >= 0.46 && t01 <= 0.54) opacity = 1
    else if (t01 > 0.54 && t01 <= 0.85) opacity = (0.85 - t01) / 0.31
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
