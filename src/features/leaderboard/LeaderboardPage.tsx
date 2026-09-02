import { useQuery } from '@tanstack/react-query'
import { fetchLeaderboard } from '@/api/endpoints'
import type { LeaderboardRow } from '@/api/types'
import { PageHeader } from '@/components/Layout'
import { EmptyState, ErrorState, Spinner, StarIcon } from '@/components/ui'
import { useT } from '@/i18n'

export default function LeaderboardPage() {
  const t = useT()
  const week = useQuery({ queryKey: ['leaderboard', 7], queryFn: () => fetchLeaderboard(7) })
  const month = useQuery({ queryKey: ['leaderboard', 30], queryFn: () => fetchLeaderboard(30) })

  return (
    <>
      <PageHeader />
      <div className="page" style={{ maxWidth: 1280, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <Board title={t.lb7Title} query={week} />
        <Board title={t.lb30Title} query={month} />
      </div>
    </>
  )
}

function Board({ title, query }: {
  title: string
  query: { data?: { my_hours: number; results: LeaderboardRow[] }; isLoading: boolean; isError: boolean; refetch: () => void }
}) {
  const t = useT()
  return (
    <div className="card" style={{ flex: '1 1 400px', padding: 24, minWidth: 0 }}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        {t.yourActiveTime}:{' '}
        <span style={{ fontWeight: 700, color: '#10B981' }}>
          {query.data?.my_hours ?? 0} {t.hoursUnit}
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

      {query.data?.results.map((row) => (
        <div key={row.user_id} style={{
          display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 14,
          alignItems: 'center', padding: '10px 4px',
          borderRadius: 8,
          background: row.is_me ? 'var(--ok-bg)' : 'transparent',
        }}>
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
            {row.avatar_url ? (
              <img
                src={row.avatar_url}
                alt=""
                width={28}
                height={28}
                loading="lazy"
                style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg,#10B981 0%,#2563EB 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#FFF',
              }}>{row.initial}</div>
            )}
            <span style={{
              fontSize: 14, fontWeight: row.is_me ? 800 : 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{row.name}</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            {row.hours} {t.hoursUnit}
          </span>
        </div>
      ))}
    </div>
  )
}
