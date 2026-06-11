"use client"

import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react"
import * as THREE from "three"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import { LIGHTING, UNIVERSE_CONFIG, type Landmark, type PlanetEntry, type Universe } from "@/lib/constants"
import SolarSystem from "./solar-system"
import StarField from "./star-field"
import StarNest from "./star-nest"
import Background from "./background"
import Nebula from "./nebula"
import SpaceAmbience from "./space-ambience"
import CosmicDust from "./cosmic-dust"
import Rift from "./rift"
import RiftWarpOverlay, {
  RIFT_TIMING,
  type RiftCinematicState,
  type RiftStage,
} from "./rift-warp-overlay"
import MoonView from "./moon-view"
import UIOverlay from "./ui-overlay"

type Mode = "system" | "planet" | "moon"
const MOBILE_QUERY = "(max-width: 768px)"

// Easing helpers for the rift cinematic.
//   easeInCubic    → Phase A: accelerating dolly-IN (slow start, fast end)
//   easeInOutCubic → Phase C: smooth, lingering dolly-OUT (slow at both ends)
function easeInCubic(t: number): number {
  return t * t * t
}
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
// Decelerating ease — starts with velocity, brakes into the end. Used for
// the post-cut arrival so the motion feels continuous through the cut.
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

const RIFT_WORLD_POS = new THREE.Vector3(0, 16, -75)
const RIFT_OVERHEAD = new THREE.Vector3(0, 52, 0)
const ORIGIN = new THREE.Vector3(0, 0, 0)
// How close the camera gets to the rift core at the midpoint of the cinematic.
// Very close — the corridor at full opacity hides whatever the camera sees
// from inside the core's icosahedron (radius 1.2). User wanted the camera
// to get genuinely "right up to" the rift before the corridor takes over.
const RIFT_NEAR_DIST = 0.4
// Reused scratch Vector3 for the lookAt lerp — avoids per-frame allocations.
const _lookAt = new THREE.Vector3()

// Where the camera settles in each mode. Shared by the isTransitioning lerp
// (deep links) and the mode-cut arrival glide.
const SETTLE_POS = {
  system: () => new THREE.Vector3(0, 52, 0),
  // Detail views deliberately settle further out than they used to — the
  // user wanted the closest zoom point "less close".
  planet: (isMobile: boolean) => new THREE.Vector3(0, 0, isMobile ? 21 : 15),
  moon: (isMobile: boolean) => new THREE.Vector3(0, isMobile ? 21 : 12, 0.5),
}

function planetFocusSettle(target: THREE.Vector3, isMobile: boolean): THREE.Vector3 {
  return target.clone().add(new THREE.Vector3(0, isMobile ? 5.5 : 3.8, isMobile ? 13 : 9.5))
}

// ── Mode-cut transitions (system↔planet↔moon) ───────────────────────────────
// Pure camera moves, no overlay (the rift keeps its warp; these stay simple).
//
// Big→small: pan/recenter onto the clicked object, then dive until it FILLS
// the frame. The scene swap happens behind the object itself — a match cut:
// "planet filling the frame" cuts to "detail planet filling the frame" —
// then the camera eases back out to the settle distance. The camera tracks
// the object live while it orbits, so the pan stays centered.
//
// Small→big: one continuous slow zoom-out. Pull back until the scene's
// center object is small, cut, arrive already moving outward, and glide the
// rest of the way to the settle position. The persistent star/nebula
// background carries the cut.
const MODE_CUT = {
  DIVE_OUT: 1.05, // dive toward the clicked object
  DIVE_IN: 1.35, // post-cut ease back out to settle
  ZOOM_OUT: 1.35, // pull back from the small scene
  ZOOM_IN: 1.5, // post-cut glide out to settle
  /** Cut distance = FILL_FACTOR × object radius → object just fills the frame. */
  FILL_FACTOR: 1.9,
  /** Safety: never hold the cut longer than this many frames. */
  MAX_HOLD_FRAMES: 30,
} as const

// Object radii used to compute match-cut distances.
const MOON_CRYSTAL_RADIUS = 1.55 // MoonView's central data crystal
const MOON_ORBIT_RADIUS = 0.36 // crystal moons orbiting a detail planet
const CAMERA_FLIGHT = {
  SYSTEM: 1.45,
  PLANET: 1.65,
  MOON: 1.35,
} as const

type CameraControlsRef = OrbitControlsImpl

interface ModeCutState {
  phase: "idle" | "out" | "cut" | "in"
  /** clock time the current phase started; -1 = lazy init on next frame. */
  start: number
  /** 'out': captured camera position. 'in': post-cut arrival position. */
  fromPos: THREE.Vector3
  /** Dive/zoom anchor. Re-read from targetObj each frame while it orbits. */
  targetPos: THREE.Vector3
  targetObj: THREE.Object3D | null
  /** Camera-to-anchor distance at the cut. */
  cutDist: number
  /** Camera-to-origin distance right after the cut. */
  arriveDist: number
  fromLookAt: THREE.Vector3
  lookAtPos: THREE.Vector3
  settlePos: THREE.Vector3
  /** Mode we're heading to — the cut releases once this mode is mounted. */
  destMode: Mode
  /** Frames spent holding at the cut (lets React mount the new scene). */
  holdFrames: number
  outDur: number
  inDur: number
  commit: (() => void) | null
}

interface CameraFlightState {
  key: string
  start: number
  fromPos: THREE.Vector3
  fromLookAt: THREE.Vector3
}

