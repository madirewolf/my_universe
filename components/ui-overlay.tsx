"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, FileDown, Home, Instagram, Linkedin, Mail, Pause, Play } from "lucide-react"
import type { Landmark, PlanetEntry, Universe, UniverseConfig } from "@/lib/constants"
import { cn } from "@/lib/utils"
import BackgroundMusic from "./background-music"

type Mode = "system" | "planet" | "moon"

// ── Mobile detection ──────────────────────────────────────────────────────
// Single source of truth for the desktop/mobile split. Desktop pixel-perfect
// stays the same; mobile gets tighter padding, smaller fonts, repositioned
// joystick, and hides hover-only UI like the planet preview tooltip.
const MOBILE_QUERY = "(max-width: 768px)"

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    const mql = window.matchMedia(query)
    const update = () => setMatches(mql.matches)
    update()
    mql.addEventListener("change", update)
    return () => mql.removeEventListener("change", update)
  }, [query])
  return matches
}

interface UIOverlayProps {
  universe: Universe
  config: UniverseConfig
  mode: Mode
  paused: boolean
  selectedPlanet: number | null
  hoveredPlanet: number | null
  selectedLandmark: Landmark | null
  onBackToSystem: () => void
  onBackFromMoon: () => void
  onPrevMoon: () => void
  onNextMoon: () => void
  onJoystick: (vel: { x: number; y: number }) => void
  onTogglePause: () => void
}


const GLASS_TONES = {
  whisper: { bg: "rgba(255, 255, 255, 0.018)", blur: 18 },
  default: { bg: "rgba(255, 255, 255, 0.028)", blur: 20 },
  strong: { bg: "rgba(255, 255, 255, 0.044)", blur: 22 },
} as const

const ACCENT_GRADIENTS: Record<Universe, string> = {
  professional:
    "linear-gradient(90deg, rgba(77,208,200,0.85), rgba(0,150,136,0.5), transparent 70%)",
  personal:
    "linear-gradient(90deg, rgba(255,160,220,0.85), rgba(180,140,255,0.5), transparent 70%)",
}

const EYEBROW_COLORS: Record<Universe, string> = {
  professional: "rgba(77,208,200,0.55)",
  personal: "rgba(255,180,230,0.7)",
}

function GlassPanel({
  tone = "default",
  accentColor,
  className,
  children,
}: {
  tone?: keyof typeof GLASS_TONES
  accentColor?: string
  className?: string
  children: React.ReactNode
}) {
  const { bg, blur } = GLASS_TONES[tone]
  const isWhisper = tone === "whisper" && !accentColor
  const border = accentColor ? `${accentColor}24` : "rgba(255,255,255,0.025)"
  // Soft outer glow that bleeds into the surrounding nebula instead of a
  // hard rectangular drop shadow.
  const shadow = accentColor
    ? `0 0 22px ${accentColor}10, 0 14px 36px rgba(0,0,0,0.16)`
    : isWhisper
      ? "0 0 18px rgba(180,210,255,0.025)"
      : "0 0 24px rgba(180,210,255,0.04), 0 14px 34px rgba(0,0,0,0.14)"
  const accentWash = accentColor ? `radial-gradient(circle at 14% 0%, ${accentColor}18, transparent 46%), ` : ""
  return (
    <div
      className={cn("relative rounded-2xl", className)}
      style={{
        background: `${accentWash}linear-gradient(135deg, ${bg}, rgba(255,255,255,0.006) 48%, rgba(255,255,255,0.032))`,
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        border: `1px solid ${isWhisper ? "rgba(255,255,255,0.008)" : border}`,
        boxShadow: shadow,
      }}
    >
      {children}
    </div>
  )
}

function NavBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150
        bg-white/[0.05] border border-white/[0.08] text-white/[0.45]
        hover:bg-[rgba(100,160,255,0.15)] hover:border-[rgba(100,160,255,0.35)] hover:text-white/95"
    >
      {children}
    </button>
  )
}

// ─── NavDial: drag-the-dot joystick on a compass ring ──────────────────────
// Continuous rotation: drag distance = velocity, drag direction = axis.
// Releasing the dot springs it back to center and stops rotation.

