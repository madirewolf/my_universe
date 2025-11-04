'use client'
// rest of your component code

import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"
import { Suspense, useState, useRef } from "react"
import * as THREE from "three"
import { LIGHTING } from "@/lib/constants"
import SolarSystem from "./solar-system"
import Planet from "./planet"
import StarField from "./star-field"
import Background from "./background"
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
    target.current.set(0, selectedPlanet !== null ? 0 : 25, selectedPlanet !== null ? 12 : 0)
    camera.position.lerp(target.current, 0.02)
    camera.lookAt(0, 0, 0)
    if (isTransitioning && camera.position.distanceTo(target.current) < 0.5) {
      setIsTransitioning(false)
    }
  })

  return null
}

export default function SolarPortfolio() {
  const [selectedPlanet, setSelectedPlanet] = useState<number | null>(null)
  const [planetRotation, setPlanetRotation] = useState(0)
  const [hoveredPlanet, setHoveredPlanet] = useState<number | null>(null)
  const [selectedLandmark, setSelectedLandmark] = useState<any>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handlePlanetClick = (idx: number) => {
    setSelectedPlanet(idx)
    setPlanetRotation(0)
    setIsTransitioning(true)
  }

  const handleBack = () => {
    setSelectedPlanet(null)
    setSelectedLandmark(null)
    setIsTransitioning(true)
  }

  const rotatePlanet = (dir: "left" | "right") => setPlanetRotation((p) => p + (dir === "left" ? -0.3 : 0.3))

  return (
    <div className="w-full h-screen relative overflow-hidden">
      <Background />

      <Canvas camera={{ position: [0, 25, 0], fov: 60 }} gl={{ antialias: true }}>
        <Suspense fallback={null}>
          <StarField />
          <Environment preset="night" />
          <CameraController
            selectedPlanet={selectedPlanet}
            isTransitioning={isTransitioning}
            setIsTransitioning={setIsTransitioning}
          />

          <ambientLight intensity={LIGHTING.ambient} />

          {selectedPlanet === null ? (
            <SolarSystem onPlanetClick={handlePlanetClick} onPlanetHover={setHoveredPlanet} />
          ) : (
            <Planet
              isDetailView
              size={4}
              type={["graphics", "algorithms", "ai-controls", "software-systems"][selectedPlanet]}
              rotation={planetRotation}
              planetIndex={selectedPlanet}
              onLandmarkClick={setSelectedLandmark}
            />
          )}

          <OrbitControls
            enabled={!isTransitioning}
            enablePan={selectedPlanet === null}
            enableZoom
            enableRotate
            minDistance={selectedPlanet === null ? 20 : 8}
            maxDistance={selectedPlanet === null ? 60 : 20}
            autoRotate={selectedPlanet === null && !isTransitioning}
            autoRotateSpeed={0.1}
            maxPolarAngle={selectedPlanet === null ? Math.PI / 2.2 : Math.PI}
            minPolarAngle={selectedPlanet === null ? Math.PI / 3 : 0}
          />
        </Suspense>
      </Canvas>

      <UIOverlay
        selectedPlanet={selectedPlanet}
        hoveredPlanet={hoveredPlanet}
        selectedLandmark={selectedLandmark}
        onBackToSystem={handleBack}
        onRotatePlanet={rotatePlanet}
        onCloseLandmark={() => setSelectedLandmark(null)}
      />
    </div>
  )
}