// Scratch vectors — avoid per-frame allocations.
const _approach = new THREE.Vector3()
const _dir = new THREE.Vector3()

function syncCameraLookAt(
  camera: THREE.Camera,
  controls: CameraControlsRef | null,
  lookAt: THREE.Vector3,
) {
  if (controls) {
    controls.target.copy(lookAt)
  }
  camera.lookAt(lookAt)
  // NO controls.update() here. update() enforces min/max-distance and polar
  // clamps, and mid-transition the camera is legitimately outside the
  // destination mode's clamps (e.g. 52 away when planet mode allows 22) —
  // calling it snapped the camera to the clamp while the flight lerp pulled
  // it back, which read as a glitchy jitter at the start of every
  // transition. Controls stay disabled during scripted moves; the idle
  // branch does one clean update() at handoff.
}

function landmarkKey(landmark: Landmark): string {
  return `${landmark.name}::${landmark.category}`
}

function findLandmarkIndex(landmarks: Landmark[], landmark: Landmark | null): number {
  if (!landmark) return -1
  const direct = landmarks.indexOf(landmark)
  if (direct >= 0) return direct

  const key = landmarkKey(landmark)
  return landmarks.findIndex((candidate) => landmarkKey(candidate) === key)
}

function initialPlanetPosition(planet: PlanetEntry): THREE.Vector3 {
  const position = new THREE.Vector3(planet.distance, 0, 0)
  position.applyAxisAngle(new THREE.Vector3(0, 1, 0), planet.phase ?? 0)
  position.applyAxisAngle(new THREE.Vector3(1, 0, 0), planet.tilt ?? 0)
  return position
}

