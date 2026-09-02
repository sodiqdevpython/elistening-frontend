import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMyLimits, fetchPlans, subscribe } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import type { Plan } from '@/api/types'
import { Badge, CheckIcon, ErrorState, SectionTitle, Spinner } from '@/components/ui'
import { useAuth } from '@/store/auth'
import { useLang, useT } from '@/i18n'

/**
 * Tarif tanlash sahifasi — **`/profile/billing`**.
 *
 * **Nega alohida sahifa:** mobil ilovada tashqi to'lov havolasi bo'lishi
 * mumkin emas (App Store / Play Store qoidalari — publish'da muammo bo'ladi).
 * Shu bois limitga yetilganda ilova faqat "qaysi tarifdasiz + ertaga
 * yangilanadi" deydi, Telegram bot esa foydalanuvchiga **aynan shu
 * sahifaning** havolasini yuboradi
 * (`backend/apps/billing/limits.py::notify_limit_once`).
 *
 * Sahifada: bugungi sarf, tariflar ro'yxati va tanlash tugmalari.
 */
export default function BillingPage() {
  const t = useT()
  const { lang } = useLang()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, isLoggedIn, loading } = useAuth()
  const [message, setMessage] = useState('')

  const plans = useQuery({ queryKey: ['plans'], queryFn: fetchPlans })
  const limits = useQuery({ queryKey: ['my-limits'], queryFn: fetchMyLimits, enabled: isLoggedIn })

  const choose = useMutation({
    mutationFn: (plan: Plan) => subscribe(plan.code),
    onSuccess: () => {
      setMessage('')
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['my-limits'] })
    },
    onError: (err) => setMessage(errorMessage(err, t.billingError)),
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
  const limitText = (v: number | null) => (v == null ? t.billingUnlimited : `${v} / ${t.billingPerDay}`)

  return (
    <div className="page" style={{ maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionTitle sub={t.billingSubtitle}>{t.billingTitle}</SectionTitle>

      {/* Bugungi holat — nima qolganini darrov ko'rsatadi */}
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

      {plans.isLoading && <Spinner />}
      {plans.isError && <ErrorState onRetry={() => plans.refetch()} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
        {plans.data?.map((plan) => {
          const active = plan.code === current
          const name = lang === 'en' ? plan.name_en : plan.name_uz
          const price = lang === 'en' ? plan.price_label_en : plan.price_label_uz
          return (
            <div
              key={plan.id}
              className="card"
              style={{
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                border: `1.5px solid ${active ? '#10B981' : 'var(--border)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 800 }}>{name}</span>
                {active && <Badge>{t.billingCurrent}</Badge>}
              </div>

              <div style={{ fontSize: 22, fontWeight: 800 }}>{price}</div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {([
                  [t.billingKindShorts, plan.daily_shorts_limit],
                  [t.billingKindVideo, plan.daily_video_limit],
                  [t.billingKindDictation, plan.daily_dictation_limit],
                ] as const).map(([label, value]) => (
                  <li key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
                    <CheckIcon />
                    <span>{label}: <b>{limitText(value)}</b></span>
                  </li>
                ))}
              </ul>

              <button
                className={active ? 'btn btn-ghost' : 'btn btn-primary'}
                disabled={active || choose.isPending}
                onClick={() => choose.mutate(plan)}
                style={{ marginTop: 'auto', padding: '11px 18px' }}
              >
                {active ? t.billingCurrent : t.billingChoose}
              </button>
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
