"use client"

import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react"
import * as THREE from "three"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import { LIGHTING, UNIVERSE_CONFIG, type Landmark, type PlanetEntry, type Universe, type UniverseConfig } from "@/lib/constants"
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
import WelcomeIntro from "./welcome-intro"
import BootScreen from "./boot-screen"
import { focusedCrystalRadius } from "./planet"

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
  // The small z offset keeps the camera OFF the exact pole above the sun.
  // At (0,52,0) looking at the origin, forward is parallel to up — the one
  // orientation lookAt can't define — so the roll collapsed to an arbitrary
  // fallback in the final frames of the return flight (the "reframe jump"
  // at the end). Same trick the moon settle already used.
  system: () => new THREE.Vector3(0, 52, 0.6),
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
// Moon→moon stepping dives CLOSER than the generic FILL_FACTOR. The crystal
// is spiky, so a bare bounding-sphere fill (≈2.95) lets too much background
// show through to ever read as "covering the screen". 2.1 makes the crystal
// body overflow the 60° frame ~1.6× while staying just outside the displaced
// spike envelope (~1.89), so the near plane never clips into it at the peak.
const MOON_STEP_CUT_DIST = 2.1
const CAMERA_FLIGHT = {
  SYSTEM: 1.75,
  SYSTEM_RETURN: 2.25,
  PLANET: 1.65,
  MOON: 1.35,
  /**
   * Attention leads, travel follows: the gaze pan recenters onto the
   * destination within this fraction of the flight, then the dolly finishes
   * the framing. Sharing one clock for gaze + dolly made the look-at LINGER
   * on the departure target early in the move — on a planet dive from the
   * overhead system view that means lingering on the near-straight-down
   * orientation (look-dir ≈ camera-up, the one pose lookAt can't define),
   * which read as jitter. Leading the gaze sweeps out of that zone fast and
   * turns the flight into the clean recenter-pan it should be.
   */
  GAZE_LEAD: 0.6,
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
  /** Camera-to-anchor distance right after the cut. */
  arriveDist: number
  fromLookAt: THREE.Vector3
  /** What the camera stares at right after the cut (the arrival anchor). */
  lookAtPos: THREE.Vector3
  /** What the camera ends up looking at — MUST equal the destination
   *  mode's resting gaze, or the controls handoff visibly refocuses. */
  settleLook: THREE.Vector3
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
  duration: number
  fromPos: THREE.Vector3
  toPos: THREE.Vector3
  fromLookAt: THREE.Vector3
  toLookAt: THREE.Vector3
  /** Pinned at flight start — keeps roll stable through the move. */
  up: THREE.Vector3
}

// Scratch vectors — avoid per-frame allocations.
const _approach = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _m4 = new THREE.Matrix4()

function syncCameraLookAt(
  camera: THREE.Camera,
  controls: CameraControlsRef | null,
  lookAt: THREE.Vector3,
  up?: THREE.Vector3,
) {
  if (controls) {
    controls.target.copy(lookAt)
  }
  if (up) {
    _m4.lookAt(camera.position, lookAt, up)
    camera.quaternion.setFromRotationMatrix(_m4)
  } else {
    camera.lookAt(lookAt)
  }
  // NO controls.update() here. update() enforces min/max-distance and polar
  // clamps, and mid-transition the camera is legitimately outside the
  // destination mode's clamps (e.g. 52 away when planet mode allows 22) —
  // calling it snapped the camera to the clamp while the flight lerp pulled
  // it back, which read as a glitchy jitter at the start of every
  // transition. Controls stay disabled during scripted moves; the idle
  // branch does one clean update() at handoff.
}

// NOTE: no opacity-based fade for the solar system — the sun/planet/rift
// materials are custom shaders that IGNORE material.opacity, so a "fade"
// leaves them fully visible (that's how the sun ended up photobombing the
// middle of the moon scene). The system hides/shows with a plain visibility
// flip, always masked by the moon match-cut; only the moon diorama (standard
// materials) genuinely materializes via opacity.

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

// ── Deep links ──────────────────────────────────────────────────────────
// URLs carry readable slugs (?universe=personal&planet=nyx&moon=luna).
// Numeric params are still accepted so old links keep working.

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

function findPlanetIndexByParam(config: UniverseConfig, param: string | null): number {
  if (param === null) return -1
  const bySlug = config.planets.findIndex((p) => slugify(p.name) === param)
  if (bySlug >= 0) return bySlug
  const idx = Number.parseInt(param, 10)
  return Number.isInteger(idx) && config.planets[idx] ? idx : -1
}

