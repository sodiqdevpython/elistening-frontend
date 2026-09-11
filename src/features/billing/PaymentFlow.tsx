import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { buyFromBalance, cancelPayIntent } from '@/api/endpoints'
import type { WalletState } from '@/api/types'
import { useLang, useT } from '@/i18n'
import { ClickPayButton } from './ClickPayButton'
import { PlanCards } from './PlanCards'

type Method = 'click' | 'paynet'

/**
 * To'lov oqimi — **uch bosqich, shu tartibda**:
 *
 *     1. QANDAY to'lash    (Click / Paynet)
 *     2. NIMA sotib olish  (tarif)
 *     3. QANCHA va TO'LASH
 *
 * **Nega aynan shu tartib.** Ilgari teskari edi: avval tarif, keyin to'lov
 * usullari chiqardi. Foydalanuvchi tarif tanlagach ekranda birdaniga ikkita
 * butunlay boshqacha blok paydo bo'lardi (Click tugmasi va Paynet
 * yo'riqnomasi) va "men nima qilishim kerak?" degan savol tug'ilardi.
 *
 * Usul birinchi bo'lsa, keyingi ekranlarda FAQAT o'sha usulga tegishli
 * narsa qoladi — bir vaqtda bitta qaror.
 *
 * Tarif tanlovi SERVERDA saqlanadi (`pending_plan`), local state'da emas:
 * Paynet'da pul bir necha soatdan keyin kelishi mumkin va tarif o'sha
 * paytda avtomatik yoqilishi kerak — brauzer yopiq bo'lsa ham.
 */
