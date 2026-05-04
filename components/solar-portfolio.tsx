"use client"

import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"
import { Suspense, useRef, useState } from "react"
import * as THREE from "three"
import { LIGHTING, UNIVERSE_CONFIG, type Landmark, type Universe } from "@/lib/constants"
import SolarSystem from "./solar-system"
import Planet from "./planet"
import StarField from "./star-field"
import Background from "./background"
import Nebula from "./nebula"
import CosmicDust from "./cosmic-dust"
import Rift from "./rift"
import UIOverlay from "./ui-overlay"

function CameraController({
  selectedPlanet,
  isTransitioning,
  setIsTransitioning,
}: {
  selectedPlanet: number | null
  isTransitioning: boolean
  setIsTransitioning: (v: boolean) => void
}) {
  const { camera } = useThree()
  const target = useRef(new THREE.Vector3(0, 25, 0))

  useFrame(() => {
    if (!isTransitioning) return
    target.current.set(0, selectedPlanet !== null ? 0 : 52, selectedPlanet !== null ? 12 : 0)
    camera.position.lerp(target.current, 0.02)
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

  const config = UNIVERSE_CONFIG[universe]
  const planets = config.planets
  const selected = selectedPlanet !== null ? planets[selectedPlanet] : null

  const handlePlanetClick = (idx: number) => {
    setSelectedPlanet(idx)
    setPlanetRotation({ lon: 0, lat: 0 })
    setIsTransitioning(true)
  }

  const handleBack = () => {
    setSelectedPlanet(null)
    setSelectedLandmark(null)
    setHoveredPlanet(null)
    setIsTransitioning(true)
  }

  const handleEnterRift = () => {
    // Reset everything before swapping universes so we land in the system view
    setSelectedPlanet(null)
    setSelectedLandmark(null)
    setHoveredPlanet(null)
    setUniverse(u => (u === "professional" ? "personal" : "professional"))
    setIsTransitioning(true)
  }

  const STEP = Math.PI / 5
  const rotatePlanet = (dir: "left" | "right" | "up" | "down") =>
    setPlanetRotation((p) => ({
      lon: p.lon + (dir === "left" ? -STEP : dir === "right" ? STEP : 0),
      lat: p.lat + (dir === "up" ? STEP : dir === "down" ? -STEP : 0),
    }))

  return (
    <div className="w-full h-screen relative overflow-hidden">
      <Background variant={config.backgroundVariant} />

      <Canvas
        camera={{ position: [0, 52, 0], fov: 60 }}
        gl={{ antialias: true }}
        onPointerDown={() => isTransitioning && setIsTransitioning(false)}
      >
        <Suspense fallback={null}>
          <StarField />
          <Nebula variant={config.backgroundVariant} />
          <CosmicDust variant={config.backgroundVariant} />
          <Environment preset="night" />
          <CameraController
            selectedPlanet={selectedPlanet}
            isTransitioning={isTransitioning}
            setIsTransitioning={setIsTransitioning}
          />

          <ambientLight intensity={LIGHTING.ambient} />

          {selectedPlanet === null ? (
            <>
              <SolarSystem
                planets={planets}
                sunVariant={config.sunVariant}
                onPlanetClick={handlePlanetClick}
                onPlanetHover={setHoveredPlanet}
              />
              <Rift onClick={handleEnterRift} universe={universe} />
            </>
          ) : (
            selected && (
              <Planet
                isDetailView
                size={4}
                type={selected.type}
                accentColor={selected.color}
                bump={selected.bump}
                seed={(selectedPlanet ?? 0) * 17.31}
                landmarks={selected.landmarks}
                lonOffset={planetRotation.lon}
                latOffset={planetRotation.lat}
                onLandmarkClick={setSelectedLandmark}
              />
            )
          )}

          <OrbitControls
            enablePan={selectedPlanet === null}
            enableZoom
            enableRotate
            minDistance={selectedPlanet === null ? 30 : 8}
            maxDistance={selectedPlanet === null ? 90 : 20}
            autoRotate={selectedPlanet === null && !isTransitioning}
            autoRotateSpeed={0.1}
            maxPolarAngle={selectedPlanet === null ? Math.PI / 2.2 : Math.PI}
            minPolarAngle={0}
          />
        </Suspense>
      </Canvas>

      <UIOverlay
        universe={universe}
        config={config}
        selectedPlanet={selectedPlanet}
        hoveredPlanet={hoveredPlanet}
        selectedLandmark={selectedLandmark}
        onBackToSystem={handleBack}
        onRotatePlanet={rotatePlanet}
        onCloseLandmark={() => setSelectedLandmark(null)}
        onEnterRift={handleEnterRift}
      />
    </div>
  )
}
