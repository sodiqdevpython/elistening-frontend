import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchMyLimits } from '@/api/endpoints'
import type { LimitBucket } from '@/api/types'
import { Badge, Spinner } from '@/components/ui'
import { useLang, useT } from '@/i18n'

/**
 * "Bugungi limit" kartasi — profil sahifasida.
 *
 * Mobil ilovada bu allaqachon bor edi, saytda esa yo'q edi: foydalanuvchi
 * o'z limitini faqat unga YETGANDA (403 modal) ko'rardi. Endi profilda ham
 * turadi — qancha qolgani oldindan ko'rinadi.
 *
 * Manba `GET /api/me/limits/` (`apps/billing/limits.py::snapshot`):
 * `limit: null` — cheksiz, `0` — umuman mumkin emas, N — kuniga N ta.
 */
export default function LimitsCard() {
  const t = useT()
  const { lang } = useLang()
  const limits = useQuery({ queryKey: ['my-limits'], queryFn: fetchMyLimits })

  const data = limits.data
  const rows: [string, LimitBucket | undefined][] = [
    [t.billingKindShorts, data?.limits.shorts],
    [t.billingKindVideo, data?.limits.video],
    [t.billingKindDictation, data?.limits.dictation],
  ]

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{t.limitsLabel}</span>
          {!!data && <Badge>{lang === 'en' ? data.plan_name_en : data.plan_name_uz}</Badge>}
        </div>
        <Link to="/profile/billing" className="btn btn-ghost"
          style={{ padding: '8px 14px', fontSize: 13, borderRadius: 10, textDecoration: 'none' }}>
          {t.billingTitle}
        </Link>
      </div>

      {limits.isLoading && <Spinner />}

      {!!data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map(([label, bucket]) => {
            if (!bucket) return null
            const unlimited = bucket.limit == null
            const cap = bucket.limit ?? 0
            const pct = cap <= 0 ? 0 : Math.min(100, Math.round((bucket.used / cap) * 100))
            const atLimit = !unlimited && bucket.remaining === 0
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 92 }}>{label}</span>
                <div style={{
                  flex: 1, height: 8, borderRadius: 999,
                  background: 'var(--bg-secondary)', overflow: 'hidden',
                }}>
                  {!unlimited && (
                    <div style={{
                      width: `${pct}%`, height: '100%', borderRadius: 999,
                      background: atLimit ? '#EF4444' : '#10B981',
                    }} />
                  )}
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 700, minWidth: 64, textAlign: 'right',
                  color: atLimit ? '#EF4444' : 'var(--text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {unlimited ? t.billingUnlimited : `${bucket.used}/${bucket.limit}`}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
