import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { buyFromBalance, cancelPayIntent } from '@/api/endpoints'
import type { WalletState } from '@/api/types'
import { Badge, CheckIcon, ProgressBar } from '@/components/ui'
import { useT } from '@/i18n'

/** `{id}` o'rniga React tugunini qo'yadi — HTML in'ektsiyasisiz. */
function splitOnce(text: string, token: string, node: React.ReactNode) {
  const at = text.indexOf(token)
  if (at < 0) return text
  return <>{text.slice(0, at)}{node}{text.slice(at + token.length)}</>
}

/**
 * Paynet to'lov paneli — tarif tanlangandan keyin ochiladi.
 *
 * **Nega bu yerda "To'lash" tugmasi yo'q.** Paynet redirect'li checkout emas:
 * biz foydalanuvchini hech qayerga yubora olmaymiz, u Paynet ilovasida yoki
 * kassada O'ZI to'laydi. Bizning yagona vazifamiz — unga to'g'ri **To'lov
 * ID**ni (Telegram chat ID) va summani ko'rsatish. Shu bois panel butunlay
 * yo'riqnoma ko'rinishida.
 *
 * Sahifada kutib turish SHART EMAS: pul kelganda backend tarifni o'zi
 * yoqadi (`apps/paynet/service._try_pending_plan`) va bot xabar yuboradi.
 */
export function PaynetPanel({ wallet, onRefresh }: {
  wallet: WalletState
  onRefresh?: () => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const choice = wallet.pending
  const paynet = wallet.providers.paynet

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['wallet'] })
    queryClient.invalidateQueries({ queryKey: ['me'] })
    queryClient.invalidateQueries({ queryKey: ['my-limits'] })
    onRefresh?.()
  }

  const cancel = useMutation({ mutationFn: cancelPayIntent, onSuccess: refresh })
  const activate = useMutation({
    mutationFn: () => buyFromBalance(choice!.plan, choice!.months),
    onSuccess: refresh,
  })

  const copyId = async () => {
    if (!paynet.payment_id) return
    try {
      await navigator.clipboard.writeText(paynet.payment_id)
    } catch {
      return // clipboard ruxsati yo'q — raqam baribir ekranda ko'rinib turibdi
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const money = (uzs: number) => `${uzs.toLocaleString('ru-RU').replace(/\u00A0/g, ' ')} so'm`
  const fill = (text: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), text)

  // Foydalanuvchi bot orqali kirmagan bo'lsa to'lov ID yo'q — buni JIM
  // o'tkazib yubormaymiz, aks holda u Paynet'da nima kiritishni bilmaydi.
  if (!paynet.payment_id) {
    return (
      <div className="card" style={{ padding: 20, borderColor: '#F59E0B' }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{t.payTitle}</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{t.payNoId}</div>
      </div>
    )
  }

  const need = choice ? choice.missing_uzs : 0
  const paidSoFar = choice ? Math.min(wallet.balance_uzs, choice.price_uzs) : 0
  const percent = choice && choice.price_uzs ? (paidSoFar / choice.price_uzs) * 100 : 0

  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{t.payTitle}</span>
        <Badge>{paynet.service_name}</Badge>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-secondary)' }}>
          {t.payBalance}: <b style={{ color: 'var(--text-primary)' }}>{wallet.balance_label}</b>
        </span>
      </div>

      {/* To'lov ID — panelning ENG muhim elementi, shu bois eng yirik */}
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '14px 16px',
      }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>
          {t.payIdLabel}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: 1.5, fontVariantNumeric: 'tabular-nums' }}>
            {paynet.payment_id}
          </span>
          <button className="btn" onClick={copyId} style={{ fontSize: 13, padding: '6px 12px' }}>
            {copied ? <><CheckIcon /> {t.payIdCopied}</> : t.payIdCopy}
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 6 }}>
          {t.payIdHint}
        </div>
      </div>

      {choice && (
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.paySelected}:</span>
            <b>{choice.plan_name}</b>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              · {fill(t.payMonthsValue, { n: String(choice.months) })} · {money(choice.price_uzs)}
            </span>
          </div>
          <ProgressBar percent={percent} color={need ? '#F59E0B' : '#10B981'} />
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8, color: need ? '#B45309' : '#047857' }}>
            {need ? fill(t.payNeedMore, { amount: money(need) }) : t.payEnough}
          </div>
        </div>
      )}

      {/* Yo'riqnoma — asosiy yuk shu yerda, chunki to'lov BIZDA emas */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{t.paySteps}</div>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
          <li>{t.payStep1}</li>
          <li>{fill(t.payStep2, { service: paynet.service_name })}</li>
          <li>{splitOnce(t.payStep3, '{id}', <b key="id">{paynet.payment_id}</b>)}</li>
          <li>{fill(t.payStep4, { amount: money(need || choice?.price_uzs || 0) })}</li>
        </ol>
      </div>

      {choice && (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {fill(t.payPendingNote, { plan: choice.plan_name })}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {choice.enough && (
              <button
                className="btn btn-primary"
                onClick={() => activate.mutate()}
                disabled={activate.isPending}
              >
                {t.payUseBalance}
              </button>
            )}
            <button className="btn" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
              {t.payCancelPending}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
