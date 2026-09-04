import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMyLimits, subscribe } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { Badge, CheckIcon, SectionTitle, Spinner } from '@/components/ui'
import { useAuth } from '@/store/auth'
import { useLang, useT } from '@/i18n'

/**
 * Tarif tanlash sahifasi — **`/profile/billing`**.
 *
 * **Tariflar STATIC** — kodda qat'iy yozilgan (API'dan OLINMAYDI). Uch tarif:
 * Free, Plus (23 000 so'm/oy), Pro (32 000 so'm/oy). Har tarif nimalar
 * qilishini shu yerda ko'rsatamiz. (Bugungi sarf esa foydalanuvchiga bog'liq,
 * u dinamik — `GET /me/limits/`.)
 *
 * Mobil ilovada tashqi to'lov havolasi bo'lmaydi (App/Play Store qoidasi);
 * bu sahifa faqat saytda, bot limitga yetilganda shu yerga yo'naltiradi.
 */
// Status nomlari — TARJIMA QILINMAYDI (uz va en da bir xil). Ular tarif
// "statusi" sifatida ko'rinadi. Tagline (izoh) esa tilga qarab, tushunarli
// bo'lishi uchun (web'da aniqroq).
type StaticPlan = {
  code: 'free' | 'plus' | 'pro'
  status: string            // Qaldirg'och / Jo'shqin / Bo'talog'im (tarjimasiz)
  taglineUz: string; taglineEn: string
  priceUz: string; priceEn: string
  featuresUz: string[]; featuresEn: string[]
  highlight?: boolean
}

const PLANS: StaticPlan[] = [
  {
    code: 'free',
    status: 'Qaldirg‘och',
    taglineUz: 'Bepul — sinab ko‘rish uchun', taglineEn: 'Free — to get started',
    priceUz: 'Bepul', priceEn: 'Free',
    featuresUz: ['Kuniga 8 ta Shorts', 'Kuniga 2 ta video', 'Kuniga 2 ta diktant', 'Reklama bilan'],
    featuresEn: ['8 Shorts per day', '2 videos per day', '2 dictations per day', 'Ads included'],
  },
  {
    code: 'plus',
    status: 'Jo‘shqin',
    taglineUz: 'Faol o‘rganuvchilar uchun', taglineEn: 'For active learners',
    priceUz: '23 000 so‘m', priceEn: '23,000 UZS',
    featuresUz: ['Kuniga 30 ta Shorts', 'Kuniga 10 ta video', 'Cheksiz diktant', 'Kuniga 2 ta IELTS test', 'Reklamasiz'],
    featuresEn: ['30 Shorts per day', '10 videos per day', 'Unlimited dictation', '2 IELTS tests per day', 'No ads'],
    highlight: true,
  },
  {
    code: 'pro',
    status: 'Bo‘talog‘im',
    taglineUz: 'Cheksiz — hammasi ochiq', taglineEn: 'Unlimited — everything unlocked',
    priceUz: '32 000 so‘m', priceEn: '32,000 UZS',
    featuresUz: ['Cheksiz Shorts', 'Cheksiz video', 'Cheksiz diktant', 'Cheksiz IELTS test', 'Reklamasiz'],
    featuresEn: ['Unlimited Shorts', 'Unlimited videos', 'Unlimited dictation', 'Unlimited IELTS tests', 'No ads'],
  },
]

export default function BillingPage() {
  const t = useT()
  const { lang } = useLang()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, isLoggedIn, loading } = useAuth()
  const [message, setMessage] = useState('')

  const limits = useQuery({ queryKey: ['my-limits'], queryFn: fetchMyLimits, enabled: isLoggedIn })

  const choose = useMutation({
    mutationFn: (code: string) => subscribe(code),
    onSuccess: () => {
      setMessage('')
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['my-limits'] })
    },
    onError: (err) => setMessage(errorMessage(err, t.paymentsSoon)),
  })

  if (loading) return <Spinner />

  if (!isLoggedIn) {
    return (
      <div className="page" style={{ maxWidth: 640 }}>
        <SectionTitle>{t.billingTitle}</SectionTitle>
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ marginBottom: 16 }}>{t.billingLoginFirst}</p>
          <button className="btn btn-primary" onClick={() => navigate('/auth')}>{t.loginCta}</button>
        </div>
      </div>
    )
  }

  const current = user?.plan || 'free'
  const buckets = limits.data?.limits

  return (
    <div className="page" style={{ maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionTitle sub={t.billingSubtitle}>{t.billingTitle}</SectionTitle>

      {/* Bugungi holat — nima qolganini darrov ko'rsatadi (foydalanuvchiga bog'liq) */}
      {buckets && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>{t.billingTodayUsage}</span>
            <Badge>{lang === 'en' ? limits.data?.plan_name_en : limits.data?.plan_name_uz}</Badge>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
            {([
              ['shorts', t.billingKindShorts],
              ['video', t.billingKindVideo],
              ['dictation', t.billingKindDictation],
            ] as const).map(([key, label]) => {
              const b = buckets[key]
              return (
                <div key={key} style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                    {b.limit == null ? t.billingUnlimited : `${b.used} / ${b.limit}`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tariflar — STATIC */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
        {PLANS.map((plan) => {
          const active = plan.code === current
          const tagline = lang === 'en' ? plan.taglineEn : plan.taglineUz
          const price = lang === 'en' ? plan.priceEn : plan.priceUz
          const features = lang === 'en' ? plan.featuresEn : plan.featuresUz
          const paid = plan.code !== 'free'
          return (
            <div
              key={plan.code}
              className="card"
              style={{
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                position: 'relative',
                border: `1.5px solid ${active ? '#10B981' : plan.highlight ? '#2563EB' : 'var(--border)'}`,
              }}
            >
              {plan.highlight && !active && (
                <div style={{
                  position: 'absolute', top: -11, left: 18,
                  background: '#2563EB', color: '#fff', borderRadius: 999,
                  padding: '2px 10px', fontSize: 11, fontWeight: 800, letterSpacing: 0.3,
                }}>{lang === 'en' ? 'POPULAR' : 'OMMABOP'}</div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  {/* Status nomi — tarjimasiz, "status" ko'rinishida */}
                  <span style={{
                    display: 'inline-block', fontSize: 15, fontWeight: 900,
                    background: 'linear-gradient(135deg,#2563EB,#7C3AED)',
                    WebkitBackgroundClip: 'text', backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent', letterSpacing: 0.2,
                  }}>{plan.status}</span>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600, marginTop: 2 }}>
                    {tagline}
                  </div>
                </div>
                {active && <Badge>{t.billingCurrent}</Badge>}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 900 }}>{price}</span>
                {paid && (
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    / {lang === 'en' ? 'mo' : 'oy'}
                  </span>
                )}
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13.5 }}>
                    <CheckIcon />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {active ? (
                <button className="btn btn-ghost" disabled style={{ marginTop: 'auto', padding: '11px 18px' }}>
                  {t.billingCurrent}
                </button>
              ) : plan.code === 'free' ? (
                <div style={{ marginTop: 'auto', height: 44 }} />
              ) : (
                <button
                  className="btn btn-primary"
                  disabled={choose.isPending}
                  onClick={() => choose.mutate(plan.code)}
                  style={{ marginTop: 'auto', padding: '11px 18px' }}
                >
                  {t.billingChoose}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {!!message && (
        <div className="card" style={{ padding: 16, borderColor: '#F59E0B', fontSize: 14, fontWeight: 600 }}>
          {message}
        </div>
      )}
    </div>
  )
}
