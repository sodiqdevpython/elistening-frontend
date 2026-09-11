import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMyLimits, fetchWallet, payIntent } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { Badge, SectionTitle, Spinner } from '@/components/ui'
import { PaymentFlow } from './PaymentFlow'
import { useAuth } from '@/store/auth'
import { useLang, useT } from '@/i18n'

/**
 * Tarif tanlash sahifasi — **`/profile/billing`**.
 *
 * Tariflar STATIC — kartalar `PlanCards` da (profil sahifasi bilan AYNAN bir
 * xil). Bu yerda qo'shimcha "bugungi sarf" bloki bor (foydalanuvchiga bog'liq).
 *
 * Mobil ilovada tashqi to'lov havolasi bo'lmaydi (App/Play Store qoidasi);
 * bu sahifa faqat saytda, bot limitga yetilganda shu yerga yo'naltiradi.
 *
 * **To'lov — Paynet.** Tarif tanlangach `PaynetPanel` ochiladi: u "To'lash"
 * tugmasi emas, YO'RIQNOMA ko'rsatadi (Paynet redirect'li checkout emas —
 * foydalanuvchi Paynet ilovasida yoki kassada o'zi to'laydi). Pul kelganda
 * tarif serverda o'zi yoqiladi, bu sahifada kutib turish shart emas.
 */
export default function BillingPage() {
  const t = useT()
  const { lang } = useLang()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, isLoggedIn, loading } = useAuth()
  const [message, setMessage] = useState('')

  const limits = useQuery({ queryKey: ['my-limits'], queryFn: fetchMyLimits, enabled: isLoggedIn })
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: fetchWallet, enabled: isLoggedIn })

  const choose = useMutation({
    mutationFn: (code: string) => payIntent(code),
    onSuccess: (data) => {
      setMessage(data.activated ? t.payActivated : '')
      queryClient.setQueryData(['wallet'], data)
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

      {/* To'lov oqimi: 1) usul  2) tarif  3) summa va to'lash.
          Tartib ATAYLAB shunday — batafsil `PaymentFlow.tsx` izohida. */}
      {wallet.data && (
        <PaymentFlow
          wallet={wallet.data}
          currentPlan={current}
          onChoosePlan={(code) => choose.mutate(code)}
          busy={choose.isPending}
        />
      )}

      {!!message && (
        <div className="card" style={{ padding: 16, borderColor: '#F59E0B', fontSize: 14, fontWeight: 600 }}>
          {message}
        </div>
      )}

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
    </div>
  )
}
