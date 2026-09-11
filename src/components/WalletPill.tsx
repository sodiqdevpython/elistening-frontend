import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchWallet } from '@/api/endpoints'
import { useAuth } from '@/store/auth'
import { useT } from '@/i18n'

/**
 * Navbar'dagi hamyon: **balans + akkaunt ID**, har sahifada ko'rinadi.
 *
 * Nega doim ko'rinadi: ikkala raqam ham foydalanuvchiga kutilmaganda kerak
 * bo'ladi — balansni bilmasa "tarif nega yoqilmadi" deb o'ylaydi, akkaunt
 * ID'ni esa Paynet kassasida so'rashadi. Ularni profil ichiga yashirsak,
 * har safar qidirishga to'g'ri kelardi.
 *
 * Bosilganda `/profile/billing` ochiladi — u yerda to'liq ma'lumot bor.
 *
 * Faqat tizimga kirgan foydalanuvchiga. So'rov `staleTime` bilan
 * keshlanadi: navbar har sahifada qayta chizilsa ham API bir marta
 * so'raladi.
 */
export function WalletPill() {
  const { isLoggedIn } = useAuth()
  const t = useT()

  const { data } = useQuery({
    queryKey: ['wallet'],
    queryFn: fetchWallet,
    enabled: isLoggedIn,
    staleTime: 60_000,
  })

  if (!isLoggedIn || !data) return null

  const paymentId = data.providers.paynet.payment_id

  return (
    <Link
      to="/profile/billing"
      title={t.walletPillHint}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '5px 10px 5px 8px', borderRadius: 16,
        border: '1px solid var(--navbar-border)',
        background: 'rgba(16,185,129,.10)',
        textDecoration: 'none', color: 'var(--navbar-text)',
        lineHeight: 1.15, whiteSpace: 'nowrap',
      }}
    >
      <WalletIcon />
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <b style={{ fontSize: 12.5, fontWeight: 800 }}>{data.balance_label}</b>
        {/* Akkaunt ID — Paynet kassasida aynan shu raqam so'raladi.
            Tor ekranda `wallet-pill-id` CSS bilan yashiriladi. */}
        {!!paymentId && (
          <span className="wallet-pill-id"
            style={{ fontSize: 10.5, fontWeight: 600, opacity: .7, fontVariantNumeric: 'tabular-nums' }}>
            ID {paymentId}
          </span>
        )}
      </span>
    </Link>
  )
}

function WalletIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10B981"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
      <circle cx="16.5" cy="13" r="1.4" fill="#10B981" stroke="none" />
    </svg>
  )
}
