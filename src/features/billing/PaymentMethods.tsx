import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { buyFromBalance, cancelPayIntent } from '@/api/endpoints'
import type { WalletState } from '@/api/types'
import { CheckIcon } from '@/components/ui'
import { useT } from '@/i18n'
import { ClickPayButton } from './ClickPayButton'

/**
 * To'lov bo'limi — balans + ikkita provayder kartochkasi.
 *
 * **Nega ikkisi ATAYLAB boshqacha ko'rinadi.** Oqimlari tubdan farq qiladi:
 *
 * * **Click** — bir bosishda my.click.uz ga o'tadi. Demak kartochkaning
 *   asosiy elementi — TUGMA.
 * * **Paynet** — foydalanuvchi ilovada yoki kassada O'ZI to'laydi, biz uni
 *   hech qayerga yubora olmaymiz. Demak asosiy element — RAQAM va
 *   YO'RIQNOMA.
 *
 * Ikkalasini bir xil "to'lash tugmasi" qilib ko'rsatish yolg'on bo'lardi:
 * Paynet tugmasi hech qayerga olib bormasdi.
 */
export function PaymentMethods({ wallet }: { wallet: WalletState }) {
  const t = useT()
  const paynet = wallet.providers.paynet

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <BalanceCard wallet={wallet} />

      <div>
        <SectionLabel>{t.payChooseMethod}</SectionLabel>
        <div style={{
          display: 'grid', gap: 14,
          gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
        }}>
          <ClickCard wallet={wallet} />
          <PaynetCard wallet={wallet} paymentId={paynet.payment_id}
            serviceName={paynet.service_name} />
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.02em',
      color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 10 }}>
      {children}
    </div>
  )
}

/** Hisobdagi pul + tanlangan tarifgacha qancha qolgani. */
function BalanceCard({ wallet }: { wallet: WalletState }) {
  const t = useT()
  const queryClient = useQueryClient()
  const choice = wallet.pending

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['wallet'] })
    queryClient.invalidateQueries({ queryKey: ['me'] })
    queryClient.invalidateQueries({ queryKey: ['my-limits'] })
  }
  const cancel = useMutation({ mutationFn: cancelPayIntent, onSuccess: refresh })
  const activate = useMutation({
    mutationFn: () => buyFromBalance(choice!.plan, choice!.months),
    onSuccess: refresh,
  })

  const need = choice ? choice.missing_uzs : 0
  const paid = choice ? Math.min(wallet.balance_uzs, choice.price_uzs) : 0
  const percent = choice && choice.price_uzs ? (paid / choice.price_uzs) * 100 : 0

  return (
    <div style={{
      borderRadius: 18, padding: '20px 22px', color: '#FFF',
      background: 'linear-gradient(135deg,#10B981 0%,#059669 60%,#047857 100%)',
      boxShadow: '0 10px 28px rgba(5,150,105,.28)',
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, opacity: .85, letterSpacing: '.02em' }}>
        {t.payBalance}
      </div>
      <div style={{ fontSize: 34, fontWeight: 800, marginTop: 2, letterSpacing: '-.02em' }}>
        {wallet.balance_label}
      </div>

      {choice && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            gap: 8, flexWrap: 'wrap', fontSize: 13, marginBottom: 7 }}>
            <span style={{ opacity: .9 }}>
              {t.paySelected}: <b>{choice.plan_name}</b>
              {choice.months > 1 && ` · ${fill(t.payMonthsValue, { n: String(choice.months) })}`}
            </span>
            <b>{money(choice.price_uzs)}</b>
          </div>

          {/* Progress — "yana qancha kerak" ni RAQAM bilan emas, ko'z bilan
              ko'rsatadi; bu sahifadagi asosiy savol. */}
          <div style={{ height: 7, borderRadius: 99, background: 'rgba(255,255,255,.28)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, percent)}%`, height: '100%',
              background: '#FFF', borderRadius: 99, transition: 'width .3s' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>
              {need ? fill(t.payNeedMore, { amount: money(need) }) : t.payEnough}
            </span>
            <span style={{ flex: 1 }} />
            {choice.enough && (
              <button onClick={() => activate.mutate()} disabled={activate.isPending}
                style={{
                  border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer',
                  background: '#FFF', color: '#047857', fontSize: 13, fontWeight: 800,
                }}>
                {t.payUseBalance}
              </button>
            )}
            <button onClick={() => cancel.mutate()} disabled={cancel.isPending}
              style={{
                border: '1px solid rgba(255,255,255,.45)', borderRadius: 10,
                padding: '8px 14px', cursor: 'pointer', background: 'transparent',
                color: '#FFF', fontSize: 13, fontWeight: 700,
              }}>
              {t.payCancelPending}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Provayder kartochkasining umumiy qobig'i — logotip + matn + amal. */
function ProviderCard({ logo, alt, tint, hint, children }: {
  logo: string; alt: string; tint: string; hint: string; children: React.ReactNode
}) {
  return (
    <div className="card" style={{
      padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
      borderTop: `3px solid ${tint}`,
    }}>
      <img src={logo} alt={alt} style={{ height: 32, width: 'auto', borderRadius: 6,
        alignSelf: 'flex-start' }} />
      <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        {hint}
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  )
}

function ClickCard({ wallet }: { wallet: WalletState }) {
  const t = useT()
  const choice = wallet.pending

  // Kalitlar `.env` da bo'lmasa server 503 qaytaradi. Ishlamaydigan tugma
  // ko'rsatib, foydalanuvchini xatoga olib borishdan ko'ra — kartochkani
  // ochiq holda "hozircha mavjud emas" deb belgilagan ma'qul.
  if (!wallet.providers.click.enabled) {
    return (
      <ProviderCard logo="/click_logo.png" alt="Click" tint="#94A3B8"
        hint={t.payWithClickHint}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)',
          background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 12px',
          textAlign: 'center' }}>
          {t.payProviderOff}
        </div>
      </ProviderCard>
    )
  }

  return (
    <ProviderCard logo="/click_logo.png" alt="Click" tint="#0D7FFC" hint={t.payWithClickHint}>
      {choice ? (
        // Click YETMAGAN qismni so'raydi (server shunday hisoblaydi), lekin
        // u servisning minimal summasidan kichik bo'lolmaydi.
        <ClickPayButton plan={choice.plan} months={choice.months}
          amountUzs={Math.max(choice.missing_uzs, wallet.providers.click.min_uzs)} />
      ) : (
        // Click'da summa buyurtmadan olinadi, shu bois tarifsiz tugma
        // ishlamaydi. Tugmani "o'chirilgan" qilib qo'yish o'rniga NIMA
        // qilish kerakligini aytamiz.
        <div style={{
          fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)',
          background: 'var(--bg-secondary)', border: '1px dashed var(--border)',
          borderRadius: 10, padding: '10px 12px', textAlign: 'center',
        }}>
          {t.payPickPlanFirst}
        </div>
      )}
    </ProviderCard>
  )
}

