"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Home, Instagram, Linkedin } from "lucide-react"
import { PLANET_NAMES, PLANET_DESCRIPTIONS, LANDMARKS, type Landmark } from "@/lib/constants"

interface UIOverlayProps {
  selectedPlanet: number | null
  hoveredPlanet: number | null
  selectedLandmark: Landmark | null
  onBackToSystem: () => void
  onRotatePlanet: (direction: "left" | "right" | "up" | "down") => void
  onCloseLandmark: () => void
}

const PLANET_META = [
  { color: "#ff0080", tags: ["C/C++", "GPU", "Rendering", "Generative AI"] },
  { color: "#00d470", tags: ["C++", "Graphs", "Pathfinding", "Optimization"] },
  { color: "#4080ff", tags: ["ROS", "NMPC", "LiDAR", "MATLAB"] },
  { color: "#ff8000", tags: ["Python", "CI/CD", "Hardware", "Systems"] },
]

function NavBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.45)",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = "rgba(100,160,255,0.15)"
        el.style.borderColor = "rgba(100,160,255,0.35)"
        el.style.color = "rgba(255,255,255,0.95)"
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = "rgba(255,255,255,0.05)"
        el.style.borderColor = "rgba(255,255,255,0.08)"
        el.style.color = "rgba(255,255,255,0.45)"
      }}
    >
      {children}
    </button>
  )
}

