"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { Html } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { ChevronLeft, ChevronRight } from "lucide-react"
import * as THREE from "three"
import type { Group, Mesh } from "three"
import type { ThreeEvent } from "@react-three/fiber"
import type { Landmark, Universe } from "@/lib/constants"
import { makeCrystalMoon } from "./planet"

type CardKind = "title" | "desc" | "tech" | "link" | "images"
type MoonConcept =
  | "observatory"
  | "walk"
  | "translator"
  | "craterMuseum"
  | "signalScope"
  | "skyArchive"
  | "rover"

interface SectionData {
  kind: CardKind
  label: string
  kicker: string
  body: string
}

interface MoonViewProps {
  landmark: Landmark
  seed: number
  universe: Universe
  isMobile?: boolean
}

const CRYSTAL_RADIUS = 1.55
const SECTION_LABELS: Record<Universe, Record<CardKind, string>> = {
  professional: {
    title: "Brief",
    desc: "About",
    tech: "Stack",
    link: "Portal",
    images: "Gallery",
  },
  personal: {
    title: "Memory",
    desc: "Story",
    tech: "Vibes",
    link: "Portal",
    images: "Evidence",
  },
}

const MOON_GLASS_BG =
  "linear-gradient(135deg, rgba(255,255,255,0.032), rgba(255,255,255,0.007) 52%, rgba(255,255,255,0.038))"
const MOON_GLASS_BG_ACTIVE =
  "linear-gradient(135deg, rgba(255,255,255,0.046), rgba(255,255,255,0.01) 52%, rgba(255,255,255,0.052))"
const MOON_GLASS_SHADOW = "0 0 18px rgba(180,210,255,0.035), 0 12px 24px rgba(0,0,0,0.12)"

function moonGlassBackground(color?: string, active = false): string {
  const tint = color ? `radial-gradient(circle at 12% 0%, ${color}${active ? "24" : "16"}, transparent 48%), ` : ""
  return `${tint}${active ? MOON_GLASS_BG_ACTIVE : MOON_GLASS_BG}`
}

const EXACT_CONCEPTS: Record<string, MoonConcept> = {
  "euphoriphilia": "skyArchive",
  "soundcloud": "signalScope",
  "currently spinning": "rover",
  "genre atlas": "translator",
  "what music means to me": "walk",
  "the question underneath": "walk",
  "how i frame it": "translator",
  "two-pronged mental health": "observatory",
  "what i'm building toward": "rover",
  "what i keep": "craterMuseum",
  "why i named her nyx": "translator",
  "gallery": "craterMuseum",
  "letterboxd · @madirewolf": "rover",
  "favourite directors": "skyArchive",
  "the vault": "craterMuseum",
  "tv & limited series": "signalScope",
  "what film means to me": "translator",
  "wadi rum, stars i couldn't see before": "observatory",
  "old worlds: petra, dead sea, bosphorus, levant": "craterMuseum",
  "home: persian gulf, kuwaiti desert": "walk",
  "canada: backcountry, canoes, cottages": "walk",
  "what nature means to me": "skyArchive",
}

const FALLBACK_CONCEPTS: MoonConcept[] = [
  "observatory",
  "walk",
  "translator",
  "signalScope",
  "skyArchive",
  "rover",
  "craterMuseum",
]

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seeded(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453123
  return x - Math.floor(x)
}

function conceptForLandmark(landmark: Landmark, seed: number): MoonConcept {
  const key = landmark.name.toLowerCase()
  if (EXACT_CONCEPTS[key]) return EXACT_CONCEPTS[key]

  const text = `${landmark.name} ${landmark.category} ${landmark.technologies.join(" ")}`.toLowerCase()
  if (text.includes("soundcloud") || text.includes("spotify") || text.includes("music")) return "signalScope"
  if (text.includes("film") || text.includes("director") || text.includes("letterboxd")) return "skyArchive"
  if (text.includes("petra") || text.includes("ruins") || text.includes("gallery")) return "craterMuseum"
  if (text.includes("wadi") || text.includes("stars") || text.includes("nature")) return "observatory"
  if (landmark.images?.length) return "craterMuseum"

  return FALLBACK_CONCEPTS[Math.abs(Math.round(seed)) % FALLBACK_CONCEPTS.length]
}

// (The data crystal's geometry now comes from planet.tsx's makeCrystalMoon —
// same recipe + same seed as the orbiting moon, so they're identical twins.)

