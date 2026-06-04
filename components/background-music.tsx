"use client"

import { Volume2, VolumeX } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface BackgroundMusicProps {
  src?: string
  volume?: number
  hideToggle?: boolean
}

export default function BackgroundMusic({
  src = "/ambient.mp3",
  volume = 0.35,
  hideToggle = false,
}: BackgroundMusicProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [muted, setMuted] = useState(false)

  // On first user interaction, directly call play() on the audio element.
  // Browsers require a user gesture before allowing audio — calling play()
  // inside the gesture handler satisfies that requirement.
  useEffect(() => {
    const tryPlay = () => {
      const a = audioRef.current
      if (!a) return
      a.volume = volume
      a.loop = true
      a.play().catch(() => {})
    }
    window.addEventListener("pointerdown", tryPlay, { once: true })
    window.addEventListener("keydown", tryPlay, { once: true })
    return () => {
      window.removeEventListener("pointerdown", tryPlay)
      window.removeEventListener("keydown", tryPlay)
    }
  }, [volume])

  // Sync mute/unmute toggle with actual playback
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (muted) {
      a.pause()
    } else {
      a.play().catch(() => {})
    }
  }, [muted])

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
