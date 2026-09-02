import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchContentList } from '@/api/endpoints'
import type { ContentItem } from '@/api/types'
import { PageHeader } from '@/components/Layout'
import { ErrorState, Spinner } from '@/components/ui'
import { useT } from '@/i18n'

/** Filmlar/Multfilmlar — dizayn: pill filter + 16:9 kartochka + sahifalash. */
export default function MoviesPage() {
  const t = useT()
  const location = useLocation()
  const cartoonsOnly = location.pathname.startsWith('/cartoons')
  const [filter, setFilter] = useState<'all' | 'cartoon'>(cartoonsOnly ? 'cartoon' : 'all')
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState('all')
  const [page, setPage] = useState(1)

  const debounced = useMemo(() => search.trim(), [search])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['movies', filter, debounced, level, page],
    queryFn: () => fetchContentList({
      kind_in: filter === 'cartoon' ? 'cartoon' : 'movie,cartoon',
      search: debounced, level, page, page_size: 12,
    }),
  })

  const title = cartoonsOnly ? t.modeCartoonsTitle : t.modeMoviesTitle

  return (
    <>
      <PageHeader />
      <div className="page" style={{ maxWidth: 1280 }}>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
          {t.moviesSectionDesc}
        </div>

        {/* Pill filter: Barchasi / Multfilmlar */}
        {!cartoonsOnly && (
          <div style={{
            display: 'inline-flex', gap: 4, background: 'var(--bg-secondary)',
            borderRadius: 10, padding: 5, marginBottom: 20,
          }}>
            {[
              { v: 'all', label: t.moviesFilterAll },
              { v: 'cartoon', label: t.tabCartoons },
            ].map((o) => (
              <button key={o.v} onClick={() => { setFilter(o.v as 'all' | 'cartoon'); setPage(1) }}
                style={{
                  border: 'none', cursor: 'pointer', borderRadius: 8,
                  padding: '7px 16px', fontSize: 13, fontWeight: 700,
                  background: filter === o.v ? 'var(--card-bg)' : 'transparent',
                  color: filter === o.v ? 'var(--text)' : 'var(--text-secondary)',
                  boxShadow: filter === o.v ? '0 2px 6px rgba(0,0,0,.06)' : 'none',
                }}>{o.label}</button>
            ))}
          </div>
        )}

        {/* Qidiruv + daraja */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <div style={{
            flex: '1 1 260px', display: 'flex', alignItems: 'center', gap: 8,
            border: '1px solid var(--border)', borderRadius: 10, padding: '9px 14px',
            background: 'var(--card-bg)', maxWidth: 360,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="M21 21L16.5 16.5" />
            </svg>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder={t.moviesSearchPlaceholder}
              style={{ border: 'none', background: 'transparent', outline: 'none',
                        fontSize: 14, width: '100%', color: 'var(--text)' }} />
          </div>
          <select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1) }}
            style={{
              border: '1px solid var(--border)', borderRadius: 10, padding: '9px 14px',
              fontSize: 14, color: 'var(--text)', background: 'var(--card-bg)',
            }}>
            <option value="all">{t.allLevelsOption}</option>
            {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {isLoading && <Spinner />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {data && data.results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0',
                          color: 'var(--text-secondary)', fontSize: 14 }}>
            {t.moviesNoResults}
          </div>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
          gap: 20,
        }}>
          {data?.results.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
        </div>
      </div>
    </>
  )
}

export function MovieCard({ movie }: { movie: ContentItem }) {
  const detailBase = movie.kind === 'video' ? '/videos' : '/movies'
  return (
    <Link to={`${detailBase}/${movie.id}`} className="card card-hover"
      style={{ padding: 0, borderRadius: 14, overflow: 'hidden',
                textDecoration: 'none', color: 'var(--text)' }}>
      <div style={{
        position: 'relative', aspectRatio: '16/9', background: movie.thumb_gradient,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {movie.thumbnail_url && (
          <img src={movie.thumbnail_url} alt="" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          }} />
        )}
        <div style={{
          position: 'relative',
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(255,255,255,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24">
            <path d="M9 6.5L18 12L9 17.5V6.5Z" fill="#FFF" />
          </svg>
        </div>
        <span style={{
          position: 'absolute', right: 8, bottom: 8,
          fontSize: 11, fontWeight: 700, color: '#FFF',
          background: 'rgba(0,0,0,.6)', borderRadius: 5, padding: '2px 6px',
        }}>{movie.duration_label}</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, lineHeight: 1.35 }}>
          {movie.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '2px 7px',
          }}>{movie.cefr_level}</span>
          {movie.genre && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{movie.genre}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