function makeSections(landmark: Landmark, universe: Universe): SectionData[] {
  const labels = SECTION_LABELS[universe]
  const sections: SectionData[] = [
    {
      kind: "title",
      label: labels.title,
      kicker: landmark.category,
      body: landmark.name,
    },
    {
      kind: "desc",
      label: labels.desc,
      kicker: universe === "personal" ? "what it means" : "what it does",
      body: landmark.description,
    },
    {
      kind: "tech",
      label: labels.tech,
      kicker: universe === "personal" ? "texture / motifs" : "tools / systems",
      body: landmark.technologies.join(" / "),
    },
  ]

  if (landmark.link || landmark.links?.length) {
    const count = (landmark.link ? 1 : 0) + (landmark.links?.length ?? 0)
    sections.push({
      kind: "link",
      label: labels.link,
      kicker: count > 1 ? `${count} connected portals` : "connected portal",
      body: count > 1 ? "Open one of the linked artifacts." : "Open the linked artifact.",
    })
  }

  if (landmark.images?.length) {
    sections.push({
      kind: "images",
      label: labels.images,
      kicker: `${landmark.images.length} visual artifact${landmark.images.length === 1 ? "" : "s"}`,
      body: "Browse the visual evidence attached to this moon.",
    })
  }

  return sections
}

function preview(section: SectionData, max = 120) {
  return section.body.length <= max ? section.body : `${section.body.slice(0, max).trim()}...`
}

function sectionPositions(
  concept: MoonConcept,
  count: number,
  isMobile: boolean,
): [number, number, number][] {
  return Array.from({ length: count }, (_, index) => {
    const centered = index - (count - 1) / 2
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2
    const orbit = isMobile ? 3.15 : 4.25

    if (concept === "walk") return [centered * (isMobile ? 0.95 : 1.35), -2.08, -2.6 - Math.abs(centered) * 0.34]
    if (concept === "rover") return [centered * (isMobile ? 0.78 : 1.05), -1.65, -3.35]
    if (concept === "skyArchive") return [Math.cos(angle) * orbit, 2.1 + (index % 2) * 0.38, Math.sin(angle) * 2.6]
    if (concept === "observatory") return [Math.cos(angle) * (orbit + 0.45), 1.65 + (index % 3) * 0.38, Math.sin(angle) * 3.3]
    if (concept === "signalScope") return [Math.cos(angle) * 3.2, -0.05, Math.sin(angle) * 3.2]
    if (concept === "translator") return [Math.cos(angle) * 3.35, -1.0, Math.sin(angle) * 3.35]
    return [Math.cos(angle) * 3.55, -2.18, Math.sin(angle) * 3.55]
  })
}

function stop(event: ThreeEvent<MouseEvent> | ThreeEvent<PointerEvent>) {
  event.stopPropagation()
}