function landmarkKey(landmark: Landmark): string {
  return `${landmark.name}::${landmark.category}`
}

function findLandmarkIndex(landmarks: Landmark[], landmark: Landmark | null): number {
  if (!landmark) return -1
  const direct = landmarks.indexOf(landmark)
  if (direct >= 0) return direct

  const key = landmarkKey(landmark)
  return landmarks.findIndex((candidate) => landmarkKey(candidate) === key)
}

function NavDial({
  onJoystick,
  accentColor,
  isMobile = false,
}: {
  onJoystick: (vel: { x: number; y: number }) => void
  accentColor: string
  isMobile?: boolean
}) {
  // Smaller dial on mobile so it leaves room for content.
  const SIZE = isMobile ? 110 : 150
  const HALF = SIZE / 2
  const RING_R = isMobile ? 42 : 58
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

  const ticks = useMemo(() => {
    // Tick positions are derived from RING_R so the dial scales cleanly.
    return Array.from({ length: 24 }).map((_, i) => {
      const ang = (i / 24) * Math.PI * 2 - Math.PI / 2
      const isCardinal = i % 6 === 0
      const isMid = i % 3 === 0
      const inn = isCardinal ? RING_R - 6 : isMid ? RING_R - 2 : RING_R + 0.5
      const out = RING_R + 6
      const op = isCardinal ? 0.32 : isMid ? 0.18 : 0.1
      return (
        <line
          key={i}
          x1={HALF + Math.cos(ang) * inn}
          y1={HALF + Math.sin(ang) * inn}
          x2={HALF + Math.cos(ang) * out}
          y2={HALF + Math.sin(ang) * out}
          stroke={`rgba(255,255,255,${op})`}
          strokeWidth={isCardinal ? 1.4 : 1}
        />
      )
    })
  }, [HALF, RING_R])

  const updatePos = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + HALF
    const cy = rect.top + HALF
    let dx = clientX - cx
    let dy = clientY - cy
    const len = Math.hypot(dx, dy)
    if (len > RING_R) {
      dx = (dx / len) * RING_R
      dy = (dy / len) * RING_R
    }
    setPos({ x: dx, y: dy })
    onJoystick({ x: dx / RING_R, y: dy / RING_R })
  }

  // Spring back to center when released
  useEffect(() => {
    if (dragging) return
    if (pos.x === 0 && pos.y === 0) return
    let raf = 0
    let cur = { x: pos.x, y: pos.y }
    const step = () => {
      cur = { x: cur.x * 0.65, y: cur.y * 0.65 }
      if (Math.hypot(cur.x, cur.y) < 0.5) {
        setPos({ x: 0, y: 0 })
        onJoystick({ x: 0, y: 0 })
        return
      }
      setPos({ x: cur.x, y: cur.y })
      onJoystick({ x: cur.x / RING_R, y: cur.y / RING_R })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging])

  // Distance from center (0..1) — used to crank up the dot's glow as you push
  const intensity = Math.min(1, Math.hypot(pos.x, pos.y) / RING_R)

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute pointer-events-auto",
        // Desktop: vertically-centered on the right edge.
        // Mobile: bottom-right corner just above the social/pause row.
        isMobile
          ? "bottom-24 right-3"
          : "top-1/2 -translate-y-1/2 right-12",
      )}
      style={{ width: SIZE, height: SIZE + 18, touchAction: "none", userSelect: "none" }}
      onPointerDown={(e) => {
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        setDragging(true)
        updatePos(e.clientX, e.clientY)
      }}
      onPointerMove={(e) => {
        if (!dragging) return
        updatePos(e.clientX, e.clientY)
      }}
      onPointerUp={(e) => {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
        setDragging(false)
      }}
      onPointerCancel={(e) => {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
        setDragging(false)
      }}
    >
      <svg
        className="absolute inset-0 pointer-events-none"
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden
      >
        {/* Outer ring */}
        <circle cx={HALF} cy={HALF} r={RING_R} fill="none" stroke={`${accentColor}30`} strokeWidth={1} />
        {/* Inner faint ring */}
        <circle
          cx={HALF}
          cy={HALF}
          r={26}
          fill="rgba(255,255,255,0.026)"
          stroke="rgba(255,255,255,0.035)"
          strokeWidth={1}
        />
        {ticks}
        {/* Faint trail line from center to dot — only while displaced */}
        {(pos.x !== 0 || pos.y !== 0) && (
          <line
            x1={HALF}
            y1={HALF}
            x2={HALF + pos.x}
            y2={HALF + pos.y}
            stroke={`${accentColor}${Math.round(0x40 + intensity * 0x80)
              .toString(16)
              .padStart(2, "0")}`}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        )}
      </svg>

      {/* The draggable dot */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 30,
          height: 30,
          left: HALF,
          top: HALF,
          marginLeft: -15,
          marginTop: -15,
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          transition: dragging ? "none" : "transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div
          className="w-full h-full rounded-full"
          style={{
            background: `radial-gradient(circle, ${accentColor} 0%, ${accentColor}88 55%, ${accentColor}22 100%)`,
            boxShadow: `0 0 ${10 + intensity * 22}px ${accentColor}${Math.round(
              0x80 + intensity * 0x60,
            )
              .toString(16)
              .padStart(2, "0")}, 0 0 0 1.5px ${accentColor}cc`,
          }}
        />
      </div>

      <div
        className="absolute left-1/2 -translate-x-1/2 text-[8.5px] font-semibold tracking-[0.32em] uppercase pointer-events-none select-none whitespace-nowrap"
        style={{
          top: SIZE + 2,
          color: `${accentColor}88`,
        }}
      >
        Drag · rotate
      </div>
    </div>
  )
}

