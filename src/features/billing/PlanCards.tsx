import { CheckIcon } from '@/components/ui'
import { useLang, useT } from '@/i18n'

/**
 * Tarif (status) kartalari — **STATIC**, `/profile/billing` va profil
 * sahifasidagi "Tarifni tanlang" bo'limida AYNAN bir xil ko'rinadi. Narx va
 * features kodda; status nomlari (Qaldirg'och/Jo'shqin/Bo'talog'im) tarjimasiz.
 */
export type StaticPlan = {
  code: 'free' | 'plus' | 'pro'
  status: string
  taglineUz: string; taglineEn: string
  priceUz: string; priceEn: string
  featuresUz: string[]; featuresEn: string[]
  highlight?: boolean
}

export const STATUS_PLANS: StaticPlan[] = [
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

export function PlanCards({ currentCode, onChoose, busy }: {
  currentCode: string
  onChoose: (code: string) => void
  busy?: boolean
}) {
  const t = useT()
  const { lang } = useLang()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
      {STATUS_PLANS.map((plan) => {
        const active = plan.code === currentCode
        const tagline = lang === 'en' ? plan.taglineEn : plan.taglineUz
        const price = lang === 'en' ? plan.priceEn : plan.priceUz
        const features = lang === 'en' ? plan.featuresEn : plan.featuresUz
        const paid = plan.code !== 'free'
        return (
          <div
            key={plan.code}
            className="card"
            style={{
              padding: 22, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative',
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
              {active && (
                <span style={{
                  background: 'linear-gradient(135deg,#10B981 0%,#059669 100%)', color: '#fff',
                  fontSize: 10, fontWeight: 800, letterSpacing: '.03em', padding: '3px 10px', borderRadius: 8,
                }}>{t.currentPlanBadge}</span>
              )}
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
                {t.currentPlanBtn}
              </button>
            ) : plan.code === 'free' ? (
              <div style={{ marginTop: 'auto', height: 44 }} />
            ) : (
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() => onChoose(plan.code)}
                style={{ marginTop: 'auto', padding: '11px 18px' }}
              >
                {t.selectPlanBtn}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
