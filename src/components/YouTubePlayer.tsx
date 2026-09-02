import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { killCaptions, loadYouTubeApi } from '@/utils/youtube'

/**
 * YouTube IFrame wrapper.
 * README §9.1: video hech qachon serverimizdan uzatilmaydi — YouTube IFrame.
 *
 * Diktant uchun:
 * - `controls: 0` — YouTube o'z tugmalarini yashiradi (progress bar, play/pause)
 * - Video ustidagi shaffof overlay klikni ushlaydi — foydalanuvchi
 *   YouTube'ning o'zidan play qila olmaydi
 * - `chunkEndMsRef` — chunk oxiri, `playRange` bilan o'rnatiladi. State
 *   PLAYING'ga o'tsa (masalan YouTube ichidan yoki avtoplaydan), agar joriy
 *   vaqt chunk oxiridan o'tgan bo'lsa darrov to'xtaydi. Bu bizdagi
 *   playRange chegarasini har doim hurmat qiladi.
 */
export interface YouTubePlayerHandle {
  play(): void
  pause(): void
  playRange(startMs: number, endMs?: number): void
  seek(ms: number): void
  currentTimeMs(): number
  /** Ijro tezligi (0.25 / 0.5 / 0.75 / 1 / 1.25 / 1.5 / 1.75 / 2) */
  setPlaybackRate(rate: number): void
  /** Hozir haqiqatan ijro etilyaptimi (YT.PlayerState.PLAYING = 1). */
  isPlaying(): boolean
  /** 0..100 oralig'ida ovoz balandligini o'rnatadi. */
  setVolume(volume: number): void
  /** Hozirgi ovoz darajasi (0..100). Player tayyor bo'lmasa null. */
  getVolume(): number | null
  mute(): void
  unMute(): void
  isMuted(): boolean
}

interface Props {
  youtubeId: string
  onReady?: () => void
  autoplay?: boolean
  /** `true` — YouTube'ning barcha native tugmalari va klaviatura shortcut'lari
   *  yoqiladi (fullscreen, seek, playbackRate, arrow keys, K/J/L, va h.k.).
   *  Listening test rejimi uchun. Default `false` — diktant chunk logikasi
   *  o'z player'ini boshqaradi. */
  nativeControls?: boolean
}

// YouTube IFrame API — umumiy loader (`utils/youtube.ts`). Ilgari bu faylda
// ham, `ShortsPlayer.tsx` da ham alohida loader bor edi va ikkalasi
// `window.onYouTubeIframeAPIReady` ni qayta yozib bir-birini buzardi.
function loadYT(): Promise<void> {
  return loadYouTubeApi().then(() => undefined)
}

