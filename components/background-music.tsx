"use client"

import { Volume2, VolumeX } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react"
import { isSilentMode } from "./welcome-intro"

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
  const [isPlaying, setIsPlaying] = useState(false)

  const playAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio || muted) return

    audio.volume = volume
    audio.loop = true
    audio.muted = false
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false))
  }, [muted, volume])

  useEffect(() => {
    // ?silent: no gesture-armed autoplay. The manual toggle still works.
    if (isSilentMode()) return
    let disposed = false

    const tryPlay = () => {
      const audio = audioRef.current
      if (!audio || muted) return

      audio.volume = volume
      audio.loop = true
      audio.muted = false
      audio
        .play()
        .then(() => {
          if (disposed) return
          setIsPlaying(true)
          window.removeEventListener("pointerdown", tryPlay)
          window.removeEventListener("touchstart", tryPlay)
          window.removeEventListener("click", tryPlay)
          window.removeEventListener("keydown", tryPlay)
        })
        .catch(() => setIsPlaying(false))
    }

    window.addEventListener("pointerdown", tryPlay)
    window.addEventListener("touchstart", tryPlay)
    window.addEventListener("click", tryPlay)
    window.addEventListener("keydown", tryPlay)

    return () => {
      disposed = true
      window.removeEventListener("pointerdown", tryPlay)
      window.removeEventListener("touchstart", tryPlay)
      window.removeEventListener("click", tryPlay)
      window.removeEventListener("keydown", tryPlay)
    }
  }, [muted, volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (muted) {
      audio.pause()
      setIsPlaying(false)
    } else {
      playAudio()
    }
  }, [muted, playAudio])

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const audio = audioRef.current
    if (!audio) return

    if (muted) {
      setMuted(false)
      return
    }

    if (audio.paused || !isPlaying) {
      playAudio()
      return
    }

    setMuted(true)
  }

  const shouldShowPlay = muted || !isPlaying

  return (
    <>
      {/* preload="none": the 3.8 MB ambient track stays off the critical
          path — it only starts downloading at the first user gesture that
          triggers playback anyway. */}
      <audio ref={audioRef} src={src} loop preload="none" playsInline />
      {!hideToggle && (
        <button
          type="button"
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onTouchStart={(event) => {
            event.stopPropagation()
          }}
          onClick={handleToggle}
          aria-label={shouldShowPlay ? "Play background music" : "Mute background music"}
          title={shouldShowPlay ? "Play music" : "Mute"}
          className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150
            backdrop-blur-[18px] border text-white/65
            hover:text-white/95"
          style={{
            background: shouldShowPlay
              ? "linear-gradient(135deg, rgba(255,255,255,0.032), rgba(255,255,255,0.007) 52%, rgba(255,255,255,0.038))"
              : "radial-gradient(circle at 12% 0%, rgba(140,200,255,0.20), transparent 48%), linear-gradient(135deg, rgba(255,255,255,0.042), rgba(255,255,255,0.008) 52%, rgba(255,255,255,0.045))",
            WebkitBackdropFilter: "blur(18px)",
            borderColor: shouldShowPlay ? "rgba(255,255,255,0.03)" : "rgba(140,200,255,0.28)",
            boxShadow: shouldShowPlay
              ? "0 0 18px rgba(180,210,255,0.035), 0 12px 24px rgba(0,0,0,0.12)"
              : "0 0 18px rgba(140,200,255,0.14), 0 12px 24px rgba(0,0,0,0.12)",
          }}
        >
          {shouldShowPlay ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      )}
    </>
  )
}