export function PaymentFlow({ wallet, currentPlan, onChoosePlan, busy }: {
  wallet: WalletState
  currentPlan: string
  onChoosePlan: (code: string) => void
  busy?: boolean
}) {
  const t = useT()
  const [method, setMethod] = useState<Method | null>(null)
  const choice = wallet.pending

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <BalanceCard wallet={wallet} />

      {/* ── 1-bosqich ── */}
      <Step n={1} title={t.payStepMethod}>
        <div style={{ display: 'grid', gap: 14,
          gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
          <MethodCard
            logo="/click_logo.png" alt="Click" tint="#0D7FFC"
            hint={t.payWithClickHint}
            selected={method === 'click'}
            disabled={!wallet.providers.click.enabled}
            disabledNote={t.payProviderOff}
            onSelect={() => setMethod('click')}
          />
          <MethodCard
            logo="/paynet_logo.png" alt="Paynet" tint="#22C55E"
            hint={t.payWithPaynetHint}
            selected={method === 'paynet'}
            disabled={!wallet.providers.paynet.payment_id}
            disabledNote={t.payNoId}
            onSelect={() => setMethod('paynet')}
          />
        </div>
      </Step>

      {/* ── 2-bosqich ── */}
      {method && (
        <Step n={2} title={t.payStepPlan}>
          <PlanCards currentCode={currentPlan} selectedCode={choice?.plan}
            onChoose={onChoosePlan} busy={busy} />
        </Step>
      )}

      {/* ── 3-bosqich ── */}
      {method && choice && (
        <Step n={3} title={t.payStepPay}>
          {method === 'click'
            ? <ClickStep wallet={wallet} />
            : <PaynetStep wallet={wallet} />}
        </Step>
      )}
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
        <span style={{
          width: 23, height: 23, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg,#10B981,#059669)', color: '#FFF',
          fontSize: 12.5, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{n}</span>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

/** Hisobdagi pul + Paynet uchun to'lov ID — sahifaning tepasida. */
function BalanceCard({ wallet }: { wallet: WalletState }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const paymentId = wallet.providers.paynet.payment_id

  const copy = async () => {
    if (!paymentId) return
    try {
      await navigator.clipboard.writeText(paymentId)
    } catch {
      return // ruxsat yo'q — raqam baribir ekranda turibdi
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div style={{
      borderRadius: 18, padding: '20px 22px', color: '#FFF',
      background: 'linear-gradient(135deg,#10B981 0%,#059669 60%,#047857 100%)',
      boxShadow: '0 10px 28px rgba(5,150,105,.28)',
      display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, opacity: .85 }}>{t.payBalance}</div>
        <div style={{ fontSize: 34, fontWeight: 800, marginTop: 2, letterSpacing: '-.02em' }}>
          {wallet.balance_label}
        </div>
      </div>

      {!!paymentId && (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, opacity: .85 }}>{t.payIdLabel}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: .8,
              fontVariantNumeric: 'tabular-nums' }}>{paymentId}</span>
            <button onClick={copy} style={{
              border: '1px solid rgba(255,255,255,.5)', background: 'transparent',
              color: '#FFF', borderRadius: 8, padding: '4px 9px', cursor: 'pointer',
              fontSize: 11.5, fontWeight: 700,
            }}>
              {copied ? t.payIdCopied : t.payIdCopy}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MethodCard({ logo, alt, tint, hint, selected, disabled, disabledNote, onSelect }: {
  logo: string; alt: string; tint: string; hint: string
  selected: boolean; disabled?: boolean; disabledNote: string; onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      aria-pressed={selected}
      disabled={disabled}
      className="card"
      style={{
        padding: 18, textAlign: 'left', cursor: disabled ? 'default' : 'pointer',
        display: 'flex', flexDirection: 'column', gap: 10,
        border: `2px solid ${selected ? tint : 'var(--border)'}`,
        boxShadow: selected ? `0 6px 20px ${tint}33` : undefined,
        opacity: disabled ? .5 : 1,
        transition: 'border-color .15s, box-shadow .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <img src={logo} alt={alt} style={{ height: 30, width: 'auto', borderRadius: 6 }} />
        {selected && (
          <span style={{
            width: 21, height: 21, borderRadius: '50%', background: tint, color: '#FFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, flexShrink: 0,
          }}>✓</span>
        )}
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        {disabled ? disabledNote : hint}
      </div>
    </button>
  )
}

/** 3-bosqich, Click: summa + tugma. Bosilsa my.click.uz ochiladi. */
function ClickStep({ wallet }: { wallet: WalletState }) {
  const choice = wallet.pending!
  const amount = Math.max(choice.missing_uzs, wallet.providers.click.min_uzs)

  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Summary choice={choice} amount={choice.missing_uzs ? amount : 0} />
      {choice.enough
        ? <ActivateFromBalance choice={choice} />
        : <ClickPayButton plan={choice.plan} months={choice.months} amountUzs={amount} />}
    </div>
  )
}

/** 3-bosqich, Paynet: summa + yo'riqnoma. Bu yerda "to'lash" tugmasi YO'Q —
 *  foydalanuvchi kassada yoki ilovada o'zi to'laydi, biz uni hech qayerga
 *  yubora olmaymiz. */
function PaynetStep({ wallet }: { wallet: WalletState }) {
  const t = useT()
  const { lang } = useLang()
  const choice = wallet.pending!
  const paymentId = wallet.providers.paynet.payment_id!
  const serviceName = wallet.providers.paynet.service_name

  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Summary choice={choice} amount={choice.missing_uzs} />

      {choice.enough ? (
        <ActivateFromBalance choice={choice} />
      ) : (
        <>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column',
            gap: 7, fontSize: 13.5, lineHeight: 1.45 }}>
            <li>{t.payStep1}</li>
            <li>{fill(t.payStep2, { service: serviceName })}</li>
            <li>{splitOnce(t.payStep3, '{id}', <b key="id">{paymentId}</b>)}</li>
            <li>{fill(t.payStep4, { amount: money(choice.missing_uzs, lang) })}</li>
          </ol>
          <div style={{
            fontSize: 12.5, color: 'var(--text-secondary)', background: 'var(--bg-secondary)',
            borderRadius: 10, padding: '10px 12px', lineHeight: 1.45,
          }}>
            {fill(t.payPendingNote, { plan: choice.plan_name })}
          </div>
        </>
      )}
    </div>
  )
}

/** Tanlangan tarif + to'lanadigan summa — uchala holatda bir xil ko'rinadi. */
function Summary({ choice, amount }: {
  choice: NonNullable<WalletState['pending']>; amount: number
}) {
  const t = useT()
  const { lang } = useLang()
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      gap: 12, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
          {t.paySelected}
        </div>
        <div style={{ fontSize: 17, fontWeight: 800 }}>
          {choice.plan_name}
          {choice.months > 1 && (
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {' · '}{fill(t.payMonthsValue, { n: String(choice.months) })}
            </span>
          )}
        </div>
        {/* Ko'tarilishda e'lon qilingan narx ustidan chizib qo'yamiz —
            foydalanuvchi nega kamroq to'layotganini darrov tushunsin. */}
        {choice.upgrade_credit_uzs > 0 && (
          <div style={{ fontSize: 12.5, marginTop: 2, color: 'var(--text-secondary)' }}>
            <s>{money(choice.full_price_uzs, lang)}</s>{' → '}
            <b style={{ color: '#059669' }}>{money(choice.price_uzs, lang)}</b>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
          {amount ? t.payAmountLabel : t.payEnough}
        </div>
        {!!amount && (
          <div style={{ fontSize: 24, fontWeight: 900, color: '#059669' }}>{money(amount, lang)}</div>
        )}
      </div>
    </div>
  )
}

/** Balans yetarli — to'lov shart emas, bitta tugma yetadi. */
function ActivateFromBalance({ choice }: { choice: NonNullable<WalletState['pending']> }) {
  const t = useT()
  const queryClient = useQueryClient()
  const activate = useMutation({
    mutationFn: () => buyFromBalance(choice.plan, choice.months),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['my-limits'] })
    },
  })
  const cancel = useMutation({
    mutationFn: cancelPayIntent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallet'] }),
  })

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <button className="btn btn-primary" style={{ flex: 1, minWidth: 180 }}
        onClick={() => activate.mutate()} disabled={activate.isPending}>
        {t.payUseBalance}
      </button>
      <button className="btn btn-ghost" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
        {t.payCancelPending}
      </button>
    </div>
  )
}

// ── Kichik yordamchilar ───────────────────────────────────────────────────
function money(uzs: number, lang: string) {
  const value = uzs.toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU').replace(/ /g, ' ')
  return lang === 'en' ? `${value} UZS` : `${value} so'm`
}

function fill(text: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), text)
}

/** `{id}` o'rniga React tugunini qo'yadi — HTML in'ektsiyasisiz. */
function splitOnce(text: string, token: string, node: React.ReactNode) {
  const at = text.indexOf(token)
  if (at < 0) return text
  return <>{text.slice(0, at)}{node}{text.slice(at + token.length)}</>
}
