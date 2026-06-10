"use client"

// Lightspeed warp overlay for the rift transition — pure DOM + CSS.
//
// WHY DOM AND NOT WEBGL (the old rift-corridor.tsx): every freeze the
// transition ever had came from the main/WebGL thread stalling at the
// universe swap — shader compile/link on first draw, React committing the
// swapped scene tree, buffer uploads. The old corridor was drawn by that
// same thread, so the warp streaks visibly froze mid-flight, on every
// device. This overlay only animates `transform` and `opacity` on
// composited layers, which browsers run on the COMPOSITOR thread — the
// loop keeps spinning even while the main thread is completely blocked.
//
// The streak field is built from staggered infinite keyframe loops, so
// 'peak' can hold for any duration (waiting on the shader compile gate)
// and the warp stays seamless — there is no timeline to run out of.
//
// STAGES (state machine lives in CameraController, solar-portfolio.tsx —
// this component just receives the current stage as a prop):
//   'in'   (2.5s): camera rotates then zooms to the rift. Overlay fades
//                  in over the last COVER_FADE seconds via a CSS
//                  transition-delay of COVER_DELAY, so it's fully opaque
//                  just BEFORE the universe swap fires at IN_DURATION.
//   'peak' (var):  overlay opaque, loop spinning. Universe swap + shader
//                  compiles happen safely hidden behind it.
//   'out'  (1.8s): overlay fades out over OUT_FADE seconds while the
//                  camera pulls back, revealing the new universe.

import type { CSSProperties } from "react"

export type RiftStage = "idle" | "in" | "peak" | "out"

export interface RiftCinematicState {
  stage: RiftStage
  /** state.clock.elapsedTime when the current stage started; -1 = uninitialized. */
  stageStart: number
  /** Flipped true by RiftCompileGate once the new universe's shaders are compiled. */
  ready: boolean
}

/** Stage timing — single source of truth, shared with CameraController. */
export const RIFT_TIMING = {
  IN_ROTATE_DURATION: 0.9,
  IN_ZOOM_DURATION: 1.6,
  IN_DURATION: 2.5,           // = IN_ROTATE + IN_ZOOM
  OUT_DURATION: 1.8,
  PEAK_MIN_DURATION: 0.5,     // floor on peak hold even if shaders are warm
  // Overlay opacity choreography (all CSS-side):
  COVER_DELAY: 1.85,          // seconds into 'in' before the cover starts fading in
  COVER_FADE: 0.5,            // fade-in duration — fully opaque at 2.35s < swap at 2.5s
  OUT_FADE: 1.4,              // fade-out duration within the 1.8s 'out' stage
} as const

// ─── Streak layers ──────────────────────────────────────────────────────────
// Each layer = thin radial rays (repeating-conic-gradient) masked down to a
// comet-tailed annulus (radial-gradient mask), scaled outward on an infinite
// loop. Staggered negative delays keep streaks in flight at every moment.
// `gap` must divide 360 evenly or the conic pattern seams at 0°.

interface StreakSpec {
  from: number   // conic start angle (deg) — de-phases ray positions per layer
  gap: number    // angular period between rays (deg)
  w: number      // ray width (deg)
  dur: number    // seconds per center→edge flight
  delay: number  // negative = already mid-flight at activation
  color: string
}

const STREAKS: StreakSpec[] = [
  { from: 0,  gap: 10, w: 1.0, dur: 1.0, delay: 0,     color: "rgba(175,196,255,0.95)" },
  { from: 23, gap: 12, w: 1.3, dur: 1.0, delay: -0.25, color: "rgba(255,152,236,0.85)" },
  { from: 47, gap: 9,  w: 0.9, dur: 1.0, delay: -0.5,  color: "rgba(205,218,255,0.9)" },
  { from: 71, gap: 15, w: 1.2, dur: 1.0, delay: -0.75, color: "rgba(255,172,246,0.8)" },
  // Slower, fatter, dimmer set behind the fast ones — parallax depth.
  { from: 55, gap: 18, w: 2.6, dur: 1.6, delay: -0.65, color: "rgba(150,166,255,0.5)" },
]