function MoonTerrain({
  color,
  seed,
  isMobile,
  variant,
}: {
  color: string
  seed: number
  isMobile: boolean
  variant: MoonConcept
}) {
  const radius = isMobile ? 6.4 : 8.6
  const craterCount = isMobile ? 9 : 15
  const rockCount = isMobile ? 18 : 28
  const craters = useMemo(
    () =>
      Array.from({ length: craterCount }, (_, i) => {
        const angle = seeded(seed, i + 10) * Math.PI * 2
        const dist = 1.1 + seeded(seed, i + 30) * (radius - 1.6)
        return {
          x: Math.cos(angle) * dist,
          z: Math.sin(angle) * dist,
          r: 0.22 + seeded(seed, i + 50) * 0.55,
          opacity: 0.045 + seeded(seed, i + 70) * 0.08,
        }
      }),
    [craterCount, radius, seed],
  )
  const rocks = useMemo(
    () =>
      Array.from({ length: rockCount }, (_, i) => {
        const angle = seeded(seed, i + 90) * Math.PI * 2
        const dist = 0.8 + seeded(seed, i + 110) * (radius - 1)
        return {
          x: Math.cos(angle) * dist,
          z: Math.sin(angle) * dist,
          scale: 0.05 + seeded(seed, i + 130) * 0.15,
        }
      }),
    [radius, rockCount, seed],
  )

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.55, 0]}>
        <circleGeometry args={[radius, 96]} />
        <meshStandardMaterial
          color={variant === "rover" ? "#151823" : "#1c1d25"}
          emissive={color}
          emissiveIntensity={0.035}
          roughness={0.96}
          metalness={0.05}
          flatShading
        />
      </mesh>
      {/* Soft rim glow — keeps the terrain disc from reading as a hard
          black coin against the bright space backdrop. Two stacked additive
          rings: a wide faint halo and a tighter, brighter edge. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.56, 0]}>
        <ringGeometry args={[radius * 0.92, radius * 1.3, 96]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.07}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.545, 0]}>
        <ringGeometry args={[radius * 0.985, radius * 1.035, 128]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.32}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Center glow pool under the data crystal */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.52, 0]}>
        <circleGeometry args={[2.4, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.535, 0]}>
        <ringGeometry args={[radius * 0.78, radius * 0.785, 128]} />
        <meshBasicMaterial color={color} transparent opacity={0.24} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.535, 0]}>
        <ringGeometry args={[radius * 0.5, radius * 0.503, 128]} />
        <meshBasicMaterial color={color} transparent opacity={0.14} />
      </mesh>
      {craters.map((crater, index) => (
        <mesh key={`crater-${index}`} position={[crater.x, -2.52, crater.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[crater.r * 0.68, crater.r, 36]} />
          <meshBasicMaterial color={index % 3 === 0 ? color : "#ffffff"} transparent opacity={crater.opacity} />
        </mesh>
      ))}
      {rocks.map((rock, index) => (
        <mesh key={`rock-${index}`} position={[rock.x, -2.42 + rock.scale * 0.25, rock.z]} scale={rock.scale}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#555866" roughness={0.9} metalness={0.08} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Scales its children in from ~0 after mount — the moon diorama (terrain,
 * beacons, projections) crystallizes around the data crystal on arrival.
 * The crystal itself is NOT wrapped: it's the match-cut anchor from the
 * planet scene and must be there from the very first frame.
 */
function MaterializeIn({
  children,
  delay = 0.15,
  duration = 0.9,
}: {
  children: React.ReactNode
  delay?: number
  duration?: number
}) {
  const ref = useRef<Group>(null)
  const startRef = useRef<number | null>(null)

  useFrame((state) => {
    if (!ref.current) return
    if (startRef.current === null) startRef.current = state.clock.elapsedTime
    const t = state.clock.elapsedTime - startRef.current - delay
    const k = Math.min(Math.max(t / duration, 0), 1)
    const eased = 1 - Math.pow(1 - k, 3)
    ref.current.scale.setScalar(Math.max(eased, 0.0001))
    ref.current.visible = t > 0
  })

  return (
    <group ref={ref} scale={0.0001} visible={false}>
      {children}
    </group>
  )
}

function DataCrystal({
  color,
  seed,
  onMenuEnter,
  onMenuLeave,
}: {
  color: string
  seed: number
  onMenuEnter: () => void
  onMenuLeave: () => void
}) {
  const outerRef = useRef<Mesh>(null)
  const innerRef = useRef<Mesh>(null)
  const haloRef = useRef<Mesh>(null)
  // SAME recipe + SAME seed as the orbiting crystal moon in planet.tsx —
  // the displacement is radius-relative, so this crystal is an identical
  // (bigger) twin of the exact moon the user dove into. That's what makes
  // the planet→moon cut read as one continuous object.
  const geometry = useMemo(() => makeCrystalMoon(CRYSTAL_RADIUS, seed), [seed])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (outerRef.current) {
      outerRef.current.rotation.y = t * 0.18
      outerRef.current.rotation.x = Math.sin(t * 0.18) * 0.1
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -t * 0.38
      innerRef.current.rotation.z = t * 0.22
    }
    if (haloRef.current) {
      const pulse = 1 + Math.sin(t * 1.35) * 0.04
      haloRef.current.scale.setScalar(pulse)
    }
  })

  return (
    <group position={[0, 0.1, 0]}>
      <mesh
        ref={outerRef}
        geometry={geometry}
        onPointerOver={(event) => {
          stop(event)
          document.body.style.cursor = "pointer"
          onMenuEnter()
        }}
        onPointerOut={(event) => {
          stop(event)
          document.body.style.cursor = ""
          onMenuLeave()
        }}
      >
        {/* Material matches the orbiting moon exactly (emissive 0.6,
            rough 0.32, metal 0.78) so the handoff doesn't shift tone. */}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          roughness={0.32}
          metalness={0.78}
          flatShading
        />
      </mesh>
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[CRYSTAL_RADIUS * 0.55, 0]} />
        <meshBasicMaterial color={color} transparent opacity={0.38} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Halo ratio + strength match the orbiting moon's glow (0.55/0.36 ≈
          1.53× radius at opacity 0.18) so the arrival keeps the same aura. */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[CRYSTAL_RADIUS * 1.53, 36, 36]} />
        <meshBasicMaterial color={color} transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh
        onPointerOver={(event) => {
          stop(event)
          document.body.style.cursor = "pointer"
          onMenuEnter()
        }}
        onPointerOut={(event) => {
          stop(event)
          document.body.style.cursor = ""
          onMenuLeave()
        }}
      >
        <sphereGeometry args={[CRYSTAL_RADIUS * 2.55, 24, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function SectionBeacon({
  concept,
  position,
  active,
  color,
  onSelect,
}: {
  concept: MoonConcept
  position: [number, number, number]
  active: boolean
  color: string
  onSelect: () => void
}) {
  const ref = useRef<Group>(null)

  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.y = state.clock.elapsedTime * (active ? 0.42 : 0.16)
    const bob = Math.sin(state.clock.elapsedTime * 1.1 + position[0]) * 0.035
    ref.current.position.y = position[1] + bob
  })

  const geometry =
    concept === "translator" ? (
      <boxGeometry args={[0.42, 1.05, 0.18]} />
    ) : concept === "craterMuseum" ? (
      <cylinderGeometry args={[0.62, 0.82, 0.12, 36]} />
    ) : concept === "signalScope" ? (
      <sphereGeometry args={[0.24, 20, 20]} />
    ) : concept === "skyArchive" ? (
      <torusGeometry args={[0.26, 0.035, 8, 32]} />
    ) : concept === "rover" ? (
      <boxGeometry args={[0.6, 0.22, 0.36]} />
    ) : (
      <octahedronGeometry args={[0.32, 0]} />
    )

  return (
    <group ref={ref} position={position}>
      <mesh
        scale={active ? 1.12 : 0.82}
        onClick={(event) => {
          stop(event)
          onSelect()
        }}
        onPointerOver={(event) => {
          stop(event)
          document.body.style.cursor = "pointer"
        }}
        onPointerOut={() => {
          document.body.style.cursor = ""
        }}
      >
        {geometry}
        <meshStandardMaterial
          color={active ? color : "#a4a8bd"}
          emissive={color}
          emissiveIntensity={active ? 1.2 : 0.28}
          roughness={0.34}
          metalness={0.48}
          transparent
          opacity={active ? 0.98 : 0.62}
          flatShading
        />
      </mesh>
    </group>
  )
}

