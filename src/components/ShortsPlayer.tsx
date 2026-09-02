import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { killCaptions, loadYouTubeApi } from '@/utils/youtube'

/**
 * ShortsPlayer — Shorts feed uchun YouTube player.
 *
 * Muhim qoida: **player HAR DOIM `mute: 1` bilan yaratiladi.** Ovoz faqat
 * slot FAOL bo'lganda (`active === true`) va foydalanuvchi ovozni o'chirmagan
 * bo'lsa yoqiladi. Ilgari `autoplay: 1` barcha mount qilingan playerlarga
 * berilardi — shu bois n+1 (oldindan yuklangan) video ham ovoz bilan
 * ijro etilib, foydalanuvchi n-videoni ko'rib turib n+1 ovozini eshitardi.
 *
 * Boshqa tuzatishlar:
 * - `onReady` da holat qayta qo'llanadi (ilgari player tayyor bo'lmagani
 *   sabab play/pause buyrug'i yo'qolib ketardi)
 * - unmount qilinganda player majburan `destroy()` — RAM va ovoz oqmasin
 * - video tugasa boshidan (YouTube Shorts kabi loop)
 * - unmuted autoplay bloklansa — muted rejimga tushib, sahifaga xabar beradi
 */
export interface ShortsPlayerHandle {
  seek(ms: number): void
  play(): void
  pause(): void
  /** Joriy ijro vaqti (ms). Player tayyor emas bo'lsa 0. */
  currentTimeMs(): number
}

interface Props {
  youtubeId: string
  /** Bu slot hozir ekranda faolmi. Faqat faol slot ijro etadi va ovoz chiqaradi. */
  active: boolean
  /** Sahifa darajasidagi ovoz holati. */
  muted: boolean
  /** Brauzer ovozli avtoplayni bloklasa chaqiriladi (sahifa muted rejimga o'tadi). */
  onAutoplayBlocked?: () => void
  /** YouTube player video yuklab bo'lmaganda xato beradi (2 — invalid id,
   *  5 — HTML5 xato, 100 — video mavjud emas / private, 101/150 — embed
   *  bloklangan). Bu holatda videoni "o'lik" deb belgilash kerak. */
  onError?: (code: number) => void
}