// Layers raster at this size and GPU-scale up to 6× — the late-flight blur
// reads as motion blur, and the small raster keeps texture memory sane on
// phones (each promoted layer costs width² × DPR² × 4 bytes).
const LAYER_SIZE = "44vmax"

// Annulus mask: long soft inner ramp = comet tail (trails toward center,
// since motion is outward), sharp outer edge = comet head.
const RING_MASK =
  "radial-gradient(circle closest-side, transparent 22%, rgba(0,0,0,0.35) 34%, rgba(0,0,0,1) 43%, transparent 49%)"

const KEYFRAMES = `
@keyframes rift-warp-fly {
  0%   { transform: translate(-50%, -50%) scale(0.25); opacity: 0; }
  12%  { opacity: 1; }
  78%  { opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(6); opacity: 0; }
}
@keyframes rift-warp-pulse {
  from { transform: translate(-50%, -50%) scale(1);    opacity: 0.7; }
  to   { transform: translate(-50%, -50%) scale(1.16); opacity: 1; }
}
`

const centered: CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "50%",
  width: LAYER_SIZE,
  height: LAYER_SIZE,
  willChange: "transform, opacity",
}

export default function RiftWarpOverlay({ stage }: { stage: RiftStage }) {
  const running = stage !== "idle"
  const playState = running ? ("running" as const) : ("paused" as const)

  // Container opacity per stage. The element stays mounted (and its layers
  // pre-rastered) at all times so activation never pays a paint cost.
  const container: CSSProperties = {
    position: "absolute",
    inset: 0,
    zIndex: 150,
    overflow: "hidden",
    // Swallow clicks mid-cinematic so nothing underneath gets selected.
    pointerEvents: running ? "auto" : "none",
    opacity: stage === "in" || stage === "peak" ? 1 : 0,
    transition:
      stage === "in"
        ? `opacity ${RIFT_TIMING.COVER_FADE}s linear ${RIFT_TIMING.COVER_DELAY}s`
        : stage === "peak"
          ? "opacity 0.15s linear"
          : stage === "out"
            ? `opacity ${RIFT_TIMING.OUT_FADE}s ease-out`
            : "opacity 0.2s linear",
  }

  return (
    <div style={container} aria-hidden>
      <style>{KEYFRAMES}</style>

      {/* Opaque base — must fully hide the scene swap behind it. Matches the
          old corridor's palette: dark violet core, brighter purple edges. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 50%, #140833 0%, #1c0b45 38%, #381660 72%, #200d3f 100%)",
        }}
      />

      {/* Slow ambient ripple rings expanding behind the streaks */}
      {[0, -1.2].map((delay) => (
        <div
          key={`ripple${delay}`}
          style={{
            ...centered,
            background:
              "radial-gradient(circle closest-side, transparent 30%, rgba(120,60,200,0.28) 42%, transparent 52%)",
            animation: "rift-warp-fly 2.4s linear infinite",
            animationDelay: `${delay}s`,
            animationPlayState: playState,
          }}
        />
      ))}

      {/* Star streak layers */}
      {STREAKS.map((s, i) => (
        <div
          key={i}
          style={{
            ...centered,
            background: `repeating-conic-gradient(from ${s.from}deg, transparent 0deg, transparent ${s.gap - s.w}deg, ${s.color} ${s.gap - s.w / 2}deg, transparent ${s.gap}deg)`,
            WebkitMaskImage: RING_MASK,
            maskImage: RING_MASK,
            animation: `rift-warp-fly ${s.dur}s linear infinite`,
            animationDelay: `${s.delay}s`,
            animationPlayState: playState,
          }}
        />
      ))}

      {/* Pulsing core glow — the vanishing point. Also hides the streak
          spawn-in region at the center. */}
      <div
        style={{
          ...centered,
          width: "46vmax",
          height: "46vmax",
          background:
            "radial-gradient(circle closest-side, rgba(250,240,255,0.9) 0%, rgba(200,150,255,0.5) 22%, rgba(120,60,200,0.16) 50%, transparent 68%)",
          animation: "rift-warp-pulse 1.1s ease-in-out infinite alternate",
          animationPlayState: playState,
        }}
      />

      {/* Static vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 50%, transparent 45%, rgba(8,3,20,0.55) 100%)",
        }}
      />
    </div>
  )
}