// Small labelled glass chip (Contact / Resume). Same glass recipe as
// SocialLink but with a text label — these are the portfolio's conversion
// buttons, so they get words, not just icons.
function ContactChip({
  href,
  icon: Icon,
  label,
  download = false,
}: {
  href: string
  icon: typeof Instagram
  label: string
  download?: boolean
}) {
  return (
    <a
      href={href}
      {...(download
        ? { download: "" }
        : href.startsWith("http")
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      onPointerDown={(event) => {
        event.stopPropagation()
      }}
      onTouchStart={(event) => {
        event.stopPropagation()
      }}
      onClick={(event) => {
        event.stopPropagation()
      }}
      className="relative z-[120] pointer-events-auto inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.2em] uppercase px-3 py-2 rounded-lg transition-all duration-200
        backdrop-blur-[18px] border text-white/60 hover:text-white/95 hover:border-white/30"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.032), rgba(255,255,255,0.008) 50%, rgba(255,255,255,0.04))",
        borderColor: "rgba(255,255,255,0.05)",
        WebkitBackdropFilter: "blur(18px)",
        boxShadow: "0 0 18px rgba(180,210,255,0.035), 0 12px 24px rgba(0,0,0,0.12)",
      }}
    >
      <Icon size={13} />
      {label}
    </a>
  )
}

function SocialLink({ href, icon: Icon }: { href: string; icon: typeof Instagram }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onPointerDown={(event) => {
        event.stopPropagation()
      }}
      onTouchStart={(event) => {
        event.stopPropagation()
      }}
      onClick={(event) => {
        event.stopPropagation()
      }}
      className="relative z-[120] flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200
        backdrop-blur-[18px] border text-white/50
        hover:border-white/30 hover:text-white/95"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.032), rgba(255,255,255,0.008) 50%, rgba(255,255,255,0.04))",
        borderColor: "rgba(255,255,255,0.03)",
        WebkitBackdropFilter: "blur(18px)",
        boxShadow: "0 0 18px rgba(180,210,255,0.035), 0 12px 24px rgba(0,0,0,0.12)",
      }}
    >
      <Icon size={18} />
    </a>
  )
}

