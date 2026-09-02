import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchContentList } from '@/api/endpoints'
import { PageHeader } from '@/components/Layout'
import { EmptyState, ErrorState, Spinner } from '@/components/ui'
import { useT } from '@/i18n'

const PAGE_SIZE = 12

/** Yangiliklar — dizayn: 16:9 qora "gazeta" kartochkalar, "News" ribbon, "YANGI" badge. */
export default function NewsPage() {
  const t = useT()
  const [page] = useState(1)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['news', page],
    queryFn: () => fetchContentList({
      kind: 'news', page, page_size: PAGE_SIZE, ordering: '-published_at',
    }),
  })

  return (
    <>
      <PageHeader />
      <div className="page" style={{ maxWidth: 1300 }}>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>{t.newsTitle}</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 22 }}>
          {t.newsDesc}
        </div>

        {isLoading && <Spinner />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {data && data.results.length === 0 && <EmptyState text={t.moviesNoResults} />}

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
          gap: '22px 20px',
        }}>
          {data?.results.map((item, i) => {
            const timeAgo = timeAgoLabel(item.published_at)
            const isLatest = i < 2
            return (
              <Link key={item.id} to={`/news/${item.id}`} className="card card-hover"
                style={{ padding: 0, borderRadius: 14, overflow: 'hidden',
                          textDecoration: 'none', color: 'var(--text)' }}>
                <div style={{
                  position: 'relative', aspectRatio: '16/9',
                  background: 'linear-gradient(135deg,#1E293B 0%,#0F172A 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    background:
                      'repeating-linear-gradient(115deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 14px)',
                  }} />
                  <div style={{
                    position: 'absolute', top: 15, left: -36, width: 150,
                    transform: 'rotate(-45deg)', background: 'rgba(15,23,42,.92)',
                    borderTop: '1px solid rgba(255,255,255,.18)',
                    borderBottom: '1px solid rgba(255,255,255,.18)',
                    color: '#FFF', fontSize: 10, fontWeight: 800,
                    letterSpacing: '.06em', textAlign: 'center', padding: '5px 0',
                  }}>{t.newsRibbon}</div>
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: 'rgba(255,255,255,.14)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                      stroke="#FFF" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M4 13V12A8 8 0 0 1 20 12V13" />
                      <rect x="2.5" y="13" width="4" height="6" rx="1.5" />
                      <rect x="17.5" y="13" width="4" height="6" rx="1.5" />
                    </svg>
                  </div>
                  {isLatest && (
                    <span style={{
                      position: 'absolute', left: 10, bottom: 10,
                      fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
                      background: '#34D399', color: '#064E3B',
                      padding: '3px 8px', borderRadius: 6,
                    }}>{t.newsBadge}</span>
                  )}
                  <span style={{
                    position: 'absolute', right: 10, bottom: 10,
                    fontSize: 11, fontWeight: 700, color: '#FFF',
                    background: 'rgba(0,0,0,.5)', borderRadius: 5, padding: '2px 7px',
                  }}>{item.duration_label}</span>
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{
                    fontSize: 14.5, fontWeight: 700, marginBottom: 8,
                    lineHeight: 1.35, minHeight: 38,
                  }}>{item.title}</div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                    fontSize: 12, color: 'var(--text-secondary)',
                  }}>
                    <span>{item.source}</span><span>·</span>
                    <span>{timeAgo}</span><span>·</span>
                    <span style={{
                      fontWeight: 600, background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 6, padding: '2px 6px',
                    }}>{item.cefr_level}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}

function timeAgoLabel(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const diffH = Math.floor((Date.now() - then) / (3600 * 1000))
  if (diffH < 1) return 'hozirgina'
  if (diffH < 24) return `${diffH}s oldin`
  const d = Math.floor(diffH / 24)
  return `${d}k oldin`
}