function ActiveProjection({
  concept,
  activeIndex,
  total,
  positions,
  color,
}: {
  concept: MoonConcept
  activeIndex: number
  total: number
  positions: [number, number, number][]
  color: string
}) {
  const activePosition = positions[activeIndex] ?? [0, 0, 0]

  if (concept === "observatory" || concept === "skyArchive") {
    return null
  }

  if (concept === "translator") {
    const distance = Math.max(1.6, Math.hypot(activePosition[0], activePosition[2]))
    return (
      <group>
        <mesh
          position={[activePosition[0] / 2, 0.05, activePosition[2] / 2]}
          rotation={[0, Math.atan2(activePosition[0], activePosition[2]), 0]}
        >
          <boxGeometry args={[0.04, 0.04, distance]} />
          <meshBasicMaterial color={color} transparent opacity={0.42} />
        </mesh>
      </group>
    )
  }

  if (concept === "walk") {
    return (
      <group>
        <mesh position={[activePosition[0], -1.76, activePosition[2]]}>
          <sphereGeometry args={[0.18, 20, 20]} />
          <meshBasicMaterial color={color} transparent opacity={0.92} />
        </mesh>
        <mesh position={[activePosition[0], -2.02, activePosition[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.28, 0.32, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.48} />
        </mesh>
      </group>
    )
  }

  if (concept === "craterMuseum") {
    return (
      <group>
        <mesh position={[activePosition[0], -2.08, activePosition[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.72, 0.88, 54]} />
          <meshBasicMaterial color={color} transparent opacity={0.58} />
        </mesh>
        <pointLight position={[activePosition[0], -0.2, activePosition[2]]} color={color} intensity={0.85} distance={5} />
      </group>
    )
  }

  if (concept === "signalScope") {
    const angle = (activeIndex / total) * Math.PI * 2
    return (
      <group rotation={[0, -angle, 0]}>
        <mesh position={[0, 0.35, -1.65]}>
          <boxGeometry args={[0.045, 0.045, 3.55]} />
          <meshBasicMaterial color={color} transparent opacity={0.64} />
        </mesh>
      </group>
    )
  }

  return null
}

function SectionOrbitMenu({
  sections,
  activeIndex,
  setActiveIndex,
  color,
  isMobile,
  visible,
  onMenuEnter,
  onMenuLeave,
}: {
  sections: SectionData[]
  activeIndex: number
  setActiveIndex: (index: number) => void
  color: string
  isMobile: boolean
  visible: boolean
  onMenuEnter: () => void
  onMenuLeave: () => void
}) {
  return (
    // NOTE: drei's `pointerEvents` prop only works in transform mode — for
    // fullscreen mode the container div defaults to pointer-events:auto and
    // silently swallows every click meant for layers below (this is what
    // broke the portal links). The style prop is what actually lands on the
    // fullscreen container.
    <Html fullscreen zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: isMobile ? "52%" : "45%",
          width: isMobile ? 285 : 410,
          height: isMobile ? 285 : 340,
          transform: "translate(-64%, -50%)",
          opacity: visible ? 1 : 0,
          visibility: visible ? "visible" : "hidden",
          pointerEvents: "auto",
          fontFamily: "var(--font-sans), system-ui, -apple-system, sans-serif",
          perspective: 700,
          userSelect: "none",
          transition: "opacity 170ms ease, visibility 170ms ease",
        }}
        onPointerEnter={(event) => {
          event.stopPropagation()
          onMenuEnter()
        }}
        onPointerLeave={(event) => {
          event.stopPropagation()
          onMenuLeave()
        }}
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
      >
        {sections.map((section, index) => {
          const centered = index - (sections.length - 1) / 2
          const active = index === activeIndex
          const abs = Math.abs(centered)
          const y = centered * (isMobile ? 31 : 38)
          const x = -Math.cos(centered * 0.72) * (isMobile ? 18 : 34) + abs * (isMobile ? 5 : 10)
          const rotate = centered * -9
          const opacity = active ? 1 : Math.max(0.34, 0.68 - abs * 0.12)

          return (
            <button
              key={section.kind}
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setActiveIndex(index)
              }}
              onPointerEnter={(event) => {
                event.stopPropagation()
                onMenuEnter()
                setActiveIndex(index)
              }}
              onMouseEnter={() => {
                onMenuEnter()
                setActiveIndex(index)
              }}
              onFocus={() => setActiveIndex(index)}
              style={{
                position: "absolute",
                left: 0,
                top: "42%",
                transform: `translate3d(${x}px, ${y}px, ${-abs * 22}px) rotateZ(${rotate}deg) scale(${active ? 1 : 0.88})`,
                transformOrigin: "left center",
                border: 0,
                background: "transparent",
                minWidth: isMobile ? 104 : 142,
                padding: isMobile ? "12px 18px" : "14px 24px",
                marginLeft: -28,
                marginTop: -14,
                color: active ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.48)",
                opacity,
                cursor: "pointer",
                fontSize: isMobile ? (active ? 18 : 14) : active ? 24 : 18,
                fontWeight: active ? 900 : 780,
                lineHeight: 1,
                letterSpacing: active ? "0.01em" : "0.03em",
                textTransform: "uppercase",
                textShadow: active
                  ? `0 0 18px rgba(255,255,255,0.24), 0 0 16px ${color}66`
                  : `0 0 10px ${color}22`,
                transition: "transform 180ms ease, opacity 180ms ease, color 180ms ease, font-size 180ms ease",
                whiteSpace: "nowrap",
                textAlign: "left",
              }}
            >
              {section.label}
            </button>
          )
        })}
      </div>
    </Html>
  )
}

