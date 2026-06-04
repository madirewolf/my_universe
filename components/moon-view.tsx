"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import * as THREE from "three"
import type { Mesh } from "three"
import type { Landmark, Universe } from "@/lib/constants"

const CRYSTAL_RADIUS = 2.6
const HOLOGRAM_DISTANCE = 6.4

// ─── Inline FBM noise ────────────────────────────────────────────────────────
// Duplicates planet.tsx, small enough to keep close to the geometry it builds.

function hash3(x: number, y: number, z: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return h - Math.floor(h)
}
function valueNoise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = x - ix, fy = y - iy, fz = z - iz
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const sz = fz * fz * (3 - 2 * fz)
  const c000 = hash3(ix, iy, iz)
  const c100 = hash3(ix + 1, iy, iz)
  const c010 = hash3(ix, iy + 1, iz)
  const c110 = hash3(ix + 1, iy + 1, iz)
  const c001 = hash3(ix, iy, iz + 1)
  const c101 = hash3(ix + 1, iy, iz + 1)
  const c011 = hash3(ix, iy + 1, iz + 1)
  const c111 = hash3(ix + 1, iy + 1, iz + 1)
  const x00 = c000 * (1 - sx) + c100 * sx
  const x10 = c010 * (1 - sx) + c110 * sx
  const x01 = c001 * (1 - sx) + c101 * sx
  const x11 = c011 * (1 - sx) + c111 * sx
  const y0 = x00 * (1 - sy) + x10 * sy
  const y1 = x01 * (1 - sy) + x11 * sy
  return y0 * (1 - sz) + y1 * sz
}
function fbm3(x: number, y: number, z: number, octaves = 4): number {
  let total = 0, amp = 0.5
  for (let i = 0; i < octaves; i++) {
    total += amp * valueNoise3(x, y, z)
    x *= 2; y *= 2; z *= 2
    amp *= 0.5
  }
  return total
}

function makeCrystalGeometry(radius: number, seed: number) {
  const g = new THREE.IcosahedronGeometry(radius, 2) // detail 2 → 320 faces
  const pos = g.attributes.position
  const noiseScale = 2.5
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const dx = x / radius, dy = y / radius, dz = z / radius
    const n = fbm3(
      dx * noiseScale + seed,
      dy * noiseScale + seed * 1.7,
      dz * noiseScale + seed * 2.3,
      4,
    )
    const factor = 1 + (n - 0.5) * 2 * 0.2
    pos.setXYZ(i, x * factor, y * factor, z * factor)
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  return g
}

// ─── HologramCard: a single floating info card ──────────────────────────────

type CardKind = "title" | "desc" | "tech" | "link" | "images"

interface HologramCardProps {
  position: [number, number, number]
  kind: CardKind
  landmark: Landmark
  universe: Universe
}

function PrevNextBtns({
  index,
  total,
  onPrev,
  onNext,
  color,
}: {
  index: number
  total: number
  onPrev: () => void
  onNext: () => void
  color: string
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
      <button
        onClick={onPrev}
        disabled={index === 0}
        style={{
          background: index === 0 ? "transparent" : `${color}25`,
          border: `1px solid ${index === 0 ? "rgba(255,255,255,0.1)" : `${color}55`}`,
          borderRadius: 6,
          padding: "4px 10px",
          color: index === 0 ? "rgba(255,255,255,0.25)" : color,
          fontSize: 11,
          fontWeight: 600,
          cursor: index === 0 ? "default" : "pointer",
        }}
      >
        &larr;
      </button>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
        {index + 1} / {total}
      </span>
      <button
        onClick={onNext}
        disabled={index === total - 1}
        style={{
          background: index === total - 1 ? "transparent" : `${color}25`,
          border: `1px solid ${index === total - 1 ? "rgba(255,255,255,0.1)" : `${color}55`}`,
          borderRadius: 6,
          padding: "4px 10px",
          color: index === total - 1 ? "rgba(255,255,255,0.25)" : color,
          fontSize: 11,
          fontWeight: 600,
          cursor: index === total - 1 ? "default" : "pointer",
        }}
      >
        &rarr;
      </button>
    </div>
  )
}

