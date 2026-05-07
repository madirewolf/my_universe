"use client"

import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"
import { Suspense, useEffect, useRef, useState } from "react"
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
import RiftCorridor from "./rift-corridor"
import MoonView from "./moon-view"
import UIOverlay from "./ui-overlay"

type Mode = "system" | "planet" | "moon"

// Easing helpers for the rift cinematic.
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

const RIFT_WORLD_POS = new THREE.Vector3(0, 16, -75)
const RIFT_OVERHEAD = new THREE.Vector3(0, 52, 0)

function CameraController({
  mode,
  isTransitioning,
  setIsTransitioning,
  riftActive,
  riftDuration,
}: {
  mode: Mode
  isTransitioning: boolean
  setIsTransitioning: (v: boolean) => void
  riftActive: boolean
  riftDuration: number
}) {
  const { camera } = useThree()
  const target = useRef(new THREE.Vector3(0, 25, 0))
  const riftStart = useRef<number | null>(null)
  const riftStartPos = useRef<THREE.Vector3 | null>(null)

  useFrame((state) => {
    // ── Rift cinematic takes priority ─────────────────────────────────────
    if (riftActive) {
      if (riftStart.current === null) {
        riftStart.current = state.clock.elapsedTime
        riftStartPos.current = camera.position.clone()
      }
      const t01 = Math.min(
        1,
        (state.clock.elapsedTime - riftStart.current) / riftDuration,
      )

      // Rift dir = unit vector from origin to rift in world space
      const riftDir = RIFT_WORLD_POS.clone().normalize()
      // Camera "near rift" position — 2.5 units in front of the rift, looking
      // straight at it. As the camera approaches, the rift fills the view and
      // the corridor overlay fades in to take over.
      const nearRift = RIFT_WORLD_POS.clone().sub(riftDir.multiplyScalar(2.5))

      if (t01 < 0.4) {
        // Phase A: ease IN toward the rift
        const phaseT = easeOutCubic(t01 / 0.4)
        camera.position.lerpVectors(riftStartPos.current!, nearRift, phaseT)
        camera.lookAt(RIFT_WORLD_POS)
      } else if (t01 < 0.6) {
        // Phase B: hold close to the rift while the corridor overlay covers
        // the screen. Universe swap fires inside this window via the
        // RiftCorridor onMidpoint callback.
        camera.position.copy(nearRift)
        camera.lookAt(RIFT_WORLD_POS)
      } else if (t01 < 1) {
        // Phase C: pull OUT to the new universe's overhead system view
        const phaseT = easeInOutCubic((t01 - 0.6) / 0.4)
        camera.position.lerpVectors(nearRift, RIFT_OVERHEAD, phaseT)
        camera.lookAt(0, 0, 0)
      } else {
        camera.position.copy(RIFT_OVERHEAD)
        camera.lookAt(0, 0, 0)
      }
      return
    }

    if (riftStart.current !== null) {
      // Rift just finished — let normal camera handling take over
      riftStart.current = null
      riftStartPos.current = null
    }

    if (!isTransitioning) return
    if (mode === "moon") {
      target.current.set(0, 1.5, 9.5)
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
    // Universe swap + camera target reset happen at the *midpoint* of the
    // corridor transition (RiftCorridor calls onMidpoint at t01 = 0.5), so
    // the user emerges into the new system view as the fade is reversing.
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
            riftActive={riftActive}
            riftDuration={4}
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

          {/* Rift transition — fullscreen Kali-fractal corridor that fades in,
              flies through, and fades out. Universe swap fires at the midpoint. */}
          <RiftCorridor
            active={riftActive}
            duration={4}
            onMidpoint={() => {
              setUniverse((u) => (u === "professional" ? "personal" : "professional"))
              setIsTransitioning(true)
            }}
            onComplete={() => setRiftActive(false)}
          />

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
