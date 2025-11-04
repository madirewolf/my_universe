"use client"

import { useEffect, useState } from "react"
import { RotateCcw, RotateCw, Home } from "lucide-react"
import { PLANET_NAMES, PLANET_DESCRIPTIONS, type Landmark } from "@/lib/constants"

interface UIOverlayProps {
  selectedPlanet: number | null
  hoveredPlanet: number | null
  selectedLandmark: Landmark | null
  onBackToSystem: () => void
  onRotatePlanet: (direction: "left" | "right") => void
  onCloseLandmark: () => void
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
        <div className="absolute top-8 left-8 text-white drop-shadow-lg pointer-events-none">
          <h1 className="text-4xl font-bold mb-2">
            Welcome to my{" "}
            <span
              className="inline-block font-black tracking-wider"
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
          </h1>

          <h2 className="text-xl opacity-90">
            or rather my{" "}
            {/* Glitch text with layered pseudo-elements */}
            <span className="glitch-text font-mono relative inline-block font-bold" data-text={glitchText}>
              {glitchText}
            </span>{" "}
          </h2>
          
          <h4 className="opacity-70 text-[1.2vw]">Hover and click on any planet to explore my work!</h4>
        </div>
      )}

      {/* Planet detail navigation */}
      {selectedPlanet !== null && (
        <>
          <div className="absolute top-8 left-8 right-8 flex justify-between items-center pointer-events-auto">
            <div className="text-white">
              <h2 className="text-3xl font-bold">{PLANET_NAMES[selectedPlanet]}</h2>
              <p className="text-lg opacity-80">{PLANET_DESCRIPTIONS[selectedPlanet]}</p>
              <p className="text-sm opacity-60">Click on landmarks to explore projects</p>
            </div>
            <button
              onClick={onBackToSystem}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg backdrop-blur-sm transition-colors"
            >
              <Home size={20} />
              Back to Solar System
            </button>
          </div>

          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 pointer-events-auto">
            <div className="flex items-center gap-4 bg-black/50 backdrop-blur-sm rounded-lg p-4">
              <button
                onClick={() => onRotatePlanet("left")}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <RotateCcw size={20} />
                Rotate Left
              </button>
              <div className="text-white text-sm opacity-80">Rotate to find all landmarks</div>
              <button
                onClick={() => onRotatePlanet("right")}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <RotateCw size={20} />
                Rotate Right
              </button>
            </div>
          </div>
        </>
      )}

      {/* Hover tooltip */}
      {hoveredPlanet !== null && selectedPlanet === null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg border border-white/20">
            <h3 className="text-xl font-bold">{PLANET_NAMES[hoveredPlanet]}</h3>
            <p className="text-sm opacity-80">Click to explore</p>
          </div>
        </div>
      )}

      {/* Landmark detail panel */}
      {selectedLandmark && (
        <div className="absolute top-1/2 left-8 -translate-y-1/2 pointer-events-auto max-w-md">
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
      )}

      <style jsx>{`
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