// Split long prose into pages at sentence boundaries, each under maxChars.
// Keeps the floating card a fixed size; long descriptions paginate instead
// of overflowing or scrolling.
function paginateText(text: string, maxChars = 300): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text]
  const pages: string[] = []
  let cur = ""
  for (const s of sentences) {
    if (cur.length + s.length > maxChars && cur.length > 0) {
      pages.push(cur.trim())
      cur = s
    } else {
      cur += s
    }
  }
  if (cur.trim()) pages.push(cur.trim())
  return pages.length > 0 ? pages : [text]
}

function HologramCard({ position, kind, landmark, universe }: HologramCardProps) {
  const c = landmark.color
  const [imgIdx, setImgIdx] = useState(0)
  const [descIdx, setDescIdx] = useState(0)
  // Reset indices when landmark changes
  useEffect(() => {
    setImgIdx(0)
    setDescIdx(0)
  }, [landmark])

  const descPages = useMemo(() => paginateText(landmark.description), [landmark.description])

  // Professional universe uses technical labels; personal universe uses
  // warmer, less corporate ones.
  const eyebrowMap: Record<CardKind, string> =
    universe === "professional"
      ? { title: "Project", desc: "About", tech: "Tech Stack", link: "External", images: "Gallery" }
      : { title: "Spotlight", desc: "Story", tech: "Vibes", link: "Listen / Watch", images: "Gallery" }
  const eyebrow = eyebrowMap[kind]

  return (
    <Html
      position={position}
      transform
      distanceFactor={5.5}
      sprite
      pointerEvents="auto"
      style={{
        pointerEvents:
          kind === "link" ||
          kind === "images" ||
          (kind === "desc" && descPages.length > 1)
            ? "auto"
            : "none",
        userSelect: "none",
      }}
    >
      <div
        style={{
          width: 270,
          padding: 16,
          background: "rgba(4, 6, 20, 0.7)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: `1px solid ${c}40`,
          borderRadius: 12,
          boxShadow: `0 0 24px ${c}25, 0 0 0 1px ${c}18, 0 12px 32px rgba(0,0,0,0.45)`,
          color: "white",
          fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
          letterSpacing: "0.005em",
        }}
      >
        <div
          style={{
            height: 1,
            marginBottom: 12,
            background: `linear-gradient(90deg, ${c}cc, ${c}33, transparent 75%)`,
          }}
        />
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: `${c}cc`,
            marginBottom: 8,
          }}
        >
          {eyebrow}
        </div>

        {kind === "title" && (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2, marginBottom: 6 }}>
              {landmark.name}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{landmark.category}</div>
          </>
        )}

        {kind === "desc" && (
          <div>
            <div
              style={{
                fontSize: 11,
                lineHeight: 1.55,
                color: "rgba(255,255,255,0.78)",
              }}
            >
              {descPages[Math.min(descIdx, descPages.length - 1)]}
            </div>
            {descPages.length > 1 && (
              <PrevNextBtns
                index={descIdx}
                total={descPages.length}
                onPrev={() => setDescIdx((i) => Math.max(0, i - 1))}
                onNext={() => setDescIdx((i) => Math.min(descPages.length - 1, i + 1))}
                color={c}
              />
            )}
          </div>
        )}

        {kind === "tech" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {landmark.technologies.map(t => (
              <span
                key={t}
                style={{
                  fontSize: 10,
                  padding: "3px 8px",
                  background: `${c}15`,
                  border: `1px solid ${c}40`,
                  borderRadius: 5,
                  color: `${c}dd`,
                  fontWeight: 500,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {kind === "link" && (landmark.link || landmark.links) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {landmark.link && (
              <a
                href={landmark.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  fontSize: 11,
                  padding: "8px 14px",
                  background: `${c}25`,
                  border: `1px solid ${c}55`,
                  borderRadius: 7,
                  color: c,
                  textDecoration: "none",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLElement).style.background = `${c}40`
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLElement).style.background = `${c}25`
                }}
              >
                {universe === "professional" ? "View Project →" : "Open →"}
              </a>
            )}
            {landmark.links?.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  fontSize: 11,
                  padding: "7px 12px",
                  background: `${c}15`,
                  border: `1px solid ${c}40`,
                  borderRadius: 7,
                  color: `${c}ee`,
                  textDecoration: "none",
                  fontWeight: 500,
                  lineHeight: 1.3,
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLElement).style.background = `${c}30`
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLElement).style.background = `${c}15`
                }}
              >
                {l.label}
              </a>
            ))}
          </div>
        )}

        {kind === "images" && landmark.images && landmark.images.length > 0 && (
          <div>
            <img
              src={landmark.images[imgIdx]}
              alt={`${landmark.name} ${imgIdx + 1}`}
              style={{
                width: "100%",
                height: 160,
                objectFit: "cover",
                borderRadius: 8,
                border: `1px solid ${c}40`,
              }}
            />
            {landmark.images.length > 1 && (
              <PrevNextBtns
                index={imgIdx}
                total={landmark.images.length}
                onPrev={() => setImgIdx((i) => Math.max(0, i - 1))}
                onNext={() => setImgIdx((i) => Math.min(landmark.images!.length - 1, i + 1))}
                color={c}
              />
            )}
          </div>
        )}
      </div>
    </Html>
  )
}

