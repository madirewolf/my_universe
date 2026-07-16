"use client"

import { useEffect, useState } from "react"

// Opaque cover for the initial WebGL warm-up — shader compilation stalls the
// first seconds of the scene hard, and without this the visitor stares at a
// half-frozen black canvas. Server-rendered, so it paints before the JS
// bundle even lands. Fades out once the canvas reports real rendered frames
// (`done`), then unmounts; the welcome splash starts after the fade.
export default function BootScreen({ done }: { done: boolean }) {
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setGone(true), 950)
    return () => clearTimeout(t)
  }, [done])

  if (gone) return null

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center"
      style={{
        // Translucent veil, not an opaque cover: the Star Nest fractal
        // backdrop compiles fast and blooms in behind the loader while the
        // heavy planet shaders are still stalling — the forming universe IS
        // the loading screen.
        background:
          "radial-gradient(ellipse at 50% 42%, rgba(6,10,22,0.55) 0%, rgba(3,5,9,0.82) 80%)",
        opacity: done ? 0 : 1,
        transition: "opacity 800ms ease 120ms",
        pointerEvents: done ? "none" : "auto",
      }}
      aria-label="Loading"
      role="status"
    >
      <div className="flex flex-col items-center gap-7">
        {/* Miniature orbit — core, ring, and one moon on the ring */}
        <div className="relative" style={{ width: 84, height: 84 }}>
          <div
            className="absolute rounded-full"
            style={{
              inset: 30,
              background: "radial-gradient(circle at 38% 35%, #ffd9a0, #e0813a 60%, #7a3c14)",
              boxShadow: "0 0 22px rgba(255,170,80,0.55)",
              animation: "bootCorePulse 2.2s ease-in-out infinite",
            }}
          />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: "1px solid rgba(140,180,255,0.28)",
              animation: "bootSpin 3.2s linear infinite",
            }}
          >
            <div
              className="absolute rounded-full"
              style={{
                width: 9,
                height: 9,
                left: "50%",
                top: -5,
                marginLeft: -4.5,
                background: "radial-gradient(circle at 35% 30%, #cfe4ff, #5f8fe0)",
                boxShadow: "0 0 10px rgba(130,175,255,0.8)",
              }}
            />
          </div>
        </div>

        <div
          className="font-display text-[12px] font-semibold uppercase select-none"
          style={{ color: "rgba(160,190,255,0.78)", letterSpacing: "0.42em", textIndent: "0.42em" }}
        >
          Initializing universe
          {/* Dots animate opacity (compositor) — a `content` animation would
              freeze on the main thread during shader compile. */}
          <span className="boot-dot" style={{ animationDelay: "0s" }}>.</span>
          <span className="boot-dot" style={{ animationDelay: "0.35s" }}>.</span>
          <span className="boot-dot" style={{ animationDelay: "0.7s" }}>.</span>
        </div>

        <div
          className="relative overflow-hidden rounded-full"
          style={{ width: 180, height: 2, background: "rgba(140,180,255,0.12)" }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: 60,
              background:
                "linear-gradient(90deg, transparent, rgba(150,190,255,0.85), transparent)",
              // transform, not `left`: keeps sweeping on the compositor even
              // while the main thread is stalled compiling planet shaders.
              animation: "bootScan 1.4s ease-in-out infinite",
              willChange: "transform",
            }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes bootSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes bootCorePulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
        @keyframes bootScan {
          0%   { transform: translateX(-60px); }
          100% { transform: translateX(180px); }
        }
        .boot-dot {
          display: inline-block;
          animation: bootDotFade 1.4s ease-in-out infinite;
          opacity: 0;
        }
        @keyframes bootDotFade {
          0%, 100% { opacity: 0; }
          40%, 70% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
