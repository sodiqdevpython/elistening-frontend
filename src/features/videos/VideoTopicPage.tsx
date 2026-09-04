import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchShorts } from '@/api/endpoints'
import type { Short, ShortContentType } from '@/api/types'
import { PageHeader } from '@/components/Layout'
import {
  Badge, EmptyState, ErrorState, LevelSelect, SearchField, Spinner,
} from '@/components/ui'
import { useT } from '@/i18n'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const PAGE_SIZE = 24

/**
 * Filmlar / Multfilmlar — GRID ro'yxat (diktant /topics/news bilan bir xil
 * shablon): qidiruv + daraja filtri + infinite scroll pagination. Kontent
 * `Short` modelidan (content_type=movie|cartoon). Kartochka bosilganda o'sha
 * video vertikal feed'da ochiladi (`/movies/:id`).
 *
 * Ilgari /movies va /cartoons to'g'ridan-to'g'ri vertikal feed (ShortsPage)
 * edi — bu /topics/news bilan mos emasdi. Endi ikkalasi bir xil grid.
 */
export default function VideoTopicPage() {
  const t = useT()
  const location = useLocation()

  // Route → content_type + sarlavha + feed havolasi.
  const { contentType, title, routeBase } = useMemo(() => {
    const p = location.pathname
    if (p.startsWith('/cartoons')) {
      return { contentType: 'cartoon' as ShortContentType, title: t.tabCartoons, routeBase: '/cartoons' }
    }
    return { contentType: 'movie' as ShortContentType, title: t.tabMovies, routeBase: '/movies' }
  }, [location.pathname, t.tabCartoons, t.tabMovies])

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState('all')

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => window.clearTimeout(id)
  }, [searchInput])

  const infinite = useInfiniteQuery({
    queryKey: ['video-topic', contentType, search, level],
    queryFn: ({ pageParam }) => fetchShorts({
      content_type: contentType, search, level,
      page: pageParam, page_size: PAGE_SIZE,
      // random=0 (default) → eng yangisi birinchi.
    }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.next ? last.page + 1 : undefined),
  })

  const items = infinite.data?.pages.flatMap((p) => p.results) ?? []
  const total = infinite.data?.pages[0]?.count ?? 0

  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !infinite.hasNextPage || infinite.isFetchingNextPage) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) infinite.fetchNextPage()
    }, { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [infinite.hasNextPage, infinite.isFetchingNextPage, infinite.fetchNextPage, items.length])

  return (
    <>
      <PageHeader />
      <div className="page" style={{ maxWidth: 1440 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0', flexWrap: 'wrap',
        }}>
          <h1 style={{ fontSize: 'clamp(20px,3vw,26px)', fontWeight: 800, margin: 0 }}>{title}</h1>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 22 }}>
          {infinite.isLoading ? '…' : `${total} ${t.lessonsUnit}`}
        </div>

        <div style={{
          position: 'sticky', top: 56, zIndex: 40, background: 'var(--bg)',
          padding: '8px 0 12px', marginBottom: 16,
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <SearchField value={searchInput} onChange={setSearchInput} placeholder={t.searchPlaceholder} />
          <LevelSelect value={level} onChange={setLevel} options={LEVELS} />
        </div>

        {infinite.isError && <ErrorState onRetry={() => infinite.refetch()} />}
        {infinite.isLoading && <Spinner />}

        {!infinite.isLoading && items.length === 0 && (
          <EmptyState text={t.moviesNoResults} />
        )}

        {items.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))',
            gap: 'clamp(16px, 2vw, 24px) clamp(12px, 1.5vw, 20px)',
          }}>
            {items.map((s) => <VideoCard key={s.id} short={s} routeBase={routeBase} />)}
          </div>
        )}

        <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />
        {infinite.isFetchingNextPage && (
          <div style={{ padding: '24px 0', textAlign: 'center' }}><Spinner /></div>
        )}
        {!infinite.hasNextPage && items.length > 0 && !infinite.isFetchingNextPage && (
          <div style={{
            padding: '24px 0', textAlign: 'center',
            fontSize: 12, color: 'var(--text-secondary)',
          }}>{t.listEnd}</div>
        )}
      </div>
    </>
  )
}

function durationLabel(sec: number): string {
  const s = Math.max(0, Math.round(sec || 0))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function VideoCard({ short, routeBase }: { short: Short; routeBase: string }) {
  const t = useT()
  const level = short.cefr_from && short.cefr_to
    ? (short.cefr_from === short.cefr_to ? short.cefr_from : `${short.cefr_from}–${short.cefr_to}`)
    : (short.cefr_from || short.cefr_to || '')
  return (
    // KENG (16:9) video — Shorts lentasi emas, oddiy VIDEO sahifasi.
    // Ilgari hamma kartochka vertikal feed'ga (`/movies/:id`) olib borardi
    // va uzun film tik shablonda ochilib, "na video na shorts" bo'lardi.
    <Link to={short.is_vertical === false ? `/dictations/${short.id}` : `${routeBase}/${short.id}`} className="yt-card"
      style={{
        textDecoration: 'none', color: 'var(--text)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
      <VideoThumb youtubeId={short.youtube_id} title={short.title}
        durationLabel={durationLabel(short.duration_sec)} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 2px' }}>
        <div style={{
          fontSize: 14.5, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, minWidth: 0,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {short.title || 'Video'}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5,
          color: 'var(--text-secondary)', flexWrap: 'wrap',
        }}>
          {level && <Badge>{level}</Badge>}
          {typeof short.views === 'number' && <span>{short.views} {t.videoViewsUnit}</span>}
        </div>
      </div>
    </Link>
  )
}

function VideoThumb({ youtubeId, title, durationLabel }: {
  youtubeId: string
  title: string
  durationLabel: string
}) {
  const [broken, setBroken] = useState(false)
  const [triedHq, setTriedHq] = useState(false)
  const hasImg = Boolean(youtubeId) && !broken
  const src = triedHq
    ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
    : `https://i.ytimg.com/vi_webp/${youtubeId}/maxresdefault.webp`
  return (
    <div style={{
      aspectRatio: '16/9', width: '100%', borderRadius: 14,
      overflow: 'hidden', position: 'relative',
      background: hasImg ? '#0F172A' : 'linear-gradient(135deg,#DB2777 0%,#BE185D 100%)',
    }}>
      {hasImg ? (
        <img src={src} alt={title} loading="lazy" decoding="async"
          onError={() => triedHq ? setBroken(true) : setTriedHq(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div aria-hidden style={{
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: '#FFF', opacity: .7,
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round">
            <rect x="3" y="6" width="18" height="12" rx="2" />
            <path d="M9 10l6 2-6 2v-4z" fill="currentColor" stroke="none" />
          </svg>
        </div>
      )}
      {durationLabel && durationLabel !== '0:00' && (
        <span aria-hidden style={{
          position: 'absolute', right: 8, bottom: 8, padding: '2px 6px', borderRadius: 4,
          background: 'rgba(0,0,0,.8)', color: '#FFF', fontSize: 12, fontWeight: 700, lineHeight: 1.2,
        }}>{durationLabel}</span>
      )}
    </div>
  )
}