function LandmarkPanel({ landmark, onClose }: { landmark: Landmark; onClose: () => void }) {
  const c = landmark.color
  return (
    <div className="absolute left-8 top-44 bottom-8 flex items-center pointer-events-none">
      <div className="pointer-events-auto" style={{ width: 380, maxWidth: "calc(100vw - 4rem)" }}>
        <GlassPanel tone="strong" accentColor={c}>
          <div
            className="h-px w-full"
            style={{ background: `linear-gradient(90deg, ${c}55, ${c}18, transparent 70%)` }}
          />

          <div className="p-6 relative">
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-md text-white/40 hover:text-white/95 hover:bg-white/[0.06] transition-colors"
              aria-label="Close"
            >
              ✕
            </button>

            <div
              className="text-[10px] font-semibold tracking-[0.22em] uppercase mb-2"
              style={{ color: `${c}99` }}
            >
              Project Detail
            </div>
            <div className="text-xl font-bold text-white tracking-tight mb-1 pr-8 leading-tight">
              {landmark.name}
            </div>
            <div className="text-[11px] mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>
              {landmark.category}
            </div>

            <div className="text-xs leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.65)" }}>
              {landmark.description}
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {landmark.technologies.map(t => (
                <span
                  key={t}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                  style={{
                    background: `radial-gradient(circle at 12% 0%, ${c}16, transparent 48%), linear-gradient(135deg, rgba(255,255,255,0.032), rgba(255,255,255,0.007) 52%, rgba(255,255,255,0.038))`,
                    border: `1px solid ${c}20`,
                    color: `${c}cc`,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>

            {landmark.link && (
              <>
                <div
                  className="h-px mb-4"
                  style={{
                    background: "linear-gradient(90deg, rgba(255,255,255,0.08), transparent)",
                  }}
                />
                <a
                  href={landmark.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.18em] uppercase px-3 py-1.5 rounded-md transition-all"
                  style={{
                    background: `radial-gradient(circle at 12% 0%, ${c}16, transparent 48%), linear-gradient(135deg, rgba(255,255,255,0.032), rgba(255,255,255,0.007) 52%, rgba(255,255,255,0.038))`,
                    border: `1px solid ${c}24`,
                    color: c,
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                  }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLElement).style.background = `radial-gradient(circle at 12% 0%, ${c}24, transparent 48%), linear-gradient(135deg, rgba(255,255,255,0.046), rgba(255,255,255,0.01) 52%, rgba(255,255,255,0.052))`
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLElement).style.background = `radial-gradient(circle at 12% 0%, ${c}16, transparent 48%), linear-gradient(135deg, rgba(255,255,255,0.032), rgba(255,255,255,0.007) 52%, rgba(255,255,255,0.038))`
                  }}
                >
                  View Project →
                </a>
              </>
            )}
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}

function HoverTooltip({ planet }: { planet: PlanetEntry }) {
  const c = planet.color
  const count = planet.landmarks.length
  return (
    <div className="absolute right-8 top-8 pointer-events-none" style={{ width: 280 }}>
      <GlassPanel tone="strong" accentColor={c}>
        <div
          className="h-px w-full"
          style={{ background: `linear-gradient(90deg, ${c}55, ${c}18, transparent 70%)` }}
        />

        <div className="p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-shrink-0" style={{ width: 64, height: 64 }}>
              <div
                className="absolute"
                style={{
                  inset: -6,
                  borderRadius: "50%",
                  border: `1px solid ${c}35`,
                  animation: "orbitSpin 8s linear infinite",
                }}
              />
              <div
                className="relative w-full h-full rounded-full overflow-hidden"
                style={{
                  background: `radial-gradient(circle at 38% 35%, ${c}50, ${c}18 55%, ${c}06)`,
                  border: `1px solid ${c}60`,
                  boxShadow: `0 0 18px ${c}40, inset 0 0 14px ${c}20`,
                  animation: "holoPulse 2.5s ease-in-out infinite",
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)",
                    animation: "scanMove 2s linear infinite",
                  }}
                />
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `radial-gradient(circle at 60% 60%, ${c}20, transparent 60%)`,
                    animation: "holoGlitch 4s steps(1) infinite",
                  }}
                />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div
                className="text-[10px] font-semibold tracking-[0.22em] uppercase mb-1.5"
                style={{ color: `${c}99` }}
              >
                Planet
              </div>
              <div className="text-base font-bold text-white leading-tight mb-1 truncate">
                {planet.name}
              </div>
              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                {count} project{count !== 1 ? "s" : ""}
              </div>
            </div>
          </div>

          <div className="text-xs leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.55)" }}>
            {planet.description}
          </div>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {planet.tags.map(tag => (
              <span
                key={tag}
                className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                style={{
                  background: `radial-gradient(circle at 12% 0%, ${c}16, transparent 48%), linear-gradient(135deg, rgba(255,255,255,0.032), rgba(255,255,255,0.007) 52%, rgba(255,255,255,0.038))`,
                  border: `1px solid ${c}20`,
                  color: `${c}cc`,
                }}
              >
                {tag}
              </span>
            ))}
          </div>

          <div
            className="h-px mb-3"
            style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.08), transparent)" }}
          />
          <div
            className="text-[10px] tracking-[0.18em] uppercase"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            Click to explore →
          </div>
        </div>
      </GlassPanel>
    </div>
  )
}

