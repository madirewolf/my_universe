"use client"

import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"
import { Suspense, useEffect, useRef, useState, type MutableRefObject } from "react"
import * as THREE from "three"
import { LIGHTING, UNIVERSE_CONFIG, type Landmark, type Universe } from "@/lib/constants"
import SolarSystem from "./solar-system"
import Planet from "./planet"
import StarField from "./star-field"
import StarNest from "./star-nest"
import Background from "./background"
import Nebula from "./nebula"
import CosmicDust from "./cosmic-dust"
import Rift from "./rift"
import RiftCorridor, {
  RIFT_TIMING,
  type RiftCinematicState,
} from "./rift-corridor"
import MoonView from "./moon-view"
import UIOverlay from "./ui-overlay"

type Mode = "system" | "planet" | "moon"

// Easing helpers for the rift cinematic.
//   easeInCubic    → Phase A: accelerating dolly-IN (slow start, fast end)
//   easeInOutCubic → Phase C: smooth, lingering dolly-OUT (slow at both ends)
function easeInCubic(t: number): number {
  return t * t * t
}
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

const RIFT_WORLD_POS = new THREE.Vector3(0, 16, -75)
const RIFT_OVERHEAD = new THREE.Vector3(0, 52, 0)
const ORIGIN = new THREE.Vector3(0, 0, 0)
// How close the camera gets to the rift core at the midpoint of the cinematic.
// Aggressive on purpose — the corridor's full-opacity plateau hides any
// micro-clipping into the rift mesh while we're this close.
const RIFT_NEAR_DIST = 0.8
// Reused scratch Vector3 for the lookAt lerp — avoids per-frame allocations.
const _lookAt = new THREE.Vector3()

function CameraController({
  mode,
  isTransitioning,
  setIsTransitioning,
  riftState,
  onSwapUniverse,
  onCinematicComplete,
}: {
  mode: Mode
  isTransitioning: boolean
  setIsTransitioning: (v: boolean) => void
  riftState: MutableRefObject<RiftCinematicState>
  onSwapUniverse: () => void
  onCinematicComplete: () => void
}) {
  const { camera } = useThree()
  const target = useRef(new THREE.Vector3(0, 25, 0))
  // Captured camera position when stage 'in' starts, AND nearRift snapshot
  // when stage 'out' starts. Reused for the lerp source.
  const stageStartPos = useRef<THREE.Vector3 | null>(null)

  useFrame((state) => {
    const sr = riftState.current

    // ── Rift cinematic takes priority ─────────────────────────────────────
    // Stage machine driven by riftState.current (see rift-corridor.tsx for
    // the timing constants and stage definitions).
    //   • 'in'   (1.6s): accelerating dolly IN to the rift core. Gaze pans
    //                    sun → rift in lockstep. Corridor fades in over
    //                    the last 0.4s.
    //   • 'peak' (var):  camera held at rift, corridor at full opacity.
    //                    Universe swap fires when entering this stage.
    //                    Holds until riftState.ready flips true (~800ms
    //                    post-swap, after new universe shaders compile).
    //   • 'out'  (1.8s): smooth pull OUT to overhead. Corridor fades out
    //                    over first 1.5s. Crossfades into new rift mesh.
    if (sr.stage !== "idle") {
      // Lazy-init the stage's start time on its first frame.
      if (sr.stageStart < 0) {
        sr.stageStart = state.clock.elapsedTime
        if (sr.stage === "in") {
          stageStartPos.current = camera.position.clone()
        }
      }
      const t = state.clock.elapsedTime - sr.stageStart

      // nearRift = position RIFT_NEAR_DIST units in front of the rift core.
      const riftDir = RIFT_WORLD_POS.clone().normalize()
      const nearRift = RIFT_WORLD_POS.clone().sub(
        riftDir.multiplyScalar(RIFT_NEAR_DIST),
      )

      if (sr.stage === "in") {
        const k = easeInCubic(Math.min(t / RIFT_TIMING.IN_DURATION, 1))
        camera.position.lerpVectors(stageStartPos.current!, nearRift, k)
        _lookAt.lerpVectors(ORIGIN, RIFT_WORLD_POS, k)
        camera.lookAt(_lookAt)

        if (t >= RIFT_TIMING.IN_DURATION) {
          // Transition: 'in' → 'peak'. Fire the universe swap; the corridor
          // is now at full opacity and hides the actual swap.
          sr.stage = "peak"
          sr.stageStart = state.clock.elapsedTime
          onSwapUniverse()
        }
      } else if (sr.stage === "peak") {
        camera.position.copy(nearRift)
        camera.lookAt(RIFT_WORLD_POS)

        if (sr.ready && t >= RIFT_TIMING.PEAK_MIN_DURATION) {
          // Transition: 'peak' → 'out'. Universe is ready; release.
          sr.stage = "out"
          sr.stageStart = state.clock.elapsedTime
          stageStartPos.current = nearRift.clone()
        }
      } else if (sr.stage === "out") {
        const k = easeInOutCubic(Math.min(t / RIFT_TIMING.OUT_DURATION, 1))
        camera.position.lerpVectors(stageStartPos.current!, RIFT_OVERHEAD, k)
        _lookAt.lerpVectors(RIFT_WORLD_POS, ORIGIN, k)
        camera.lookAt(_lookAt)

        if (t >= RIFT_TIMING.OUT_DURATION) {
          // Cinematic complete.
          sr.stage = "idle"
          sr.stageStart = -1
          stageStartPos.current = null
          onCinematicComplete()
        }
      }
      return
    }

    if (!isTransitioning) return
    if (mode === "moon") {
      // Default top-down. Sprite Html cards billboard to face the camera so
      // they stay readable regardless of angle. Tiny z offset breaks the
      // OrbitControls gimbal-lock singularity at polar angle 0.
      target.current.set(0, 12, 0.5)
    } else if (mode === "planet") {
      target.current.set(0, 0, 12)
    } else {
      target.current.set(0, 52, 0)
    }
    camera.position.lerp(target.current, 0.04)
    camera.lookAt(0, 0, 0)
    if (camera.position.distanceTo(target.current) < 0.5) {
      setIsTransitioning(false)
    }
  })

  return null
}

