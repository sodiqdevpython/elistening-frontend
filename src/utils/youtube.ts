/**
 * YouTube IFrame API — YAGONA global loader.
 *
 * Ilgari `YouTubePlayer.tsx` va `ShortsPlayer.tsx` ikkalasi ham o'z loaderiga
 * ega edi va ikkalasi ham `window.onYouTubeIframeAPIReady` ni qayta yozardi.
 * Natijada: avval diktant sahifasi ochilib API yuklangan bo'lsa, Shorts
 * sahifasidagi loader ikkinchi <script> qo'shar, lekin callback ikkinchi
 * marta chaqirilmagani sabab promise HECH QACHON resolve bo'lmasdi —
 * Shorts'da qora ekran qolib ketardi.
 *
 * Bu modul: bitta script, bitta promise, ustiga poll bilan himoya.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YTNamespace = any

const SCRIPT_ID = 'youtube-iframe-api'
let ytPromise: Promise<YTNamespace> | null = null

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (ytPromise) return ytPromise
  ytPromise = new Promise<YTNamespace>((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    if (w.YT?.Player) { resolve(w.YT); return }

    // Boshqa kod allaqachon callback qo'ygan bo'lsa uni ham chaqiramiz.
    const prev = typeof w.onYouTubeIframeAPIReady === 'function'
      ? w.onYouTubeIframeAPIReady
      : null
    w.onYouTubeIframeAPIReady = () => {
      try { prev?.() } catch { /* noop */ }
      resolve(w.YT)
    }

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      document.head.appendChild(script)
    }

    // Himoya: script allaqachon yuklangan va callback o'tib ketgan bo'lsa
    // ham YT.Player paydo bo'lishini kutamiz.
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      if (w.YT?.Player) {
        window.clearInterval(timer)
        resolve(w.YT)
      } else if (Date.now() - startedAt > 20_000) {
        window.clearInterval(timer)
      }
    }, 120)
  })
  return ytPromise
}

/** YouTube captions/CC modulini o'chirish — bir necha usul birga, chunki
 *  ba'zi videolarda avto-caption qayta paydo bo'ladi. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function killCaptions(p: any): void {
  if (!p) return
  try { p.unloadModule?.('captions') } catch { /* noop */ }
  try { p.unloadModule?.('cc') } catch { /* noop */ }
  try { p.setOption?.('captions', 'track', {}) } catch { /* noop */ }
  try { p.setOption?.('cc', 'track', {}) } catch { /* noop */ }
  try { p.setOption?.('captions', 'reload', true) } catch { /* noop */ }
}

/** Shorts uchun poster: `oardefault` — original 9:16 nisbat. Yo'q bo'lsa
 *  `hqdefault` (4:3, kesiladi). */
export function shortPoster(youtubeId: string, hq = false): string {
  return hq
    ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
    : `https://i.ytimg.com/vi/${youtubeId}/oardefault.jpg`
}
