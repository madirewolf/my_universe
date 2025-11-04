"use client"

import { useRef } from "react"
import type { Group } from "three"
import Planet from "./planet"
import Sun from "./sun"
import { PLANET_DATA } from "@/lib/constants"

interface SolarSystemProps {
  onPlanetClick: (planetIndex: number) => void
  onPlanetHover: (planetIndex: number | null) => void
}

export default function SolarSystem({ onPlanetClick, onPlanetHover }: SolarSystemProps) {
  const systemRef = useRef<Group>(null)

  return (
    <group ref={systemRef}>
      <Sun position={[0, 0, 0]} />

      {PLANET_DATA.map((planet, index) => (
        <Planet
          key={index}
          distance={planet.distance}
          speed={planet.speed}
          size={planet.size}
          type={planet.type}
          onClick={() => onPlanetClick(index)}
          onHover={(hovered) => onPlanetHover(hovered ? index : null)}
        />
      ))}
    </group>
  )
}