export default function UIOverlay({
  selectedPlanet,
  hoveredPlanet,
  selectedLandmark,
  onBackToSystem,
  onRotatePlanet,
  onCloseLandmark,
}: UIOverlayProps) {
  // === Glitch text logic (matches the earlier version) ===
  const [glitchText, setGlitchText] = useState("solar system")

  useEffect(() => {
    const glitchChars = "!<>-_\\/[]{}—=+*^?#________"
    const originalText = "solar system :P"

    const glitchInterval = setInterval(() => {
      // ~30% chance to trigger a glitch
      if (Math.random() > 0.7) {
        const glitched = originalText
          .split("")
          .map((char) => (Math.random() > 0.6 ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : char))
          .join("")

        setGlitchText(glitched)

        // snap back quickly to clean text
        const t = setTimeout(() => setGlitchText(originalText), 50 + Math.random() * 100)
        return () => clearTimeout(t)
      }
    }, 200)

    return () => clearInterval(glitchInterval)
  }, [])

  return (
    <>
      {/* Title (only in system view) */}
      {selectedPlanet === null && (
        <div className="absolute top-8 left-8 pointer-events-none">
          <div
            className="relative rounded-xl overflow-hidden"
            style={{
              background: "rgba(4, 6, 20, 0.58)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 0 0 1px rgba(90,130,255,0.1), 0 12px 40px rgba(0,0,0,0.45)",
            }}
          >
            {/* Top accent line */}
            <div
              className="h-px w-full"
              style={{
                background: "linear-gradient(90deg, rgba(100,160,255,0.85), rgba(180,80,255,0.5), transparent 70%)",
              }}
            />

            <div className="px-6 py-5">
              {/* Eyebrow label */}
              <div
                className="text-[10px] font-semibold tracking-[0.28em] uppercase mb-4"
                style={{ color: "rgba(120,170,255,0.55)" }}
              >
                Interactive Portfolio
              </div>

              {/* Main heading */}
              <div className="text-3xl font-bold text-white tracking-tight mb-1">
                Welcome to my{" "}
                <span
                  className="inline-block font-black"
                  style={{
                    background: "linear-gradient(90deg, #ff006e, #8338ec, #3a86ff, #06ffa5, #ffbe0b)",
                    backgroundSize: "200% 100%",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    animation: "wave 3s ease-in-out infinite, gradient 8s linear infinite",
                  }}
                >
                  Universe
                </span>
              </div>

              {/* Subtitle with glitch */}
              <div className="text-sm font-medium mb-5" style={{ color: "rgba(255,255,255,0.72)" }}>
                or rather my{" "}
                <span className="glitch-text relative inline-block font-bold" data-text={glitchText}>
                  {glitchText}
                </span>
              </div>

              {/* Divider */}
              <div
                className="mb-4 h-px"
                style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.1), transparent)" }}
              />

              {/* Hint */}
              <div
                className="text-xs tracking-wide"
                style={{ color: "rgba(255,255,255,0.38)" }}
              >
                Hover &amp; click any planet to explore
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Planet detail navigation */}
      {selectedPlanet !== null && (
        <>
          <div className="absolute top-8 left-8 right-8 flex justify-between items-start pointer-events-auto">
            {/* Planet info panel */}
            <div
              className="relative rounded-xl overflow-hidden"
              style={{
                background: "rgba(4, 6, 20, 0.58)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "0 0 0 1px rgba(90,130,255,0.1), 0 12px 40px rgba(0,0,0,0.45)",
              }}
            >
              <div
                className="h-px w-full"
                style={{ background: "linear-gradient(90deg, rgba(100,160,255,0.85), rgba(180,80,255,0.5), transparent 70%)" }}
              />
              <div className="px-6 py-5">
                <div
                  className="text-[10px] font-semibold tracking-[0.28em] uppercase mb-3"
                  style={{ color: "rgba(120,170,255,0.55)" }}
                >
                  Currently Exploring
                </div>
                <div className="text-2xl font-bold text-white tracking-tight mb-1">
                  {PLANET_NAMES[selectedPlanet]}
                </div>
                <div className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {PLANET_DESCRIPTIONS[selectedPlanet]}
                </div>
              </div>
            </div>

            {/* Back button */}
            <button
              onClick={onBackToSystem}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150"
              style={{
                background: "rgba(4, 6, 20, 0.58)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.6)",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = "rgba(100,160,255,0.35)"
                el.style.color = "rgba(255,255,255,0.95)"
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = "rgba(255,255,255,0.07)"
                el.style.color = "rgba(255,255,255,0.6)"
              }}
            >
              <Home size={15} />
              Back to Solar System
            </button>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none text-white/50 text-xs tracking-wide">
            Click on the moon crystals to explore projects
          </div>

          <div className="absolute top-1/2 -translate-y-1/2 right-16 pointer-events-auto">
            <div
              className="relative flex flex-col items-center gap-1.5 px-5 py-4 rounded-2xl overflow-hidden"
              style={{
                background: "rgba(4, 6, 20, 0.55)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "0 0 0 1px rgba(90,130,255,0.08), 0 8px 32px rgba(0,0,0,0.4)",
              }}
            >
              {/* Top accent */}
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(100,160,255,0.5), transparent)" }}
              />

              <NavBtn onClick={() => onRotatePlanet("up")}><ArrowUp size={14} /></NavBtn>
              <div className="flex items-center gap-1.5">
                <NavBtn onClick={() => onRotatePlanet("left")}><ArrowLeft size={14} /></NavBtn>
                <div
                  className="w-14 text-center text-[10px] font-semibold tracking-[0.2em] uppercase"
                  style={{ color: "rgba(255,255,255,0.28)" }}
                >
                  explore
                </div>
                <NavBtn onClick={() => onRotatePlanet("right")}><ArrowRight size={14} /></NavBtn>
              </div>
              <NavBtn onClick={() => onRotatePlanet("down")}><ArrowDown size={14} /></NavBtn>
            </div>
          </div>
        </>
      )}

      {/* Hover tooltip */}
      {hoveredPlanet !== null && selectedPlanet === null && (() => {
        const meta  = PLANET_META[hoveredPlanet]
        const count = (LANDMARKS[hoveredPlanet] || []).length
        const c     = meta.color
        return (
          <div className="absolute right-8 top-8 pointer-events-none" style={{ width: 280 }}>
            <div
              className="relative rounded-xl overflow-hidden"
              style={{
                background: "rgba(4, 6, 20, 0.75)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: `1px solid ${c}30`,
                boxShadow: `0 0 0 1px ${c}15, 0 12px 40px rgba(0,0,0,0.5), 0 0 30px ${c}10`,
              }}
            >
              {/* Top accent in planet color */}
              <div className="h-px w-full" style={{ background: `linear-gradient(90deg, ${c}cc, ${c}44, transparent 70%)` }} />

              <div className="p-5">
                {/* Hologram + info row */}
                <div className="flex items-center gap-4 mb-4">
                  {/* Hologram planet */}
                  <div className="relative flex-shrink-0" style={{ width: 64, height: 64 }}>
                    {/* Orbit ring */}
                    <div
                      className="absolute"
                      style={{
                        inset: -6, borderRadius: "50%",
                        border: `1px solid ${c}35`,
                        animation: "orbitSpin 8s linear infinite",
                      }}
                    />
                    {/* Planet circle */}
                    <div
                      className="relative w-full h-full rounded-full overflow-hidden"
                      style={{
                        background: `radial-gradient(circle at 38% 35%, ${c}50, ${c}18 55%, ${c}06)`,
                        border: `1px solid ${c}60`,
                        boxShadow: `0 0 18px ${c}40, inset 0 0 14px ${c}20`,
                        animation: "holoPulse 2.5s ease-in-out infinite",
                      }}
                    >
                      {/* Scanlines */}
                      <div
                        className="absolute inset-0"
                        style={{
                          background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)",
                          animation: "scanMove 2s linear infinite",
                        }}
                      />
                      {/* Glitch overlay */}
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: `radial-gradient(circle at 60% 60%, ${c}20, transparent 60%)`,
                          animation: "holoGlitch 4s steps(1) infinite",
                        }}
                      />
                    </div>
                  </div>

                  {/* Name + stats */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold tracking-[0.22em] uppercase mb-1.5" style={{ color: `${c}99` }}>
                      Planet
                    </div>
                    <div className="text-base font-bold text-white leading-tight mb-1 truncate">
                      {PLANET_NAMES[hoveredPlanet]}
                    </div>
                    <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {count} project{count !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div
                  className="text-xs leading-relaxed mb-4"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  {PLANET_DESCRIPTIONS[hoveredPlanet]}
                </div>

                {/* Tech tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {meta.tags.map(tag => (
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

                {/* CTA */}
                <div
                  className="h-px mb-3"
                  style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.08), transparent)" }}
                />
                <div className="text-[10px] tracking-[0.18em] uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Click to explore →
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Landmark detail panel */}
      {selectedLandmark && (
        <div className="absolute left-8 top-44 bottom-0 flex items-center pointer-events-none">
        <div className="pointer-events-auto max-w-md w-full">
          <div className="bg-black/80 backdrop-blur-sm text-white p-6 rounded-lg border border-white/20 relative">
            <button onClick={onCloseLandmark} className="absolute top-2 right-2 text-white/60 hover:text-white">
              ✕
            </button>
            <h3 className="text-2xl font-bold mb-2">{selectedLandmark.name}</h3>
            <p className="text-sm opacity-80 mb-3">{selectedLandmark.category}</p>
            <p className="text-sm mb-4">{selectedLandmark.description}</p>
            <div className="flex gap-2 flex-wrap">
              {selectedLandmark.technologies.map((t: string, i: number) => (
                <span key={i} className="bg-white/20 px-2 py-1 rounded text-xs">
                  {t}
                </span>
              ))}
            </div>
            {selectedLandmark.link && (
              <a
                href={selectedLandmark.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm transition-colors"
              >
                View Project
              </a>
            )}
          </div>
        </div>
        </div>
      )}

      {/* Social links — always visible */}
      <div className="absolute bottom-8 right-8 flex gap-3 pointer-events-auto">
        <a
          href="https://www.instagram.com/limiliminal/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200"
          style={{
            background: "rgba(4, 6, 20, 0.45)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.5)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.95)"
            ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.3)"
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)"
            ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"
          }}
        >
          <Instagram size={18} />
        </a>
        <a
          href="https://www.linkedin.com/in/mohammad-abu-daqer/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200"
          style={{
            background: "rgba(4, 6, 20, 0.45)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.5)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.95)"
            ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.3)"
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)"
            ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"
          }}
        >
          <Linkedin size={18} />
        </a>
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
          90%  { transform: translate(-3px, 1px); opacity: 0.7; }
          92%  { transform: translate(3px, -1px); opacity: 0.9; }
          94%  { transform: translate(-1px, 2px); opacity: 0.75; }
          96%  { transform: translate(0, 0); opacity: 1; }
        }

        /* Universe title motion + gradient */
        @keyframes wave {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 200% 50%;
          }
        }

        /* === Glitch visuals (layers like your original) === */
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
          0% {
            transform: translate(0);
          }
          20% {
            transform: translate(-2px, 2px);
          }
          40% {
            transform: translate(-2px, -2px);
          }
          60% {
            transform: translate(2px, 2px);
          }
          80% {
            transform: translate(2px, -2px);
          }
          100% {
            transform: translate(0);
          }
        }
        @keyframes glitch-2 {
          0% {
            transform: translate(0);
          }
          20% {
            transform: translate(2px, -2px);
          }
          40% {
            transform: translate(2px, 2px);
          }
          60% {
            transform: translate(-2px, -2px);
          }
          80% {
            transform: translate(-2px, 2px);
          }
          100% {
            transform: translate(0);
          }
        }
      `}</style>
    </>
  )
}
