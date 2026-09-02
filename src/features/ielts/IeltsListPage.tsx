import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchIeltsListeningTests } from '@/api/endpoints'
import { PageHeader } from '@/components/Layout'
import { ErrorState, Spinner } from '@/components/ui'
import { useT } from '@/i18n'

export default function IeltsListPage() {
  const t = useT()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ielts-tests-list'],
    queryFn: () => fetchIeltsListeningTests(1),
    staleTime: 60_000,
  })

  return (
    <>
      <PageHeader />
      <div className="page" style={{ maxWidth: 1100 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
            {t.modeIeltsTitle}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 640 }}>
            {t.modeIeltsDesc}
          </div>
        </div>

        {isLoading && <Spinner />}
        {isError && <ErrorState onRetry={() => refetch()} />}

        {data && data.results.length === 0 && (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
            Hozircha testlar yo‘q. Admin URL kiritib javoblarni yozgach shu yerda ko‘rinadi.
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {data?.results.map((test) => (
            <Link
              key={test.id}
              to={`/ielts-tests/${test.slug}`}
              className="card card-hover"
              style={{
                padding: 20, textDecoration: 'none', color: 'var(--text)', borderRadius: 14,
                display: 'flex', flexDirection: 'column', gap: 12,
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'linear-gradient(135deg,#2563EB 0%,#7C3AED 100%)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 18,
              }}>IELTS</div>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35 }}>
                {test.title}
              </div>
              <div style={{ display: 'flex', gap: 12, color: 'var(--text-secondary)', fontSize: 13 }}>
                <span>{test.total_questions} savol</span>
                <span>·</span>
                <span>{test.views} ko‘rish</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
