import { useQuery } from '@tanstack/react-query'
import { fetchWalletHistory } from '@/api/endpoints'
import type { WalletHistoryRow } from '@/api/types'
import { Badge, Spinner } from '@/components/ui'
import { STATUS_PLANS } from '@/features/billing/PlanCards'
import { useLang, useT } from '@/i18n'
import { fill } from '@/utils/format'

/**
 * "To'lovlar tarixi" kartasi — qaysi kuni qancha pul tushgani (Paynet / Click)
 * va nimaga sarflangani. "Tarif tarixi" (`PlanHistoryCard`) yonida turadi.
 *
 * Manba: `GET /api/billing/wallet/history/` → `WalletTransaction` jadvali.
 * Har qator balans o'zgargan paytda AYNI qulf ostida yoziladi, shu bois
 * "Balans: …" qatori o'sha paytdagi haqiqiy qoldiq. Bo'sh bo'lsa — bu
 * jadvaldan oldingi to'lov (migratsiyada tiklangan, qoldiq noma'lum).
 */
export default function WalletHistoryCard() {
  const t = useT()
  const { lang } = useLang()

  const history = useQuery({ queryKey: ['wallet-history'], queryFn: fetchWalletHistory })
  const data = history.data
  const rows = data?.results ?? []

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{t.walletHistoryTitle}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.walletHistoryDesc}</div>
      </div>

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 16 }}>
          <Stat label={t.walletHistoryBalance} value={money(data.balance_uzs, lang)} />
          <Stat label={t.walletHistoryTotalIn} value={money(data.total_in_uzs, lang)} />
          <Stat label={t.walletHistorySpent} value={money(data.total_spent_uzs, lang)} />
        </div>
      )}

      {history.isLoading && <Spinner />}
      {!history.isLoading && rows.length === 0 && (
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{t.walletHistoryEmpty}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((row) => {
          const incoming = row.amount_uzs > 0
          return (
            <div
              key={row.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px',
              }}
            >
              <span aria-hidden style={{ fontSize: 18 }}>{kindIcon(row.kind)}</span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {rowTitle(row, t)}
                  {row.kind === 'purchase' && row.months > 0 && (
                    <Badge>{fill(t.historyMonths, { n: row.months })}</Badge>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                  {formatDateTime(row.occurred_at, lang)}
                  {row.balance_after_uzs !== null && (
                    <> · {fill(t.walletHistoryBalanceAfter, { amount: money(row.balance_after_uzs, lang) })}</>
                  )}
                </div>
              </div>
              <div style={{
                fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap',
                color: incoming ? '#059669' : 'var(--text)',
              }}>
                {incoming ? '+' : '−'}{money(Math.abs(row.amount_uzs), lang)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function rowTitle(row: WalletHistoryRow, t: ReturnType<typeof useT>): string {
  if (row.kind === 'deposit') return fill(t.walletHistoryDeposit, { provider: row.provider_label })
  if (row.kind === 'refund') return fill(t.walletHistoryRefund, { provider: row.provider_label })
  if (row.kind === 'purchase') {
    // Status nomi saytning qolgan joylari bilan bir xil yozilsin (O‘rta, Yuqori).
    const plan = STATUS_PLANS.find((p) => p.code === row.plan)?.status ?? row.plan_name ?? ''
    return fill(t.walletHistoryPurchase, { plan })
  }
  return row.note || t.walletHistoryAdjust
}

/** Tur belgisi — matnni takrorlamaydi, faqat ko'zga tez tashlanadi. */
function kindIcon(kind: WalletHistoryRow['kind']): string {
  if (kind === 'deposit') return '💰'
  if (kind === 'purchase') return '💳'
  if (kind === 'refund') return '↩️'
  return '⚙️'
}

/** Doim kun.oy.yil — brauzer en-US bo'lsa "10/11" (11-oktabr) 10-noyabr
 *  deb o'qilardi, "qaysi kuni tushdi" esa shu kartaning asosiy savoli. */
function formatDateTime(value: string, lang: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(lang === 'en' ? 'en-GB' : 'ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
}

function money(uzs: number, lang: string) {
  const value = uzs.toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU').replace(/ /g, ' ')
  return lang === 'en' ? `${value} UZS` : `${value} so'm`
}