export default function SolarPortfolio() {
  const [universe, setUniverse] = useState<Universe>("professional")
  const [selectedPlanet, setSelectedPlanet] = useState<number | null>(null)
  const [planetRotation, setPlanetRotation] = useState({ lon: 0, lat: 0 })
  const [hoveredPlanet, setHoveredPlanet] = useState<number | null>(null)
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [riftActive, setRiftActive] = useState(false)
  // Stage state for the rift cinematic. Mutated in place by CameraController
  // and read by RiftCorridor — both run in useFrame on the same Canvas, so a
  // ref keeps them in sync without per-frame React re-renders.
  const riftState = useRef<RiftCinematicState>({
    stage: "idle",
    stageStart: -1,
    ready: true,
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

  // Spacebar = global pause toggle (so people can freeze the system to click moons easily)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        setPaused((p) => !p)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const config = UNIVERSE_CONFIG[universe]
  const planets = config.planets
  const selected = selectedPlanet !== null ? planets[selectedPlanet] : null

  const mode: Mode = selectedLandmark ? "moon" : selectedPlanet !== null ? "planet" : "system"

  // When in moon mode, derive the moon's index in its planet's landmark list so
  // we hand the same seed to MoonView that the orbiting moon used.
  const landmarkIndex =
    selected && selectedLandmark ? selected.landmarks.indexOf(selectedLandmark) : -1
  const landmarkSeed = landmarkIndex >= 0 ? landmarkIndex * 13.7 + 7 : 0

  const handlePlanetClick = (idx: number) => {
    setSelectedPlanet(idx)
    setPlanetRotation({ lon: 0, lat: 0 })
    setIsTransitioning(true)
  }

  const handleLandmarkClick = (landmark: Landmark) => {
    setSelectedLandmark(landmark)
    setIsTransitioning(true)
  }

  const handleBackFromMoon = () => {
    setSelectedLandmark(null)
    setIsTransitioning(true)
  }

  const handleBack = () => {
    setSelectedPlanet(null)
    setSelectedLandmark(null)
    setHoveredPlanet(null)
    setIsTransitioning(true)
  }

  const handleEnterRift = () => {
    if (riftActive) return
    setSelectedPlanet(null)
    setSelectedLandmark(null)
    setHoveredPlanet(null)
    setRiftActive(true)
    // Initialize the cinematic stage. CameraController will pick this up on
    // its next frame and lazy-init the stageStart timestamp from the canvas
    // clock. Universe swap fires when CameraController transitions 'in' →
    // 'peak'; the corridor sits at full opacity until riftState.ready flips
    // true, which we schedule ~800ms after the swap.
    riftState.current = { stage: "in", stageStart: -1, ready: false }
  }

  const handleSwapUniverse = () => {
    setUniverse((u) => (u === "professional" ? "personal" : "professional"))
    setIsTransitioning(true)
    // Give the new universe ~800ms to compile its shaders (the actual cause
    // of the brief on-load freeze the user hit) before letting the corridor
    // fade out and the camera pull back. If shaders are already cached on
    // a subsequent swap this just adds a beat of "warp peak" — fine.
    setTimeout(() => {
      riftState.current.ready = true
    }, 800)
  }

  const handleCinematicComplete = () => {
    setRiftActive(false)
  }

  // (Rotation now driven entirely by the NavDial joystick + the integrator above.)

  return (
    <div className="w-full h-screen relative overflow-hidden">
      <Background variant={config.backgroundVariant} />

      <Canvas
        camera={{ position: [0, 52, 0], fov: 60 }}
        gl={{ antialias: true }}
        onPointerDown={() => isTransitioning && setIsTransitioning(false)}
      >
        <Suspense fallback={null}>
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
          <CosmicDust variant={config.backgroundVariant} />
          <Environment preset="night" />
          <CameraController
            mode={mode}
            isTransitioning={isTransitioning}
            setIsTransitioning={setIsTransitioning}
            riftState={riftState}
            onSwapUniverse={handleSwapUniverse}
            onCinematicComplete={handleCinematicComplete}
          />

          <ambientLight intensity={LIGHTING.ambient} />

          {mode === "system" && (
            <>
              <SolarSystem
                planets={planets}
                sunVariant={config.sunVariant}
                paused={paused}
                onSunClick={() => setPaused((p) => !p)}
                onPlanetClick={handlePlanetClick}
                onPlanetHover={setHoveredPlanet}
              />
              <Rift onClick={handleEnterRift} universe={universe} paused={paused} />
            </>
          )}

          {mode === "planet" && selected && (
            <Planet
              isDetailView
              size={4}
              type={selected.type}
              accentColor={selected.color}
              bump={selected.bump}
              shape={selected.shape}
              seed={(selectedPlanet ?? 0) * 17.31}
              landmarks={selected.landmarks}
              lonOffset={planetRotation.lon}
              latOffset={planetRotation.lat}
              paused={paused}
              onLandmarkClick={handleLandmarkClick}
            />
          )}

          {mode === "moon" && selectedLandmark && (
            <MoonView landmark={selectedLandmark} seed={landmarkSeed} />
          )}

          {/* Rift transition — lightspeed corridor. Stage machine lives in
              CameraController; this just renders opacity from riftState. */}
          <RiftCorridor active={riftActive} riftState={riftState} />

          <OrbitControls
            // Pan stays off so rotation is always anchored to the sun (system),
            // the planet (planet detail), or the data crystal (moon).
            enablePan={false}
            target={[0, 0, 0]}
            enableZoom
            enableRotate
            minDistance={mode === "system" ? 30 : mode === "moon" ? 4 : 8}
            maxDistance={mode === "system" ? 90 : mode === "moon" ? 16 : 20}
            autoRotate={mode === "system" && !isTransitioning && !paused}
            autoRotateSpeed={0.1}
            maxPolarAngle={mode === "system" ? Math.PI / 2.2 : Math.PI}
            minPolarAngle={0}
          />
        </Suspense>
      </Canvas>

      <UIOverlay
        universe={universe}
        config={config}
        mode={mode}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        selectedPlanet={selectedPlanet}
        hoveredPlanet={hoveredPlanet}
        selectedLandmark={selectedLandmark}
        onBackToSystem={handleBack}
        onBackFromMoon={handleBackFromMoon}
        onJoystick={setJoystick}
        onEnterRift={handleEnterRift}
      />
    </div>
  )
}
