import { useEffect, useRef } from 'react'

/**
 * Cloudflare Turnstile — rasm ham, topshiriq ham yo'q: ko'pincha o'zi tekshirib
 * o'tkazadi, kerak bo'lsa bitta katak bosiladi. Qo'shimcha npm paket YO'Q.
 *
 * `sitekey` serverdan keladi (`/api/config/` → `captcha_sitekey`):
 * - `undefined` — hali yuklanmoqda: token BERILMAYDI, aks holda kod captchasiz
 *   yuborilib server 400 qaytarardi;
 * - `''` — captcha o'chiq: `onToken('disabled')`, login to'silmaydi.
 *
 * `resetKey` o'zgarsa widget tozalanadi (token bir martalik — xato koddan
 * keyin qayta tekshirish kerak).
 */
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
    }
    __onTurnstileLoad?: () => void
  }
}

let loader: Promise<void> | null = null

function loadTurnstile(): Promise<void> {
  if (loader) return loader
  loader = new Promise((resolve, reject) => {
    window.__onTurnstileLoad = () => resolve()
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__onTurnstileLoad'
    s.async = true
    s.defer = true
    s.onerror = () => { loader = null; s.remove(); reject(new Error('Turnstile')) }
    document.head.appendChild(s)
  })
  return loader
}

export default function TurnstileBox({
  sitekey,
  lang,
  theme,
  resetKey,
  onToken,
}: {
  sitekey: string | undefined
  lang: string
  theme: 'light' | 'dark'
  resetKey: number
  onToken: (token: string) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    if (sitekey === undefined) return
    if (!sitekey) {
      onToken('disabled')
      return
    }
    let cancelled = false
    loadTurnstile().then(() => {
      const el = boxRef.current
      if (cancelled || !el || widgetId.current !== null || !window.turnstile) return
      widgetId.current = window.turnstile.render(el, {
        sitekey,
        theme,
        // O'zbek tili Turnstile'da yo'q — brauzer tili (yoki inglizcha).
        language: lang === 'en' ? 'en' : 'auto',
        // 300 px dan tor joyda (kichik telefon) ixcham ko'rinish.
        size: el.clientWidth < 300 ? 'compact' : 'normal',
        callback: (t: string) => onToken(t),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      })
    }).catch(() => { /* Cloudflare ochilmadi — kod baribir server tomonda rad etiladi */ })
    return () => { cancelled = true }
    // Til va mavzu widget yaratilganda bir marta olinadi; onToken — setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitekey])

  useEffect(() => {
    if (resetKey && widgetId.current !== null) {
      window.turnstile?.reset(widgetId.current)
      onToken('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  if (!sitekey) return null
  return <div ref={boxRef} style={{ display: 'flex', justifyContent: 'center', minHeight: 65 }} />
}