const YouTubePlayer = forwardRef<YouTubePlayerHandle, Props>(function YouTubePlayer(
  { youtubeId, onReady, autoplay = false, nativeControls = false }, ref,
) {
  const holderRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null)
  const [holderId] = useState(() => `yt-${Math.random().toString(36).slice(2)}`)
  const [ready, setReady] = useState(false)
  // Play/pause tugmasi UI holati — onStateChange orqali yangilanadi.
  const [playing, setPlaying] = useState(false)
  // Chunk oxiri (ms). playRange bilan o'rnatiladi. Faqat playRange yangi
  // qiymat bersa o'zgaradi — YouTube ichidan play bosilsa ham hurmat qilinadi.
  const chunkEndMsRef = useRef<number | null>(null)
  // Chunk boshi (ms). YouTube ichidan play bosilsa currentTime chunk oralig'iga
  // qaytariladi.
  const chunkStartMsRef = useRef<number | null>(null)

  // Ijro tezligi — player tayyor bo'lguncha memoize'lab qo'yamiz, ready
  // bo'lganda applyPendingRate() bilan qo'llanadi.
  const pendingRateRef = useRef<number>(1)
  // Player tayyor bo'lmasdan turib playRange chaqirilsa — buferga qo'yamiz.
  // Player onReady bo'lgan zahoti darrov ijro etamiz (kuttirmasdan).
  const pendingPlayRef = useRef<{ startMs: number; endMs?: number } | null>(null)
  // Ref versiyasi — `ready` state effect'lardan orqada qolishi mumkin,
  // shu bois ref bilan sinxron tekshiramiz (onReady ichida true qilamiz).
  const readyRef = useRef(false)
  // playRange (yoki playVideo) chaqirilganidan beri hali PLAYING'ga o'tmagan
  // bo'lsa loader ko'rsatamiz. `ready` bilan cheklanmaydi — player tayyor,
  // ammo videoning o'zi buffering'da bo'lishi mumkin.
  const [awaitingPlay, setAwaitingPlay] = useState(false)
  // Video hech bo'lmasa bir marta PLAYING'ga o'tganmi. Birinchi start uchun
  // loader ko'rsatamiz; keyingi chunk almashishlarida (video allaqachon "issiq"
  // holatda bo'lganda) loader ko'rsatmasak ham bo'ladi — seek darrov ishlaydi.
  const hasPlayedOnceRef = useRef(false)
  // Ovoz — localStorage'da saqlaymiz, sessiyalar orasida esda qoladi.
  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('listening.yt.volume')
      const v = raw != null ? Number(raw) : NaN
      return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 80
    } catch { return 80 }
  })
  const [muted, setMutedState] = useState<boolean>(() => {
    try { return localStorage.getItem('listening.yt.muted') === '1' }
    catch { return false }
  })
  // Player tayyor bo'lgach ovoz sozlamalarini qo'llaymiz
  useEffect(() => {
    try { localStorage.setItem('listening.yt.volume', String(volume)) } catch { /* noop */ }
    const p = playerRef.current
    if (p && readyRef.current) {
      try { p.setVolume(volume) } catch { /* noop */ }
    }
  }, [volume])
  useEffect(() => {
    try { localStorage.setItem('listening.yt.muted', muted ? '1' : '0') } catch { /* noop */ }
    const p = playerRef.current
    if (p && readyRef.current) {
      try { muted ? p.mute() : p.unMute() } catch { /* noop */ }
    }
  }, [muted])

  // YT.Player konstruktor obyektni darhol qaytaradi, LEKIN `seekTo`/`playVideo`
  // kabi metodlar onReady dan keyingina chaqirilishi mumkin. Shu bois ham
  // `readyRef` ni, ham metod mavjudligini tekshiramiz.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isUsable = (p: any) =>
    !!p && readyRef.current && typeof p.seekTo === 'function' && typeof p.playVideo === 'function'

  const doPlayRange = (startMs: number, endMs?: number) => {
    const p = playerRef.current
    // Chunk chegaralarini har doim yangilaymiz — hatto buferga tushsa ham
    // onReady dan keyin `pendingPlayRef` ni ijro etamiz.
    chunkStartMsRef.current = startMs
    chunkEndMsRef.current = endMs ?? null
    if (!isUsable(p)) {
      pendingPlayRef.current = { startMs, endMs }
      setAwaitingPlay(true)
      return
    }
    // Loader FAQAT birinchi start uchun — chunk almashishlarida ko'rsatmaymiz,
    // chunki video allaqachon issiq va seek darrov ishlaydi. Aks holda har
    // chunk'da o'rtada aylanuvchi spinner chiqib foydalanuvchini kuttirar edi.
    if (!hasPlayedOnceRef.current) setAwaitingPlay(true)
    try { p.setPlaybackRate?.(pendingRateRef.current) } catch { /* noop */ }
    // Seek'ni tashlab yuborish (re-bufferni oldini olish) UChun tor oyna:
    // joriy pozitsiya `startMs` dan biroz OLDIN yoki AYNAN shu joyda bo'lishi
    // shart. `startMs` dan O'TIB KETGAN bo'lsa har doim orqaga seek qilamiz —
    // aks holda LEAD padding tushib qoladi va yangi chunk birinchi so'zning
    // boshi eshitilmay qoladi (masalan "He claims" o'rniga "claims" bo'lib
    // qoladi). Seek orqaga arzon: bufer allaqachon shu joyda.
    const SEEK_SKIP_BEFORE_MS = 250   // biroz oldin bo'lsa skip
    const SEEK_SKIP_AFTER_MS = 30     // o'tib ketishi mumkin bo'lgan juda kichik oyna
    let curMs = -1
    try { curMs = (p.getCurrentTime?.() ?? 0) * 1000 } catch { /* noop */ }
    const closeEnough = hasPlayedOnceRef.current
      && curMs >= 0
      && curMs >= startMs - SEEK_SKIP_BEFORE_MS
      && curMs <= startMs + SEEK_SKIP_AFTER_MS
    if (!closeEnough) {
      try { p.seekTo(startMs / 1000, true) } catch { /* noop */ }
    }
    try { p.playVideo() } catch { /* noop */ }
  }

  useImperativeHandle(ref, () => ({
    play: () => {
      const p = playerRef.current
      if (!isUsable(p)) {
        // Ready bo'lmagan bo'lsa — pending play sifatida saqlaymiz
        if (chunkStartMsRef.current != null) {
          pendingPlayRef.current = {
            startMs: chunkStartMsRef.current,
            endMs: chunkEndMsRef.current ?? undefined,
          }
        }
        setAwaitingPlay(true)
        return
      }
      // Birinchi start bo'lmasa loader ko'rsatmaymiz — foydalanuvchi darrov ko'radi.
      if (!hasPlayedOnceRef.current) setAwaitingPlay(true)
      try { p.playVideo() } catch { /* noop */ }
    },
    pause: () => {
      const p = playerRef.current
      if (!isUsable(p)) return
      try { p.pauseVideo() } catch { /* noop */ }
    },
    playRange: doPlayRange,
    seek: (ms) => {
      const p = playerRef.current
      if (!isUsable(p)) return
      try { p.seekTo(ms / 1000, true) } catch { /* noop */ }
    },
    currentTimeMs: () => {
      const p = playerRef.current
      if (!isUsable(p)) return 0
      try { return p.getCurrentTime() * 1000 } catch { return 0 }
    },
    setPlaybackRate: (rate) => {
      pendingRateRef.current = rate
      const p = playerRef.current
      if (!isUsable(p)) return
      try { p.setPlaybackRate(rate) } catch { /* noop */ }
    },
    isPlaying: () => {
      const p = playerRef.current
      if (!isUsable(p) || typeof p.getPlayerState !== 'function') return false
      try { return p.getPlayerState() === 1 } catch { return false }
    },
    setVolume: (v) => {
      const clamped = Math.max(0, Math.min(100, Math.round(v)))
      setVolumeState(clamped)
    },
    getVolume: () => {
      const p = playerRef.current
      if (!isUsable(p) || typeof p.getVolume !== 'function') return null
      try { return p.getVolume() } catch { return null }
    },
    mute: () => setMutedState(true),
    unMute: () => setMutedState(false),
    isMuted: () => muted,
  }))

  useEffect(() => {
    let cancelled = false
    loadYT().then(() => {
      if (cancelled || !holderRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const YT = (window as any).YT
      playerRef.current = new YT.Player(holderId, {
        videoId: youtubeId,
        // nocookie domain — cookie/tracking yo'q, tezroq yuklanadi
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          rel: 0,
          modestbranding: 1,
          controls: nativeControls ? 1 : 0,
          disablekb: nativeControls ? 0 : 1,
          fs: nativeControls ? 1 : 0,
          iv_load_policy: 3,  // Video annotationlari yashiriladi
          cc_load_policy: 0,  // Captions/subtitle default'da yoqilmasin
          cc_lang_pref: 'xx', // Yaramas til → captions yuklanmaydi
          hl: 'xx',           // Interface tili — xato → CC ham xato
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            readyRef.current = true
            setReady(true)
            // Captions/subtitle modulini majburiy o'chiramiz — foydalanuvchi
            // videoning matnini o'qib qo'ymasligi uchun.
            killCaptions(playerRef.current)
            try {
              // Tezlik va ovoz — ready oldin chaqirilgan bo'lishi mumkin
              playerRef.current?.setPlaybackRate?.(pendingRateRef.current)
              playerRef.current?.setVolume?.(volume)
              if (muted) playerRef.current?.mute?.()
              else playerRef.current?.unMute?.()
            } catch { /* noop */ }
            // Ready'dan oldin buferga tushgan playRange chaqiruvi bo'lsa —
            // darrov ijro etamiz. Foydalanuvchi Boshlash bosgan, kutmaydi.
            const pending = pendingPlayRef.current
            if (pending) {
              pendingPlayRef.current = null
              doPlayRange(pending.startMs, pending.endMs)
            }
            onReady?.()
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onStateChange: (e: any) => {
            // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
            setPlaying(e.data === 1)
            if (e.data === 1) {
              hasPlayedOnceRef.current = true
              setAwaitingPlay(false)
            }
            if (e.data === 1) {
              const p = playerRef.current
              if (!p) return
              // Har play boshlanganda ham captions'ni majburiy o'chiramiz —
              // YouTube ba'zan avto-caption'ni qayta yoqib qo'yadi.
              killCaptions(p)
              const endMs = chunkEndMsRef.current
              const startMs = chunkStartMsRef.current
              if (endMs == null || startMs == null) return
              const cur = p.getCurrentTime() * 1000
              // Agar chunk oralig'idan tashqarida bo'lsa — chunk boshiga qaytaramiz
              if (cur >= endMs || cur < startMs - 500) {
                p.seekTo(startMs / 1000, true)
              }
            }
          },
        },
      })
    })
    // Chunk oxirini majburiy to'xtatish — timeupdate yo'q, poll qilamiz.
    // Player tayyor bo'lganidan keyin (getPlayerState mavjud) chaqiriladi.
    const timer = window.setInterval(() => {
      const p = playerRef.current
      const endMs = chunkEndMsRef.current
      if (!p || endMs == null) return
      if (typeof p.getPlayerState !== 'function') return  // hali tayyor emas
      if (p.getPlayerState() !== 1) return  // 1 = PLAYING
      if (typeof p.getCurrentTime !== 'function') return
      if (p.getCurrentTime() * 1000 >= endMs) {
        try { p.pauseVideo() } catch { /* postMessage race — jimgina o'tkazamiz */ }
      }
    }, 100)
    return () => {
      cancelled = true
      readyRef.current = false
      hasPlayedOnceRef.current = false
      window.clearInterval(timer)
      try { playerRef.current?.destroy?.() } catch { /* noop */ }
      playerRef.current = null
    }
  }, [youtubeId, holderId, autoplay, onReady])

  return (
    <div style={{
      position: 'relative', aspectRatio: '16/9', width: '100%',
      borderRadius: 16, overflow: 'hidden', background: '#0F172A',
    }}>
      <div id={holderId} ref={holderRef} style={{ width: '100%', height: '100%' }} />

      {/* Video ustidagi shaffof overlay — klik pause/resume ni almashtiradi.
          Foydalanuvchi YouTube'ning o'z UI'siga tegmasdan boshqaradi.
          `nativeControls` yoqilgan bo'lsa BU OVERLAY YO'Q — YouTube UI'siga
          klik borishi kerak (seek bar, playback rate, va h.k.) */}
      {!nativeControls && (
        <div
          onClick={() => {
            const p = playerRef.current
            if (!isUsable(p)) return
            if (playing) {
              try { p.pauseVideo() } catch { /* noop */ }
            } else {
              setAwaitingPlay(true)
              try { p.playVideo() } catch { /* noop */ }
            }
          }}
          onContextMenu={(e) => e.preventDefault()}
          title={playing ? 'To\'xtatish uchun bosing' : 'Ijro uchun bosing'}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 48,
            background: 'transparent', cursor: 'pointer',
          }}
        />
      )}

      {/* Katta markazdagi pause/play indikatori — faqat pause holatida
          ko'rinadi, playing paytda yashiriladi (video ko'rinsin). */}
      {ready && !awaitingPlay && !playing && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(0,0,0,.55)', color: '#FFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, pointerEvents: 'none',
            border: '2px solid rgba(255,255,255,.35)',
          }}
        >▶</div>
      )}

      {/* Loader — faqat foydalanuvchi ijro so'ragan (Boshlash yoki keyingi
          chunk) VA hali PLAYING'ga o'tmagan bo'lsa ko'rinadi. Video tayyor
          bo'lgani bilan o'z-o'zidan yopiladi, kuttirmaydi. */}
      {awaitingPlay && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(15,23,42,.85)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 14,
          color: '#E2E8F0', fontSize: 13, fontWeight: 600,
          zIndex: 3, pointerEvents: 'none',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: '3px solid rgba(255,255,255,.12)',
            borderTopColor: '#10B981',
            animation: 'ytSpin 0.7s linear infinite',
          }} />
          <span>{ready ? 'Video ochilyapti...' : 'YouTube tayyorlanmoqda...'}</span>
          <style>{`@keyframes ytSpin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Pastki boshqaruv bari — asl manbaga havola (mualliflik huquqi).
          Overlay'dan baland turadi. `nativeControls` yoqilgan bo'lsa
          YouTube'ning O'Z bari chiqadi, biznikini ko'rsatmaymiz. */}
      {!nativeControls && (
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 48,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px',
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.65) 100%)',
        zIndex: 2,
      }}>
        <span style={{
          fontSize: 11, color: 'rgba(255,255,255,.7)', fontWeight: 600,
          pointerEvents: 'none',
        }}>
          Videoga bosing — pauza / ijro
        </span>

        {/* Ovoz boshqaruvi — mute tugmasi + slider. Player tayyor bo'lgach
            ishlaydi, boshqa fokusni olmasin. */}
        <button
          type="button"
          onClick={() => setMutedState((m) => !m)}
          aria-label={muted ? 'Ovozni yoqish' : 'Ovozni o\'chirish'}
          title={muted ? 'Ovozni yoqish' : 'Ovozni o\'chirish'}
          style={{
            width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
            background: 'rgba(255,255,255,.14)', color: '#FFF',
            border: '1px solid rgba(255,255,255,.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
          }}
        >
          {muted || volume === 0 ? '🔇' : volume < 50 ? '🔈' : '🔊'}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={muted ? 0 : volume}
          onChange={(e) => {
            const v = Number(e.target.value)
            setVolumeState(v)
            if (v > 0 && muted) setMutedState(false)
          }}
          aria-label="Ovoz"
          title={`Ovoz: ${muted ? 0 : volume}`}
          style={{
            width: 96, accentColor: '#10B981', cursor: 'pointer',
          }}
        />

        <div style={{ flex: 1 }} />

        <a
          href={`https://www.youtube.com/watch?v=${youtubeId}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Asl manbani YouTube'da ochish"
          style={{
            fontSize: 12, fontWeight: 700, color: '#FFF',
            textDecoration: 'none',
            background: 'rgba(239, 68, 68, .85)',
            border: '1px solid rgba(255,255,255,.25)',
            borderRadius: 8, padding: '6px 10px',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <span aria-hidden>▶</span>
          YouTube'da ochish
        </a>
      </div>
      )}
    </div>
  )
})

export default YouTubePlayer