function ConceptSet({
  concept,
  color,
  seed,
  isMobile,
}: {
  concept: MoonConcept
  color: string
  seed: number
  isMobile: boolean
}) {
  const groupRef = useRef<Group>(null)

  useFrame((state) => {
    if (!groupRef.current) return
    if (concept === "skyArchive") groupRef.current.rotation.y = state.clock.elapsedTime * 0.045
    if (concept === "signalScope") groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.22) * 0.08
  })

  if (concept === "observatory") {
    return (
      <group ref={groupRef}>
        <MoonTerrain color={color} seed={seed} isMobile={isMobile} variant={concept} />
        <mesh position={[-2.8, -1.25, -2.2]} rotation={[0.22, 0.45, -0.15]}>
          <cylinderGeometry args={[0.1, 0.18, 1.3, 18]} />
          <meshStandardMaterial color="#81879b" emissive={color} emissiveIntensity={0.08} roughness={0.5} />
        </mesh>
        <mesh position={[-2.45, -0.52, -2.0]} rotation={[0.45, 0.22, -0.35]}>
          <cylinderGeometry args={[0.36, 0.46, 0.16, 40]} />
          <meshStandardMaterial color="#242a39" emissive={color} emissiveIntensity={0.16} roughness={0.38} metalness={0.42} />
        </mesh>
        {Array.from({ length: isMobile ? 12 : 18 }, (_, i) => {
          const angle = (i / (isMobile ? 12 : 18)) * Math.PI * 2
          const r = 3.2 + (i % 4) * 0.55
          return (
            <mesh key={i} position={[Math.cos(angle) * r, 2.05 + (i % 3) * 0.45, Math.sin(angle) * r]}>
              <sphereGeometry args={[i % 5 === 0 ? 0.045 : 0.028, 8, 8]} />
              <meshBasicMaterial color={i % 4 === 0 ? color : "#ffffff"} transparent opacity={0.74} />
            </mesh>
          )
        })}
      </group>
    )
  }

  if (concept === "walk") {
    return (
      <group ref={groupRef}>
        <MoonTerrain color={color} seed={seed} isMobile={isMobile} variant={concept} />
        {[-2, -1, 0, 1, 2].map((i) => (
          <mesh key={i} position={[i * 1.05, -2.49, -2.5 - Math.abs(i) * 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.18, 0.22, 26]} />
            <meshBasicMaterial color={color} transparent opacity={0.24} />
          </mesh>
        ))}
      </group>
    )
  }

  if (concept === "translator") {
    return (
      <group ref={groupRef}>
        <MoonTerrain color={color} seed={seed} isMobile={isMobile} variant={concept} />
        <mesh position={[0, -0.54, 0]} rotation={[0.18, 0.65, 0]}>
          <boxGeometry args={[0.1, 3.6, 0.1]} />
          <meshBasicMaterial color={color} transparent opacity={0.24} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, -0.42 + i * 0.42, 0]} rotation={[Math.PI / 2, 0.2 + i * 0.38, 0]}>
            <torusGeometry args={[1.05 + i * 0.38, 0.012, 8, 96]} />
            <meshBasicMaterial color={color} transparent opacity={0.2 - i * 0.035} />
          </mesh>
        ))}
      </group>
    )
  }

  if (concept === "craterMuseum") {
    return (
      <group ref={groupRef}>
        <MoonTerrain color={color} seed={seed} isMobile={isMobile} variant={concept} />
        {Array.from({ length: 6 }, (_, i) => {
          const angle = (i / 6) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(angle) * 4.25, -2.42, Math.sin(angle) * 4.25]}>
              <cylinderGeometry args={[0.1, 0.14, 0.55, 16]} />
              <meshStandardMaterial color="#767b8f" emissive={color} emissiveIntensity={0.12} roughness={0.65} />
            </mesh>
          )
        })}
      </group>
    )
  }

  if (concept === "signalScope") {
    return (
      <group ref={groupRef}>
        <MoonTerrain color={color} seed={seed} isMobile={isMobile} variant={concept} />
        {[1.15, 1.9, 2.75, 3.6].map((r, i) => (
          <mesh key={r} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[r, 0.014, 8, 120]} />
            <meshBasicMaterial color={color} transparent opacity={0.28 - i * 0.045} />
          </mesh>
        ))}
        {[-2, -1, 0, 1, 2].map((i) => (
          <mesh key={i} position={[i * 0.25, -1.58 + Math.abs(i) * 0.18, -3.05]}>
            <boxGeometry args={[0.08, 0.48 + Math.abs(i) * 0.2, 0.08]} />
            <meshBasicMaterial color={color} transparent opacity={0.46} />
          </mesh>
        ))}
      </group>
    )
  }

  if (concept === "skyArchive") {
    return (
      <group ref={groupRef}>
        <MoonTerrain color={color} seed={seed} isMobile={isMobile} variant={concept} />
        {[2.45, 3.25, 4.05].map((r, i) => (
          <mesh key={r} position={[0, 1.15 + i * 0.42, 0]} rotation={[Math.PI / 2.65, 0.15 + i * 0.28, 0]}>
            <torusGeometry args={[r, 0.018, 8, 128]} />
            <meshBasicMaterial color={color} transparent opacity={0.25 - i * 0.045} />
          </mesh>
        ))}
      </group>
    )
  }

  return (
    <group ref={groupRef}>
      <MoonTerrain color={color} seed={seed} isMobile={isMobile} variant={concept} />
      <Html position={[0, -1.05, -4.6]} transform sprite distanceFactor={isMobile ? 9 : 6.4} pointerEvents="none">
        <div
          style={{
            width: isMobile ? 235 : 360,
            height: isMobile ? 92 : 128,
            border: `1px solid ${color}18`,
            borderRadius: "18px 18px 9px 9px",
            background: moonGlassBackground(color),
            boxShadow: `inset 0 0 18px ${color}0d, ${MOON_GLASS_SHADOW}`,
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
          }}
        />
      </Html>
    </group>
  )
}