export default function UIOverlay({
  universe,
  config,
  mode,
  paused,
  selectedPlanet,
  hoveredPlanet,
  selectedLandmark,
  onBackToSystem,
  onBackFromMoon,
  onPrevMoon,
  onNextMoon,
  onJoystick,
  onTogglePause,
}: UIOverlayProps) {
  const isMobile = useMediaQuery(MOBILE_QUERY)

  const planets = config.planets
  const selected = selectedPlanet !== null ? planets[selectedPlanet] : null
  const hovered = hoveredPlanet !== null ? planets[hoveredPlanet] : null
  const selectedLandmarkIndex =
    selected && selectedLandmark ? findLandmarkIndex(selected.landmarks, selectedLandmark) : -1
  const moonCount = selected?.landmarks.length ?? 0

  useEffect(() => {
    if (mode !== "moon") return

    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        onPrevMoon()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        onNextMoon()
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [mode, onNextMoon, onPrevMoon])

  const accentGradient = ACCENT_GRADIENTS[universe]
  const eyebrowColor = EYEBROW_COLORS[universe]

  return (
    <>
      {/* Contact CTA (system view) — the portfolio's conversion corner */}
      {mode === "system" && (
        <div
          className={cn(
            "absolute z-20 flex gap-2 pointer-events-none",
            isMobile ? "top-3 left-3" : "top-8 left-8",
          )}
        >
          <ContactChip href="mailto:mohammad.abu.daqer@gmail.com" icon={Mail} label="Contact" />
          <ContactChip href="/resume.pdf" icon={FileDown} label="Resume" download />
        </div>
      )}

      {/* Planet detail navigation */}
      {mode === "planet" && selected && (
        <>
          <div
            className={cn(
              "absolute pointer-events-auto",
              isMobile
                ? "top-3 left-3 right-3 flex flex-col gap-2"
                : "top-8 left-8 right-8 flex justify-between items-start",
            )}
          >
            <GlassPanel>
              <div className="h-px w-full opacity-45" style={{ background: accentGradient }} />
              <div className={cn(isMobile ? "px-4 py-3" : "px-6 py-5")}>
                <div
                  className={cn(
                    "font-semibold tracking-[0.28em] uppercase",
                    isMobile ? "text-[9px] mb-2" : "text-[10px] mb-3",
                  )}
                  style={{ color: eyebrowColor }}
                >
                  Currently Exploring
                </div>
                <div
                  className={cn(
                    "font-display font-bold text-white tracking-tight mb-1",
                    isMobile ? "text-lg" : "text-2xl",
                  )}
                >
                  {selected.name}
                </div>
                <div
                  className={cn(isMobile ? "text-xs" : "text-sm")}
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  {selected.description}
                </div>
              </div>
            </GlassPanel>

            <button
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onBackToSystem()
              }}
              className={cn(
                "z-[80] flex items-center gap-2 rounded-xl font-medium transition-all duration-150",
                "backdrop-blur-[20px] border text-white/60",
                "hover:border-[rgba(100,160,255,0.35)] hover:text-white/95",
                isMobile ? "self-start px-3 py-2 text-xs" : "px-4 py-2.5 text-sm",
              )}
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.032), rgba(255,255,255,0.007) 52%, rgba(255,255,255,0.038))",
                borderColor: "rgba(255,255,255,0.03)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow: "0 0 18px rgba(180,210,255,0.035), 0 12px 24px rgba(0,0,0,0.12)",
              }}
            >
              <Home size={isMobile ? 13 : 15} />
              {isMobile ? "Back" : "Back to Solar System"}
            </button>
          </div>

          {!isMobile && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none text-white/50 text-xs tracking-wide">
              Click on the orbiting moons to explore projects
            </div>
          )}

          <NavDial
            onJoystick={onJoystick}
            accentColor={selected.color}
            isMobile={isMobile}
          />
        </>
      )}

      {/* Hover tooltip — desktop only (no hover on touch devices) */}
      {!isMobile && hovered && mode === "system" && <HoverTooltip planet={hovered} />}

      {/* Moon mode: slim breadcrumb HUD + back-to-planet button.
          The actual project info is rendered diegetically as floating
          holograms around the data crystal in MoonView. */}
      {mode === "moon" && selected && selectedLandmark && (
        <>
          <div
            className={cn(
              "absolute pointer-events-auto",
              isMobile ? "top-3 left-3 right-3" : "top-8 left-8 max-w-[480px]",
            )}
            style={
              isMobile
                ? { width: "calc(100vw - 24px)", maxWidth: "calc(100vw - 24px)", zIndex: 80 }
                : { zIndex: 80 }
            }
          >
            <GlassPanel accentColor={selectedLandmark.color}>
              <div
                className="h-px w-full"
                style={{
                  background: `linear-gradient(90deg, ${selectedLandmark.color}55, ${selectedLandmark.color}18, transparent 70%)`,
                }}
              />
              {isMobile ? (
                <div className="px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onPointerDown={(event) => {
                        event.stopPropagation()
                      }}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        onBackFromMoon()
                      }}
                      aria-label={`Back to ${selected.name}`}
                      className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg border transition-all duration-150 active:scale-95"
                      style={{
                        background: `radial-gradient(circle at 12% 0%, ${selectedLandmark.color}18, transparent 48%), linear-gradient(135deg, rgba(255,255,255,0.032), rgba(255,255,255,0.007) 52%, rgba(255,255,255,0.038))`,
                        borderColor: `${selectedLandmark.color}24`,
                        color: "rgba(255,255,255,0.72)",
                        boxShadow: `0 0 18px ${selectedLandmark.color}10`,
                      }}
                    >
                      <ArrowLeft size={14} />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-[9px] font-semibold uppercase tracking-[0.18em]"
                        style={{ color: `${selectedLandmark.color}cc` }}
                      >
                        Current Planet
                      </div>
                      <div className="truncate font-display text-sm font-bold leading-tight text-white">
                        {selected.name}
                      </div>
                      <div
                        className="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug"
                        style={{ color: "rgba(255,255,255,0.68)" }}
                      >
                        {selectedLandmark.name}
                      </div>
                    </div>
                  </div>

                  {moonCount > 1 && (
                    <div
                      className="mt-2 flex items-center gap-2"
                      style={{ width: 188, maxWidth: "100%" }}
                    >
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onPrevMoon()
                        }}
                        aria-label="Previous moon"
                        className="grid h-9 w-9 place-items-center rounded-lg border transition-all duration-150 active:scale-95"
                        style={{
                          background: `radial-gradient(circle at 12% 0%, ${selectedLandmark.color}18, transparent 48%), linear-gradient(135deg, rgba(255,255,255,0.032), rgba(255,255,255,0.007) 52%, rgba(255,255,255,0.038))`,
                          borderColor: `${selectedLandmark.color}24`,
                          color: `${selectedLandmark.color}dd`,
                        }}
                      >
                        <ArrowLeft size={14} />
                      </button>
                      <div
                        className="w-[100px] rounded-lg border px-2 py-2 text-center text-[10px] font-semibold tabular-nums"
                        style={{
                          color: "rgba(255,255,255,0.55)",
                          borderColor: `${selectedLandmark.color}18`,
                          background: "linear-gradient(135deg, rgba(255,255,255,0.026), rgba(255,255,255,0.006) 52%, rgba(255,255,255,0.03))",
                        }}
                      >
                        {selectedLandmarkIndex + 1} / {moonCount}
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onNextMoon()
                        }}
                        aria-label="Next moon"
                        className="grid h-9 w-9 place-items-center rounded-lg border transition-all duration-150 active:scale-95"
                        style={{
                          background: `radial-gradient(circle at 12% 0%, ${selectedLandmark.color}18, transparent 48%), linear-gradient(135deg, rgba(255,255,255,0.032), rgba(255,255,255,0.007) 52%, rgba(255,255,255,0.038))`,
                          borderColor: `${selectedLandmark.color}24`,
                          color: `${selectedLandmark.color}dd`,
                        }}
                      >
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-shrink font-display text-lg font-bold leading-tight tracking-tight text-white">
                    {selected.name}
                  </div>
                  <div
                    className="min-w-0 flex-1 border-l pl-3"
                    style={{ borderColor: `${selectedLandmark.color}2e` }}
                  >
                    <div className="text-sm font-semibold leading-snug text-white/70">
                      {selectedLandmark.name}
                    </div>
                    <div
                      className="mt-0.5 text-[11px]"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      Moon {selectedLandmarkIndex + 1} / {moonCount}
                    </div>
                  </div>
                </div>
              )}
            </GlassPanel>
          </div>

          {!isMobile && (
            <div className="absolute top-8 right-8 z-[80] flex items-center gap-2 pointer-events-auto">
              {moonCount > 1 && (
                <>
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.stopPropagation()
                    }}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onPrevMoon()
                    }}
                    aria-label="Previous moon"
                    className="grid h-11 w-11 place-items-center rounded-xl border text-white/60 transition-all duration-150 hover:text-white/95 active:scale-95"
                    style={{
                      background: `radial-gradient(circle at 12% 0%, ${selectedLandmark.color}18, transparent 48%), linear-gradient(135deg, rgba(255,255,255,0.032), rgba(255,255,255,0.007) 52%, rgba(255,255,255,0.038))`,
                      borderColor: `${selectedLandmark.color}24`,
                      WebkitBackdropFilter: "blur(20px)",
                      boxShadow: "0 0 18px rgba(180,210,255,0.035), 0 12px 24px rgba(0,0,0,0.12)",
                    }}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.stopPropagation()
                    }}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onNextMoon()
                    }}
                    aria-label="Next moon"
                    className="grid h-11 w-11 place-items-center rounded-xl border text-white/60 transition-all duration-150 hover:text-white/95 active:scale-95"
                    style={{
                      background: `radial-gradient(circle at 12% 0%, ${selectedLandmark.color}18, transparent 48%), linear-gradient(135deg, rgba(255,255,255,0.032), rgba(255,255,255,0.007) 52%, rgba(255,255,255,0.038))`,
                      borderColor: `${selectedLandmark.color}24`,
                      WebkitBackdropFilter: "blur(20px)",
                      boxShadow: "0 0 18px rgba(180,210,255,0.035), 0 12px 24px rgba(0,0,0,0.12)",
                    }}
                  >
                    <ArrowRight size={16} />
                  </button>
                </>
              )}
              <button
                type="button"
                onPointerDown={(event) => {
                  event.stopPropagation()
                }}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onBackFromMoon()
                }}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150",
                  "backdrop-blur-[20px] border text-white/60",
                  "hover:border-[rgba(100,160,255,0.35)] hover:text-white/95",
                )}
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.032), rgba(255,255,255,0.007) 52%, rgba(255,255,255,0.038))",
                  borderColor: "rgba(255,255,255,0.03)",
                  WebkitBackdropFilter: "blur(20px)",
                  boxShadow: "0 0 18px rgba(180,210,255,0.035), 0 12px 24px rgba(0,0,0,0.12)",
                }}
              >
                <ArrowLeft size={15} />
                {`Back to ${selected.name.replace(/\s*Planet\s*$/i, "")}`}
              </button>
            </div>
          )}

          {!isMobile && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none text-white/45 text-xs tracking-wide">
              Arrow keys switch moons · drag to orbit · scroll to zoom
            </div>
          )}
        </>
      )}

      {/* Social links */}
      <div
        className={cn(
          "absolute z-[120] flex pointer-events-auto",
          isMobile ? "bottom-3 right-3 gap-2" : "bottom-8 right-8 gap-3",
          // Mobile moon view: the bottom sheet owns the bottom — hide these
          // so they don't sit on top of the stitched panel list.
          isMobile && mode === "moon" && "hidden",
        )}
      >
        <SocialLink href="https://www.instagram.com/limiliminal/" icon={Instagram} />
        <SocialLink href="https://www.linkedin.com/in/mohammad-abu-daqer/" icon={Linkedin} />
      </div>

      {/* Pause / freeze toggle (also: spacebar, or click the sun) + music toggle */}
      <div
        className={cn(
          "absolute z-[120] flex items-center pointer-events-auto",
          isMobile ? "bottom-3 left-3 gap-2" : "bottom-8 left-8 gap-3",
          isMobile && mode === "moon" && "hidden",
        )}
      >
        <BackgroundMusic />
        <button
          type="button"
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onTouchStart={(event) => {
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onTogglePause()
          }}
          aria-label={paused ? "Resume orbital motion" : "Freeze orbital motion"}
          title={paused ? "Resume (space)" : "Freeze (space)"}
          className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150
            backdrop-blur-[18px] border text-white/65
            hover:text-white/95"
          style={{
            background: paused
              ? "radial-gradient(circle at 12% 0%, rgba(255,200,80,0.20), transparent 48%), linear-gradient(135deg, rgba(255,255,255,0.042), rgba(255,255,255,0.008) 52%, rgba(255,255,255,0.045))"
              : "linear-gradient(135deg, rgba(255,255,255,0.032), rgba(255,255,255,0.007) 52%, rgba(255,255,255,0.038))",
            WebkitBackdropFilter: "blur(18px)",
            borderColor: paused ? "rgba(255,200,80,0.28)" : "rgba(255,255,255,0.03)",
            boxShadow: paused
              ? "0 0 18px rgba(255,200,80,0.14), 0 12px 24px rgba(0,0,0,0.12)"
              : "0 0 18px rgba(180,210,255,0.035), 0 12px 24px rgba(0,0,0,0.12)",
          }}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        {paused && !isMobile && (
          <div
            className="text-[10px] font-semibold tracking-[0.28em] uppercase select-none pointer-events-none"
            style={{ color: "rgba(255,200,80,0.85)" }}
          >
            Stasis · Space to resume
          </div>
        )}
        {!paused && !isMobile && (
          <div
            className="text-[10px] font-medium tracking-[0.18em] uppercase select-none pointer-events-none"
            style={{ color: "rgba(255,255,255,0.32)" }}
          >
            Space · click sun to freeze
          </div>
        )}
      </div>

      <style jsx>{`

        /* Hologram animations */
        @keyframes orbitSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes scanMove {
          from { transform: translateY(0); }
          to   { transform: translateY(8px); }
        }
        @keyframes holoPulse {
          0%, 100% { opacity: 0.85; }
          50%      { opacity: 1; }
        }
        @keyframes holoGlitch {
          0%, 88%, 100% { transform: translate(0, 0); opacity: 1; }
          90% { transform: translate(-3px, 1px); opacity: 0.7; }
          92% { transform: translate(3px, -1px); opacity: 0.9; }
          94% { transform: translate(-1px, 2px); opacity: 0.75; }
          96% { transform: translate(0, 0); opacity: 1; }
        }
      `}</style>
    </>
  )
}
