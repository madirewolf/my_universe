"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode, type TouchEvent as ReactTouchEvent } from "react"
import { Html } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { ChevronLeft, ChevronRight } from "lucide-react"
import * as THREE from "three"
import type { Group, Mesh } from "three"
import type { ThreeEvent } from "@react-three/fiber"
import type { Landmark, Universe } from "@/lib/constants"
import { makeCrystalMoon } from "./planet"

type CardKind = "desc" | "tech" | "link" | "images" | "note"
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
  display?: "chips" | "text"
}

interface MoonViewProps {
  landmark: Landmark
  seed: number
  universe: Universe
  isMobile?: boolean
  /** Mobile: horizontal swipe on the moon steps to the prev/next moon. */
  onPrevMoon?: () => void
  onNextMoon?: () => void
}

const CRYSTAL_RADIUS = 1.55
const SECTION_LABELS: Record<Universe, Record<CardKind, string>> = {
  professional: {
    desc: "About",
    tech: "Stack",
    link: "Portal",
    images: "Gallery",
    note: "Note",
  },
  personal: {
    desc: "",
    tech: "Details",
    link: "Link",
    images: "Evidence",
    note: "Note",
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
  "currently spinning": "walk",
  "genre atlas": "translator",
  "what music means to me": "walk",
  "the question underneath": "walk",
  "how i frame it": "translator",
  "two-pronged mental health": "observatory",
  "what i'm building toward": "skyArchive",
  "what i keep": "craterMuseum",
  "why i named her nyx": "translator",
  "gallery": "craterMuseum",
  "letterboxd · @madirewolf": "skyArchive",
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

function isNatureLandmark(landmark: Landmark): boolean {
  const key = `${landmark.name} ${landmark.category} ${landmark.technologies.join(" ")}`.toLowerCase()
  return (
    key.includes("wadi rum") ||
    key.includes("petra") ||
    key.includes("dead sea") ||
    key.includes("persian gulf") ||
    key.includes("kuwait") ||
    key.includes("muskoka") ||
    key.includes("backcountry") ||
    key.includes("canoe") ||
    key.includes("nature means")
  )
}

// (The data crystal's geometry now comes from planet.tsx's makeCrystalMoon —
// same recipe + same seed as the orbiting moon, so they're identical twins.)

function makeSections(landmark: Landmark, universe: Universe): SectionData[] {
  const labels = SECTION_LABELS[universe]
  const natureMode = universe === "personal" && isNatureLandmark(landmark)
  const sections: SectionData[] = []

  sections.push({
    kind: "desc",
    label: natureMode ? "Memory" : landmark.sectionLabels?.story ?? labels.desc,
    kicker: natureMode
      ? landmark.category
      : landmark.sectionKickers?.story ?? (universe === "personal" ? "" : "what it does"),
    body: landmark.description,
  })

  if (!natureMode && !landmark.hideTech && (landmark.technologies.length > 0 || landmark.techAsText)) {
    sections.push({
      kind: "tech",
      label: landmark.sectionLabels?.tech ?? labels.tech,
      kicker: landmark.sectionKickers?.tech ?? (universe === "personal" ? "details" : "tools / systems"),
      body: landmark.techAsText ?? landmark.technologies.join(" / "),
      display: landmark.techAsText ? "text" : "chips",
    })
  }

  if (landmark.notes?.length) {
    landmark.notes.forEach((note) => {
      sections.push({
        kind: "note",
        label: note.label,
        kicker: note.kicker ?? "field note",
        body: note.body,
      })
    })
  }

  if (landmark.link || landmark.links?.length) {
    const count = (landmark.link ? 1 : 0) + (landmark.links?.length ?? 0)
    sections.push({
      kind: "link",
      label: landmark.sectionLabels?.link ?? labels.link,
      kicker: landmark.sectionKickers?.link ?? (count > 1 ? `${count} links` : "external link"),
      body: count > 1 ? "Open one of the linked artifacts." : "Open the linked artifact.",
    })
  }

  if (landmark.images?.length) {
    sections.push({
      kind: "images",
      label: natureMode ? "Gallery" : landmark.sectionLabels?.images ?? labels.images,
      kicker: landmark.sectionKickers?.images ?? `${landmark.images.length} visual artifact${landmark.images.length === 1 ? "" : "s"}`,
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
  delay = 0.08,
  duration = 1.45,
}: {
  children: React.ReactNode
  delay?: number
  duration?: number
}) {
  const ref = useRef<Group>(null)
  const startRef = useRef<number | null>(null)
  const completeRef = useRef(false)

  useFrame((state) => {
    if (!ref.current || completeRef.current) return
    if (startRef.current === null) startRef.current = state.clock.elapsedTime
    const t = state.clock.elapsedTime - startRef.current - delay
    const k = Math.min(Math.max(t / duration, 0), 1)
    const eased = k * k * k * (k * (k * 6 - 15) + 10)
    ref.current.scale.setScalar(0.72 + eased * 0.28)
    ref.current.visible = t > -0.02
    ref.current.traverse((obj) => {
      const material = (obj as Mesh).material
      if (!material) return
      const materials = Array.isArray(material) ? material : [material]
      materials.forEach((mat) => {
        const m = mat as THREE.Material & {
          opacity?: number
          userData: Record<string, unknown>
        }
        if (typeof m.opacity !== "number") return
        if (m.userData.materializeBaseOpacity === undefined) {
          m.userData.materializeBaseOpacity = m.opacity
          m.userData.materializeBaseTransparent = m.transparent
        }
        const baseOpacity = m.userData.materializeBaseOpacity as number
        const baseTransparent = m.userData.materializeBaseTransparent as boolean
        m.opacity = baseOpacity * eased
        m.transparent = eased < 0.999 || baseTransparent || baseOpacity < 0.999
        m.needsUpdate = true
      })
    })
    if (k >= 1) completeRef.current = true
  })

  return (
    <group ref={ref} scale={0.72} visible={false}>
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
  if (total <= 0) return null

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
              key={`${section.kind}-${section.label}`}
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
  landmark,
  universe,
  isMobile,
}: {
  concept: MoonConcept
  sections: SectionData[]
  activeIndex: number
  landmark: Landmark
  universe: Universe
  isMobile: boolean
}) {
  const color = landmark.color
  const textSections = useMemo(() => sections.filter((section) => section.kind === "desc" || section.kind === "note"), [sections])
  const tagSection = sections.find((section) => section.kind === "tech")
  const linkSection = sections.find((section) => section.kind === "link")
  const gallerySection = sections.find((section) => section.kind === "images")
  const activeText = textSections[Math.min(activeIndex, Math.max(0, textSections.length - 1))] ?? textSections[0]
  const rightTextSection = !isMobile && textSections.length === 2 && !tagSection && !gallerySection && !linkSection
    ? textSections[(activeIndex + 1) % 2]
    : undefined
  const forceTechRight = !isMobile && landmark.name === "Currently Spinning"
  const links = useMemo(() => {
    const out: { label: string; url: string }[] = []
    if (landmark.link) out.push({ label: universe === "professional" ? "View project" : "Open link", url: landmark.link })
    if (landmark.links) out.push(...landmark.links)
    return out
  }, [landmark.link, landmark.links, universe])

  const shell: CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    fontFamily: "var(--font-sans), system-ui, -apple-system, sans-serif",
  }
  const leftColumn: CSSProperties = isMobile
    ? {
        position: "absolute",
        left: 12,
        right: 12,
        bottom: activeText || links.length ? 305 : 70,
        maxHeight: "30vh",
        pointerEvents: "auto",
      }
    : {
        position: "absolute",
        left: 24,
        // Sits below the (taller, two-row) "Current Planet" header. Bottom is
        // bounded so a full gallery never collides with the mute/stasis
        // buttons in the lower-left.
        top: 128,
        width: "clamp(300px, 24vw, 440px)",
        maxHeight: "calc(100vh - 220px)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        pointerEvents: "auto",
      }
  const rightColumn: CSSProperties = isMobile
    ? {
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 70,
        maxHeight: "38vh",
        pointerEvents: "auto",
      }
    : {
        position: "absolute",
        right: 24,
        top: 116,
        width: "clamp(330px, 24vw, 500px)",
        maxHeight: links.length ? "calc(100vh - 310px)" : "calc(100vh - 170px)",
        pointerEvents: "auto",
      }
  const linkPanel: CSSProperties = isMobile
    ? {
        position: "absolute",
        right: 12,
        bottom: 12,
        width: "min(360px, calc(100vw - 24px))",
        pointerEvents: "auto",
      }
    : {
        position: "absolute",
        right: 24,
        bottom: 32,
        width: "clamp(330px, 24vw, 500px)",
        pointerEvents: "auto",
      }
  // Desktop: two flex columns, each spanning from just under the top buttons
  // down to an offset above the bottom buttons. The TOP panel takes the slack
  // (flex 0 1 auto + inner scroll) and the BOTTOM panel rides directly under
  // it — foolproof across viewport heights / browser zoom (no magic numbers).
  const columnBase: CSSProperties = {
    position: "absolute",
    top: 116,
    bottom: 104,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    pointerEvents: "auto",
  }
  const leftStack: CSSProperties = { ...columnBase, left: 24, width: "clamp(300px, 24vw, 460px)" }
  const rightStack: CSSProperties = { ...columnBase, right: 24, width: "clamp(330px, 24vw, 500px)" }

  // Mobile keeps its stacked bottom-sheet arrangement; rightPanelContent /
  // showRight feed that branch only.
  const leftHasContent = Boolean(gallerySection || tagSection)
  const rightPanelContent: ReactNode = activeText ? (
    <TextContent color={color} isMobile={isMobile} section={activeText} />
  ) : tagSection ? (
    <TagsContent color={color} isMobile={isMobile} landmark={landmark} section={tagSection} />
  ) : gallerySection && landmark.images?.length ? (
    <GalleryContent color={color} images={landmark.images} isMobile={isMobile} landmarkName={landmark.name} section={gallerySection} />
  ) : null
  const showRight = Boolean(
    activeText ||
      (!leftHasContent && tagSection) ||
      (!leftHasContent && gallerySection && landmark.images?.length),
  )

  // Desktop content placement favors clean two-panel splits. With three or
  // more panels, tags can stack under text again.
  const hasText = Boolean(activeText)
  const hasRightText = Boolean(rightTextSection)
  const hasTags = Boolean(tagSection)
  const hasGallery = Boolean(gallerySection && landmark.images?.length)
  const showPortal = Boolean(linkSection && links.length > 0)
  const desktopPanelCount = [hasText, hasTags, hasGallery, showPortal].filter(Boolean).length
  const splitDesktopPair = desktopPanelCount === 2
  const portalPairsWithGalleryOnly = splitDesktopPair && showPortal && hasGallery && !hasText && !hasTags
  const leftHasText = hasText
  const leftHasTags = hasTags && (!splitDesktopPair || !hasText) && !forceTechRight
  const leftHasPortal = portalPairsWithGalleryOnly
  const rightHasTags = (hasTags && splitDesktopPair && hasText) || (forceTechRight && hasTags)
  const rightHasGallery = hasGallery
  const rightHasPortal = showPortal && !leftHasPortal
  const showLeftStack = leftHasText || leftHasTags || leftHasPortal
  const showRightStack = rightHasTags || rightHasGallery || rightHasPortal || hasRightText

  return (
    <Html fullscreen zIndexRange={[18, 0]} style={{ pointerEvents: "none" }}>
      <div style={shell}>
        <style>{`
          @keyframes moon-ui-in {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {isMobile ? (
          <>
            {leftHasContent && (
              <div style={leftColumn} data-moon-swipe-ignore>
                {gallerySection && landmark.images?.length ? (
                  <MoonPanel color={color} isMobile={isMobile} maxHeight="inherit">
                    <GalleryContent
                      color={color}
                      images={landmark.images}
                      isMobile={isMobile}
                      landmarkName={landmark.name}
                      section={gallerySection}
                    />
                  </MoonPanel>
                ) : null}
                {tagSection ? (
                  <MoonPanel color={color} isMobile={isMobile} maxHeight={gallerySection ? "16vh" : "inherit"}>
                    <TagsContent color={color} isMobile={isMobile} landmark={landmark} section={tagSection} />
                  </MoonPanel>
                ) : null}
              </div>
            )}
            {showRight && (
              <div style={rightColumn} data-moon-swipe-ignore>
                <MoonPanel color={color} isMobile={isMobile} maxHeight="inherit">
                  {rightPanelContent}
                </MoonPanel>
              </div>
            )}
            {showPortal && (
              <div style={linkPanel} data-moon-swipe-ignore>
                <MoonPanel color={color} isMobile={isMobile}>
                  <LinkContent color={color} isMobile={isMobile} links={links} section={linkSection!} />
                </MoonPanel>
              </div>
            )}
          </>
        ) : (
          <>
            {/* LEFT: text first; tags stay here unless this is a two-panel text/tag moon. */}
            {showLeftStack && (
              <div style={leftStack} data-moon-swipe-ignore>
                {leftHasText && (
                  <MoonPanel color={color} isMobile={isMobile} maxHeight="100%" fill style={{ flex: "0 1 auto", minHeight: 0 }}>
                    <TextContent color={color} isMobile={isMobile} section={activeText!} />
                  </MoonPanel>
                )}
                {leftHasTags && (
                  <MoonPanel color={color} isMobile={isMobile} style={{ flex: "0 0 auto" }}>
                    <TagsContent color={color} isMobile={isMobile} landmark={landmark} section={tagSection!} />
                  </MoonPanel>
                )}
                {leftHasPortal && (
                  <MoonPanel color={color} isMobile={isMobile} style={{ flex: "0 0 auto" }}>
                    <LinkContent color={color} isMobile={isMobile} links={links} section={linkSection!} />
                  </MoonPanel>
                )}
              </div>
            )}

            {/* RIGHT: galleries live here; two-panel text/tag moons put tags here too. */}
            {showRightStack && (
              <div style={rightStack} data-moon-swipe-ignore>
                {hasRightText && rightTextSection && (
                  <MoonPanel color={color} isMobile={isMobile} maxHeight="100%" style={{ flex: "0 1 auto", minHeight: 0 }} fill>
                    <TextContent color={color} isMobile={isMobile} section={rightTextSection} />
                  </MoonPanel>
                )}
                {rightHasTags && (
                  <MoonPanel color={color} isMobile={isMobile} style={{ flex: "0 0 auto" }}>
                    <TagsContent color={color} isMobile={isMobile} landmark={landmark} section={tagSection!} />
                  </MoonPanel>
                )}
                {rightHasGallery && (
                  <MoonPanel color={color} isMobile={isMobile} maxHeight="100%" style={{ flex: "0 1 auto", minHeight: 0 }}>
                    <GalleryContent color={color} images={landmark.images!} isMobile={isMobile} landmarkName={landmark.name} section={gallerySection!} />
                  </MoonPanel>
                )}
                {rightHasPortal && (
                  <MoonPanel color={color} isMobile={isMobile} style={{ flex: "0 0 auto" }}>
                    <LinkContent color={color} isMobile={isMobile} links={links} section={linkSection!} />
                  </MoonPanel>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Html>
  )
}

function LegacyInfoDeck({
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
        width: 460,
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
                  fontSize: isMobile ? 14 : 16,
                  lineHeight: 1.62,
                }}
              >
                {(active.kind === "desc" || active.kind === "note") && active.body}

                {active.kind === "tech" && active.display === "text" && active.body}

                {active.kind === "tech" && active.display !== "text" && (
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

function MoonPanel({
  children,
  color,
  isMobile,
  maxHeight,
  style,
  fill,
}: {
  children: ReactNode
  color: string
  isMobile: boolean
  maxHeight?: CSSProperties["maxHeight"]
  /** Extra styles merged onto the panel root (e.g. flex sizing in a column). */
  style?: CSSProperties
  /** Let the inner content area grow to fill the panel so its own scroll
   *  region (not a magic vh cap) handles overflow. Used by the auto-fitting
   *  right-hand text panel. */
  fill?: boolean
}) {
  return (
    <div
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
        maxHeight,
        ...style,
      }}
    >
      <div style={{ height: 1, background: `linear-gradient(90deg, ${color}55, ${color}18, transparent 78%)` }} />
      <div style={{ padding: isMobile ? 12 : 16, minHeight: 0, display: "flex", flexDirection: "column", ...(fill ? { flex: 1 } : null) }}>{children}</div>
    </div>
  )
}

function SectionHeader({
  color,
  isMobile,
  section,
}: {
  color: string
  isMobile: boolean
  section: SectionData
}) {
  return (
    <div style={{ minWidth: 0, marginBottom: 12 }}>
      <div style={{ color, fontSize: isMobile ? 9 : 10, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>
        {section.label}
      </div>
      <div style={{ color: "rgba(255,255,255,0.48)", fontSize: isMobile ? 10 : 11, fontWeight: 650 }}>
        {section.kicker}
      </div>
    </div>
  )
}

function TextContent({ color, isMobile, section, flush = false }: { color: string; isMobile: boolean; section: SectionData; flush?: boolean }) {
  return (
    <>
      <SectionHeader color={color} isMobile={isMobile} section={section} />
      <div
        style={{
          minHeight: 0,
          // flush (mobile sheet): no inner cap/scroll, the bubble flows full
          // height and the SHEET scrolls. Desktop fills its auto-fit panel;
          // plain mobile keeps a viewport cap.
          flex: !isMobile && !flush ? 1 : undefined,
          maxHeight: flush ? undefined : isMobile ? "27vh" : undefined,
          overflowY: flush ? "visible" : "auto",
          paddingRight: 4,
          color: "rgba(255,255,255,0.84)",
          fontSize: isMobile ? 15 : 17,
          lineHeight: 1.66,
        }}
      >
        {section.body}
      </div>
    </>
  )
}

function TagsContent({
  color,
  isMobile,
  landmark,
  section,
  flush = false,
}: {
  color: string
  isMobile: boolean
  landmark: Landmark
  section: SectionData
  flush?: boolean
}) {
  return (
    <>
      <SectionHeader color={color} isMobile={isMobile} section={section} />
      <div
        style={{
          minHeight: 0,
          maxHeight: flush ? undefined : isMobile ? "12vh" : "22vh",
          overflowY: flush ? "visible" : "auto",
          paddingRight: 4,
          color: "rgba(255,255,255,0.82)",
          fontSize: isMobile ? 13 : 15,
          lineHeight: 1.55,
        }}
      >
        {section.display === "text" ? (
          section.body
        ) : (
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
      </div>
    </>
  )
}

function GalleryContent({
  color,
  images,
  isMobile,
  landmarkName,
  section,
}: {
  color: string
  images: string[]
  isMobile: boolean
  landmarkName: string
  section: SectionData
}) {
  const [imageIndex, setImageIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [naturalSize, setNaturalSize] = useState({ width: 16, height: 10 })
  // Desktop hover-magnifier (Amazon-style): origin tracks the cursor so moving
  // around the image magnifies whichever part you point at, not a fixed center.
  const [zoom, setZoom] = useState({ active: false, x: 50, y: 50 })
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const touchDidSwipe = useRef(false)
  const src = images[Math.min(imageIndex, images.length - 1)]

  useEffect(() => {
    setImageIndex(0)
    setExpanded(false)
    setZoom({ active: false, x: 50, y: 50 })
    setNaturalSize({ width: 16, height: 10 })
  }, [landmarkName, images])

  if (!src) return null

  const step = (dir: number) => {
    setImageIndex((index) => Math.max(0, Math.min(images.length - 1, index + dir)))
  }
  const onTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchStart.current
    touchStart.current = null
    const touch = event.changedTouches[0]
    if (!start || !touch) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) * 1.25) return
    touchDidSwipe.current = true
    step(dx < 0 ? 1 : -1)
  }

  return (
    <>
      <SectionHeader color={color} isMobile={isMobile} section={section} />
      <div style={{ display: "flex", flexDirection: "column", gap: 9, minHeight: 0 }}>
        <div
          onMouseEnter={isMobile ? undefined : () => setZoom((z) => ({ ...z, active: true }))}
          onMouseLeave={isMobile ? undefined : () => setZoom((z) => ({ ...z, active: false }))}
          onMouseMove={
            isMobile
              ? undefined
              : (event) => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  const x = ((event.clientX - rect.left) / rect.width) * 100
                  const y = ((event.clientY - rect.top) / rect.height) * 100
                  setZoom({
                    active: true,
                    x: Math.max(0, Math.min(100, x)),
                    y: Math.max(0, Math.min(100, y)),
                  })
                }
          }
          onClick={isMobile ? () => {
            if (touchDidSwipe.current) {
              touchDidSwipe.current = false
              return
            }
            setExpanded(true)
          } : undefined}
          onTouchStart={(event) => {
            const touch = event.touches[0]
            touchDidSwipe.current = false
            if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY }
          }}
          onTouchEnd={onTouchEnd}
          style={{
            width: "100%",
            aspectRatio: `${naturalSize.width} / ${naturalSize.height}`,
            maxHeight: isMobile ? "25vh" : "min(58vh, 540px)",
            minHeight: isMobile ? 132 : 170,
            borderRadius: 11,
            border: `1px solid ${color}35`,
            background: "rgba(0,0,0,0.18)",
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
            cursor: "zoom-in",
          }}
        >
          <img
            src={src}
            alt={`${landmarkName} ${imageIndex + 1}`}
            draggable={false}
            onLoad={(event) => {
              const image = event.currentTarget
              if (image.naturalWidth && image.naturalHeight) {
                setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight })
              }
            }}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
              // Magnify the part under the cursor; origin follows the pointer.
              transform: !isMobile && zoom.active ? "scale(2.4)" : "scale(1)",
              transformOrigin: `${zoom.x}% ${zoom.y}%`,
              transition: "transform 0.16s ease-out",
              willChange: "transform",
            }}
          />
        </div>
        {images.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <button type="button" onClick={() => step(-1)} style={miniButton(color)} disabled={imageIndex === 0} aria-label="Previous image">
              <ChevronLeft size={14} />
            </button>
            <span style={{ color: "rgba(255,255,255,0.48)", fontSize: 10 }}>{imageIndex + 1} / {images.length}</span>
            <button type="button" onClick={() => step(1)} style={miniButton(color)} disabled={imageIndex === images.length - 1} aria-label="Next image">
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
      {expanded && (
        <div
          onClick={isMobile ? () => setExpanded(false) : undefined}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            display: "grid",
            placeItems: "center",
            pointerEvents: isMobile ? "auto" : "none",
            background: isMobile ? "rgba(4,6,16,0.68)" : "transparent",
            backdropFilter: isMobile ? "blur(12px)" : undefined,
            WebkitBackdropFilter: isMobile ? "blur(12px)" : undefined,
          }}
        >
          <img
            src={src}
            alt={`${landmarkName} enlarged ${imageIndex + 1}`}
            style={{
              maxWidth: isMobile ? "92vw" : "70vw",
              maxHeight: isMobile ? "78vh" : "78vh",
              objectFit: "contain",
              borderRadius: 16,
              border: `1px solid ${color}35`,
              boxShadow: `0 24px 90px rgba(0,0,0,0.5), 0 0 50px ${color}20`,
              background: "rgba(0,0,0,0.34)",
            }}
          />
        </div>
      )}
    </>
  )
}

function LinkContent({
  color,
  isMobile,
  links,
  section,
}: {
  color: string
  isMobile: boolean
  links: { label: string; url: string }[]
  section: SectionData
}) {
  return (
    <>
      <SectionHeader color={color} isMobile={isMobile} section={section} />
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
    </>
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

// Mobile bottom-sheet: the moon owns the top of the screen; a peek of the
// stitched panel list sits at the bottom. Swipe up to expand into the full
// scrollable list of bubbles, swipe down (from the top) to collapse. The
// horizontal swipe-to-step-moons gesture lives in MoonView's window handler.
function MobileMoonSheet({
  sections,
  landmark,
  universe,
  expanded,
  setExpanded,
  scrollRef,
}: {
  sections: SectionData[]
  landmark: Landmark
  universe: Universe
  expanded: boolean
  setExpanded: (v: boolean) => void
  scrollRef: MutableRefObject<HTMLDivElement | null>
}) {
  const color = landmark.color
  const textSections = sections.filter((s) => s.kind === "desc" || s.kind === "note")
  const tagSection = sections.find((s) => s.kind === "tech")
  const gallerySection = sections.find((s) => s.kind === "images")
  const linkSection = sections.find((s) => s.kind === "link")
  const links = useMemo(() => {
    const out: { label: string; url: string }[] = []
    if (landmark.link) out.push({ label: universe === "professional" ? "View project" : "Open link", url: landmark.link })
    if (landmark.links) out.push(...landmark.links)
    return out
  }, [landmark.link, landmark.links, universe])

  return (
    <Html fullscreen zIndexRange={[18, 0]} style={{ pointerEvents: "none" }}>
      <style>{`@keyframes moon-ui-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div
        data-moon-sheet
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "84vh",
          transform: expanded ? "translateY(0)" : "translateY(48vh)",
          transition: "transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(180deg, rgba(8,11,20,0.66), rgba(7,10,18,0.93))",
          borderTop: `1px solid ${color}33`,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          boxShadow: `0 -12px 44px rgba(0,0,0,0.5), 0 0 30px ${color}14`,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          pointerEvents: "auto",
          touchAction: "pan-y",
          fontFamily: "var(--font-sans), system-ui, -apple-system, sans-serif",
        }}
      >
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Collapse details" : "Expand details"}
          style={{
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            padding: "11px 0 9px",
            width: "100%",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          <span style={{ width: 42, height: 4, borderRadius: 999, background: `${color}66` }} />
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.42)" }}>
            {expanded ? "Swipe down to close" : "Swipe up for details"}
          </span>
        </button>

        <div
          ref={scrollRef}
          data-moon-sheet-scroll
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: expanded ? "auto" : "hidden",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: "2px 14px 26px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {textSections.map((section) => (
            <MoonPanel key={`${section.kind}-${section.label}`} color={color} isMobile>
              <TextContent color={color} isMobile section={section} flush />
            </MoonPanel>
          ))}
          {gallerySection && landmark.images?.length ? (
            <MoonPanel color={color} isMobile>
              <GalleryContent color={color} images={landmark.images} isMobile landmarkName={landmark.name} section={gallerySection} />
            </MoonPanel>
          ) : null}
          {tagSection ? (
            <MoonPanel color={color} isMobile>
              <TagsContent color={color} isMobile landmark={landmark} section={tagSection} flush />
            </MoonPanel>
          ) : null}
          {linkSection && links.length > 0 ? (
            <MoonPanel color={color} isMobile>
              <LinkContent color={color} isMobile links={links} section={linkSection} />
            </MoonPanel>
          ) : null}
        </div>
      </div>
    </Html>
  )
}

