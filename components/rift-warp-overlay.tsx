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
// SEAMLESSNESS: the overlay's base is a bright radial "core" gradient that
// matches what the rift core looks like when it engulfs the camera. The
// cover therefore fades in over an almost identical frame (camera diving
// into the source rift) and fades out over an almost identical frame
// (camera pinned inside the DESTINATION rift) — both handoffs read as one
// continuous shot. The base crossfades source → destination palette at the
// universe swap, hidden behind the streaks.
//
// STAGES (state machine lives in CameraController, solar-portfolio.tsx —
// this component just receives the current stage + universe as props):
//   'in'   (2.5s): camera rotates then zooms into the rift. Overlay fades
//                  in over the last COVER_FADE seconds via a CSS
//                  transition-delay of COVER_DELAY, fully opaque just
//                  BEFORE the universe swap fires at IN_DURATION.
//   'peak' (var):  overlay opaque, streak loop spinning. Universe swap +
//                  shader compiles happen safely hidden behind it. The
//                  core-colored base crossfades to the destination palette
//                  (the `universe` prop flips at the swap).
//   'out'  (7s):   three beats —
//                  0 .. STREAK_FADE      streaks/glow fade, leaving only
//                                        the flat destination core color;
//                                        camera already pinned INSIDE the
//                                        new universe's rift core.
//                  OUT_HOLD .. +OUT_REVEAL
//                                        the color itself fades, revealing
//                                        the real rift core engulfing the
//                                        screen — same color, no seam.
//                  OUT_HOLD .. OUT_DURATION
//                                        camera pulls out sloooowly from
//                                        inside the rift to the overhead
//                                        view, gaze easing onto the sun.

import type { CSSProperties } from "react"
import type { Universe } from "@/lib/constants"

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
  PEAK_MIN_DURATION: 0.5,     // floor on peak hold even if shaders are warm
  // Overlay opacity choreography (all CSS-side):
  COVER_DELAY: 1.85,          // seconds into 'in' before the cover starts fading in
  COVER_FADE: 0.5,            // fade-in duration — fully opaque at 2.35s < swap at 2.5s
  // 'out' choreography:
  STREAK_FADE: 1.05,          // streaks/glow wind down, leaving the flat core color
  OUT_HOLD: 1.15,             // camera pinned inside the new rift core until here
  OUT_REVEAL: 0.7,            // core color fades, revealing the real engulfed rift
  OUT_DURATION: 7.0,          // total — slow pull-out ends overhead, centered on sun
} as const

// ─── Core-colored base ──────────────────────────────────────────────────────
// Bright center → rift halo → deep space at the corners. Tuned to read like
// the camera sitting inside each universe's rift core (rift.tsx palettes:
// professional = violet/pink #a050ff/#ff80d0/#ffa0e8, personal =
// blue/cyan #3070ff/#00e0ff/#a0e8ff). Both layers stay mounted; the active
// one (the CURRENT `universe` prop, which flips at the swap) sits at
// opacity 1 so the swap reads as a slow tint shift behind the streaks.

const CORE_BG: Record<Universe, string> = {
  professional:
    "radial-gradient(circle at 50% 50%, #f0fffc 0%, #b2f5ea 16%, #80deea 32%, #26a69a 52%, #00695c 76%, #012420 100%)",
  personal:
    "radial-gradient(circle at 50% 50%, #f2fdff 0%, #c2f0ff 16%, #93e2ff 32%, #4aa8fb 52%, #1d4fae 76%, #071238 100%)",
}

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

export default function RiftWarpOverlay({
  stage,
  universe,
}: {
  stage: RiftStage
  universe: Universe
}) {
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
            ? // Hold the flat core color until OUT_HOLD (streaks finish
              // winding down), then fade to the real rift core behind it.
              `opacity ${RIFT_TIMING.OUT_REVEAL}s linear ${RIFT_TIMING.OUT_HOLD}s`
            : "opacity 0.2s linear",
  }

  // Everything animated (ripples, streaks, core glow, vignette) lives in
  // this wrapper so the 'out' stage can wind it down as one unit, leaving
  // only the flat core-colored base on screen.
  const fx: CSSProperties = {
    position: "absolute",
    inset: 0,
    opacity: stage === "out" ? 0 : 1,
    transition:
      stage === "out"
        ? `opacity ${RIFT_TIMING.STREAK_FADE}s ease-out`
        : "opacity 0.3s linear",
  }

  return (
    <div style={container} aria-hidden>
      <style>{KEYFRAMES}</style>

      {/* Core-colored base — both palettes mounted, crossfaded by the
          `universe` prop (flips at the swap, hidden behind the streaks).
          Opaque: this is what fully hides the scene swap. */}
      {(["professional", "personal"] as Universe[]).map((u) => (
        <div
          key={u}
          style={{
            position: "absolute",
            inset: 0,
            background: CORE_BG[u],
            opacity: universe === u ? 1 : 0,
            transition: "opacity 1.2s linear",
          }}
        />
      ))}

      <div style={fx}>
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

        {/* Vignette — keeps the streaks readable against the bright base */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 50% 50%, transparent 45%, rgba(8,3,20,0.45) 100%)",
          }}
        />
      </div>
    </div>
  )
}
