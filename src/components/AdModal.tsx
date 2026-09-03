import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAppAd } from '@/api/endpoints'
import { useT } from '@/i18n'

/**
 * Sayt ochilganda chiqadigan reklama (backend `AppAd`).
 *
 * Mobil ilovadagi `mobile/src/components/AdModal.tsx` bilan **bir xil
 * model va bir xil uslub**: rasm/gif + sarlavha + matn (havolalar bosiladi)
 * + CTA tugmasi + X (avto-yopilish hisoblagichi bilan).
 *
 * Yagona farq — RASM: server ikkita beradi (`image_web_url` sayt uchun keng,
 * `image_url` mobil uchun tik). Sayt rasmi bo'sh bo'lsa server o'zi mobil
 * rasmga qaytaradi, ya'ni admin bitta rasm bersa ham ishlaydi.
 *
 * Har cold-start'da bir marta: `sessionStorage` bilan belgilanadi, shu bois
 * sahifadan sahifaga o'tganda qayta chiqmaydi.
 */
const SEEN_KEY = 'listening.ad.seen'

const URL_RE = /(https?:\/\/[^\s]+)/g

/** Matn ichidagi havolalarni bosiladigan qiladi. */
function LinkedText({ text }: { text: string }) {
  return (
    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
      {text.split(URL_RE).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            style={{ color: '#10B981', fontWeight: 700 }}>{part}</a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  )
}

export default function AdModal() {
  const t = useT()
  const [closed, setClosed] = useState(() => {
    try { return sessionStorage.getItem(SEEN_KEY) === '1' } catch { return false }
  })

  const { data: ad } = useQuery({
    queryKey: ['app-ad'],
    queryFn: fetchAppAd,
    enabled: !closed,
    staleTime: 5 * 60_000,
  })

  const [remaining, setRemaining] = useState(0)
  useEffect(() => { if (ad?.duration_sec) setRemaining(ad.duration_sec) }, [ad?.duration_sec])

  const close = () => {
    setClosed(true)
    try { sessionStorage.setItem(SEEN_KEY, '1') } catch { /* private rejim */ }
  }

  // Avto-yopilish sanog'i (`duration_sec > 0` bo'lsa).
  useEffect(() => {
    if (!ad?.duration_sec || closed) return
    if (remaining <= 0) { close(); return }
    const id = window.setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, ad?.duration_sec, closed])

  // `Esc` bilan yopish
  useEffect(() => {
    if (closed || !ad) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closed, ad])

  if (closed || !ad) return null

  const image = ad.image_web_url || ad.image_url
  const openLink = () => { if (ad.link_url) window.open(ad.link_url, '_blank', 'noopener') }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ad.title || t.adCta}
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 720,
          background: 'var(--bg-secondary)', borderRadius: 18, overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,.35)',
        }}
      >
        <button
          onClick={close}
          aria-label={t.close}
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 2,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            height: 34, padding: '0 12px', border: 'none', cursor: 'pointer',
            background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: 999,
            fontSize: 13, fontWeight: 800,
          }}
        >
          ✕{remaining > 0 && <span>{remaining}</span>}
        </button>

        {!!image && (
          <img
            src={image}
            alt=""
            onClick={openLink}
            style={{
              display: 'block', width: '100%', maxHeight: 420,
              objectFit: 'contain', background: '#000',
              cursor: ad.link_url ? 'pointer' : 'default',
            }}
          />
        )}

        {(!!ad.title || !!ad.body || !!ad.link_url) && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 260, overflowY: 'auto' }}>
            {!!ad.title && (
              <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.35 }}>{ad.title}</div>
            )}
            {!!ad.body && <LinkedText text={ad.body} />}
            {!!ad.link_url && (
              <button className="btn btn-primary" onClick={openLink}
                style={{ alignSelf: 'flex-start', padding: '11px 22px', fontSize: 14.5 }}>
                {t.adCta}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