// ─── MoonView: scaled-up data crystal + ring of hologram cards ──────────────

interface MoonViewProps {
  landmark: Landmark
  seed: number
  universe: Universe
}

export default function MoonView({ landmark, seed, universe }: MoonViewProps) {
  const crystalRef = useRef<Mesh>(null)
  const innerRef = useRef<Mesh>(null)
  const haloRef = useRef<Mesh>(null)

  const crystalGeom = useMemo(() => makeCrystalGeometry(CRYSTAL_RADIUS, seed), [seed])
  useEffect(() => () => crystalGeom.dispose(), [crystalGeom])

  useFrame((s) => {
    const t = s.clock.elapsedTime
    if (crystalRef.current) {
      crystalRef.current.rotation.y = t * 0.18
      crystalRef.current.rotation.x = Math.sin(t * 0.11) * 0.08
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -t * 0.32
      innerRef.current.rotation.z = t * 0.18
    }
    if (haloRef.current) {
      const pulse = 1 + Math.sin(t * 1.5) * 0.04
      haloRef.current.scale.setScalar(pulse)
    }
  })

  const cards = useMemo(() => {
    const list: CardKind[] = ["title", "desc", "tech"]
    if (landmark.link || landmark.links) list.push("link")
    if (landmark.images && landmark.images.length > 0) list.push("images")
    return list
  }, [landmark])

  return (
    <group>
      {/* Crystal core: flat-shaded, faceted, slowly rotating */}
      <mesh ref={crystalRef} geometry={crystalGeom}>
        <meshStandardMaterial
          color={landmark.color}
          emissive={landmark.color}
          emissiveIntensity={0.6}
          roughness={0.32}
          metalness={0.78}
          flatShading
        />
      </mesh>

      {/* Inner counter-spinning glint */}
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[CRYSTAL_RADIUS * 0.5, 0]} />
        <meshBasicMaterial
          color={landmark.color}
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Pulsing outer halo */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[CRYSTAL_RADIUS * 1.55, 32, 32]} />
        <meshBasicMaterial
          color={landmark.color}
          transparent
          opacity={0.07}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Floating hologram cards arranged in a ring */}
      {cards.map((kind, i) => {
        const angle = (i / cards.length) * Math.PI * 2 - Math.PI / 2 // start from "front"
        const x = Math.cos(angle) * HOLOGRAM_DISTANCE
        const z = Math.sin(angle) * HOLOGRAM_DISTANCE
        // Slight vertical offset based on kind so cards don't all sit on the equator
        const y = kind === "title" ? 0.6 : kind === "link" ? -0.6 : 0
        return <HologramCard key={kind} position={[x, y, z]} kind={kind} landmark={landmark} universe={universe} />
      })}

      {/* Lighting */}
      <ambientLight intensity={0.25} />
      <directionalLight position={[10, 6, 6]} intensity={0.85} />
      <pointLight position={[-6, 2, 6]} intensity={0.5} color={landmark.color} />
    </group>
  )
}
