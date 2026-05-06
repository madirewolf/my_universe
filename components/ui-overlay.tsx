"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Home, Instagram, Linkedin, Sparkles, Pause, Play } from "lucide-react"
import type { Landmark, PlanetEntry, Universe, UniverseConfig } from "@/lib/constants"
import { cn } from "@/lib/utils"
import BackgroundMusic from "./background-music"

type Mode = "system" | "planet" | "moon"

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
  onJoystick: (vel: { x: number; y: number }) => void
  onEnterRift: () => void
  onTogglePause: () => void
}

// Tiny 1×1 SVG noise tile, encoded as a data URI. Used as an overlay texture
// on glass panels — gives a subtle CRT-grain feel without bringing in an asset.
const NOISE_DATA_URI =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/></svg>"

const GLASS_TONES = {
  default: { bg: "rgba(4, 6, 20, 0.58)", blur: 18 },
  strong: { bg: "rgba(4, 6, 20, 0.75)", blur: 20 },
} as const

const TITLE_GRADIENTS: Record<Universe, string> = {
  professional: "linear-gradient(90deg, #ff006e, #8338ec, #3a86ff, #06ffa5, #ffbe0b)",
  personal: "linear-gradient(90deg, #ffb0e0, #d090ff, #80d8ff, #b0ffd0, #fff0a0)",
}

const ACCENT_GRADIENTS: Record<Universe, string> = {
  professional:
    "linear-gradient(90deg, rgba(100,160,255,0.85), rgba(180,80,255,0.5), transparent 70%)",
  personal:
    "linear-gradient(90deg, rgba(255,160,220,0.85), rgba(180,140,255,0.5), transparent 70%)",
}

const EYEBROW_COLORS: Record<Universe, string> = {
  professional: "rgba(120,170,255,0.55)",
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
  const border = accentColor ? `${accentColor}30` : "rgba(255,255,255,0.07)"
  const shadow = accentColor
    ? `0 0 0 1px ${accentColor}15, 0 12px 40px rgba(0,0,0,0.5), 0 0 30px ${accentColor}10`
    : "0 0 0 1px rgba(90,130,255,0.1), 0 12px 40px rgba(0,0,0,0.45)"
  return (
    <div
      className={cn("glass-panel relative rounded-xl overflow-hidden", className)}
      style={{
        background: bg,
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        border: `1px solid ${border}`,
        boxShadow: shadow,
      }}
    >
      {/* Scanlines — subtle CRT vibe, faded toward the panel edges */}
      <div
        aria-hidden
        className="glass-scanlines pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,255,255,0.022) 2px, rgba(255,255,255,0.022) 3px)",
          mixBlendMode: "overlay",
        }}
      />
      {/* Grain — film-style noise speckle */}
      <div
        aria-hidden
        className="glass-grain pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `url("${NOISE_DATA_URI}")`,
          backgroundSize: "160px 160px",
          opacity: 0.06,
          mixBlendMode: "overlay",
        }}
      />
      {/* Shimmer — slow horizontal sweep that re-renders the panel as if it's
          made of light, dissipating into space at the edges */}
      <div
        aria-hidden
        className="glass-shimmer pointer-events-none absolute inset-0"
        style={{
          background: accentColor
            ? `linear-gradient(115deg, transparent 35%, ${accentColor}18 50%, transparent 65%)`
            : "linear-gradient(115deg, transparent 35%, rgba(120,170,255,0.10) 50%, transparent 65%)",
          mixBlendMode: "screen",
          backgroundSize: "200% 100%",
        }}
      />
      {/* Soft edge dissipation — fades the corners so the panel reads as
          emerging from the nebula rather than imposed on it */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{
          boxShadow: `inset 0 0 24px ${accentColor ?? "rgba(0,0,0"}${accentColor ? "00" : ",0.55)"}, inset 0 0 60px rgba(0,0,0,0.18)`,
        }}
      />
      <div className="relative">{children}</div>
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

