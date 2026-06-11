"use client"

import { useRef, type MutableRefObject } from "react"
import * as THREE from "three"
import type { Group } from "three"
import Planet from "./planet"
import Sun from "./sun"
import type { PlanetEntry } from "@/lib/constants"

interface SolarSystemProps {
  planets: PlanetEntry[]
  sunVariant: "warm" | "nebula" | "teal"
  paused?: boolean
  focusedPlanet?: number | null
  planetRotation?: { lon: number; lat: number }
  /** Filled with the focused planet's orbiting moon meshes (for the
   *  moon→planet return's match-cut framing). */
  focusedLandmarkObjects?: MutableRefObject<(THREE.Object3D | null)[]>
  onSunClick?: () => void
  /** object = the clicked planet mesh — tracked live during the dive. */
  onPlanetClick: (planetIndex: number, object: THREE.Object3D) => void
  onLandmarkClick?: (landmark: PlanetEntry["landmarks"][number], object: THREE.Object3D) => void
  onPlanetHover: (planetIndex: number | null) => void
}

export default function SolarSystem({
  planets,
  sunVariant,
  paused = false,
  focusedPlanet = null,
  planetRotation = { lon: 0, lat: 0 },
  focusedLandmarkObjects,
  onSunClick,
  onPlanetClick,
  onLandmarkClick,
  onPlanetHover,
}: SolarSystemProps) {
  const systemRef = useRef<Group>(null)

  return (
    <group ref={systemRef}>
      <Sun
        key={sunVariant}
        position={[0, 0, 0]}
        variant={sunVariant}
        paused={paused}
        onClick={onSunClick}
      />

      {planets.map((planet, index) => (
        <Planet
          key={`${sunVariant}-${planet.type}-${index}`}
          distance={planet.distance}
          speed={planet.speed}
          size={planet.size}
          type={planet.type}
          accentColor={planet.color}
          phase={planet.phase}
          tilt={planet.tilt}
          bump={planet.bump}
          shape={planet.shape}
          seed={index * 17.31}
          paused={paused}
          focused={focusedPlanet === index}
          landmarks={planet.landmarks}
          lonOffset={focusedPlanet === index ? planetRotation.lon : 0}
          latOffset={focusedPlanet === index ? planetRotation.lat : 0}
          landmarkObjectsRef={focusedPlanet === index ? focusedLandmarkObjects : undefined}
          onLandmarkClick={onLandmarkClick}
          onClick={(e) => {
            e.stopPropagation()
            onPlanetClick(index, e.object)
          }}
          onHover={(hovered) => onPlanetHover(hovered ? index : null)}
        />
      ))}
    </group>
  )
}
