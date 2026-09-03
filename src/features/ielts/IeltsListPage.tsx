import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchIeltsListeningTests } from '@/api/endpoints'
import { PageHeader } from '@/components/Layout'
import { ErrorState, Spinner } from '@/components/ui'
import { useT } from '@/i18n'

type DoneFilter = '' | '1' | '0'

/**
 * IELTS Listening testlar ro'yxati — qidiruv + sahifalash + bajarilgan/
 * bajarilmagan filtri. Eng yangi test doim tepada (backend `-created_at`).
 * Bajarilgan testda yashil belgi + oxirgi ball ko'rsatiladi (`my_result`).
 */
export default function IeltsListPage() {
  const t = useT()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [done, setDone] = useState<DoneFilter>('')
  const [page, setPage] = useState(1)

  // Qidiruvni 400ms debounce — har harfda so'rov ketmasin.
  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(id)
  }, [searchInput])

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['ielts-tests-list', page, search, done],
    queryFn: () => fetchIeltsListeningTests({ page, search, done }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

  const results = data?.results ?? []
  const hasPrev = Boolean(data?.previous)
  const hasNext = Boolean(data?.next)

  const filters: { key: DoneFilter; label: string }[] = [
    { key: '', label: t.moviesFilterAll },
    { key: '1', label: t.ieltsFilterDone },
    { key: '0', label: t.ieltsFilterUndone },
  ]

  return (
    <>
      <PageHeader />
      <div className="page" style={{ maxWidth: 1100 }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
            {t.modeIeltsTitle}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 640 }}>
            {t.modeIeltsDesc}
          </div>
        </div>

        {/* Qidiruv + filtr paneli */}
        <div style={{
          display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t.ieltsSearchPlaceholder}
            style={{
              flex: '1 1 240px', minWidth: 200, padding: '10px 14px',
              borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--text)', fontSize: 14,
            }}
          />
          <div style={{ display: 'flex', gap: 6, background: 'var(--bg-secondary)', padding: 4, borderRadius: 10 }}>
            {filters.map((f) => {
              const active = done === f.key
              return (
                <button
                  key={f.key || 'all'}
                  onClick={() => { setDone(f.key); setPage(1) }}
                  style={{
                    padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                    background: active ? 'var(--bg)' : 'transparent',
                    color: active ? 'var(--text)' : 'var(--text-secondary)',
                    boxShadow: active ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
                  }}
                >{f.label}</button>
              )
            })}
          </div>
        </div>

        {isLoading && <Spinner />}
        {isError && <ErrorState onRetry={() => refetch()} />}

        {data && results.length === 0 && (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
            {search || done ? t.ieltsNoResults
              : 'Hozircha testlar yo‘q. Admin URL kiritib javoblarni yozgach shu yerda ko‘rinadi.'}
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
          opacity: isFetching ? 0.6 : 1, transition: 'opacity .15s',
        }}>
          {results.map((test) => {
            const doneRes = test.my_result
            return (
              <Link
                key={test.id}
                to={`/ielts-tests/${test.slug}`}
                className="card card-hover"
                style={{
                  padding: 20, textDecoration: 'none', color: 'var(--text)', borderRadius: 14,
                  display: 'flex', flexDirection: 'column', gap: 12, position: 'relative',
                  border: doneRes ? '1px solid #10B98155' : undefined,
                }}
              >
                {/* Bajarilgan belgisi — yuqori o'ng burchakda */}
                {doneRes && (
                  <div style={{
                    position: 'absolute', top: 12, right: 12,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: '#10B981', color: '#fff', borderRadius: 999,
                    padding: '3px 9px', fontSize: 11, fontWeight: 800,
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                      stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    {doneRes.score}/{doneRes.total}
                  </div>
                )}
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: 'linear-gradient(135deg,#2563EB 0%,#7C3AED 100%)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 18,
                }}>IELTS</div>
                <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35, paddingRight: doneRes ? 56 : 0 }}>
                  {test.title}
                </div>
                <div style={{ display: 'flex', gap: 12, color: 'var(--text-secondary)', fontSize: 13 }}>
                  <span>{test.total_questions} savol</span>
                  <span>·</span>
                  <span>{test.views} ko‘rish</span>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Sahifalash — server `next`/`previous` ga qarab (page_size'ga bog'liq emas) */}
        {(hasPrev || hasNext) && (
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 26,
          }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!hasPrev}
              style={pageBtn(!hasPrev)}
            >← {t.moviesPagePrev}</button>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>
              {t.moviesPageLabel} {page}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNext}
              style={pageBtn(!hasNext)}
            >{t.moviesPageNext} →</button>
          </div>
        )}
      </div>
    </>
  )
}

function pageBtn(disabled: boolean): CSSProperties {
  return {
    padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border)',
    background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 14,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    fontFamily: 'inherit',
  }
}
