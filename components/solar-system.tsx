"use client"

import { useRef } from "react"
import type { Group } from "three"
import Planet from "./planet"
import Sun from "./sun"
import type { PlanetEntry } from "@/lib/constants"

interface SolarSystemProps {
  planets: PlanetEntry[]
  sunVariant: "warm" | "nebula"
  onPlanetClick: (planetIndex: number) => void
  onPlanetHover: (planetIndex: number | null) => void
}

export default function SolarSystem({
  planets,
  sunVariant,
  onPlanetClick,
  onPlanetHover,
}: SolarSystemProps) {
  const systemRef = useRef<Group>(null)

  return (
    <group ref={systemRef}>
      <Sun key={sunVariant} position={[0, 0, 0]} variant={sunVariant} />

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
          seed={index * 17.31}
          onClick={() => onPlanetClick(index)}
          onHover={(hovered) => onPlanetHover(hovered ? index : null)}
        />
      ))}
    </group>
  )
}
