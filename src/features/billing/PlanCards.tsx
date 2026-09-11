import { CheckIcon } from '@/components/ui'
import { useLang, useT } from '@/i18n'

/**
 * Tarif (status) kartalari — **STATIC**, `/profile/billing` va profil
 * sahifasidagi "Tarifni tanlang" bo'limida AYNAN bir xil ko'rinadi. Narx va
 * features kodda; status nomlari (Oddiy/O'rta/Yuqori) tarjimasiz.
 */
export type StaticPlan = {
  code: 'free' | 'plus' | 'pro'
  status: string
  taglineUz: string; taglineEn: string
  priceUz: string; priceEn: string
  /** Raqamli narx — ko'tarilish farqini hisoblash uchun (matndan ajratib
   *  olish mo'rt bo'lardi: "23 000 so'm" formati o'zgarishi mumkin). */
  priceUzs: number
  featuresUz: string[]; featuresEn: string[]
  highlight?: boolean
}

export const STATUS_PLANS: StaticPlan[] = [
  {
    code: 'free',
    status: 'Oddiy',
    taglineUz: 'Bepul — sinab ko‘rish uchun', taglineEn: 'Free — to get started',
    priceUz: 'Bepul', priceEn: 'Free', priceUzs: 0,
    featuresUz: ['Kuniga 8 ta Shorts', 'Kuniga 2 ta video', 'Kuniga 2 ta diktant', 'Reklama bilan'],
    featuresEn: ['8 Shorts per day', '2 videos per day', '2 dictations per day', 'Ads included'],
  },
  {
    code: 'plus',
    status: 'O‘rta',
    taglineUz: 'Faol o‘rganuvchilar uchun', taglineEn: 'For active learners',
    priceUz: '23 000 so‘m', priceEn: '23,000 UZS', priceUzs: 23000,
    featuresUz: ['Kuniga 30 ta Shorts', 'Kuniga 10 ta video', 'Cheksiz diktant', 'Kuniga 2 ta IELTS test', 'Reklamasiz'],
    featuresEn: ['30 Shorts per day', '10 videos per day', 'Unlimited dictation', '2 IELTS tests per day', 'No ads'],
    highlight: true,
  },
  {
    code: 'pro',
    status: 'Yuqori',
    taglineUz: 'Cheksiz — hammasi ochiq', taglineEn: 'Unlimited — everything unlocked',
    priceUz: '32 000 so‘m', priceEn: '32,000 UZS', priceUzs: 32000,
    featuresUz: ['Cheksiz Shorts', 'Cheksiz video', 'Cheksiz diktant', 'Cheksiz IELTS test', 'Reklamasiz'],
    featuresEn: ['Unlimited Shorts', 'Unlimited videos', 'Unlimited dictation', 'Unlimited IELTS tests', 'No ads'],
  },
]

export function PlanCards({ currentCode, selectedCode, onChoose, busy }: {
  currentCode: string
  /** To'lov oqimida TANLANGAN tarif (joriy tarifdan farqli). */
  selectedCode?: string
  onChoose: (code: string) => void
  busy?: boolean
}) {
  const t = useT()
  const { lang } = useLang()

  // Joriy tarif darajasi. Ro'yxat allaqachon pastdan yuqoriga tartiblangan,
  // shu bois indeks = daraja.
  const currentIndex = STATUS_PLANS.findIndex((p) => p.code === currentCode)
  const current = currentIndex >= 0 ? STATUS_PLANS[currentIndex] : null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
      {STATUS_PLANS.map((plan, index) => {
        const active = plan.code === currentCode
        const picked = plan.code === selectedCode
        // Pastroq tarif TANLANMAYDI: server ham rad etadi (`grant_plan`
        // hech qachon pastga tushirmaydi), lekin foydalanuvchi buni tugmani
        // bosgandan keyin emas, KO'RIB bilishi kerak.
        const lower = index < currentIndex
        // Ko'tarilishda faqat FARQ to'lanadi (`billing/pricing.py`).
        const upgrade = !active && !lower && current && current.priceUzs > 0
          ? plan.priceUzs - current.priceUzs
          : 0
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
              border: `1.5px solid ${
                picked ? '#059669' : active ? '#10B981'
                  : plan.highlight ? '#2563EB' : 'var(--border)'}`,
              boxShadow: picked ? '0 6px 20px rgba(5,150,105,.22)' : undefined,
              opacity: lower ? .55 : 1,
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

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 900 }}>{price}</span>
                {paid && (
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    / {lang === 'en' ? 'mo' : 'oy'}
                  </span>
                )}
              </div>
              {upgrade > 0 && (
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#059669', marginTop: 3 }}>
                  {t.planUpgradePrice.replace('{amount}', money(upgrade, lang))}
                </div>
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
            ) : lower ? (
              <div style={{
                marginTop: 'auto', padding: '11px 18px', textAlign: 'center',
                fontSize: 12.5, fontWeight: 700, lineHeight: 1.35,
                color: 'var(--text-secondary)', background: 'var(--bg-secondary)',
                border: '1px dashed var(--border)', borderRadius: 10,
              }}>
                {t.planLowerBlocked}
              </div>
            ) : plan.code === 'free' ? (
              <div style={{ marginTop: 'auto', height: 44 }} />
            ) : (
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() => onChoose(plan.code)}
                style={{ marginTop: 'auto', padding: '11px 18px' }}
              >
                {picked ? `✓ ${t.planPicked}` : t.selectPlanBtn}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function money(uzs: number, lang: string) {
  const value = uzs.toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU').replace(/ /g, ' ')
  return lang === 'en' ? `${value} UZS` : `${value} so'm`
}