function InfoDeck({
  concept,
  sections,
  activeIndex,
  setActiveIndex,
  landmark,
  universe,
  isMobile,
}: {
  concept: MoonConcept
  sections: SectionData[]
  activeIndex: number
  setActiveIndex: (index: number) => void
  landmark: Landmark
  universe: Universe
  isMobile: boolean
}) {
  const [imageIndex, setImageIndex] = useState(0)
  const active = sections[activeIndex] ?? sections[0]
  const color = landmark.color
  const links = useMemo(() => {
    const out: { label: string; url: string }[] = []
    if (landmark.link) out.push({ label: universe === "professional" ? "View project" : "Open portal", url: landmark.link })
    if (landmark.links) out.push(...landmark.links)
    return out
  }, [landmark.link, landmark.links, universe])

  useEffect(() => {
    setImageIndex(0)
  }, [landmark.name, active?.kind])

  const shell: CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    fontFamily: "var(--font-sans), system-ui, -apple-system, sans-serif",
  }
  const panel: CSSProperties = isMobile
    ? {
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 70,
        maxHeight: "44vh",
        pointerEvents: "auto",
      }
    : {
        position: "absolute",
        right: 28,
        top: 116,
        width: 410,
        maxHeight: "calc(100vh - 210px)",
        pointerEvents: "auto",
      }

  return (
    // Same drei gotcha as SectionOrbitMenu: pointer-events none must go via
    // `style` to reach the fullscreen container.
    <Html fullscreen zIndexRange={[18, 0]} style={{ pointerEvents: "none" }}>
      <div style={shell}>
        <style>{`
          @keyframes moon-ui-in {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div style={panel} data-moon-swipe-ignore>
          <div
            // Keyed per moon so hopping moons replays the entrance — the
            // panel eases in after the diorama starts crystallizing.
            key={landmark.name}
            style={{
              animation: "moon-ui-in 0.55s ease 0.4s backwards",
              borderRadius: isMobile ? 14 : 16,
              overflow: "hidden",
              background: moonGlassBackground(color),
              border: `1px solid ${color}24`,
              boxShadow: `0 0 22px ${color}10, 0 14px 34px rgba(0,0,0,0.16)`,
              backdropFilter: "blur(22px)",
              WebkitBackdropFilter: "blur(22px)",
              color: "white",
              display: "flex",
              flexDirection: "column",
              maxHeight: "inherit",
            }}
          >
            <div style={{ height: 1, background: `linear-gradient(90deg, ${color}55, ${color}18, transparent 78%)` }} />
            <div style={{ padding: isMobile ? 12 : 16, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color, fontSize: isMobile ? 9 : 10, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>
                    {active.label}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.48)", fontSize: isMobile ? 10 : 11, fontWeight: 650 }}>
                    {active.kicker}
                  </div>
                </div>
              </div>

              <div
                style={{
                  minHeight: 0,
                  maxHeight: isMobile ? "25vh" : "38vh",
                  overflowY: "auto",
                  paddingRight: 4,
                  color: "rgba(255,255,255,0.82)",
                  fontSize: isMobile ? 12 : 13,
                  lineHeight: 1.55,
                }}
              >
                {active.kind === "title" && (
                  <div style={{ fontSize: isMobile ? 19 : 25, fontWeight: 850, lineHeight: 1.1 }}>{active.body}</div>
                )}

                {active.kind === "desc" && active.body}

                {active.kind === "tech" && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {landmark.technologies.map((item) => (
                      <span
                        key={item}
                        style={{
                          padding: "5px 8px",
                          borderRadius: 7,
                          background: moonGlassBackground(color),
                          border: `1px solid ${color}20`,
                          color: `${color}e8`,
                          fontSize: isMobile ? 10 : 11,
                          fontWeight: 650,
                        }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}

                {active.kind === "link" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {links.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "9px 11px",
                          borderRadius: 9,
                          background: moonGlassBackground(color),
                          border: `1px solid ${color}24`,
                          color,
                          textDecoration: "none",
                          fontSize: isMobile ? 11 : 12,
                          fontWeight: 750,
                          backdropFilter: "blur(16px)",
                          WebkitBackdropFilter: "blur(16px)",
                        }}
                      >
                        <span>{link.label}</span>
                        <span aria-hidden="true">open</span>
                      </a>
                    ))}
                  </div>
                )}

                {active.kind === "images" && landmark.images?.length && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 9, minHeight: 0 }}>
                    <img
                      src={landmark.images[imageIndex]}
                      alt={`${landmark.name} ${imageIndex + 1}`}
                      style={{
                        width: "100%",
                        maxHeight: isMobile ? "19vh" : 260,
                        minHeight: isMobile ? 112 : 170,
                        objectFit: "contain",
                        borderRadius: 10,
                        border: `1px solid ${color}35`,
                        display: "block",
                        background: "rgba(0,0,0,0.18)",
                      }}
                    />
                    {landmark.images.length > 1 && (
                      <div
                        style={{
                          position: "sticky",
                          bottom: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          paddingTop: 2,
                          background: "linear-gradient(180deg, transparent, rgba(8,10,24,0.18))",
                        }}
                      >
                        <button type="button" onClick={() => setImageIndex((i) => Math.max(0, i - 1))} style={miniButton(color)} disabled={imageIndex === 0} aria-label="Previous image">
                          <ChevronLeft size={14} />
                        </button>
                        <span style={{ color: "rgba(255,255,255,0.48)", fontSize: 10 }}>{imageIndex + 1} / {landmark.images.length}</span>
                        <button type="button" onClick={() => setImageIndex((i) => Math.min(landmark.images!.length - 1, i + 1))} style={miniButton(color)} disabled={imageIndex === landmark.images.length - 1} aria-label="Next image">
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Html>
  )
}

function miniButton(color: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    border: `1px solid ${color}24`,
    background: moonGlassBackground(color),
    color,
    borderRadius: 8,
    padding: 0,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    cursor: "pointer",
    pointerEvents: "auto",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    boxShadow: `0 0 14px ${color}0d`,
  }
}

export default function MoonView({ landmark, seed, universe, isMobile = false }: MoonViewProps) {
  const concept = useMemo(() => conceptForLandmark(landmark, seed), [landmark, seed])
  const sections = useMemo(() => makeSections(landmark, universe), [landmark, universe])
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuVisible, setMenuVisible] = useState(isMobile)
  const hideMenuRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const positions = useMemo(() => sectionPositions(concept, sections.length, isMobile), [concept, isMobile, sections.length])

  const showMenu = () => {
    if (hideMenuRef.current) {
      clearTimeout(hideMenuRef.current)
      hideMenuRef.current = null
    }
    setMenuVisible(true)
  }

  const scheduleHideMenu = () => {
    if (isMobile) return
    if (hideMenuRef.current) clearTimeout(hideMenuRef.current)
    hideMenuRef.current = setTimeout(() => {
      setMenuVisible(false)
      hideMenuRef.current = null
    }, 420)
  }

  useEffect(() => {
    setActiveIndex(0)
  }, [landmark.name, sections.length])

  // Mobile: vertical swipe steps through the sections (swipe up = next,
  // swipe down = previous) — more intuitive than aiming at the orbit menu.
  // Swipes that start inside the scrollable info panel keep native scrolling
  // (it carries data-moon-swipe-ignore). One-finger rotate is disabled for
  // the mobile moon view in solar-portfolio.tsx so swipes don't fight the
  // camera.
  useEffect(() => {
    if (!isMobile) return

    let startX = 0
    let startY = 0
    let startTime = 0
    let tracking = false

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      const target = event.target as Element | null
      if (target?.closest?.("[data-moon-swipe-ignore]")) return
      tracking = true
      startX = event.touches[0].clientX
      startY = event.touches[0].clientY
      startTime = performance.now()
    }

    const onTouchEnd = (event: TouchEvent) => {
      if (!tracking) return
      tracking = false
      const touch = event.changedTouches[0]
      if (!touch) return
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      const elapsed = performance.now() - startTime
      // Quick, predominantly-vertical flicks only.
      if (elapsed > 650) return
      if (Math.abs(dy) < 56 || Math.abs(dy) < Math.abs(dx) * 1.4) return
      const step = dy < 0 ? 1 : -1
      setActiveIndex((index) =>
        Math.min(sections.length - 1, Math.max(0, index + step)),
      )
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchend", onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchend", onTouchEnd)
    }
  }, [isMobile, sections.length])

  useEffect(() => {
    setMenuVisible(isMobile)
  }, [isMobile, landmark.name])

  useEffect(() => {
    return () => {
      if (hideMenuRef.current) clearTimeout(hideMenuRef.current)
    }
  }, [])

  return (
    <group>
      {/* Crystal first, world second: the crystal is the continuity anchor
          from the planet scene; the rest of the diorama crystallizes in
          around it. Keyed per landmark so moon-hopping re-materializes. */}
      <DataCrystal
        color={landmark.color}
        seed={seed}
        onMenuEnter={showMenu}
        onMenuLeave={scheduleHideMenu}
      />
      <MaterializeIn key={landmark.name}>
        <ConceptSet concept={concept} color={landmark.color} seed={seed + hashString(landmark.name) * 0.0001} isMobile={isMobile} />
        {sections.map((section, index) => (
          <SectionBeacon
            key={section.kind}
            concept={concept}
            position={positions[index]}
            active={index === activeIndex}
            color={landmark.color}
            onSelect={() => setActiveIndex(index)}
          />
        ))}
        <ActiveProjection
          concept={concept}
          activeIndex={activeIndex}
          total={sections.length}
          positions={positions}
          color={landmark.color}
        />
      </MaterializeIn>
      <SectionOrbitMenu
        sections={sections}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
        color={landmark.color}
        isMobile={isMobile}
        visible={isMobile || menuVisible}
        onMenuEnter={showMenu}
        onMenuLeave={scheduleHideMenu}
      />
      <InfoDeck
        concept={concept}
        sections={sections}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
        landmark={landmark}
        universe={universe}
        isMobile={isMobile}
      />

      <ambientLight intensity={0.28} />
      <directionalLight position={[8, 8, 5]} intensity={0.9} />
      <pointLight position={[-5, 2, 4]} intensity={0.55} color={landmark.color} />
      <pointLight position={[4, -0.4, -5]} intensity={0.45} color={landmark.color} />
    </group>
  )
}
