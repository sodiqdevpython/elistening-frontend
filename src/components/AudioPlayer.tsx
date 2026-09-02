import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { YouTubePlayerHandle } from './YouTubePlayer'

interface Props {
  src: string
  autoplay?: boolean
}

/** Native <audio> wrapper — YouTubePlayerHandle interfeysi bilan bir xil. */
const AudioPlayer = forwardRef<YouTubePlayerHandle, Props>(function AudioPlayer(
  { src, autoplay = false }, ref,
) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const stopAtRef = useRef<number | null>(null)

  useImperativeHandle(ref, () => ({
    play: () => audioRef.current?.play?.().catch(() => {}),
    pause: () => audioRef.current?.pause?.(),
    playRange: (startMs, endMs) => {
      const el = audioRef.current
      if (!el) return
      el.currentTime = startMs / 1000
      stopAtRef.current = endMs ?? null
      el.play().catch(() => {})
    },
    seek: (ms) => { if (audioRef.current) audioRef.current.currentTime = ms / 1000 },
    currentTimeMs: () => (audioRef.current?.currentTime ?? 0) * 1000,
    setPlaybackRate: (rate) => {
      if (audioRef.current) audioRef.current.playbackRate = rate
    },
    isPlaying: () => {
      const el = audioRef.current
      return !!el && !el.paused && !el.ended && el.currentTime > 0
    },
    setVolume: (v) => {
      const el = audioRef.current
      if (el) el.volume = Math.max(0, Math.min(1, v / 100))
    },
    getVolume: () => {
      const el = audioRef.current
      return el ? Math.round(el.volume * 100) : null
    },
    mute: () => { if (audioRef.current) audioRef.current.muted = true },
    unMute: () => { if (audioRef.current) audioRef.current.muted = false },
    isMuted: () => !!audioRef.current?.muted,
  }))

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const check = () => {
      const stop = stopAtRef.current
      if (stop == null || el.paused) return
      if (el.currentTime * 1000 >= stop) { el.pause(); stopAtRef.current = null }
    }
    el.addEventListener('timeupdate', check)
    const timer = window.setInterval(check, 100)
    return () => { el.removeEventListener('timeupdate', check); window.clearInterval(timer) }
  }, [src])

  return (
    <audio ref={audioRef} src={src} controls autoPlay={autoplay} preload="metadata"
      style={{ width: '100%' }} />
  )
})

export default AudioPlayer
