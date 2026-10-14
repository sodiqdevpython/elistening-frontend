import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { fetchUserProfile } from '@/api/endpoints'
import { PageHeader } from '@/components/Layout'
import UserAvatar from '@/components/UserAvatar'
import { Badge, EmptyState, ErrorState, Spinner } from '@/components/ui'
import { useAuth } from '@/store/auth'
import { useLang, useT } from '@/i18n'
import { fill, formatDay } from '@/utils/format'
import UserSearch from './UserSearch'

/**
 * Boshqa foydalanuvchining OCHIQ profili — `/u/:id`.
 *
 * Faqat ochiq ma'lumot: ism, rasm, daraja, ro'yxatdan o'tgan sana va
 * statistika. Telegram ID / tarif / balans server javobida umuman yo'q
 * (`backend/apps/accounts/public.py`). Manzil username emas, ichki `id` —
 * avtomatik `tg<id>` username Telegram ID'ni oshkor qilardi.
 */
export default function UserProfilePage() {
  const t = useT()
  const { lang } = useLang()
  const { id = '' } = useParams()
  const { isLoggedIn } = useAuth()
  const profile = useQuery({
    queryKey: ['user-profile', id],
    queryFn: () => fetchUserProfile(id),
    enabled: /^\d+$/.test(id),
    retry: (count, err) => !(isAxiosError(err) && err.response?.status === 404) && count < 2,
  })
  const notFound = !/^\d+$/.test(id)
    || (isAxiosError(profile.error) && profile.error.response?.status === 404)

  const listen = (sec: number) => {
    if (sec <= 0) return `0 ${t.minutesUnit}`
    if (sec >= 3600) return `${(sec / 3600).toFixed(1)} ${t.hoursUnit}`
    return `${Math.max(1, Math.round(sec / 60))} ${t.minutesUnit}`
  }

  const p = profile.data
  return (
    <>
      <PageHeader />
      <div className="page" style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/leaderboard" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
            {t.userBackToLeaderboard}
          </Link>
          {isLoggedIn && <div style={{ flex: '1 1 260px', maxWidth: 420, marginLeft: 'auto' }}><UserSearch /></div>}
        </div>

        {notFound ? (
          <div className="card"><EmptyState text={t.userNotFound} /></div>
        ) : profile.isLoading ? (
          <Spinner />
        ) : profile.isError || !p ? (
          <div className="card"><ErrorState onRetry={profile.refetch} /></div>
        ) : (
          <>
            <div className="card" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <UserAvatar url={p.avatar_url} initial={p.initial} size={76} />
              <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, overflowWrap: 'anywhere' }}>{p.name}</h1>
                  {p.cefr_level && <Badge>{p.cefr_level}</Badge>}
                </div>
                {p.username && (
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>@{p.username}</div>
                )}
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                  {fill(t.userJoined, { date: formatDay(p.joined_at, lang) })}
                </div>
              </div>
              {p.is_me && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{t.userIsMe}</span>
                  <Link to="/profile" className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 13 }}>
                    {t.userOpenMyProfile}
                  </Link>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <Tile label={t.userStatTotal} value={listen(p.stats.listening_seconds)} />
              <Tile label={t.userStat30} value={listen(p.stats.listening_seconds_30d)} />
              <Tile label={t.userStatDictations} value={p.stats.dictations_completed} />
              <Tile label={t.userStatInvited} value={p.stats.invited_count} />
            </div>
          </>
        )}
      </div>
    </>
  )
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.03em' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{value}</div>
    </div>
  )
}