const ShortsPlayer = forwardRef<ShortsPlayerHandle, Props>(function ShortsPlayer(
  { youtubeId, active, muted, onAutoplayBlocked, onError }, ref,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null)
  const readyRef = useRef(false)
  const activeRef = useRef(active)
  const mutedRef = useRef(muted)
  const blockedCbRef = useRef(onAutoplayBlocked)
  const errorCbRef = useRef(onError)
  const pendingSeekRef = useRef<number | null>(null)
  const blockTimerRef = useRef<number | null>(null)
  const [holderId] = useState(() => `yt-short-${Math.random().toString(36).slice(2)}`)

  blockedCbRef.current = onAutoplayBlocked
  errorCbRef.current = onError

  const isUsable = useCallback(() => {
    const p = playerRef.current
    return !!p && readyRef.current && typeof p.playVideo === 'function'
  }, [])

  /** Joriy `active`/`muted` holatini playerga qo'llash. Player tayyor
   *  bo'lmasa hech narsa qilmaydi — `onReady` da qayta chaqiriladi. */
  const applyState = useCallback(() => {
    if (!isUsable()) return
    const p = playerRef.current
    if (blockTimerRef.current) {
      window.clearTimeout(blockTimerRef.current)
      blockTimerRef.current = null
    }
    try {
      if (!activeRef.current) {
        // Preload slot: JIM va TO'XTATILGAN. Ovoz oqishining oldi olinadi.
        p.mute()
        p.pauseVideo()
        return
      }
      if (mutedRef.current) p.mute()
      else p.unMute()
      p.playVideo()
      if (!mutedRef.current) {
        // Brauzer ovozli avtoplayni bloklagan bo'lishi mumkin — 900 ms dan
        // keyin tekshiramiz. PLAYING(1) yoki BUFFERING(3) bo'lmasa — muted
        // rejimga tushamiz va sahifaga "ovozni yoqing" tugmasi chiqadi.
        blockTimerRef.current = window.setTimeout(() => {
          blockTimerRef.current = null
          if (!isUsable() || !activeRef.current) return
          try {
            const st = playerRef.current.getPlayerState?.()
            if (st !== 1 && st !== 3) {
              playerRef.current.mute()
              playerRef.current.playVideo()
              blockedCbRef.current?.()
            }
          } catch { /* noop */ }
        }, 900)
      }
    } catch { /* noop */ }
  }, [isUsable])

  useImperativeHandle(ref, () => ({
    seek: (ms) => {
      if (!isUsable()) { pendingSeekRef.current = ms; return }
      try { playerRef.current.seekTo(Math.max(0, ms) / 1000, true) } catch { /* noop */ }
    },
    play: () => {
      if (!isUsable()) return
      try { playerRef.current.playVideo() } catch { /* noop */ }
    },
    pause: () => {
      if (!isUsable()) return
      try { playerRef.current.pauseVideo() } catch { /* noop */ }
    },
    currentTimeMs: () => {
      if (!isUsable()) return 0
      try { return (playerRef.current.getCurrentTime?.() ?? 0) * 1000 } catch { return 0 }
    },
  }), [isUsable])

  // Player yaratish — mount'da BIR MARTA (slot `key={short.id}` bilan
  // bog'langani sabab `youtubeId` hech qachon o'zgarmaydi).
  useEffect(() => {
    let disposed = false
    readyRef.current = false

    loadYouTubeApi().then((YT) => {
      if (disposed || !document.getElementById(holderId)) return
      playerRef.current = new YT.Player(holderId, {
        videoId: youtubeId,
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,          // HECH QACHON o'zi boshlamaydi — biz boshqaramiz
          mute: 1,              // har doim jim yaratiladi (ovoz oqmasin)
          rel: 0,
          modestbranding: 1,
          controls: 1,
          playsinline: 1,
          cc_load_policy: 0,
          cc_lang_pref: 'xx',
          hl: 'xx',
          iv_load_policy: 3,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (disposed) {
              try { playerRef.current?.destroy?.() } catch { /* noop */ }
              playerRef.current = null
              return
            }
            readyRef.current = true
            killCaptions(playerRef.current)
            const pending = pendingSeekRef.current
            if (pending != null) {
              pendingSeekRef.current = null
              try { playerRef.current.seekTo(Math.max(0, pending) / 1000, true) } catch { /* noop */ }
            }
            applyState()
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onStateChange: (e: any) => {
            if (e.data === 1) {
              killCaptions(playerRef.current)
              // Faol bo'lmagan slot qandaydir yo'l bilan ijroga o'tsa —
              // darrov to'xtatamiz (ovoz oqishiga qarshi oxirgi to'siq).
              if (!activeRef.current) {
                try { playerRef.current.mute(); playerRef.current.pauseVideo() } catch { /* noop */ }
              }
            } else if (e.data === 0 && activeRef.current) {
              // ENDED → YouTube Shorts kabi boshidan takrorlaymiz.
              try {
                playerRef.current.seekTo(0, true)
                playerRef.current.playVideo()
              } catch { /* noop */ }
            }
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onError: (e: any) => {
            // YT xato kodlari:
            //   2   — noto'g'ri video id
            //   5   — HTML5 player xato
            //   100 — video mavjud emas yoki private
            //   101 / 150 — embed bloklangan (huquqlar, geografik cheklov)
            const code = Number(e?.data ?? 0)
            errorCbRef.current?.(code)
          },
        },
      })
    })

    return () => {
      disposed = true
      readyRef.current = false
      if (blockTimerRef.current) {
        window.clearTimeout(blockTimerRef.current)
        blockTimerRef.current = null
      }
      const p = playerRef.current
      playerRef.current = null
      try { p?.stopVideo?.() } catch { /* noop */ }
      try { p?.destroy?.() } catch { /* noop */ }
    }
  }, [youtubeId, holderId, applyState])

  // active / muted o'zgarsa — holatni qo'llaymiz.
  useEffect(() => {
    activeRef.current = active
    mutedRef.current = muted
    applyState()
  }, [active, muted, applyState])

  // Tab yashirilsa ijroni to'xtatamiz (fon'da ovoz qolib ketmasin).
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        try { playerRef.current?.pauseVideo?.() } catch { /* noop */ }
      } else {
        applyState()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [applyState])

  // Muhim: YT.Player berilgan elementni IFRAME bilan ALMASHTIRADI — shu bois
  // klass to'g'ridan-to'g'ri holder'ga berilmaydi, o'ram (wrapper) orqali
  // CSS yoziladi (`.shorts-player iframe`).
  return (
    <div className="shorts-player">
      <div id={holderId} />
    </div>
  )
})

export default ShortsPlayer
