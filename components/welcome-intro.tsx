"use client"

import { useEffect, useRef, useState } from "react"
import type { Universe, UniverseConfig } from "@/lib/constants"

// Same gradients the old top-left banner used for the universe label —
// kept identical so the splash feels like the banner's cinematic upgrade.
const TITLE_GRADIENTS: Record<Universe, string> = {
  professional: "linear-gradient(90deg, #00b8a9, #26c6b8, #4dd0c8, #80deea, #a7ffeb)",
  personal: "linear-gradient(90deg, #ffb0e0, #d090ff, #80d8ff, #b0ffd0, #fff0a0)",
}

// Pre-generated neural voice line (Sonia via edge-tts, slowed and
// pitched down for a flat ship-AI delivery, then run through a subtle
// comms-band + chorus + echo chain for the futuristic timbre):
//   uvx edge-tts --voice en-GB-SoniaNeural --rate=-12% --pitch=-20Hz \
//     --text "Welcome to my universe. Or rather, my solar system." \
//     --write-media voice-raw.mp3
//   uvx --from static-ffmpeg static_ffmpeg -y -i voice-raw.mp3 \
//     -af "highpass=f=130,lowpass=f=7200,chorus=0.6:0.9:45|60:0.28|0.22:0.28|0.35:1.6|1.9,aecho=0.8:0.5:16|32:0.14|0.08,volume=1.55,alimiter=limit=0.95" \
//     -b:a 96k public/welcome-voice.mp3
const VOICE_SRC = "/welcome-voice.mp3"

// Splash timeline (ms): brief beat so the scene paints first, then
// fade/blur in, hold long enough to read, drift out, gone for the session.
const ENTER_DELAY = 700
const ENTER_DUR = 1100
const HOLD_DUR = 3600
const EXIT_DUR = 1000

type Phase = "waiting" | "enter" | "hold" | "exit" | "done"

// ?silent suppresses autoplaying audio (voice line + ambient music).
// Used for silent local debugging; also handy for embedding/demos.
export function isSilentMode(): boolean {
  if (typeof window === "undefined") return false
  return new URLSearchParams(window.location.search).has("silent")
}