function findMoonIndexByParam(planet: PlanetEntry, param: string | null): number {
  if (param === null) return -1
  const bySlug = planet.landmarks.findIndex((m) => slugify(m.name) === param)
  if (bySlug >= 0) return bySlug
  const idx = Number.parseInt(param, 10)
  return Number.isInteger(idx) && planet.landmarks[idx] ? idx : -1
}

function initialPlanetPosition(planet: PlanetEntry): THREE.Vector3 {
  const position = new THREE.Vector3(planet.distance, 0, 0)
  position.applyAxisAngle(new THREE.Vector3(0, 1, 0), planet.phase ?? 0)
  position.applyAxisAngle(new THREE.Vector3(1, 0, 0), planet.tilt ?? 0)
  return position
}

// Signals the boot screen once the canvas has produced a handful of real
// frames — a completed frame means the shader-compile stall is behind us.
function BootReady({ onReady }: { onReady: () => void }) {
  const frames = useRef(0)
  const fired = useRef(false)
  useFrame(() => {
    if (fired.current) return
    frames.current += 1
    if (frames.current >= 5) {
      fired.current = true
      onReady()
    }
  })
  return null
}

function CameraController({
  mode,
  isMobile,
  focusTarget,
  returningToSystem,
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
  returningToSystem: boolean
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
    duration: CAMERA_FLIGHT.SYSTEM,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromLookAt: new THREE.Vector3(),
    toLookAt: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
  })
  // Captured camera position when stage 'in' starts, AND nearRift snapshot
  // when stage 'out' starts. Reused for the lerp source.
  const stageStartPos = useRef<THREE.Vector3 | null>(null)
  const riftDepartureLookAt = useRef(new THREE.Vector3(0, 0, 0))

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
          const departure = sr.departureLookAt
          riftDepartureLookAt.current.set(
            departure?.[0] ?? ORIGIN.x,
            departure?.[1] ?? ORIGIN.y,
            departure?.[2] ?? ORIGIN.z,
          )
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
          // pans smoothly from the current focus onto the rift.
          const k = easeInOutCubic(t / RIFT_TIMING.IN_ROTATE_DURATION)
          camera.position.copy(stageStartPos.current!)
          _lookAt.lerpVectors(riftDepartureLookAt.current, RIFT_WORLD_POS, k)
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
          riftDepartureLookAt.current.copy(ORIGIN)
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
        // brakes into the settle position. The gaze glides from the arrival
        // anchor onto the resting gaze and finishes EARLY (gaze lead), so
        // the final frame is exactly the frame the idle controls take over
        // — no end-of-transition refocus jump.
        const rawT = t / mw.inDur
        const k = easeOutCubic(Math.min(rawT, 1))
        const gazeK = easeInOutCubic(Math.min(rawT / 0.85, 1))
        camera.position.lerpVectors(mw.fromPos, mw.settlePos, k)
        _lookAt.lerpVectors(mw.lookAtPos, mw.settleLook, gazeK)
        syncCameraLookAt(camera, controls, _lookAt)

        if (rawT >= 1) {
          mw.phase = "idle"
          mw.start = -1
          lookTarget.current.copy(mw.settleLook)
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
    const flightKey = `${mode}:${returningToSystem ? "return" : "steady"}:${isMobile ? "m" : "d"}:${nextLookTarget.x.toFixed(3)}:${nextLookTarget.y.toFixed(3)}:${nextLookTarget.z.toFixed(3)}`

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
      const f = flight.current
      f.key = flightKey
      f.start = state.clock.elapsedTime
      f.duration = returningToSystem
        ? CAMERA_FLIGHT.SYSTEM_RETURN
        : mode === "planet"
          ? CAMERA_FLIGHT.PLANET
          : mode === "moon"
            ? CAMERA_FLIGHT.MOON
            : CAMERA_FLIGHT.SYSTEM
      f.fromPos.copy(camera.position)
      f.fromLookAt.copy(controls?.target ?? lookTarget.current)
      f.toPos.copy(target.current)
      f.toLookAt.copy(nextLookTarget)
      f.up.copy(camera.up)
    }

    const rawT = (state.clock.elapsedTime - flight.current.start) / flight.current.duration
    const k = easeInOutCubic(Math.min(rawT, 1))
    // Gaze leads, dolly follows (GAZE_LEAD): the recenter-pan finishes early
    // so the camera isn't still staring at the departure point while it
    // travels — that lingering was the planet-flight jitter. up stays pinned
    // (matrix lookAt) so roll never twists through the move.
    const gazeK = easeInOutCubic(Math.min(rawT / CAMERA_FLIGHT.GAZE_LEAD, 1))
    camera.position.lerpVectors(flight.current.fromPos, flight.current.toPos, k)
    _lookAt.lerpVectors(flight.current.fromLookAt, flight.current.toLookAt, gazeK)
    syncCameraLookAt(camera, controls, _lookAt, flight.current.up)

    if (rawT >= 1) {
      lookTarget.current.copy(flight.current.toLookAt)
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

    const prevTarget = gl.getRenderTarget()
    const visibility = new Map<THREE.Object3D, boolean>()
    const culling = new Map<THREE.Object3D, boolean>()

    // Force-draw hidden subtrees too (landmark moons start invisible until
    // first focus) — a real offscreen draw links ANGLE shader programs.
    groups.forEach((g) => {
      g.traverse((o) => {
        visibility.set(o, o.visible)
        culling.set(o, o.frustumCulled)
        o.visible = true
        o.frustumCulled = false
      })
    })

    gl.setRenderTarget(rt.current)
    gl.render(scene, camera) // <- the real draw that ANGLE actually links
    gl.setRenderTarget(prevTarget)

    visibility.forEach((visible, o) => {
      o.visible = visible
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
  const [releaseFocusPauseOnSettle, setReleaseFocusPauseOnSettle] = useState(false)
  const [returningToSystem, setReturningToSystem] = useState(false)
  const paused = manualPaused || focusPaused
  const controlsRef = useRef<CameraControlsRef | null>(null)
  // Stage of the rift cinematic, mirrored into React state at each stage
  // boundary (via CameraController's onSwapUniverse / onStageOut /
  // onCinematicComplete callbacks) so the DOM warp overlay can react to it.
  const [riftStage, setRiftStage] = useState<RiftStage>("idle")
  // False until the canvas has rendered real frames; drives the boot screen
  // fade and holds the welcome splash so they never overlap.
  const [booted, setBooted] = useState(false)

  // Safety hatch: if the canvas never reports frames (WebGL blocked, GPU
  // driver trouble, tab kept in the background), don't trap the visitor on
  // the boot screen forever.
  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 18000)
    return () => clearTimeout(t)
  }, [])
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
    settleLook: new THREE.Vector3(),
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
  // Live meshes of the focused planet's orbiting crystal moons, registered
  // by Planet. Used by the moon→planet return to arrive framing the exact
  // moon we left through (the data crystal's twin).
  const focusedMoonObjects = useRef<(THREE.Object3D | null)[]>([])
  // Live planet body meshes of the ACTIVE universe, registered by Planet.
  // Lets browser back/forward re-dive into a planet with the real match cut
  // (the object is tracked live, exactly like a click).
  const planetObjectsRef = useRef<(THREE.Object3D | null)[]>([])
  // True while a navigation was initiated by popstate (browser back/forward)
  // — suppresses the next history push so we don't grow the stack while
  // walking it. Consumed by replaceQuery / handleSwapUniverse.
  const popNavRef = useRef(false)
  // Deep history jump straight into a moon (e.g. forward from system view):
  // dive to the planet first, then this parks the moon index until the
  // planet arrival settles and its moon meshes exist.
  const pendingMoonRef = useRef<number | null>(null)
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
    const targetUniverse: Universe =
      params.get("universe") === "personal" ? "personal" : "professional"
    const cfg = UNIVERSE_CONFIG[targetUniverse]
    const planetIndex = findPlanetIndexByParam(cfg, params.get("planet"))

    if (planetIndex < 0) {
      // Universe-only deep link (?universe=personal) — no dive needed.
      if (targetUniverse !== "professional") setUniverse(targetUniverse)
      return
    }

    const targetPlanet = cfg.planets[planetIndex]
    const planetPosition = initialPlanetPosition(targetPlanet)
    const moonIndex = findMoonIndexByParam(targetPlanet, params.get("moon"))
    const targetMoon = moonIndex >= 0 ? targetPlanet.landmarks[moonIndex] : null

    setUniverse(targetUniverse)
    setSelectedPlanet(planetIndex)
    setFocusTarget([planetPosition.x, planetPosition.y, planetPosition.z])
    setSelectedLandmark(targetMoon)
    setFocusPaused(true)
    setHoveredPlanet(null)
    setIsTransitioning(true)
  }, [])

  const mode: Mode = selectedLandmark ? "moon" : selectedPlanet !== null ? "planet" : "system"
  const cameraMode: Mode = returningToSystem ? "system" : mode
  // OrbitControls clamps stay on the *departure* mode until the flight ends —
  // flipping to the destination mode on click made frame 1 snap before useFrame
  // could disable the controls.
  const controlsMode: Mode = isTransitioning
    ? returningToSystem
      ? "planet"
      : selectedPlanet !== null
        ? "system"
        : cameraMode
    : cameraMode

  useEffect(() => {
    if (!returningToSystem || isTransitioning) return
    setSelectedPlanet(null)
    setFocusTarget(null)
    setPlanetRotation({ lon: 0, lat: 0 })
    setReturningToSystem(false)
    if (releaseFocusPauseOnSettle) {
      setFocusPaused(false)
      setReleaseFocusPauseOnSettle(false)
    }
  }, [isTransitioning, releaseFocusPauseOnSettle, returningToSystem])

  useEffect(() => {
    if (!releaseFocusPauseOnSettle || returningToSystem || isTransitioning || mode !== "system") return
    setFocusPaused(false)
    setReleaseFocusPauseOnSettle(false)
  }, [isTransitioning, mode, releaseFocusPauseOnSettle, returningToSystem])

  // When in moon mode, derive the moon's index in its planet's landmark list so
  // we hand the same seed to MoonView that the orbiting moon used.
  const landmarkIndex =
    selected && selectedLandmark ? findLandmarkIndex(selected.landmarks, selectedLandmark) : -1
  const landmarkSeed = landmarkIndex >= 0 ? landmarkIndex * 13.7 + 7 : 0

  const replaceQuery = useCallback(
    (planetIndex: number | null, moonIndex?: number | null, push = false) => {
      if (typeof window === "undefined") return

      const url = new URL(window.location.href)
      const keepSilent = url.searchParams.has("silent")
      url.search = ""
      if (keepSilent) url.searchParams.set("silent", "")
      // Professional system view is the clean "/" URL; everything else is
      // spelled out with slugs.
      if (universe === "personal") url.searchParams.set("universe", universe)
      if (planetIndex !== null) {
        const planet = UNIVERSE_CONFIG[universe].planets[planetIndex]
        if (planet) {
          url.searchParams.set("universe", universe)
          url.searchParams.set("planet", slugify(planet.name))
          const moon =
            moonIndex !== undefined && moonIndex !== null
              ? planet.landmarks[moonIndex]
              : null
          if (moon) url.searchParams.set("moon", slugify(moon.name))
        }
      }

      // popstate-driven navigation must not grow the history stack.
      const shouldPush = push && !popNavRef.current
      if (push && popNavRef.current) popNavRef.current = false

      const href = `${url.pathname}${url.search}${url.hash}`
      if (shouldPush && url.search !== window.location.search) {
        window.history.pushState(null, "", href)
      } else {
        window.history.replaceState(null, "", href)
      }
    },
    [universe],
  )

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
    /** Resting gaze of the destination mode. Defaults to lookAtPos. */
    settleLook?: THREE.Vector3
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
    mw.settleLook.copy(opts.settleLook ?? opts.lookAtPos ?? ORIGIN)
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
    if (isTransitioning) return

    const target = new THREE.Vector3()
    object.getWorldPosition(target)
    setHoveredPlanet(null)
    setReturningToSystem(false)
    if (!manualPaused && !focusPaused) setFocusPaused(true)
    setFocusTarget([target.x, target.y, target.z])
    setSelectedPlanet(idx)
    replaceQuery(idx, null, true)
    setPlanetRotation({ lon: 0, lat: 0 })
    setIsTransitioning(true)
  }

  const handleLandmarkClick = (landmark: Landmark, object: THREE.Object3D) => {
    const moonIndex = selected ? findLandmarkIndex(selected.landmarks, landmark) : -1
    // History entry lands at interaction time; the commit below only
    // re-confirms the same URL (replace) once the cut actually happens.
    if (selectedPlanet !== null && moonIndex >= 0) replaceQuery(selectedPlanet, moonIndex, true)
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

  const handleMoonJump = useCallback((nextIndex: number) => {
    if (!selected || selected.landmarks.length === 0) return
    const next = selected.landmarks[nextIndex]
    if (!next || next === selectedLandmark) return
    // Dive through the data crystal, come out at the next moon's crystal.
    // Closer cut (crystal fills the whole frame) and snappier than the
    // generic mode-cut — cycling between moons should feel quick. cutDist
    // and arriveDist stay equal so the match cut lands seamlessly.
    startModeCut({
      targetObj: null,
      cutDist: MOON_STEP_CUT_DIST,
      arriveDist: MOON_STEP_CUT_DIST,
      settlePos: SETTLE_POS.moon(isMobile),
      destMode: "moon",
      outDur: 0.55,
      inDur: 0.75,
      commit: () => {
        setSelectedLandmark(next)
        if (selectedPlanet !== null) replaceQuery(selectedPlanet, nextIndex)
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replaceQuery, selected, selectedLandmark, selectedPlanet, isMobile])

  const handleMoonStep = useCallback((direction: -1 | 1) => {
    if (!selected || !selectedLandmark || selected.landmarks.length === 0) return

    const currentIndex = findLandmarkIndex(selected.landmarks, selectedLandmark)
    if (currentIndex < 0) return

    const nextIndex =
      (currentIndex + direction + selected.landmarks.length) % selected.landmarks.length
    handleMoonJump(nextIndex)
  }, [handleMoonJump, selected, selectedLandmark])

  const handlePrevMoon = useCallback(() => handleMoonStep(-1), [handleMoonStep])
  const handleNextMoon = useCallback(() => handleMoonStep(1), [handleMoonStep])

  const handleBackFromMoon = () => {
    if (selectedPlanet !== null) replaceQuery(selectedPlanet, null, true)
    // Exact mirror of the way in: dive back INTO the data crystal until it
    // fills the frame, cut behind it to its orbiting twin filling the frame
    // the same way, then pull back from the moon while the gaze glides onto
    // the planet — ending precisely on the focused planet's resting frame.
    const planetTarget = focusTargetVector ?? ORIGIN
    const moonObj =
      landmarkIndex >= 0 ? focusedMoonObjects.current[landmarkIndex] ?? null : null
    const moonPos = moonObj
      ? moonObj.getWorldPosition(new THREE.Vector3())
      : planetTarget.clone()
    const crystalRadius = selected ? focusedCrystalRadius(selected.size) : 0.24
    startModeCut({
      targetObj: null, // dive anchor = the data crystal at the origin
      cutDist: MODE_CUT.FILL_FACTOR * MOON_CRYSTAL_RADIUS,
      // The twin moon fills the frame at the matching angular size.
      arriveDist: moonObj ? MODE_CUT.FILL_FACTOR * crystalRadius : 9.5,
      lookAtPos: moonPos,
      settleLook: planetTarget,
      settlePos: focusTargetVector
        ? planetFocusSettle(focusTargetVector, isMobile)
        : SETTLE_POS.planet(isMobile),
      destMode: "planet",
      outDur: MODE_CUT.DIVE_OUT,
      inDur: MODE_CUT.ZOOM_IN,
      commit: () => {
        setSelectedLandmark(null)
        if (selectedPlanet !== null) replaceQuery(selectedPlanet, null)
      },
    })
  }

  const handleBack = () => {
    if (riftState.current.stage !== "idle" || modeWarp.current.phase !== "idle") return
    setSelectedLandmark(null)
    setReturningToSystem(selectedPlanet !== null)
    if (selectedPlanet === null) setFocusTarget(null)
    setReleaseFocusPauseOnSettle(true)
    setHoveredPlanet(null)
    replaceQuery(null, undefined, true)
    setIsTransitioning(true)
  }

  const handleEnterRift = () => {
    // Guard on the refs, not React state — the refs are the per-frame truth
    // and can't go stale in a closure, so re-entry mid-cinematic (double
    // click, double-fired handler) is impossible.
    if (riftState.current.stage !== "idle" || modeWarp.current.phase !== "idle") return
    const departureLookAt = focusTargetVector
      ? ([focusTargetVector.x, focusTargetVector.y, focusTargetVector.z] as [number, number, number])
      : ([ORIGIN.x, ORIGIN.y, ORIGIN.z] as [number, number, number])
    setSelectedPlanet(null)
    setSelectedLandmark(null)
    setFocusTarget(null)
    setFocusPaused(false)
    setReleaseFocusPauseOnSettle(false)
    setReturningToSystem(false)
    setHoveredPlanet(null)
    setRiftStage("in")
    // Initialize the cinematic stage. CameraController will pick this up on
    // its next frame and lazy-init the stageStart timestamp from the canvas
    // clock. Universe swap fires when CameraController transitions 'in' →
    // 'peak'. The DOM warp overlay starts its fade-in immediately via a CSS
    // transition-delay (RIFT_TIMING.COVER_DELAY), so it goes opaque just
    // before the swap without needing a mid-stage callback.
    riftState.current = { stage: "in", stageStart: -1, ready: false, departureLookAt }
  }

  const handleSwapUniverse = () => {
    const next: Universe = universe === "professional" ? "personal" : "professional"
    setUniverse(next)
    // History entry for the universe switch (unless we're already replaying
    // history — then just leave the URL the browser restored).
    if (typeof window !== "undefined") {
      if (popNavRef.current) {
        popNavRef.current = false
      } else {
        const search = next === "personal" ? "?universe=personal" : ""
        window.history.pushState(null, "", `${window.location.pathname}${search}`)
      }
    }
    setIsTransitioning(true)
    setRiftStage("peak")
    // riftState.ready stays false here. RiftCompileGate (rendered inside
    // Canvas, below) watches the `universe` prop and flips ready=true when
    // WebGLRenderer.compileAsync resolves — i.e. the new universe's shader
    // programs are actually compiled. The overlay + camera 'peak' stage
    // hold until then, so we never transition into a half-rendered scene.
  }

  // Browser back/forward: parse the restored URL and replay it through the
  // real navigation handlers, so history moves use the same match cuts and
  // cinematics as clicks. Rebound every render on purpose — the handlers
  // close over current state. Busy transitions ignore the event (rare; the
  // URL self-corrects on the next navigation).
  useEffect(() => {
    const onPopState = () => {
      if (riftState.current.stage !== "idle" || modeWarp.current.phase !== "idle") return
      if (isTransitioning) return

      const params = new URLSearchParams(window.location.search)
      const targetUniverse: Universe =
        params.get("universe") === "personal" ? "personal" : "professional"

      if (targetUniverse !== universe) {
        // Crossing universes replays the rift; deeper targets in the other
        // universe settle at its system view (acceptable simplification).
        popNavRef.current = true
        pendingMoonRef.current = null
        handleEnterRift()
        return
      }

      const cfg = UNIVERSE_CONFIG[universe]
      const pIdx = findPlanetIndexByParam(cfg, params.get("planet"))
      const mIdx = pIdx >= 0 ? findMoonIndexByParam(cfg.planets[pIdx], params.get("moon")) : -1

      if (pIdx < 0) {
        // Target: system view
        pendingMoonRef.current = null
        if (mode !== "system") {
          popNavRef.current = true
          handleBack()
        }
        return
      }

      if (selectedPlanet !== pIdx) {
        if (mode !== "system") {
          // Planet-to-planet history jump: return home first; the next
          // popstate-equivalent step re-enters via pendingMoonRef? No —
          // history only moves one entry per event, so settle for home.
          popNavRef.current = true
          pendingMoonRef.current = null
          handleBack()
          return
        }
        const obj = planetObjectsRef.current[pIdx]
        if (!obj) return
        popNavRef.current = true
        pendingMoonRef.current = mIdx >= 0 ? mIdx : null
        handlePlanetClick(pIdx, obj)
        return
      }

      // Same planet as current
      if (mIdx < 0) {
        if (mode === "moon") {
          popNavRef.current = true
          handleBackFromMoon()
        }
        return
      }
      if (mode === "planet") {
        const landmark = cfg.planets[pIdx].landmarks[mIdx]
        const moonObj = focusedMoonObjects.current[mIdx]
        if (landmark && moonObj) {
          popNavRef.current = true
          handleLandmarkClick(landmark, moonObj)
        }
        return
      }
      if (mode === "moon" && landmarkIndex !== mIdx) {
        popNavRef.current = true
        handleMoonJump(mIdx)
      }
    }

    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  })

  // Second leg of a deep history jump (system → planet → moon): once the
  // planet arrival settles and its moon meshes are registered, dive on.
  useEffect(() => {
    if (pendingMoonRef.current === null) return
    if (mode !== "planet" || isTransitioning) return
    if (riftState.current.stage !== "idle" || modeWarp.current.phase !== "idle") return
    const mIdx = pendingMoonRef.current
    const landmark = selected?.landmarks[mIdx]
    const moonObj = focusedMoonObjects.current[mIdx]
    if (!landmark || !moonObj) return
    pendingMoonRef.current = null
    popNavRef.current = true // still history-driven — no new entry
    handleLandmarkClick(landmark, moonObj)
  })

  const handleStageOut = () => {
    setRiftStage("out")
  }

  const handleCinematicComplete = () => {
    setRiftStage("idle")
  }

  // (Rotation now driven entirely by the NavDial joystick + the integrator above.)

  return (
    <div className="w-full h-screen relative overflow-hidden" data-universe={universe}>
      <Background variant={config.backgroundVariant} />

      {/* No pointer-down transition cancel: interrupting a flight midway
          re-enabled controls in a pose outside their clamps, which snapped
          the camera (one of the jitter sources). Flights are short; they
          always complete. */}
      <Canvas
        camera={{ position: [0, 52, 0.6], fov: 60 }}
        frameloop="always"
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <RenderHeartbeat />
          <BootReady onReady={() => setBooted(true)} />
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
                : [0.72, 1.12, 1.08]
            }
          />
          <StarField />
          <Nebula variant={config.backgroundVariant} />
          <SpaceAmbience variant={config.backgroundVariant} />
          <CosmicDust variant={config.backgroundVariant} />
          <Environment preset="night" />
          <CameraController
            mode={cameraMode}
            isMobile={isMobile}
            focusTarget={focusTargetVector}
            returningToSystem={returningToSystem}
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
                  // The planet stays "focused" through moon visits too (the
                  // system is hidden then, but its moons must stay mounted at
                  // full scale so the moon→planet return can cut to the twin
                  // moon already in place) and through the return-to-system
                  // flight (moons dissolve only after we're home).
                  focusedPlanet={(mode !== "system" || returningToSystem) && isActive ? selectedPlanet : null}
                  planetRotation={planetRotation}
                  focusedLandmarkObjects={isActive ? focusedMoonObjects : undefined}
                  planetObjectsRef={isActive ? planetObjectsRef : undefined}
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
            <MoonView
              landmark={selectedLandmark}
              seed={landmarkSeed}
              universe={universe}
              isMobile={isMobile}
              onPrevMoon={handlePrevMoon}
              onNextMoon={handleNextMoon}
            />
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
            enableRotate={!(controlsMode === "moon" && isMobile)}
            enableDamping={!isTransitioning}
            dampingFactor={0.055}
            // During a flight the clamps go fully permissive (union of every
            // mode) so OrbitControls.update()'s clamp can NEVER yank the camera
            // mid-move. Without this, a planet→planet flight starts at ~10
            // units while controlsMode resolves to "system" (min 30) — the
            // first frame snapped the camera outward ("zoom out") before the
            // lerp took over. The clamps snap back to the destination mode at
            // handoff, where the camera already sits in range (no snap).
            minDistance={isTransitioning ? (isMobile ? 5 : 3) : controlsMode === "system" ? 30 : controlsMode === "moon" ? (isMobile ? 9 : 4) : (isMobile ? 5 : 3)}
            maxDistance={isTransitioning ? 90 : controlsMode === "system" ? 90 : controlsMode === "moon" ? (isMobile ? 26 : 16) : (isMobile ? 28 : 22)}
            autoRotate={controlsMode === "system" && !isTransitioning && !paused}
            autoRotateSpeed={0.1}
            maxPolarAngle={isTransitioning ? Math.PI : controlsMode === "system" ? Math.PI / 2.2 : Math.PI}
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
      />

      {/* One-shot welcome splash (replaces the old top-left banner) —
          transparent overlay that fades in on load, speaks the welcome
          line, and fades away. Dismissed early if the visitor dives into
          a planet or the rift before it finishes. */}
      <WelcomeIntro
        universe={universe}
        config={config}
        start={booted}
        dismiss={mode !== "system" || riftStage !== "idle"}
      />

      {/* Boot cover — opaque over the initial shader-compile stall, fades
          once BootReady reports rendered frames. Above everything. */}
      <BootScreen done={booted} />
    </div>
  )
}