function NavDial({
  onJoystick,
  accentColor,
}: {
  onJoystick: (vel: { x: number; y: number }) => void
  accentColor: string
}) {
  const SIZE = 150
  const HALF = SIZE / 2
  const RING_R = 58
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

  const ticks = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => {
      const ang = (i / 24) * Math.PI * 2 - Math.PI / 2
      const isCardinal = i % 6 === 0
      const isMid = i % 3 === 0
      const inn = isCardinal ? 52 : isMid ? 56 : 58.5
      const op = isCardinal ? 0.32 : isMid ? 0.18 : 0.1
      return (
        <line
          key={i}
          x1={HALF + Math.cos(ang) * inn}
          y1={HALF + Math.sin(ang) * inn}
          x2={HALF + Math.cos(ang) * 64}
          y2={HALF + Math.sin(ang) * 64}
          stroke={`rgba(255,255,255,${op})`}
          strokeWidth={isCardinal ? 1.4 : 1}
        />
      )
    })
  }, [])

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
      className="absolute top-1/2 -translate-y-1/2 right-12 pointer-events-auto"
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
          fill="rgba(4,6,20,0.4)"
          stroke="rgba(255,255,255,0.06)"
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

function SocialLink({ href, icon: Icon }: { href: string; icon: typeof Instagram }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200
        bg-[rgba(4,6,20,0.45)] backdrop-blur-[12px] border border-white/10 text-white/50
        hover:border-white/30 hover:text-white/95"
      style={{ WebkitBackdropFilter: "blur(12px)" }}
    >
      <Icon size={18} />
    </a>
  )
}

