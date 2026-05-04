"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Home, Instagram, Linkedin, Sparkles } from "lucide-react"
import type { Landmark, PlanetEntry, Universe, UniverseConfig } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface UIOverlayProps {
  universe: Universe
  config: UniverseConfig
  selectedPlanet: number | null
  hoveredPlanet: number | null
  selectedLandmark: Landmark | null
  onBackToSystem: () => void
  onRotatePlanet: (direction: "left" | "right" | "up" | "down") => void
  onCloseLandmark: () => void
  onEnterRift: () => void
}

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
      className={cn("relative rounded-xl overflow-hidden", className)}
      style={{
        background: bg,
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        border: `1px solid ${border}`,
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
  selectedPlanet,
  hoveredPlanet,
  selectedLandmark,
  onBackToSystem,
  onRotatePlanet,
  onCloseLandmark,
  onEnterRift,
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
      {selectedPlanet === null && (
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
      {selected && (
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

          <div className="absolute top-1/2 -translate-y-1/2 right-16 pointer-events-auto">
            <GlassPanel className="rounded-2xl flex flex-col items-center gap-1.5 px-5 py-4">
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(100,160,255,0.5), transparent)",
                }}
              />

              <NavBtn onClick={() => onRotatePlanet("up")}>
                <ArrowUp size={14} />
              </NavBtn>
              <div className="flex items-center gap-1.5">
                <NavBtn onClick={() => onRotatePlanet("left")}>
                  <ArrowLeft size={14} />
                </NavBtn>
                <div
                  className="w-14 text-center text-[10px] font-semibold tracking-[0.2em] uppercase"
                  style={{ color: "rgba(255,255,255,0.28)" }}
                >
                  explore
                </div>
                <NavBtn onClick={() => onRotatePlanet("right")}>
                  <ArrowRight size={14} />
                </NavBtn>
              </div>
              <NavBtn onClick={() => onRotatePlanet("down")}>
                <ArrowDown size={14} />
              </NavBtn>
            </GlassPanel>
          </div>
        </>
      )}

      {/* Hover tooltip */}
      {hovered && selectedPlanet === null && <HoverTooltip planet={hovered} />}

      {/* Landmark detail panel */}
      {selectedLandmark && <LandmarkPanel landmark={selectedLandmark} onClose={onCloseLandmark} />}

      {/* Social links */}
      <div className="absolute bottom-8 right-8 flex gap-3 pointer-events-auto">
        <SocialLink href="https://www.instagram.com/limiliminal/" icon={Instagram} />
        <SocialLink href="https://www.linkedin.com/in/mohammad-abu-daqer/" icon={Linkedin} />
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
