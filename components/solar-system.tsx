"use client"

import { useRef } from "react"
import * as THREE from "three"
import type { Group } from "three"
import Planet from "./planet"
import Sun from "./sun"
import type { PlanetEntry } from "@/lib/constants"

interface SolarSystemProps {
  planets: PlanetEntry[]
  sunVariant: "warm" | "nebula"
  paused?: boolean
  onSunClick?: () => void
  /** object = the clicked planet mesh — tracked live during the dive. */
  onPlanetClick: (planetIndex: number, object: THREE.Object3D) => void
  onPlanetHover: (planetIndex: number | null) => void
}

export default function SolarSystem({
  planets,
  sunVariant,
  paused = false,
  onSunClick,
  onPlanetClick,
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