function RiftHint({ universe, onClick }: { universe: Universe; onClick: () => void }) {
  const accent = universe === "professional" ? "#d090ff" : "#80d0ff"
  const otherSide = universe === "professional" ? "Inner Universe" : "Public Universe"
  return (
    <button
      onClick={onClick}
      className="pointer-events-auto inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.2em] uppercase px-3 py-2 rounded-lg transition-all duration-200"
      style={{
        background: `${accent}10`,
        border: `1px solid ${accent}40`,
        color: accent,
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.background = `${accent}25`
        ;(e.currentTarget as HTMLElement).style.borderColor = `${accent}80`
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.background = `${accent}10`
        ;(e.currentTarget as HTMLElement).style.borderColor = `${accent}40`
      }}
    >
      <Sparkles size={12} />
      Rift &rarr; {otherSide}
    </button>
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
            style={{ background: `linear-gradient(90deg, ${c}cc, ${c}44, transparent 70%)` }}
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
                    background: `${c}15`,
                    border: `1px solid ${c}30`,
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
                    background: `${c}15`,
                    border: `1px solid ${c}40`,
                    color: c,
                  }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLElement).style.background = `${c}28`
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLElement).style.background = `${c}15`
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
          style={{ background: `linear-gradient(90deg, ${c}cc, ${c}44, transparent 70%)` }}
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
                  background: `${c}15`,
                  border: `1px solid ${c}30`,
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
  onJoystick,
  onEnterRift,
  onTogglePause,
}: UIOverlayProps) {
  const [glitchText, setGlitchText] = useState(config.glitchSubtitle)

  // Reset the glitch text whenever the universe changes
  useEffect(() => {
    setGlitchText(config.glitchSubtitle)
  }, [config.glitchSubtitle])

  useEffect(() => {
    if (selectedPlanet !== null) return

    const glitchChars = "!<>-_\\/[]{}—=+*^?#________"
    const originalText = config.glitchSubtitle
    let snapBackTimeout: ReturnType<typeof setTimeout> | null = null

    const glitchInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        const glitched = originalText
          .split("")
          .map(char =>
            Math.random() > 0.6 ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : char,
          )
          .join("")
        setGlitchText(glitched)
        if (snapBackTimeout) clearTimeout(snapBackTimeout)
        snapBackTimeout = setTimeout(() => setGlitchText(originalText), 50 + Math.random() * 100)
      }
    }, 200)

    return () => {
      clearInterval(glitchInterval)
      if (snapBackTimeout) clearTimeout(snapBackTimeout)
    }
  }, [selectedPlanet, config.glitchSubtitle])

  const planets = config.planets
  const selected = selectedPlanet !== null ? planets[selectedPlanet] : null
  const hovered = hoveredPlanet !== null ? planets[hoveredPlanet] : null

  const titleGradient = TITLE_GRADIENTS[universe]
  const accentGradient = ACCENT_GRADIENTS[universe]
  const eyebrowColor = EYEBROW_COLORS[universe]

  return (
    <>
      {/* Title (system view) */}
      {mode === "system" && (
        <div className="absolute top-8 left-8 pointer-events-none">
          <GlassPanel>
            <div className="h-px w-full" style={{ background: accentGradient }} />
            <div className="px-6 py-5">
              <div
                className="text-[10px] font-semibold tracking-[0.28em] uppercase mb-4"
                style={{ color: eyebrowColor }}
              >
                {config.eyebrow}
              </div>

              <div className="text-3xl font-bold text-white tracking-tight mb-1">
                Welcome to my{" "}
                <span
                  key={universe}
                  className="inline-block font-black bg-clip-text text-transparent"
                  style={{
                    backgroundImage: titleGradient,
                    backgroundSize: "200% 100%",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    animation: "wave 3s ease-in-out infinite, gradient 8s linear infinite",
                  }}
                >
                  {config.label}
                </span>
              </div>

              <div className="text-sm font-medium mb-5" style={{ color: "rgba(255,255,255,0.72)" }}>
                or rather my{" "}
                <span
                  className="glitch-text relative inline-block font-bold"
                  data-text={glitchText}
                >
                  {glitchText}
                </span>
              </div>

              <div
                className="mb-4 h-px"
                style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.1), transparent)" }}
              />

              <div className="text-xs tracking-wide" style={{ color: "rgba(255,255,255,0.38)" }}>
                Hover &amp; click any planet to explore
              </div>

              <div className="mt-4">
                <RiftHint universe={universe} onClick={onEnterRift} />
              </div>
            </div>
          </GlassPanel>
        </div>
      )}

      {/* Planet detail navigation */}
      {mode === "planet" && selected && (
        <>
          <div className="absolute top-8 left-8 right-8 flex justify-between items-start pointer-events-auto">
            <GlassPanel>
              <div className="h-px w-full" style={{ background: accentGradient }} />
              <div className="px-6 py-5">
                <div
                  className="text-[10px] font-semibold tracking-[0.28em] uppercase mb-3"
                  style={{ color: eyebrowColor }}
                >
                  Currently Exploring
                </div>
                <div className="text-2xl font-bold text-white tracking-tight mb-1">
                  {selected.name}
                </div>
                <div className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {selected.description}
                </div>
              </div>
            </GlassPanel>

            <button
              onClick={onBackToSystem}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150
                bg-[rgba(4,6,20,0.58)] backdrop-blur-[18px] border border-white/[0.07] text-white/60
                hover:border-[rgba(100,160,255,0.35)] hover:text-white/95"
              style={{ WebkitBackdropFilter: "blur(18px)" }}
            >
              <Home size={15} />
              Back to Solar System
            </button>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none text-white/50 text-xs tracking-wide">
            Click on the orbiting moons to explore projects
          </div>

          <NavDial onJoystick={onJoystick} accentColor={selected.color} />
        </>
      )}

      {/* Hover tooltip */}
      {hovered && mode === "system" && <HoverTooltip planet={hovered} />}

      {/* Moon mode: slim breadcrumb HUD + back-to-planet button.
          The actual project info is rendered diegetically as floating
          holograms around the data crystal in MoonView. */}
      {mode === "moon" && selected && selectedLandmark && (
        <>
          <div className="absolute top-8 left-8 pointer-events-auto">
            <GlassPanel accentColor={selectedLandmark.color}>
              <div
                className="h-px w-full"
                style={{
                  background: `linear-gradient(90deg, ${selectedLandmark.color}cc, ${selectedLandmark.color}33, transparent 70%)`,
                }}
              />
              <div className="px-5 py-4">
                <div
                  className="text-[10px] font-semibold tracking-[0.22em] uppercase mb-1"
                  style={{ color: `${selectedLandmark.color}cc` }}
                >
                  Now Inspecting
                </div>
                <div className="text-lg font-bold text-white tracking-tight leading-tight">
                  {selectedLandmark.name}
                </div>
                <div
                  className="text-[11px] mt-1"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                >
                  {selected.name}
                </div>
              </div>
            </GlassPanel>
          </div>

          <button
            onClick={onBackFromMoon}
            className="absolute top-8 right-8 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150
              bg-[rgba(4,6,20,0.58)] backdrop-blur-[18px] border border-white/[0.07] text-white/60
              hover:border-[rgba(100,160,255,0.35)] hover:text-white/95 pointer-events-auto"
            style={{ WebkitBackdropFilter: "blur(18px)" }}
          >
            <ArrowLeft size={15} />
            Back to {selected.name.replace(/\s*Planet\s*$/i, "")}
          </button>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none text-white/45 text-xs tracking-wide">
            Drag to orbit · scroll to zoom
          </div>
        </>
      )}

      {/* Social links */}
      <div className="absolute bottom-8 right-8 flex gap-3 pointer-events-auto">
        <SocialLink href="https://www.instagram.com/limiliminal/" icon={Instagram} />
        <SocialLink href="https://www.linkedin.com/in/mohammad-abu-daqer/" icon={Linkedin} />
      </div>

      {/* Pause / freeze toggle (also: spacebar, or click the sun) + music toggle */}
      <div className="absolute bottom-8 left-8 flex items-center gap-3 pointer-events-auto">
        <BackgroundMusic />
        <button
          onClick={onTogglePause}
          aria-label={paused ? "Resume orbital motion" : "Freeze orbital motion"}
          title={paused ? "Resume (space)" : "Freeze (space)"}
          className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150
            bg-[rgba(4,6,20,0.55)] backdrop-blur-[12px] border text-white/65
            hover:text-white/95"
          style={{
            WebkitBackdropFilter: "blur(12px)",
            borderColor: paused ? "rgba(255,200,80,0.5)" : "rgba(255,255,255,0.10)",
            boxShadow: paused
              ? "0 0 18px rgba(255,200,80,0.25), 0 0 0 1px rgba(255,200,80,0.25)"
              : "none",
          }}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        {paused && (
          <div
            className="text-[10px] font-semibold tracking-[0.28em] uppercase select-none pointer-events-none"
            style={{ color: "rgba(255,200,80,0.85)" }}
          >
            Stasis · Space to resume
          </div>
        )}
        {!paused && (
          <div
            className="text-[10px] font-medium tracking-[0.18em] uppercase select-none pointer-events-none"
            style={{ color: "rgba(255,255,255,0.32)" }}
          >
            Space · click sun to freeze
          </div>
        )}
      </div>

      <style jsx>{`
        /* Glass-panel shimmer — slow horizontal sweep so panels feel alive */
        :global(.glass-shimmer) {
          animation: shimmerSweep 9s ease-in-out infinite;
        }
        @keyframes shimmerSweep {
          0%   { background-position: -100% 0; opacity: 0.0; }
          15%  { opacity: 0.85; }
          50%  { background-position: 100% 0; opacity: 0.85; }
          65%  { opacity: 0.0; }
          100% { background-position: 200% 0; opacity: 0.0; }
        }

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

        /* Universe title motion + gradient */
        @keyframes wave {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-5px); }
        }
        @keyframes gradient {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }

        /* Glitch visuals */
        .glitch-text {
          color: #00ff41;
          text-shadow: 0 0 5px #00ff41;
        }
        .glitch-text::before,
        .glitch-text::after {
          content: attr(data-text);
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
        }
        .glitch-text::before {
          animation: glitch-1 0.3s infinite;
          color: #ff00ff;
          z-index: -1;
        }
        .glitch-text::after {
          animation: glitch-2 0.3s infinite;
          color: #00ffff;
          z-index: -2;
        }

        @keyframes glitch-1 {
          0%   { transform: translate(0); }
          20%  { transform: translate(-2px, 2px); }
          40%  { transform: translate(-2px, -2px); }
          60%  { transform: translate(2px, 2px); }
          80%  { transform: translate(2px, -2px); }
          100% { transform: translate(0); }
        }
        @keyframes glitch-2 {
          0%   { transform: translate(0); }
          20%  { transform: translate(2px, -2px); }
          40%  { transform: translate(2px, 2px); }
          60%  { transform: translate(-2px, -2px); }
          80%  { transform: translate(-2px, 2px); }
          100% { transform: translate(0); }
        }
      `}</style>
    </>
  )
}