function CameraController({
  mode,
  isMobile,
  focusTarget,
  controlsRef,
  isTransitioning,
  setIsTransitioning,
  riftState,
  modeWarp,
  onSwapUniverse,
  onStageOut,
  onCinematicComplete,
}: {
  mode: Mode
  isMobile: boolean
  focusTarget: THREE.Vector3 | null
  controlsRef: MutableRefObject<CameraControlsRef | null>
  isTransitioning: boolean
  setIsTransitioning: (v: boolean) => void
  riftState: MutableRefObject<RiftCinematicState>
  modeWarp: MutableRefObject<ModeCutState>
  onSwapUniverse: () => void
  onStageOut: () => void
  onCinematicComplete: () => void
}) {
  const { camera } = useThree()
  const target = useRef(new THREE.Vector3(0, 25, 0))
  const lookTarget = useRef(new THREE.Vector3(0, 0, 0))
  const flight = useRef<CameraFlightState>({
    key: "",
    start: -1,
    fromPos: new THREE.Vector3(),
    fromLookAt: new THREE.Vector3(),
  })
  // Captured camera position when stage 'in' starts, AND nearRift snapshot
  // when stage 'out' starts. Reused for the lerp source.
  const stageStartPos = useRef<THREE.Vector3 | null>(null)

  useFrame((state) => {
    const sr = riftState.current
    const mw = modeWarp.current
    const controls = controlsRef.current
    if (controls) {
      controls.enabled = sr.stage === "idle" && mw.phase === "idle" && !isTransitioning
    }

    // ── Rift cinematic takes priority ─────────────────────────────────────
    // Stage machine driven by riftState.current (timing constants live in
    // rift-warp-overlay.tsx). The warp visual itself is a DOM overlay with
    // compositor-driven CSS animations — it keeps looping even if this
    // thread stalls (shader compile at the swap), so it can never freeze.
    //   • 'in'   (2.5s): two sub-phases, sequenced.
    //       ROTATE (0.0-0.9s): camera holds at start, gaze smoothly pans
    //                          ORIGIN → RIFT_WORLD_POS. Overlay invisible.
    //                          You see the camera deliberately swing onto
    //                          the rift before any motion.
    //       ZOOM   (0.9-2.5s): camera accelerates toward nearRift along
    //                          the line through the rift, gaze locked on
    //                          the rift. Overlay fades in over the last
    //                          ~0.5s of zoom (CSS transition-delay —
    //                          RIFT_TIMING.COVER_DELAY / COVER_FADE).
    //   • 'peak' (var):    camera held at rift, overlay at full opacity.
    //                      Universe swap fires when entering this stage.
    //                      Holds until riftState.ready flips true — set
    //                      by RiftCompileGate after gl.compileAsync
    //                      resolves (i.e. the new universe's shaders are
    //                      actually compiled). Min floor = 0.5s.
    //   • 'out'  (7s):     three beats —
    //                      0..OUT_HOLD: camera PINNED inside the new
    //                        universe's rift core (it engulfs the screen)
    //                        while the overlay's streaks wind down to the
    //                        flat core color; the color then fades over
    //                        the matching real core — invisible handoff.
    //                      OUT_HOLD..OUT_DURATION: glacial easeInOut pull
    //                        from inside the rift up to the overhead view,
    //                        gaze lerping rift → sun. Ends centered on the
    //                        new universe's sun.
    if (sr.stage !== "idle") {
      if (sr.stageStart < 0) {
        sr.stageStart = state.clock.elapsedTime
        if (sr.stage === "in") {
          stageStartPos.current = camera.position.clone()
        }
      }
      const t = state.clock.elapsedTime - sr.stageStart

      // nearRift = RIFT_NEAR_DIST units in front of the rift core.
      const riftDir = RIFT_WORLD_POS.clone().normalize()
      const nearRift = RIFT_WORLD_POS.clone().sub(
        riftDir.multiplyScalar(RIFT_NEAR_DIST),
      )

      if (sr.stage === "in") {
        if (t < RIFT_TIMING.IN_ROTATE_DURATION) {
          // ROTATE sub-phase: camera holds at its start position; gaze
          // pans smoothly from origin (sun) onto the rift.
          const k = easeInOutCubic(t / RIFT_TIMING.IN_ROTATE_DURATION)
          camera.position.copy(stageStartPos.current!)
          _lookAt.lerpVectors(ORIGIN, RIFT_WORLD_POS, k)
          syncCameraLookAt(camera, controls, _lookAt)
        } else if (t < RIFT_TIMING.IN_DURATION) {
          // ZOOM sub-phase: camera dollies start → nearRift, gaze locked
          // on the rift the whole time. Accelerating ease-in feels like
          // "spooling up to lightspeed" once we've committed to the dive.
          const localT =
            (t - RIFT_TIMING.IN_ROTATE_DURATION) / RIFT_TIMING.IN_ZOOM_DURATION
          const k = easeInCubic(Math.min(localT, 1))
          camera.position.lerpVectors(stageStartPos.current!, nearRift, k)
          syncCameraLookAt(camera, controls, RIFT_WORLD_POS)
        } else {
          // 'in' → 'peak'. Fire the universe swap (the warp overlay is at
          // full opacity now, so it hides the actual mesh-tree swap).
          sr.stage = "peak"
          sr.stageStart = state.clock.elapsedTime
          onSwapUniverse()
        }
      } else if (sr.stage === "peak") {
        camera.position.copy(nearRift)
        syncCameraLookAt(camera, controls, RIFT_WORLD_POS)

        if (sr.ready && t >= RIFT_TIMING.PEAK_MIN_DURATION) {
          // 'peak' → 'out'. New universe shaders are compiled; release.
          sr.stage = "out"
          sr.stageStart = state.clock.elapsedTime
          stageStartPos.current = nearRift.clone()
          onStageOut()
        }
      } else if (sr.stage === "out") {
        if (t < RIFT_TIMING.OUT_HOLD) {
          // ENGULF: pinned inside the new universe's rift core while the
          // overlay winds down to the flat core color. The core IS the
          // screen and matches the overlay base, so the reveal is seamless.
          camera.position.copy(nearRift)
          syncCameraLookAt(camera, controls, RIFT_WORLD_POS)
        } else {
          // Slow pull-out: easeInOutCubic starts at ~zero velocity, so the
          // rift still engulfs the screen through the color-fade reveal,
          // then the camera glides up to overhead, gaze easing rift → sun.
          const k = easeInOutCubic(
            Math.min(
              (t - RIFT_TIMING.OUT_HOLD) /
                (RIFT_TIMING.OUT_DURATION - RIFT_TIMING.OUT_HOLD),
              1,
            ),
          )
          camera.position.lerpVectors(stageStartPos.current!, RIFT_OVERHEAD, k)
          _lookAt.lerpVectors(RIFT_WORLD_POS, ORIGIN, k)
          syncCameraLookAt(camera, controls, _lookAt)
        }

        if (t >= RIFT_TIMING.OUT_DURATION) {
          sr.stage = "idle"
          sr.stageStart = -1
          stageStartPos.current = null
          onCinematicComplete()
        }
      }
      return
    }

    // ── Mode-cut transitions (system↔planet↔moon) ─────────────────────────
    // See the MODE_CUT block above for the full choreography.
    if (mw.phase !== "idle") {
      if (mw.start < 0) {
        mw.start = state.clock.elapsedTime
        if (mw.phase === "out") mw.fromPos.copy(camera.position)
      }
      const t = state.clock.elapsedTime - mw.start

      if (mw.phase === "out") {
        // Track the live object — planets/moons keep orbiting while we move.
        if (mw.targetObj) mw.targetObj.getWorldPosition(mw.targetPos)
        _dir.copy(mw.fromPos).sub(mw.targetPos)
        if (_dir.lengthSq() < 1e-6) _dir.set(0, 0, 1)
        _dir.normalize()
        _approach.copy(mw.targetPos).addScaledVector(_dir, mw.cutDist)

        const k = easeInOutCubic(Math.min(t / mw.outDur, 1))
        camera.position.lerpVectors(mw.fromPos, _approach, k)
        // Recenter from the actual current anchor. In planet mode this is
        // the focused planet, not the origin.
        _lookAt.lerpVectors(mw.fromLookAt, mw.targetPos, Math.min(k * 1.35, 1))
        syncCameraLookAt(camera, controls, _lookAt)

        if (t >= mw.outDur) {
          // Swap the scene behind the object (big→small: it fills the
          // frame; small→big: everything is tiny). Camera HOLDS here until
          // the destination mode is actually mounted, so the new scene's
          // first visible frame already has the camera at its arrival
          // position — no flash of a half-set-up view.
          mw.commit?.()
          mw.commit = null
          mw.targetObj = null
          mw.phase = "cut"
          mw.holdFrames = 0
          mw.fromPos.copy(camera.position)
        }
      } else if (mw.phase === "cut") {
        camera.position.copy(mw.fromPos)
        syncCameraLookAt(camera, controls, mw.targetPos)
        mw.holdFrames += 1

        if (
          (mode === mw.destMode && mw.holdFrames >= 1) ||
          mw.holdFrames > MODE_CUT.MAX_HOLD_FRAMES
        ) {
          mw.phase = "in"
          mw.start = state.clock.elapsedTime
          // Orientation-continuous arrival: keep the camera's direction
          // RELATIVE to the old anchor, re-applied around the new anchor.
          // Diving into a moon from the side cuts to the data crystal seen
          // from the same side; zooming out above the moon scene cuts to
          // hovering above the planet. The gaze direction never jumps.
          _dir.copy(mw.fromPos).sub(mw.targetPos)
          if (_dir.lengthSq() < 1e-6) _dir.copy(mw.settlePos).sub(mw.lookAtPos)
          if (_dir.lengthSq() < 1e-6) _dir.set(0, 0, 1)
          _dir.normalize()
          // Never arrive from below — the moon scene has a terrain disc at
          // y≈-2.5 the camera shouldn't start under.
          _dir.y = Math.max(_dir.y, 0.05)
          _dir.normalize()
          mw.fromPos.copy(mw.lookAtPos).addScaledVector(_dir, mw.arriveDist)
          camera.position.copy(mw.fromPos)
          syncCameraLookAt(camera, controls, mw.lookAtPos)
        }
      } else {
        // Arrival — starts with velocity (continuing the cut's motion) and
        // brakes into the settle position.
        const k = easeOutCubic(Math.min(t / mw.inDur, 1))
        camera.position.lerpVectors(mw.fromPos, mw.settlePos, k)
        syncCameraLookAt(camera, controls, mw.lookAtPos)

        if (t >= mw.inDur) {
          mw.phase = "idle"
          mw.start = -1
          lookTarget.current.copy(mw.lookAtPos)
        }
      }
      return
    }

    const nextLookTarget = focusTarget && mode === "planet" ? focusTarget : ORIGIN
    if (mode === "moon") {
      // Default top-down. Sprite Html cards billboard to face the camera so
      // they stay readable regardless of angle. Tiny z offset breaks the
      // OrbitControls gimbal-lock singularity at polar angle 0.
      target.current.copy(SETTLE_POS.moon(isMobile))
    } else if (mode === "planet") {
      target.current.copy(focusTarget ? planetFocusSettle(focusTarget, isMobile) : SETTLE_POS.planet(isMobile))
    } else {
      target.current.copy(SETTLE_POS.system())
    }
    const flightKey = `${mode}:${isMobile ? "m" : "d"}:${nextLookTarget.x.toFixed(3)}:${nextLookTarget.y.toFixed(3)}:${nextLookTarget.z.toFixed(3)}`

    if (!isTransitioning) {
      flight.current.key = flightKey
      flight.current.start = -1
      lookTarget.current.copy(nextLookTarget)
      if (controls && controls.target.distanceTo(nextLookTarget) > 0.001) {
        controls.target.copy(nextLookTarget)
        controls.update()
      }
      return
    }

    if (flight.current.key !== flightKey || flight.current.start < 0) {
      flight.current.key = flightKey
      flight.current.start = state.clock.elapsedTime
      flight.current.fromPos.copy(camera.position)
      flight.current.fromLookAt.copy(controls?.target ?? lookTarget.current)
    }

    const duration =
      mode === "planet"
        ? CAMERA_FLIGHT.PLANET
        : mode === "moon"
          ? CAMERA_FLIGHT.MOON
          : CAMERA_FLIGHT.SYSTEM
    const k = easeInOutCubic(
      Math.min((state.clock.elapsedTime - flight.current.start) / duration, 1),
    )
    camera.position.lerpVectors(flight.current.fromPos, target.current, k)
    lookTarget.current.lerpVectors(flight.current.fromLookAt, nextLookTarget, k)
    syncCameraLookAt(camera, controls, lookTarget.current)

    if (k >= 1) {
      setIsTransitioning(false)
      flight.current.start = -1
    }
  })

  return null
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    const mql = window.matchMedia(query)
    const update = () => setMatches(mql.matches)
    update()
    mql.addEventListener("change", update)
    return () => mql.removeEventListener("change", update)
  }, [query])
  return matches
}

