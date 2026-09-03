import { useEffect, useRef } from 'react'

/**
 * hCaptcha widget — "mashina / svetafor / velosiped topish" uslubidagi rasm
 * jumboq. Qo'shimcha npm paket YO'Q: hCaptcha skriptini o'zi yuklaydi va
 * `explicit` rejimda render qiladi.
 *
 * `sitekey` bo'sh bo'lsa (VITE_HCAPTCHA_SITEKEY berilmagan) — hech narsa
 * ko'rsatilmaydi va `onToken('disabled')` chaqiriladi (captcha o'chiq, login
 * to'silmaydi). Prod'da sitekey berilsa — widget chiqadi.
 */
declare global {
  interface Window {
    hcaptcha?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
    }
  }
}

export default function HCaptchaBox({
  sitekey,
  onToken,
}: {
  sitekey: string
  onToken: (token: string) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    if (!sitekey) {
      onToken('disabled') // captcha o'chiq — login bloklanmaydi
      return
    }
    let cancelled = false

    // Skriptni bir marta yuklaymiz (explicit render).
    if (!document.getElementById('hcaptcha-script')) {
      const s = document.createElement('script')
      s.id = 'hcaptcha-script'
      s.src = 'https://js.hcaptcha.com/1/api.js?render=explicit'
      s.async = true
      s.defer = true
      document.head.appendChild(s)
    }

    const render = () => {
      if (cancelled || !boxRef.current || widgetId.current !== null) return
      if (!window.hcaptcha) {
        window.setTimeout(render, 300) // skript hali yuklanmagan
        return
      }
      widgetId.current = window.hcaptcha.render(boxRef.current, {
        sitekey,
        callback: (t: string) => onToken(t),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      })
    }
    render()

    return () => { cancelled = true }
    // sitekey o'zgarmaydi (build-time) — bir marta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitekey])

  if (!sitekey) return null
  return <div ref={boxRef} style={{ display: 'flex', justifyContent: 'center', minHeight: 78 }} />
}
