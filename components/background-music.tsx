"use client"

import { Volume2, VolumeX } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface BackgroundMusicProps {
  /** URL of the audio file. Drop your file at /public/xtal.mp3 by default. */
  src?: string
  /** 0 to 1 */
  volume?: number
  /** Render the toggle button somewhere external instead of here. */
  hideToggle?: boolean
}

/**
 * Loops an ambient track in the background. Browsers block autoplay until the
 * user has interacted with the page, so we:
 *   1. Render the <audio> element pre-loaded but paused
 *   2. On first ANY click/keypress anywhere on the page, attempt play()
 *   3. Render a Volume2/VolumeX toggle button so the user can mute/unmute
 *
 * The audio file isn't bundled — drop yours at /public/xtal.mp3 (or pass a URL
 * via the `src` prop). For Aphex Twin's "Xtal" the user supplies the file
 * locally; we don't ship copyrighted audio.
 */
export default function BackgroundMusic({
  src = "/xtal.mp3",
  volume = 0.35,
  hideToggle = false,
}: BackgroundMusicProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [muted, setMuted] = useState(true)
  const [hasInteracted, setHasInteracted] = useState(false)

  // First user interaction unblocks autoplay across the whole page
  useEffect(() => {
    if (hasInteracted) return
    const onFirstInteract = () => {
      setHasInteracted(true)
      setMuted(false)
    }
    window.addEventListener("pointerdown", onFirstInteract, { once: true })
    window.addEventListener("keydown", onFirstInteract, { once: true })
    return () => {
      window.removeEventListener("pointerdown", onFirstInteract)
      window.removeEventListener("keydown", onFirstInteract)
    }
  }, [hasInteracted])

  // Keep audio playback in sync with the muted flag
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.volume = volume
    a.loop = true
    if (muted) {
      a.pause()
    } else {
      a.play().catch(() => {
        // Autoplay blocked — user will need to click the toggle once
      })
    }
  }, [muted, volume])

  return (
    <>
      <audio ref={audioRef} src={src} loop preload="auto" />
      {!hideToggle && (
        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute background music" : "Mute background music"}
          title={muted ? "Unmute" : "Mute"}
          className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150
            bg-[rgba(4,6,20,0.55)] backdrop-blur-[12px] border text-white/65
            hover:text-white/95"
          style={{
            WebkitBackdropFilter: "blur(12px)",
            borderColor: muted ? "rgba(255,255,255,0.10)" : "rgba(140,200,255,0.45)",
            boxShadow: muted
              ? "none"
              : "0 0 18px rgba(140,200,255,0.22), 0 0 0 1px rgba(140,200,255,0.22)",
          }}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      )}
    </>
  )
}
