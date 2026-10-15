import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchLeaderboard } from '@/api/endpoints'
import { PageHeader } from '@/components/Layout'
import UserAvatar from '@/components/UserAvatar'
import { EmptyState, ErrorState, Pagination, Spinner, StarIcon } from '@/components/ui'
import UserSearch from '@/features/users/UserSearch'
import { useAuth } from '@/store/auth'
import { useT } from '@/i18n'
import { fill } from '@/utils/format'

/** Davr filtri (kun): 1 = bugun, 0 = butun vaqt. Server ham shularni qabul qiladi. */
const PERIODS = [1, 7, 30, 90, 0] as const

/** Reyting — BITTA jadval: hamma foydalanuvchi, eng ko'p tinglagan tepada,
 *  oxirgi N kun filtri va sahifalash (server 30 tadan beradi). */
export default function LeaderboardPage() {
  const t = useT()
  const { isLoggedIn } = useAuth()
  const [period, setPeriod] = useState<number>(7)
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['leaderboard', period, page],
    queryFn: () => fetchLeaderboard(period, page),
    placeholderData: keepPreviousData,
  })
  const periodLabel = (p: number) =>
    p === 0 ? t.lbPeriodAll : p === 1 ? t.lbPeriodToday : fill(t.lbPeriodDays, { n: p })
  // Faol vaqt yorlig'i: xom `seconds` bo'lsa undan, aks holda `hours` dan.
  // 1 soatdan kam bo'lsa DAQIQADA va eng kamida 1 daqiqa — backend `hours` ni
  // 0.1 (6 daqiqa) aniqlikda yaxlitlagani sabab kichik faollik "0" bo'lardi.
  const fmt = (seconds: number | undefined, hours: number): string => {
    const sec = seconds != null ? seconds : Math.round((hours || 0) * 3600)
    if (sec <= 0) return `0 ${t.minutesUnit}`
    if (sec >= 3600) return `${(sec / 3600).toFixed(1)} ${t.hoursUnit}`
    return `${Math.max(1, Math.round(sec / 60))} ${t.minutesUnit}`
  }
  return (
    <>
      <PageHeader />
      <div className="page" style={{ maxWidth: 900 }}>
        {/* Qidiruv — natija bosilsa ochiq profil (`/u/:id`). */}
        {isLoggedIn && <div style={{ marginBottom: 20 }}><UserSearch /></div>}
        <div className="card" style={{ padding: 24, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap', marginBottom: 6,
          }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{t.lbTitle}</div>
            <div role="tablist" style={{
              display: 'flex', gap: 4, padding: 3, borderRadius: 10,
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              // Tor ekranda bir qatorda qoladi, sig'masa yonga suriladi.
              maxWidth: '100%', overflowX: 'auto', whiteSpace: 'nowrap',
            }}>
              {PERIODS.map((p) => (
                <button key={p} role="tab" aria-selected={period === p}
                  onClick={() => { setPeriod(p); setPage(1) }}
                  style={{
                    border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 13, fontWeight: 700, flexShrink: 0,
                    cursor: 'pointer', fontFamily: 'inherit',
                    background: period === p ? '#10B981' : 'transparent',
                    color: period === p ? '#FFF' : 'var(--text-secondary)',
                  }}>{periodLabel(p)}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            {t.yourActiveTime}:{' '}
            <span style={{ fontWeight: 700, color: '#10B981' }}>
              {fmt(query.data?.my_seconds, query.data?.my_hours ?? 0)}
            </span>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 14,
            padding: '0 4px 10px', fontSize: 12, fontWeight: 700,
            color: 'var(--text-secondary)', textTransform: 'uppercase',
            letterSpacing: '.03em', borderBottom: '1px solid var(--border)', marginBottom: 4,
          }}>
            <span>{t.rankHeader}</span><span>{t.usernameHeader}</span><span>{t.activeTimeHeader}</span>
          </div>

          {query.isLoading && <Spinner />}
          {query.isError && <ErrorState onRetry={query.refetch} />}
          {query.data?.results.length === 0 && <EmptyState />}

          {query.data?.results.map((row) => {
            const rowStyle: React.CSSProperties = {
              display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 14,
              alignItems: 'center', padding: '10px 4px',
              borderRadius: 8,
              background: row.is_me ? 'var(--ok-bg)' : 'transparent',
              color: 'inherit', textDecoration: 'none',
            }
            const cells = (<>
              <div style={{
                width: 26, height: 26, borderRadius: 8, display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                background: row.rank === 1 ? 'rgba(16,185,129,.16)' : 'var(--bg-secondary)',
                color: row.rank === 1 ? '#15803D' : 'var(--text-secondary)',
              }}>
                {row.rank === 1 ? <StarIcon /> : row.rank}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {/* Rasm qo'ygan bo'lsa — rasm, aks holda bosh harf. */}
                <UserAvatar url={row.avatar_url} initial={row.initial} size={28} />
                <span style={{
                  fontSize: 14, fontWeight: row.is_me ? 800 : 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{row.name}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {fmt(row.seconds, row.hours)}
              </span>
            </>)
            // Ochiq profili borlar bosiladi; ismsizlarniki yo'q (server 404 beradi).
            return row.has_profile ? (
              <Link key={row.user_id} to={`/u/${row.user_id}`} className="lb-row-link" style={rowStyle}>{cells}</Link>
            ) : (
              <div key={row.user_id} style={rowStyle}>{cells}</div>
            )
          })}

          <Pagination page={query.data?.page ?? page} totalPages={query.data?.num_pages ?? 1} onChange={setPage} />
        </div>
      </div>
    </>
  )
}
