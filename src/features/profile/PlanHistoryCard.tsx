import { useQuery } from '@tanstack/react-query'
import { fetchSubscriptionHistory } from '@/api/endpoints'
import { Badge, Spinner } from '@/components/ui'
import { useLang, useT } from '@/i18n'
import { fill } from '@/utils/format'

/**
 * "Tarif tarixi" kartasi — **faqat saytda** (mobil ilovada kerak emas).
 *
 * Manba: `GET /api/me/subscriptions/` → `SubscriptionEvent` jadvali. U
 * o'zgarmas (append-only) yozuvlar: tarif har safar berilganda/uzaytirilganda
 * bitta qator qo'shiladi. Shu bois "qachon oldim, qanday yo'l bilan, qachon
 * tugaydi" savoliga aniq javob bo'ladi.
 *
 * Har yozuv paytida foydalanuvchiga Telegram orqali ham xabar ketgan bo'ladi
 * (`backend/apps/billing/signals.py`) — bu karta o'sha xabarlarning tarixi.
 */
export default function PlanHistoryCard() {
  const t = useT()
  const { lang } = useLang()

  const history = useQuery({ queryKey: ['subscription-history'], queryFn: fetchSubscriptionHistory })
  const rows = history.data?.results ?? []

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{t.historyTitle}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.historyDesc}</div>
      </div>

      {history.isLoading && <Spinner />}
      {!history.isLoading && rows.length === 0 && (
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{t.historyEmpty}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((row) => {
          const name = lang === 'en' ? row.plan_name_en : row.plan_name_uz
          return (
            <div
              key={row.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px',
              }}
            >
              <span aria-hidden style={{ fontSize: 18 }}>{reasonIcon(row.reason)}</span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {name}
                  {row.months > 0 && <Badge>{fill(t.historyMonths, { n: row.months })}</Badge>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                  {row.reason_label} · {formatDate(row.started_at)} →{' '}
                  {row.expires_at ? `${formatDate(row.expires_at)} ${t.historyUntil}` : t.historyForever}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Sabab belgisi — matnni takrorlamaydi, faqat ko'zga tez tashlanadi. */
function reasonIcon(reason: string): string {
  if (reason === 'invite') return '🎁'
  if (reason === 'paid') return '💳'
  if (reason === 'test') return '🧪'
  return '⚙️'
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}
