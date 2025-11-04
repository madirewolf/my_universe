"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import type { Mesh, Group } from "three"
import { getPlanetMaterial } from "@/lib/shaders"
import { LANDMARKS, type Landmark } from "@/lib/constants"

interface PlanetProps {
  // Orbit mode props
  distance?: number
  speed?: number
  size: number
  type: string
  onClick?: () => void
  onHover?: (hovered: boolean) => void
  // Detail mode props
  isDetailView?: boolean
  rotation?: number
  onLandmarkClick?: (landmark: Landmark) => void
  planetIndex?: number
}

export default function Planet({
  distance,
  speed,
  size,
  type,
  onClick,
  onHover,
  isDetailView = false,
  rotation = 0,
  onLandmarkClick,
  planetIndex,
}: PlanetProps) {
  const orbitRef = useRef<Group>(null)
  const planetGroupRef = useRef<Group>(null)
  const planetRef = useRef<Mesh>(null)
  const landmarkRefs = useRef<Mesh[]>([])
  const [hoveredLandmark, setHoveredLandmark] = useState<number | null>(null)

  const rotationAccumulator = useRef(0)

  const landmarks = planetIndex !== undefined ? LANDMARKS[planetIndex] || [] : []

  useFrame((state) => {
    // Orbit animation (only in orbit mode)
    if (!isDetailView && orbitRef.current && speed) {
      orbitRef.current.rotation.y += speed
    }

    // Manual rotation (only in detail mode)
    if (isDetailView && planetGroupRef.current) {
      planetGroupRef.current.rotation.z = rotation
    }

    if (planetRef.current) {
      const rotationSpeed = isDetailView ? 0.005 : 0.01
      planetRef.current.rotation.y += rotationSpeed
      rotationAccumulator.current += rotationSpeed

      if (!isDetailView) {
        planetRef.current.rotation.x += 0.005
      }

      const material = planetRef.current.material as any
      if (material.uniforms?.time) {
        // Use accumulated rotation instead of clock time for perfect sync
        material.uniforms.time.value = rotationAccumulator.current
      }
    }

    // Landmark animations (only in detail mode)
    if (isDetailView) {
      landmarkRefs.current.forEach((landmark, index) => {
        if (landmark) {
          landmark.rotation.y += 0.02
          landmark.rotation.x += 0.01
          landmark.scale.setScalar(hoveredLandmark === index ? 0.3 + Math.sin(state.clock.elapsedTime * 4) * 0.1 : 0.2)
        }
      })
    }
  })

  const planetMesh = (
    <mesh
      ref={planetRef}
      position={isDetailView ? [0, 0, 0] : [distance || 0, 0, 0]}
      onClick={onClick}
      onPointerOver={(e) => {
        if (!isDetailView && onHover) {
          e.stopPropagation()
          document.body.style.cursor = "pointer"
          onHover(true)
        }
      }}
      onPointerOut={() => {
        if (!isDetailView && onHover) {
          document.body.style.cursor = "default"
          onHover(false)
        }
      }}
      castShadow
      receiveShadow
    >
      <sphereGeometry args={[size, 64, 64]} />
      {getPlanetMaterial(type)}
    </mesh>
  )

  // Orbit mode: simple planet in orbit
  if (!isDetailView) {
    return <group ref={orbitRef}>{planetMesh}</group>
  }

  // Detail mode: planet with landmarks
  return (
    <group ref={planetGroupRef}>
      {planetMesh}

      {/* Landmarks */}
      {landmarks.map((landmark, index) => (
        <mesh
          key={index}
          ref={(el) => {
            if (el) landmarkRefs.current[index] = el
          }}
          position={landmark.position}
          onClick={(e) => {
            e.stopPropagation()
            onLandmarkClick?.(landmark)
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            document.body.style.cursor = "pointer"
            setHoveredLandmark(index)
          }}
          onPointerOut={() => {
            document.body.style.cursor = "default"
            setHoveredLandmark(null)
          }}
        >
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={landmark.color}
            emissive={landmark.color}
            emissiveIntensity={0.5}
            transparent
            opacity={0.9}
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
      ))}

      {/* Detail view lighting */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[10, 5, 5]} intensity={0.8} />
      <pointLight position={[-5, 0, 5]} intensity={0.3} color="#4080ff" />
    </group>
  )
}
