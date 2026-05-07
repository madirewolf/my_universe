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
import MoonView from "./moon-view"
import UIOverlay from "./ui-overlay"

type Mode = "system" | "planet" | "moon"

function CameraController({
  mode,
  isTransitioning,
  setIsTransitioning,
}: {
  mode: Mode
  isTransitioning: boolean
  setIsTransitioning: (v: boolean) => void
}) {
  const { camera } = useThree()
  const target = useRef(new THREE.Vector3(0, 25, 0))

  useFrame(() => {
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
    setSelectedPlanet(null)
    setSelectedLandmark(null)
    setHoveredPlanet(null)
    setUniverse(u => (u === "professional" ? "personal" : "professional"))
    setIsTransitioning(true)
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
            // Personal universe gets a quieter, more pastel pass so the fractal
            // doesn't fight the bright pink/violet background.
            brightness={config.backgroundVariant === "bright" ? 0.0009 : 0.0014}
            saturation={config.backgroundVariant === "bright" ? 0.55 : 0.85}
            tint={config.backgroundVariant === "bright" ? [1.05, 1.0, 1.05] : [0.9, 0.95, 1.1]}
          />
          <StarField />
          <Nebula variant={config.backgroundVariant} />
          <CosmicDust variant={config.backgroundVariant} />
          <Environment preset="night" />
          <CameraController
            mode={mode}
            isTransitioning={isTransitioning}
            setIsTransitioning={setIsTransitioning}
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