export default function MoonView({ landmark, seed, universe, isMobile = false, onPrevMoon, onNextMoon }: MoonViewProps) {
  const concept = useMemo(() => conceptForLandmark(landmark, seed), [landmark, seed])
  const sections = useMemo(() => makeSections(landmark, universe), [landmark, universe])
  const textSections = useMemo(() => sections.filter((section) => section.kind === "desc" || section.kind === "note"), [sections])
  const orbitSections = textSections.length > 1 ? textSections : []
  const [activeIndex, setActiveIndex] = useState(0)
  // Mobile bottom-sheet: collapsed = moon dominant + peek; expanded = full
  // stitched list of panels.
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const sheetScrollRef = useRef<HTMLDivElement>(null)
  const [menuVisible, setMenuVisible] = useState(isMobile)
  const hideMenuRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const positions = useMemo(() => sectionPositions(concept, orbitSections.length, isMobile), [concept, isMobile, orbitSections.length])

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
    setSheetExpanded(false)
    if (sheetScrollRef.current) sheetScrollRef.current.scrollTop = 0
  }, [landmark.name, orbitSections.length])

  // Mobile gestures (single source of truth — the sheet itself uses native
  // scroll, the moon area is otherwise inert since one-finger rotate is off):
  //   • swipe ↑  → expand the bottom sheet (reveal the stitched panel list)
  //   • swipe ↓  → collapse back to the moon (only when the sheet is already
  //               scrolled to its top, so it never fights content scrolling)
  //   • swipe ←  → previous moon  •  swipe → → next moon
  useEffect(() => {
    if (!isMobile) return

    let startX = 0
    let startY = 0
    let startTime = 0
    let startScroll = 0
    let startedInScroll = false
    let tracking = false

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      tracking = true
      startX = event.touches[0].clientX
      startY = event.touches[0].clientY
      startTime = performance.now()
      startScroll = sheetScrollRef.current?.scrollTop ?? 0
      const target = event.target as Element | null
      startedInScroll = Boolean(target?.closest?.("[data-moon-sheet-scroll]"))
    }

    const onTouchEnd = (event: TouchEvent) => {
      if (!tracking) return
      tracking = false
      const touch = event.changedTouches[0]
      if (!touch) return
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      const elapsed = performance.now() - startTime
      if (elapsed > 700) return
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)

      // Horizontal → step moons.
      if (absX > 60 && absX > absY * 1.3) {
        if (dx < 0) onPrevMoon?.()
        else onNextMoon?.()
        return
      }

      // Vertical → open / close the sheet.
      if (absY > 52 && absY > absX * 1.3) {
        if (dy < 0) {
          if (!sheetExpanded) setSheetExpanded(true)
        } else {
          // Collapse only on a downward flick from the top of the content,
          // so mid-scroll down-swipes don't yank the sheet shut.
          if (sheetExpanded && (!startedInScroll || startScroll <= 2)) setSheetExpanded(false)
        }
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchend", onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchend", onTouchEnd)
    }
  }, [isMobile, sheetExpanded, onPrevMoon, onNextMoon])

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
        {orbitSections.map((section, index) => (
          <SectionBeacon
            key={`${section.kind}-${section.label}`}
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
          total={orbitSections.length}
          positions={positions}
          color={landmark.color}
        />
      </MaterializeIn>
      {orbitSections.length > 1 && !isMobile && (
        <SectionOrbitMenu
          sections={orbitSections}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          color={landmark.color}
          isMobile={isMobile}
          visible={menuVisible}
          onMenuEnter={showMenu}
          onMenuLeave={scheduleHideMenu}
        />
      )}
      {isMobile ? (
        <MobileMoonSheet
          sections={sections}
          landmark={landmark}
          universe={universe}
          expanded={sheetExpanded}
          setExpanded={setSheetExpanded}
          scrollRef={sheetScrollRef}
        />
      ) : (
        <InfoDeck
          concept={concept}
          sections={sections}
          activeIndex={activeIndex}
          landmark={landmark}
          universe={universe}
          isMobile={isMobile}
        />
      )}

      <ambientLight intensity={0.28} />
      <directionalLight position={[8, 8, 5]} intensity={0.9} />
      <pointLight position={[-5, 2, 4]} intensity={0.55} color={landmark.color} />
      <pointLight position={[4, -0.4, -5]} intensity={0.45} color={landmark.color} />
    </group>
  )
}
