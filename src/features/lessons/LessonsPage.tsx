import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { fetchCategoryGroups, fetchDictations } from '@/api/endpoints'
import type { Dictation } from '@/api/types'
import { PageHeader } from '@/components/Layout'
import {
  Badge, EmptyState, ErrorState, LevelSelect, SearchField, Spinner,
} from '@/components/ui'
import { useLang, useT } from '@/i18n'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const PAGE_SIZE = 24

/** Mavzu ichidagi diktantlar — API pagination + infinite scroll + server-side
 *  search & level filter. Kartochkalar YouTube uslubida (border yo'q, katta
 *  thumbnail). Pastga scroll qilgan sari yangi sahifa avtomatik yuklanadi. */
export default function LessonsPage() {
  const t = useT()
  const { lang } = useLang()
  // Route: /topics/:type — bu yerda `type` category slug (short-stories, news, ...).
  const params = useParams()
  const typeSlug = params.type ?? params.slug ?? ''
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState('all')

  // Search input'ni debounce qilamiz — har harfda API urmaslik uchun.
  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => window.clearTimeout(t)
  }, [searchInput])

  // Yengil so'rov — faqat category sarlavhasi uchun. Ro'yxatning o'zi
  // pastdagi infinite query orqali yuklanadi.
  const { data: header } = useQuery({
    queryKey: ['category-header', typeSlug],
    queryFn: () => fetchCategoryGroups(typeSlug, { light: true }),
    enabled: Boolean(typeSlug),
    staleTime: 60_000,
  })
  const category = header?.category

  // Asosiy ro'yxat — sahifama-sahifa yuklaymiz.
  const infinite = useInfiniteQuery({
    queryKey: ['dictations', typeSlug, search, level],
    queryFn: ({ pageParam }) => fetchDictations({
      type: typeSlug, search, level, page: pageParam, page_size: PAGE_SIZE,
    }),
    initialPageParam: 1,
    getNextPageParam: (last) => last.next ? last.page + 1 : undefined,
    enabled: Boolean(typeSlug),
  })

  const items = infinite.data?.pages.flatMap((p) => p.results) ?? []
  const total = infinite.data?.pages[0]?.count ?? 0

  // Sentinel div — scroll pastga tushganda ko'zga tushsa keyingi sahifani yuklaymiz
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
        <Link to="/topics" style={{ fontSize: 13, fontWeight: 600 }}>‹ {t.breadcrumbAll}</Link>

        {category && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0 4px', flexWrap: 'wrap',
          }}>
            <h1 style={{ fontSize: 'clamp(20px,3vw,26px)', fontWeight: 800, margin: 0 }}>
              {lang === 'uz' ? category.name_uz : category.name_en}
            </h1>
            <Badge>{category.levels}</Badge>
          </div>
        )}
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 22 }}>
          {infinite.isLoading ? '…' : `${total} ${t.lessonsUnit}`}
        </div>

        {/* Filtr paneli — doim ko'rinib turadi (sticky), scroll paytida ham qulay */}
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
            {items.map((d) => <LessonCard key={d.id} lesson={d} typeSlug={typeSlug} />)}
          </div>
        )}

        {/* Infinite scroll sentinel + yuklanmoqda indikatori */}
        <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />
        {infinite.isFetchingNextPage && (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <Spinner />
          </div>
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

function LessonCard({ lesson, typeSlug }: { lesson: Dictation; typeSlug: string }) {
  const t = useT()
  const href = `/topics/${typeSlug}/${lesson.slug}`
  const meta = lesson.chunks_count ? `${lesson.chunks_count} chunk` : lesson.type_label
  return (
    // YouTube uslubidagi kartochka — border yo'q, fon yo'q, faqat thumbnail
    // ostidagi matn. Hover'da thumbnail biroz kattaroq bo'ladi.
    <Link to={href} className="yt-card"
      style={{
        textDecoration: 'none', color: 'var(--text)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
      <Thumbnail
        youtubeId={lesson.youtube_id}
        title={lesson.title}
        durationLabel={lesson.duration_label}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 2px' }}>
        <div style={{
          fontSize: 14.5, fontWeight: 700, color: 'var(--text)',
          lineHeight: 1.35, minWidth: 0,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {lesson.title}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5,
          color: 'var(--text-secondary)', flexWrap: 'wrap',
        }}>
          {lesson.cefr_level && (
            <>
              <span>{t.vocabLevelLabel}: {lesson.cefr_level}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span>{meta}</span>
        </div>
      </div>
    </Link>
  )
}

/** YouTube-uslubidagi thumbnail:
 *  - Katta 16:9 rasm, dumaloq burchak
 *  - O'ng-past burchakda davomiylik (masalan `3:23`) — YouTube kabi
 *  - YouTube ID yo'q bo'lsa audio ikonli placeholder */
function Thumbnail({ youtubeId, title, durationLabel }: {
  youtubeId: string | null
  title: string
  durationLabel: string
}) {
  const [broken, setBroken] = useState(false)
  const [triedHq, setTriedHq] = useState(false)
  const hasImg = youtubeId && !broken
  const src = triedHq
    ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
    : `https://i.ytimg.com/vi_webp/${youtubeId}/maxresdefault.webp`
  return (
    <div style={{
      aspectRatio: '16/9', width: '100%', borderRadius: 14,
      overflow: 'hidden', position: 'relative',
      background: hasImg
        ? '#0F172A'
        : 'linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%)',
    }}>
      {hasImg ? (
        <img
          src={src}
          alt={title}
          loading="lazy"
          decoding="async"
          onError={() => triedHq ? setBroken(true) : setTriedHq(true)}
          style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          }}
        />
      ) : (
        <div aria-hidden style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary)', opacity: .5,
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 13V12A8 8 0 0 1 20 12V13" />
            <rect x="2.5" y="13" width="4" height="6" rx="1.5" />
            <rect x="17.5" y="13" width="4" height="6" rx="1.5" />
          </svg>
        </div>
      )}

      {/* Davomiylik chip — YouTube uslubi */}
      {durationLabel && durationLabel !== '0:00' && (
        <span aria-hidden style={{
          position: 'absolute', right: 8, bottom: 8,
          padding: '2px 6px', borderRadius: 4,
          background: 'rgba(0,0,0,.8)', color: '#FFF',
          fontSize: 12, fontWeight: 700, letterSpacing: '.01em',
          lineHeight: 1.2,
        }}>{durationLabel}</span>
      )}
    </div>
  )
}