function RenderHeartbeat() {
  const { invalidate } = useThree()

  useEffect(() => {
    let raf = 0
    const tick = () => {
      invalidate()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [invalidate])

  return null
}

/**
 * ShaderWarmer
 *
 * Fixes the rift-swap freeze on Windows/Chrome (ANGLE → Direct3D).
 *
 * The problem: `gl.compile()` / `compileAsync()` do NOT fully prime a shader
 * program on ANGLE. ANGLE defers final program linking until the FIRST REAL
 * DRAW CALL with the actual render state (blend mode, depth, etc.). So when
 * the hidden universe is revealed during the rift swap and draws for the
 * first time, ANGLE links the program synchronously and stalls the main
 * thread — freezing the corridor mid-animation.
 *
 * The fix: issue REAL draw calls for both universes at load, to a tiny
 * offscreen render target the user never sees. A real render forces ANGLE
 * to compile + link + cache the program for the exact draw state it'll use
 * on screen. Spread over a handful of early frames so the warm-up itself
 * doesn't hitch. After that, the rift swap is a pure cache hit.
 *
 * frustumCulled is disabled during the warm render so every planet/sun/rift
 * mesh actually gets draw-called regardless of where it sits relative to the
 * load-time camera.
 */
function ShaderWarmer({
  systemGroupRefs,
}: {
  systemGroupRefs: MutableRefObject<Record<Universe, THREE.Group | null>>
}) {
  const { gl, scene, camera } = useThree()
  const framesLeft = useRef(4)
  const rt = useRef<THREE.WebGLRenderTarget | null>(null)

  useFrame(() => {
    if (framesLeft.current <= 0) return
    const groups = Object.values(systemGroupRefs.current).filter(
      (g): g is THREE.Group => g !== null,
    )
    if (groups.length < 2) return // wait until BOTH universes are mounted

    if (!rt.current) rt.current = new THREE.WebGLRenderTarget(16, 16)

    const prevVis = groups.map((g) => g.visible)
    const prevTarget = gl.getRenderTarget()
    const culling = new Map<THREE.Object3D, boolean>()

    // Force-draw both universes: visible + no frustum culling.
    groups.forEach((g) => {
      g.visible = true
      g.traverse((o) => {
        culling.set(o, o.frustumCulled)
        o.frustumCulled = false
      })
    })

    gl.setRenderTarget(rt.current)
    gl.render(scene, camera) // <- the real draw that ANGLE actually links
    gl.setRenderTarget(prevTarget)

    // Restore visibility + culling so the on-screen frame is unchanged.
    groups.forEach((g, i) => {
      g.visible = prevVis[i]
    })
    culling.forEach((fc, o) => {
      o.frustumCulled = fc
    })

    framesLeft.current -= 1
  })

  useEffect(
    () => () => {
      rt.current?.dispose()
    },
    [],
  )
  return null
}

/**
 * RiftCompileGate
 *
 * Watches `universe` and, on each change after initial mount, uses
 * `WebGLRenderer.compileAsync` (three.js r152+) to verify that ALL
 * materials in the new scene tree have been compiled before signaling the
 * rift cinematic that it's safe to transition out of 'peak'.
 *
 * Why: when the universe swaps, the new universe's planet shaders are
 * lazy-compiled on first render — that's the first-load freeze the user
 * was hitting (the corridor visually stalled because the GPU was blocked
 * compiling). compileAsync uses an internal 1×1 render target plus the
 * KHR_parallel_shader_compile extension to compile in the background and
 * resolves a Promise when finished, so we get a real "scene ready"
 * signal instead of a hardcoded setTimeout guess.
 *
 * If compileAsync isn't available (very old three.js / older browsers),
 * we fall back to synchronous compile() + a 300ms beat. A 4s hard
 * fallback prevents the cinematic from ever stalling indefinitely if
 * something pathological happens.
 */
function RiftCompileGate({
  universe,
  riftState,
}: {
  universe: Universe
  riftState: MutableRefObject<RiftCinematicState>
}) {
  const { gl, scene, camera } = useThree()
  const isFirstRun = useRef(true)

  useEffect(() => {
    // Skip the initial mount — we only want to gate the cinematic AFTER
    // a real universe swap.
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }

    let cancelled = false

    // Defer one frame so React has fully committed the new scene tree
    // (added the new planet meshes / shaders to three.js's scene graph)
    // before we ask the renderer to compile them.
    const raf = requestAnimationFrame(() => {
      if (cancelled) return

      const compileAsync = (
        gl as unknown as {
          compileAsync?: (s: THREE.Scene, c: THREE.Camera) => Promise<unknown>
        }
      ).compileAsync

      const markReady = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!cancelled) riftState.current.ready = true
          })
        })
      }

      if (typeof compileAsync === "function") {
        compileAsync.call(gl, scene, camera).then(markReady).catch(markReady)
      } else {
        // Fallback for ancient three.js: synchronous compile + a small
        // post-flush delay to let the GPU breathe before the corridor
        // fades out.
        try {
          gl.compile(scene, camera)
        } catch {
          /* ignore */
        }
        setTimeout(markReady, 300)
      }
    })

    // Hard ceiling — if something stalls compileAsync (offline GPU,
    // browser bug), don't trap the user inside the corridor forever.
    const fallback = setTimeout(() => {
      if (!cancelled) riftState.current.ready = true
    }, 4000)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      clearTimeout(fallback)
    }
  }, [universe, gl, scene, camera, riftState])

  return null
}

