import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { setLimitHandler, type LimitPayload } from '@/api/client'
import { useLang } from '@/i18n'
import { fill } from '@/utils/format'

/**
 * Kunlik limit oynasi — ILOVA DARAJASIDA bir marta mount qilinadi (Layout).
 *
 * `client.ts` interceptor'i HAR `limit_reached` 403 da `setLimitHandler` orqali
 * bu modalni ochadi. Shu bois qaysi endpoint bo'lishidan qat'i nazar (shorts
 * view, dictation view, ...) limitga yetilsa foydalanuvchi bir xil oynani
 * ko'radi. Web'da — mobil ilovadan farqli — tashqi to'lov cheklovi yo'q, shu
 * bois "Tariflarni ko'rish" (`/profile/billing`) havolasi ko'rsatiladi.
 *
 * Fon qorayadi, lekin ish (video) modal ortida to'xtatilmaydi — chaqiruvchi
 * (ShortsPage/DictationPage) `{limited}` javobiga qarab o'zi to'xtatadi. Bu
 * modal faqat SABABNI tushuntiradi.
 */
export default function LimitGate() {
  const { t, lang } = useLang()
  const [payload, setPayload] = useState<LimitPayload | null>(null)

  useEffect(() => {
    setLimitHandler((p) => setPayload(p))
    return () => setLimitHandler(null)
  }, [])

  useEffect(() => {
    if (!payload) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPayload(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [payload])

  if (!payload) return null

  const snap = payload.limits
  const planName = snap ? (lang === 'en' ? snap.plan_name_en : snap.plan_name_uz) : ''
  const kind = payload.error.kind
  const bucket = snap?.limits?.[kind as 'shorts' | 'video' | 'dictation' | 'ielts']
  const close = () => setPayload(null)

  return (
    <div
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,.62)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 320, padding: 16,
      }}
    >
      <div style={{
        position: 'relative',
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '30px 26px 26px', width: '100%', maxWidth: 380,
        boxShadow: '0 30px 70px rgba(0,0,0,.5)', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
      }}>
        <button
          onClick={close} aria-label={t.limitClose}
          style={{
            position: 'absolute', top: 12, right: 12,
            width: 30, height: 30, borderRadius: '50%',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            cursor: 'pointer', fontSize: 16, fontWeight: 800,
            color: 'var(--text-secondary)', lineHeight: 0,
          }}
        >×</button>

        {/* Soat ikonasi — "ertaga yangilanadi" ma'nosi */}
        <div style={{
          width: 60, height: 60, borderRadius: 18,
          background: 'linear-gradient(135deg,#F59E0B 0%,#EF4444 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 12px 26px rgba(245,158,11,.35)',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </div>

        <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.25 }}>
          {t.limitTitle}
        </div>
        <div style={{
          fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: 300,
        }}>
          {fill(t.limitBody, { plan: planName })}
        </div>

        {bucket && bucket.limit != null && (
          <div style={{
            fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 999, padding: '5px 12px',
          }}>
            {fill(t.limitUsedLine, { used: bucket.used, limit: bucket.limit })}
          </div>
        )}

        <Link
          to="/profile/billing"
          onClick={close}
          className="btn btn-primary"
          style={{
            width: '100%', textDecoration: 'none', padding: '12px 18px',
            borderRadius: 12, fontSize: 15, fontWeight: 800,
          }}
        >{t.limitUpgrade}</Link>
        <button
          onClick={close}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
            fontFamily: 'inherit', padding: '4px 8px',
          }}
        >{t.limitResets}</button>
      </div>
    </div>
  )
}
