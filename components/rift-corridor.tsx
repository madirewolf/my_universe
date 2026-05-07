"use client"

// Lightspeed warp corridor — fullscreen overlay used during the rift transition
// between universes. Cheap radial-streak shader (no raymarching, just
// analytical math over 3 angular layers of pseudo-random stars).
//
// STAGE-BASED CHOREOGRAPHY (in/peak/out):
//   stage 'in'   (2.5s fixed): camera ROTATES toward rift first (0.9s
//                              hold-and-pan) then ZOOMS to it (1.6s
//                              dolly). Corridor invisible until the
//                              last 0.7s of the stage, then ramps to 1.
//   stage 'peak' (variable):   camera held at rift, corridor at full
//                              opacity. Universe swap fires on entry.
//                              Holds until riftState.ready flips true,
//                              which happens when WebGLRenderer
//                              .compileAsync resolves (i.e. all new
//                              universe shaders are actually compiled).
//                              Min floor = 0.5s.
//   stage 'out'  (1.8s fixed): camera dollies out, corridor fades out
//                              over the first 1.5s. Crossfades into the
//                              new universe's rift mesh.
//
// CameraController (solar-portfolio.tsx) owns the state machine and
// transitions the stages; this corridor just reads riftState.current
// and renders the matching opacity. They share one ref.

import { useEffect, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import type { ShaderMaterial } from "three"
import type { MutableRefObject } from "react"

export type RiftStage = "idle" | "in" | "peak" | "out"

export interface RiftCinematicState {
  stage: RiftStage
  /** state.clock.elapsedTime when the current stage started; -1 = uninitialized. */
  stageStart: number
  /** Set true ~800ms after universe swap so 'peak' can transition to 'out'. */
  ready: boolean
}

/**
 * Stage timing — single source of truth, shared with CameraController.
 *
 * The 'in' stage is internally split into two sub-phases by the camera:
 *   • ROTATE (0..IN_ROTATE_DURATION):   camera holds at its start position,
 *                                       gaze pans smoothly origin → rift.
 *   • ZOOM   (IN_ROTATE_DURATION..IN_DURATION):
 *                                       camera dollies start → nearRift,
 *                                       gaze locked on the rift.
 *
 * Doing them sequentially (rather than concurrent like before) guarantees
 * the camera is centered on the rift before it starts moving toward it —
 * the user sees a deliberate "look at it, then go" beat.
 */
export const RIFT_TIMING = {
  IN_ROTATE_DURATION: 0.9,
  IN_ZOOM_DURATION: 1.6,
  IN_DURATION: 2.5,           // = IN_ROTATE + IN_ZOOM
  OUT_DURATION: 1.8,
  PEAK_MIN_DURATION: 0.5,     // floor on peak hold even if shaders are warm
  // Corridor opacity ramps within each stage:
  IN_FADE_START: 1.8,         // corridor begins materializing during zoom
  IN_FADE_END: 2.5,           // fully opaque exactly when camera reaches rift
  OUT_FADE_DURATION: 1.5,     // fade out over first 1.5s of 'out' stage
} as const

interface RiftCorridorProps {
  active: boolean
  riftState: MutableRefObject<RiftCinematicState>
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

export default function RiftCorridor({ active, riftState }: RiftCorridorProps) {
  const matRef = useRef<ShaderMaterial>(null)
  const { size } = useThree()
  // Mount/unmount the mesh based on `active`. Brief delay on unmount lets
  // the final fade-out frames render before the mesh disappears.
  const [render, setRender] = useState(false)

  useEffect(() => {
    if (active) {
      setRender(true)
    } else {
      const id = setTimeout(() => setRender(false), 60)
      return () => clearTimeout(id)
    }
  }, [active])

  useFrame((state) => {
    const m = matRef.current
    if (!m || !render) return
    const sr = riftState.current

    let opacity = 0
    if (sr.stage !== "idle" && sr.stageStart >= 0) {
      const t = state.clock.elapsedTime - sr.stageStart

      if (sr.stage === "in") {
        // Fade in during the last (IN_FADE_END - IN_FADE_START) seconds.
        if (t >= RIFT_TIMING.IN_FADE_START) {
          opacity = Math.min(
            (t - RIFT_TIMING.IN_FADE_START) /
              (RIFT_TIMING.IN_FADE_END - RIFT_TIMING.IN_FADE_START),
            1,
          )
        }
      } else if (sr.stage === "peak") {
        opacity = 1
      } else if (sr.stage === "out") {
        opacity = Math.max(1 - t / RIFT_TIMING.OUT_FADE_DURATION, 0)
      }
    }

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