function PaynetCard({ wallet, paymentId, serviceName }: {
  wallet: WalletState; paymentId: string | null; serviceName: string
}) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const choice = wallet.pending

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
    <ProviderCard logo="/paynet_logo.png" alt="Paynet" tint="#22C55E" hint={t.payWithPaynetHint}>
      {!paymentId ? (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#B45309' }}>{t.payNoId}</div>
      ) : (
        <>
          {/* To'lov ID — kartochkaning ENG muhim elementi: kassada aynan
              shu raqam so'raladi. Shu bois eng yirik. */}
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '10px 12px',
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '.03em' }}>
              {t.payIdLabel}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1,
                fontVariantNumeric: 'tabular-nums' }}>
                {paymentId}
              </span>
              <button className="btn" onClick={copy}
                style={{ fontSize: 12, padding: '5px 10px', marginLeft: 'auto' }}>
                {copied ? <><CheckIcon /> {t.payIdCopied}</> : t.payIdCopy}
              </button>
            </div>
          </div>

          <button onClick={() => setOpen((v) => !v)}
            style={{
              border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
              fontSize: 13, fontWeight: 700, color: '#059669', textAlign: 'left',
            }}>
            {open ? '−' : '+'} {t.paySteps}
          </button>

          {open && (
            <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column',
              gap: 6, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              <li>{t.payStep1}</li>
              <li>{fill(t.payStep2, { service: serviceName })}</li>
              <li>{splitOnce(t.payStep3, '{id}', <b key="id" style={{ color: 'var(--text)' }}>{paymentId}</b>)}</li>
              <li>{fill(t.payStep4, { amount: money(choice ? choice.missing_uzs || choice.price_uzs : 0) })}</li>
            </ol>
          )}
        </>
      )}
    </ProviderCard>
  )
}

// ── Kichik yordamchilar ───────────────────────────────────────────────────
function money(uzs: number) {
  return `${uzs.toLocaleString('ru-RU').replace(/ /g, ' ')} so'm`
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