export default function WelcomeIntro({
  universe,
  config,
  start = true,
  dismiss = false,
}: {
  universe: Universe
  config: UniverseConfig
  /** Gate: the splash timeline holds until this is true (boot screen done). */
  start?: boolean
  dismiss?: boolean
}) {
  const [phase, setPhase] = useState<Phase>("waiting")
  const [glitchText, setGlitchText] = useState(config.glitchSubtitle)
  const voiceRef = useRef<HTMLAudioElement>(null)
  const voiceStartedRef = useRef(false)

  const visible = phase === "enter" || phase === "hold"
  const active = visible // speech + glitch only run while the splash is up

  // Phase machine — each phase schedules the next. Holds in "waiting"
  // until the boot screen clears (`start`).
  useEffect(() => {
    if (!start && phase === "waiting") return
    const next: Partial<Record<Phase, [Phase, number]>> = {
      waiting: ["enter", ENTER_DELAY],
      enter: ["hold", ENTER_DUR],
      hold: ["exit", HOLD_DUR],
      exit: ["done", EXIT_DUR],
    }
    const step = next[phase]
    if (!step) return
    const t = setTimeout(() => setPhase(step[0]), step[1])
    return () => clearTimeout(t)
  }, [phase, start])

  // Early dismiss (planet dive / rift) — bail out and cut the voice.
  useEffect(() => {
    if (!dismiss) return
    setPhase(p => (p === "done" || p === "exit" ? p : "exit"))
    voiceRef.current?.pause()
  }, [dismiss])

  // Voice line. Browsers block audio before the first user gesture, so:
  // try as the splash enters, and if that was rejected, retry on the first
  // pointer/key interaction while the splash is still visible. A started
  // playback is left to finish past the fade (the <audio> stays mounted).
  useEffect(() => {
    if (!active || isSilentMode()) return
    const audio = voiceRef.current
    if (!audio) return

    const tryPlay = () => {
      if (voiceStartedRef.current) return
      audio.volume = 1.0
      audio
        .play()
        .then(() => {
          voiceStartedRef.current = true
          removeGestureListeners()
        })
        .catch(() => {
          // Autoplay blocked — the gesture listeners will retry.
        })
    }

    const onGesture = () => tryPlay()
    const removeGestureListeners = () => {
      window.removeEventListener("pointerdown", onGesture)
      window.removeEventListener("keydown", onGesture)
    }

    window.addEventListener("pointerdown", onGesture)
    window.addEventListener("keydown", onGesture)
    tryPlay()

    return removeGestureListeners
  }, [active])

  // Subtitle glitcher — same behavior the old banner had.
  useEffect(() => {
    if (!active) {
      setGlitchText(config.glitchSubtitle)
      return
    }
    const glitchChars = "!<>-_\\/[]{}—=+*^?#________"
    const originalText = config.glitchSubtitle
    let snapBack: ReturnType<typeof setTimeout> | null = null
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const glitched = originalText
          .split("")
          .map(ch =>
            Math.random() > 0.6 ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : ch,
          )
          .join("")
        setGlitchText(glitched)
        if (snapBack) clearTimeout(snapBack)
        snapBack = setTimeout(() => setGlitchText(originalText), 50 + Math.random() * 100)
      }
    }, 200)
    return () => {
      clearInterval(interval)
      if (snapBack) clearTimeout(snapBack)
    }
  }, [active, config.glitchSubtitle])

  const transition = visible
    ? `opacity ${ENTER_DUR}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${ENTER_DUR}ms cubic-bezier(0.16, 1, 0.3, 1), filter ${ENTER_DUR}ms cubic-bezier(0.16, 1, 0.3, 1)`
    : `opacity ${EXIT_DUR}ms ease-in, transform ${EXIT_DUR}ms ease-in, filter ${EXIT_DUR}ms ease-in`

  // The <audio> sits outside the phase conditional so playback that started
  // late (first gesture near the end of the splash) finishes naturally
  // instead of being cut when the visuals unmount.
  return (
    <>
      <audio ref={voiceRef} src={VOICE_SRC} preload="auto" playsInline />
      {phase !== "done" && (
        <div className="fixed inset-0 z-[130] grid place-items-center pointer-events-none" aria-hidden>
          {/* Soft scrim so the type reads over the sun — fades with the text,
              never a solid backdrop. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 62% 46% at 50% 46%, rgba(4,8,18,0.5), rgba(4,8,18,0.2) 55%, transparent 75%)",
              opacity: visible ? 1 : 0,
              transition: `opacity ${visible ? ENTER_DUR : EXIT_DUR}ms ease`,
            }}
          />

          <div
            className="relative px-6 text-center"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0) scale(1)" : phase === "exit" ? "translateY(-18px) scale(1.03)" : "translateY(26px) scale(0.965)",
              filter: visible ? "blur(0px)" : "blur(12px)",
              transition,
            }}
          >
            <div
              className="mx-auto mb-6 h-px"
              style={{
                width: "min(420px, 60vw)",
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
                transform: visible ? "scaleX(1)" : "scaleX(0)",
                transition: `transform ${visible ? ENTER_DUR + 300 : EXIT_DUR}ms cubic-bezier(0.16, 1, 0.3, 1)`,
              }}
            />

            <h1
              className="font-display font-bold tracking-tight leading-none"
              style={{
                fontSize: "clamp(2.5rem, 7.5vw, 5.75rem)",
                color: "rgba(255,255,255,0.92)",
                textShadow:
                  "0 0 24px rgba(255,255,255,0.18), 0 1px 1px rgba(255,255,255,0.22), 0 18px 44px rgba(0,0,0,0.35)",
              }}
            >
              Welcome to my{" "}
              <span
                className="inline-block font-black bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.54) 34%, rgba(255,255,255,0.88) 58%, rgba(255,255,255,0.48) 100%), ${TITLE_GRADIENTS[universe]}`,
                  backgroundBlendMode: "screen",
                  backgroundSize: "200% 100%",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter:
                    "drop-shadow(0 0 18px rgba(255,255,255,0.16)) drop-shadow(0 12px 30px rgba(0,0,0,0.3))",
                  animation: "introGradient 8s linear infinite",
                }}
              >
                {config.label}
              </span>
            </h1>

            <div
              className="font-sans font-medium mt-4"
              style={{
                fontSize: "clamp(1rem, 2.6vw, 1.5rem)",
                color: "rgba(255,255,255,0.6)",
                textShadow: "0 0 14px rgba(255,255,255,0.1), 0 12px 28px rgba(0,0,0,0.3)",
              }}
            >
              {universe === "professional" && <>or rather my{" "}</>}
              <span className="intro-glitch relative inline-block font-bold" data-text={glitchText}>
                {glitchText}
              </span>
            </div>

            <div
              className="mx-auto mt-6 h-px"
              style={{
                width: "min(420px, 60vw)",
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
                transform: visible ? "scaleX(1)" : "scaleX(0)",
                transition: `transform ${visible ? ENTER_DUR + 300 : EXIT_DUR}ms cubic-bezier(0.16, 1, 0.3, 1)`,
              }}
            />
          </div>

          <style jsx>{`
            @keyframes introGradient {
              0%   { background-position: 0% 50%; }
              100% { background-position: 200% 50%; }
            }

            .intro-glitch {
              color: #00ff41;
              text-shadow: 0 0 6px #00ff41;
            }
            .intro-glitch::before,
            .intro-glitch::after {
              content: attr(data-text);
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              height: 100%;
            }
            .intro-glitch::before {
              animation: introGlitch1 0.3s infinite;
              color: #ff00ff;
              z-index: -1;
            }
            .intro-glitch::after {
              animation: introGlitch2 0.3s infinite;
              color: #00ffff;
              z-index: -2;
            }

            @keyframes introGlitch1 {
              0%   { transform: translate(0); }
              20%  { transform: translate(-2px, 2px); }
              40%  { transform: translate(-2px, -2px); }
              60%  { transform: translate(2px, 2px); }
              80%  { transform: translate(2px, -2px); }
              100% { transform: translate(0); }
            }
            @keyframes introGlitch2 {
              0%   { transform: translate(0); }
              20%  { transform: translate(2px, -2px); }
              40%  { transform: translate(2px, 2px); }
              60%  { transform: translate(-2px, -2px); }
              80%  { transform: translate(-2px, 2px); }
              100% { transform: translate(0); }
            }
          `}</style>
        </div>
      )}
    </>
  )
}