export default function SolarPortfolio() {
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const [universe, setUniverse] = useState<Universe>("professional")
  const [selectedPlanet, setSelectedPlanet] = useState<number | null>(null)
  const [focusTarget, setFocusTarget] = useState<[number, number, number] | null>(null)
  const [planetRotation, setPlanetRotation] = useState({ lon: 0, lat: 0 })
  const [hoveredPlanet, setHoveredPlanet] = useState<number | null>(null)
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [manualPaused, setManualPaused] = useState(false)
  const [focusPaused, setFocusPaused] = useState(false)
  const paused = manualPaused || focusPaused
  const controlsRef = useRef<CameraControlsRef | null>(null)
  // Stage of the rift cinematic, mirrored into React state at each stage
  // boundary (via CameraController's onSwapUniverse / onStageOut /
  // onCinematicComplete callbacks) so the DOM warp overlay can react to it.
  const [riftStage, setRiftStage] = useState<RiftStage>("idle")
  // Per-frame stage state for the cinematic. Mutated in place by
  // CameraController inside useFrame — a ref avoids per-frame React renders.
  const riftState = useRef<RiftCinematicState>({
    stage: "idle",
    stageStart: -1,
    ready: true,
  })
  // Mode-cut transition state. Ref drives the camera without a DOM cover;
  // the clicked object itself masks the scene swap (match cut).
  const modeWarp = useRef<ModeCutState>({
    phase: "idle",
    start: -1,
    fromPos: new THREE.Vector3(),
    targetPos: new THREE.Vector3(),
    targetObj: null,
    cutDist: 1,
    arriveDist: 1,
    fromLookAt: new THREE.Vector3(),
    lookAtPos: new THREE.Vector3(),
    settlePos: new THREE.Vector3(),
    destMode: "system",
    holdFrames: 0,
    outDur: MODE_CUT.DIVE_OUT,
    inDur: MODE_CUT.DIVE_IN,
    commit: null,
  })
  const systemGroupRefs = useRef<Record<Universe, THREE.Group | null>>({
    professional: null,
    personal: null,
  })
  // Joystick velocity from the navigation dial (-1..1 each axis). When non-zero
  // a RAF loop integrates it into planetRotation for continuous rotation.
  const joystickRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const { x, y } = joystickRef.current
      if (x !== 0 || y !== 0) {
        const speed = 1.6 // rad/sec at full deflection
        setPlanetRotation((p) => ({
          lon: p.lon + x * dt * speed,
          lat: p.lat - y * dt * speed,
        }))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const setJoystick = (vel: { x: number; y: number }) => {
    joystickRef.current = vel
  }

  const toggleManualPause = useCallback(() => {
    setManualPaused((p) => !p)
  }, [])

  // Spacebar = global pause toggle (so people can freeze the system to click moons easily)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        toggleManualPause()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggleManualPause])

  const config = UNIVERSE_CONFIG[universe]
  const planets = config.planets
  const selected = selectedPlanet !== null ? planets[selectedPlanet] : null
  const focusTargetVector = useMemo(
    () => (focusTarget ? new THREE.Vector3(...focusTarget) : null),
    [focusTarget],
  )

  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const universeParam = params.get("universe")
    const planetParam = params.get("planet")
    const moonParam = params.get("moon")
    if (!universeParam || planetParam === null) return
    if (universeParam !== "professional" && universeParam !== "personal") return

    const planetIndex = Number.parseInt(planetParam, 10)
    const targetPlanet = UNIVERSE_CONFIG[universeParam].planets[planetIndex]
    if (!targetPlanet) return

    const planetPosition = initialPlanetPosition(targetPlanet)
    const moonIndex = moonParam === null ? -1 : Number.parseInt(moonParam, 10)
    const targetMoon = moonIndex >= 0 ? targetPlanet.landmarks[moonIndex] ?? null : null

    setUniverse(universeParam)
    setSelectedPlanet(planetIndex)
    setFocusTarget([planetPosition.x, planetPosition.y, planetPosition.z])
    setSelectedLandmark(targetMoon)
    setFocusPaused(true)
    setHoveredPlanet(null)
    setIsTransitioning(true)
  }, [])

  const mode: Mode = selectedLandmark ? "moon" : selectedPlanet !== null ? "planet" : "system"

  // When in moon mode, derive the moon's index in its planet's landmark list so
  // we hand the same seed to MoonView that the orbiting moon used.
  const landmarkIndex =
    selected && selectedLandmark ? findLandmarkIndex(selected.landmarks, selectedLandmark) : -1
  const landmarkSeed = landmarkIndex >= 0 ? landmarkIndex * 13.7 + 7 : 0

  const replaceQuery = useCallback((planetIndex: number | null, moonIndex?: number | null) => {
    if (typeof window === "undefined") return

    const url = new URL(window.location.href)
    if (planetIndex === null) {
      url.search = ""
    } else {
      url.searchParams.set("universe", universe)
      url.searchParams.set("planet", String(planetIndex))
      if (moonIndex === undefined || moonIndex === null) {
        url.searchParams.delete("moon")
      } else {
        url.searchParams.set("moon", String(moonIndex))
      }
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
  }, [universe])

  /**
   * Kick off a mode-cut transition. `targetObj` (or the origin) is the
   * dive/zoom anchor; the scene swap (`commit`) runs at the cut point.
   */
  const startModeCut = (opts: {
    targetObj: THREE.Object3D | null
    cutDist: number
    arriveDist: number
    fromLookAt?: THREE.Vector3
    lookAtPos?: THREE.Vector3
    settlePos: THREE.Vector3
    destMode: Mode
    outDur: number
    inDur: number
    commit: () => void
  }) => {
    if (riftState.current.stage !== "idle" || modeWarp.current.phase !== "idle") return
    setHoveredPlanet(null)
    const mw = modeWarp.current
    mw.phase = "out"
    mw.start = -1
    mw.targetObj = opts.targetObj
    if (opts.targetObj) {
      opts.targetObj.getWorldPosition(mw.targetPos)
    } else {
      mw.targetPos.copy(ORIGIN)
    }
    mw.cutDist = opts.cutDist
    mw.arriveDist = opts.arriveDist
    mw.fromLookAt.copy(opts.fromLookAt ?? ORIGIN)
    mw.lookAtPos.copy(opts.lookAtPos ?? ORIGIN)
    mw.settlePos.copy(opts.settlePos)
    mw.destMode = opts.destMode
    mw.holdFrames = 0
    mw.outDur = opts.outDur
    mw.inDur = opts.inDur
    mw.commit = opts.commit
  }

  const handlePlanetClick = (idx: number, object: THREE.Object3D) => {
    const planet = planets[idx]
    if (!planet) return
    if (riftState.current.stage !== "idle" || modeWarp.current.phase !== "idle") return

    const target = new THREE.Vector3()
    object.getWorldPosition(target)
    setHoveredPlanet(null)
    if (!manualPaused && !focusPaused) setFocusPaused(true)
    setFocusTarget([target.x, target.y, target.z])
    setSelectedPlanet(idx)
    replaceQuery(idx, null)
    setPlanetRotation({ lon: 0, lat: 0 })
    setIsTransitioning(true)
  }

  const handleLandmarkClick = (landmark: Landmark, object: THREE.Object3D) => {
    const moonIndex = selected ? findLandmarkIndex(selected.landmarks, landmark) : -1
    const moonSettle = SETTLE_POS.moon(isMobile)
    // Pan from the focused planet to the clicked moon, then make a small
    // arrival adjustment into the moon scene instead of a big in/out lurch.
    startModeCut({
      targetObj: object,
      cutDist: isMobile ? 2.8 : 2.1,
      arriveDist: moonSettle.length() * 0.92,
      fromLookAt: focusTargetVector ?? ORIGIN,
      settlePos: moonSettle,
      destMode: "moon",
      outDur: 1.15,
      inDur: 0.95,
      commit: () => {
        setSelectedLandmark(landmark)
        if (selectedPlanet !== null && moonIndex >= 0) replaceQuery(selectedPlanet, moonIndex)
      },
    })
  }

  const handleMoonStep = useCallback((direction: -1 | 1) => {
    if (!selected || !selectedLandmark || selected.landmarks.length === 0) return

    const currentIndex = findLandmarkIndex(selected.landmarks, selectedLandmark)
    if (currentIndex < 0) return

    const nextIndex =
      (currentIndex + direction + selected.landmarks.length) % selected.landmarks.length
    const next = selected.landmarks[nextIndex]
    // Dive through the data crystal, come out at the next moon's crystal.
    startModeCut({
      targetObj: null,
      cutDist: MODE_CUT.FILL_FACTOR * MOON_CRYSTAL_RADIUS,
      arriveDist: MODE_CUT.FILL_FACTOR * MOON_CRYSTAL_RADIUS,
      settlePos: SETTLE_POS.moon(isMobile),
      destMode: "moon",
      outDur: MODE_CUT.DIVE_OUT,
      inDur: MODE_CUT.DIVE_IN,
      commit: () => {
        setSelectedLandmark(next)
        if (selectedPlanet !== null) replaceQuery(selectedPlanet, nextIndex)
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replaceQuery, selected, selectedLandmark, selectedPlanet, isMobile])

  const handlePrevMoon = useCallback(() => handleMoonStep(-1), [handleMoonStep])
  const handleNextMoon = useCallback(() => handleMoonStep(1), [handleMoonStep])

  const handleBackFromMoon = () => {
    // Small→big: slow zoom-out from the moon scene; cut while everything is
    // small; arrive close over the planet still moving outward, glide to 15.
    const planetTarget = focusTargetVector ?? ORIGIN
    startModeCut({
      targetObj: null,
      cutDist: 30,
      arriveDist: 9.5,
      lookAtPos: planetTarget,
      settlePos: focusTargetVector
        ? planetFocusSettle(focusTargetVector, isMobile)
        : SETTLE_POS.planet(isMobile),
      destMode: "planet",
      outDur: MODE_CUT.ZOOM_OUT,
      inDur: MODE_CUT.ZOOM_IN,
      commit: () => {
        setSelectedLandmark(null)
        if (selectedPlanet !== null) replaceQuery(selectedPlanet, null)
      },
    })
  }

  const handleBack = () => {
    if (riftState.current.stage !== "idle" || modeWarp.current.phase !== "idle") return
    setSelectedPlanet(null)
    setSelectedLandmark(null)
    setFocusTarget(null)
    setFocusPaused(false)
    setHoveredPlanet(null)
    replaceQuery(null)
    setIsTransitioning(true)
  }

  const handleEnterRift = () => {
    // Guard on the refs, not React state — the refs are the per-frame truth
    // and can't go stale in a closure, so re-entry mid-cinematic (double
    // click, double-fired handler) is impossible.
    if (riftState.current.stage !== "idle" || modeWarp.current.phase !== "idle") return
    setSelectedPlanet(null)
    setSelectedLandmark(null)
    setFocusTarget(null)
    setFocusPaused(false)
    setHoveredPlanet(null)
    setRiftStage("in")
    // Initialize the cinematic stage. CameraController will pick this up on
    // its next frame and lazy-init the stageStart timestamp from the canvas
    // clock. Universe swap fires when CameraController transitions 'in' →
    // 'peak'. The DOM warp overlay starts its fade-in immediately via a CSS
    // transition-delay (RIFT_TIMING.COVER_DELAY), so it goes opaque just
    // before the swap without needing a mid-stage callback.
    riftState.current = { stage: "in", stageStart: -1, ready: false }
  }

  const handleSwapUniverse = () => {
    setUniverse((u) => (u === "professional" ? "personal" : "professional"))
    setIsTransitioning(true)
    setRiftStage("peak")
    // riftState.ready stays false here. RiftCompileGate (rendered inside
    // Canvas, below) watches the `universe` prop and flips ready=true when
    // WebGLRenderer.compileAsync resolves — i.e. the new universe's shader
    // programs are actually compiled. The overlay + camera 'peak' stage
    // hold until then, so we never transition into a half-rendered scene.
  }

  const handleStageOut = () => {
    setRiftStage("out")
  }

  const handleCinematicComplete = () => {
    setRiftStage("idle")
  }

  // (Rotation now driven entirely by the NavDial joystick + the integrator above.)

  return (
    <div className="w-full h-screen relative overflow-hidden">
      <Background variant={config.backgroundVariant} />

      <Canvas
        camera={{ position: [0, 52, 0], fov: 60 }}
        frameloop="always"
        gl={{ antialias: true }}
        onPointerDown={() => isTransitioning && setIsTransitioning(false)}
      >
        <Suspense fallback={null}>
          <RenderHeartbeat />
          <StarNest
            // Personal universe stays soft pastel so the fractal doesn't fight
            // the bright pink/violet background. Public universe is pushed
            // toward light purple — knocks the natural warm/orange highlights
            // of the fractal toward lavender so the whole rim glow reads cool.
            brightness={config.backgroundVariant === "bright" ? 0.0009 : 0.0014}
            saturation={config.backgroundVariant === "bright" ? 0.55 : 0.85}
            tint={
              config.backgroundVariant === "bright"
                ? [1.05, 1.0, 1.05]
                : [1.05, 0.78, 1.55]
            }
          />
          <StarField />
          <Nebula variant={config.backgroundVariant} />
          <SpaceAmbience variant={config.backgroundVariant} />
          <CosmicDust variant={config.backgroundVariant} />
          <Environment preset="night" />
          <CameraController
            mode={mode}
            isMobile={isMobile}
            focusTarget={focusTargetVector}
            controlsRef={controlsRef}
            isTransitioning={isTransitioning}
            setIsTransitioning={setIsTransitioning}
            riftState={riftState}
            modeWarp={modeWarp}
            onSwapUniverse={handleSwapUniverse}
            onStageOut={handleStageOut}
            onCinematicComplete={handleCinematicComplete}
          />
          <RiftCompileGate universe={universe} riftState={riftState} />

          <ambientLight intensity={LIGHTING.ambient} />

          {/* Dual-mount — both universes stay mounted from app start. The
              active universe remains visible through system and planet modes,
              so planet focus happens in the same solar-system scene. */}
          {(["professional", "personal"] as Universe[]).map((u) => {
            const cfg = UNIVERSE_CONFIG[u]
            const isActive = u === universe
            return (
              <group
                key={u}
                ref={(group) => {
                  systemGroupRefs.current[u] = group
                }}
                visible={mode !== "moon" && isActive}
              >
                <SolarSystem
                  planets={cfg.planets}
                  sunVariant={cfg.sunVariant}
                  paused={paused || !isActive}
                  focusedPlanet={mode === "planet" && isActive ? selectedPlanet : null}
                  planetRotation={planetRotation}
                  onSunClick={toggleManualPause}
                  onPlanetClick={handlePlanetClick}
                  onLandmarkClick={handleLandmarkClick}
                  onPlanetHover={setHoveredPlanet}
                />
                <Rift onClick={handleEnterRift} universe={u} paused={paused || !isActive} />
              </group>
            )
          })}
          <ShaderWarmer systemGroupRefs={systemGroupRefs} />

          {mode === "moon" && selectedLandmark && (
            <MoonView landmark={selectedLandmark} seed={landmarkSeed} universe={universe} isMobile={isMobile} />
          )}

          <OrbitControls
            ref={controlsRef}
            // Pan stays off so rotation is always anchored to the sun (system),
            // the focused planet, or the data crystal (moon).
            enablePan={false}
            enableZoom
            // Mobile moon view: one-finger vertical swipes step through the
            // info sections (see moon-view.tsx), so rotation is disabled
            // there. Pinch zoom still works.
            enableRotate={!(mode === "moon" && isMobile)}
            enableDamping
            dampingFactor={0.055}
            minDistance={mode === "system" ? 30 : mode === "moon" ? (isMobile ? 9 : 4) : (isMobile ? 5 : 3)}
            maxDistance={mode === "system" ? 90 : mode === "moon" ? (isMobile ? 26 : 16) : (isMobile ? 28 : 22)}
            autoRotate={mode === "system" && !isTransitioning && !paused}
            autoRotateSpeed={0.1}
            maxPolarAngle={mode === "system" ? Math.PI / 2.2 : Math.PI}
            minPolarAngle={0}
          />
        </Suspense>
      </Canvas>

      {/* Rift transition — lightspeed warp. DOM + compositor-driven CSS so
          it keeps animating even while the WebGL thread stalls compiling the
          new universe's shaders. Sits above the UI (z-150) so the whole swap,
          including the UI rebrand, happens behind the cover. `universe` flips
          at the swap, crossfading the core-colored base to the destination
          rift's palette. */}
      <RiftWarpOverlay stage={riftStage} universe={universe} />

      <UIOverlay
        universe={universe}
        config={config}
        mode={mode}
        paused={paused}
        onTogglePause={toggleManualPause}
        selectedPlanet={selectedPlanet}
        hoveredPlanet={hoveredPlanet}
        selectedLandmark={selectedLandmark}
        onBackToSystem={handleBack}
        onBackFromMoon={handleBackFromMoon}
        onPrevMoon={handlePrevMoon}
        onNextMoon={handleNextMoon}
        onJoystick={setJoystick}
        onEnterRift={handleEnterRift}
      />
    </div>
  )
}
