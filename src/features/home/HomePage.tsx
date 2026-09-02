import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchHome } from '@/api/endpoints'
import { PageHeader } from '@/components/Layout'
import {
  Badge, CategoryIcon, ErrorState, Spinner, gradient,
} from '@/components/ui'
import { useLang, useT } from '@/i18n'

const MODE_CARDS = [
  // Birinchi kartochka — "Diktant mashqlari" navigatsiya QILMAYDI: pastdagi
  // "Boshqa mavzular" bo'limiga silliq scroll qiladi (`scrollTo`).
  { to: '/topics', scrollTo: 'home-all-topics',
    grad: 'linear-gradient(135deg,#10B981 0%,#059669 100%)', color: '#059669', icon: 'headphone',
    title: 'modePracticeTitle', desc: 'modePracticeDesc', cta: 'modePracticeCta' },
  { to: '/shorts',   grad: 'linear-gradient(135deg,#DB2777 0%,#BE185D 100%)', color: '#DB2777', icon: 'reels',
    title: 'modeShortsTitle', desc: 'modeShortsDesc', cta: 'modeShortsCta' },
  { to: '/cartoons', grad: 'linear-gradient(135deg,#0891B2 0%,#0E7490 100%)', color: '#0891B2', icon: 'smile',
    title: 'modeCartoonsTitle', desc: 'modeCartoonsDesc', cta: 'modeCartoonsCta' },
  { to: '/movies',   grad: 'linear-gradient(135deg,#D97706 0%,#B45309 100%)', color: '#D97706', icon: 'movie',
    title: 'modeMoviesTitle', desc: 'modeMoviesDesc', cta: 'modeMoviesCta' },
  { to: '/ielts-tests', grad: 'linear-gradient(135deg,#2563EB 0%,#7C3AED 100%)', color: '#2563EB', icon: 'target',
    title: 'modeIeltsTitle', desc: 'modeIeltsDesc', cta: 'modeIeltsCta' },
] as const

function ModeIcon({ name }: { name: string }) {
  const c = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none',
              stroke: '#FFFFFF', strokeWidth: 1.8, strokeLinecap: 'round' as const,
              strokeLinejoin: 'round' as const }
  switch (name) {
    case 'target': return <svg {...c}><circle cx="12" cy="12" r="9" /><path d="M12 3V21M3 12H21" /></svg>
    case 'reels':  return <svg {...c}><rect x="4" y="3" width="16" height="18" rx="4" /><path d="M10 9.5L15 12L10 14.5V9.5Z" fill="#FFFFFF" stroke="none" /></svg>
    case 'movie':  return <svg {...c}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9H21M7 5V3M17 5V3" /></svg>
    case 'smile':  return <svg {...c}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5C9.5 8.7 10.2 8 11 8C11.8 8 12.5 8.7 12.5 9.5C12.5 10.3 11.5 10.5 11.5 11.5M11.5 14V14.3" /></svg>
    case 'music':  return <svg {...c}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
    case 'headphone':
    default: return <svg {...c}><path d="M4 13V12A8 8 0 0 1 20 12V13" /><rect x="2.5" y="13" width="4" height="6" rx="1.5" /><rect x="17.5" y="13" width="4" height="6" rx="1.5" /></svg>
  }
}

export default function HomePage() {
  const t = useT()
  const { lang } = useLang()
  const [carouselIdx, setCarouselIdx] = useState(0)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['home'],
    queryFn: fetchHome,
    staleTime: 5 * 60_000,   // mavzular + karusel kamdan-kam o'zgaradi
  })

  useEffect(() => { setCarouselIdx(0) }, [data?.carousel.length])
  const carousel = data?.carousel ?? []
  const currentNews = carousel[carouselIdx]

  // Cheksiz auto-rotate: har 5 s da keyingi yangilikka o'tamiz. Karusel ustiga
  // hover paytida to'xtatamiz — foydalanuvchi o'qib bo'lguncha kutamiz.
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused || carousel.length < 2) return
    const t = window.setInterval(() => {
      setCarouselIdx((i) => (i + 1) % carousel.length)
    }, 5000)
    return () => window.clearInterval(t)
  }, [paused, carousel.length])

  return (
    <>
      <PageHeader />
      <div className="page" style={{ maxWidth: 1280 }}>
        {isLoading && <Spinner />}
        {isError && <ErrorState onRetry={() => refetch()} />}

        {/* 4 rejim kartochkasi */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
          {MODE_CARDS.map((m) => {
            const inner = (
              <>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: m.grad,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16, boxShadow: `0 6px 14px ${m.color}33`,
                }}>
                  <ModeIcon name={m.icon} />
                </div>
                <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>
                  {t[m.title as keyof typeof t]}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)',
                                lineHeight: 1.5, marginBottom: 16 }}>
                  {t[m.desc as keyof typeof t]}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>
                  {t[m.cta as keyof typeof t]} →
                </span>
              </>
            )
            const cardStyle: React.CSSProperties = {
              flex: '1 1 320px', padding: 28, textDecoration: 'none',
              color: 'var(--text)', borderRadius: 16,
            }
            // `scrollTo` bo'lsa — navigatsiya emas, sahifa ichida silliq scroll.
            if ('scrollTo' in m && m.scrollTo) {
              return (
                <button key={m.to} type="button" className="card card-hover"
                  onClick={() => {
                    document.getElementById(m.scrollTo)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  style={{ ...cardStyle, textAlign: 'left', cursor: 'pointer',
                           font: 'inherit', border: 'none', background: 'var(--card-bg)' }}>
                  {inner}
                </button>
              )
            }
            return (
              <Link key={m.to} to={m.to} className="card card-hover" style={cardStyle}>
                {inner}
              </Link>
            )
          })}
        </div>

        {/* Yangiliklar karuseli — oxirgi 5 ta yangilik, YouTube thumbnail
            bilan, har 5 s da avtomatik almashadi (hover'da to'xtaydi). */}
        {currentNews && (
          <Link
            to={`/topics/news/${currentNews.slug || currentNews.id}`}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            style={{
              display: 'block', position: 'relative',
              // Katta va moslashuvchan — mobilda 220px, desktopda ~520px.
              // aspect-ratio bilan doim 16:9 shakl saqlanadi, kesilmaydi.
              aspectRatio: '16/9',
              maxHeight: 'min(560px, 62vh)',
              width: '100%',
              borderRadius: 18,
              overflow: 'hidden', marginBottom: 44, textDecoration: 'none',
              background: 'linear-gradient(135deg,#1E293B 0%,#0F172A 100%)',
              boxShadow: '0 20px 50px rgba(15,23,42,.22)',
            }}
          >
            {/* Thumbnail — YouTube maxres, xato bo'lsa hq ga tushadi */}
            {currentNews.youtube_id && (
              <HomeThumbnail
                youtubeId={currentNews.youtube_id}
                title={currentNews.title}
              />
            )}

            <div style={{
              position: 'absolute', top: 22, left: -40, width: 160, transform: 'rotate(-45deg)',
              background: 'rgba(15,23,42,.92)', color: '#FFF', fontSize: 11, fontWeight: 800,
              letterSpacing: '.06em', textAlign: 'center', padding: '5px 0', zIndex: 2,
            }}>{t.newsRibbon}</div>
            <div style={{
              position: 'absolute', inset: 0, background:
                'linear-gradient(180deg, rgba(15,23,42,0.05) 0%, rgba(15,23,42,0.4) 55%, rgba(15,23,42,0.92) 100%)',
            }} />
            {carousel.length > 1 && (
              <>
                <button onClick={(e) => { e.preventDefault(); setCarouselIdx((i) => (i - 1 + carousel.length) % carousel.length) }}
                  style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'rgba(255,255,255,.2)', backdropFilter: 'blur(6px)',
                    border: '1px solid rgba(255,255,255,.25)', cursor: 'pointer', color: '#FFF', fontSize: 18,
                    zIndex: 3,
                  }}>‹</button>
                <button onClick={(e) => { e.preventDefault(); setCarouselIdx((i) => (i + 1) % carousel.length) }}
                  style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'rgba(255,255,255,.2)', backdropFilter: 'blur(6px)',
                    border: '1px solid rgba(255,255,255,.25)', cursor: 'pointer', color: '#FFF', fontSize: 18,
                    zIndex: 3,
                  }}>›</button>
                {/* Progress dots — hozirgi indeks yashil */}
                <div style={{
                  position: 'absolute', top: 14, right: 16, display: 'flex', gap: 5, zIndex: 3,
                }}>
                  {carousel.map((_, i) => (
                    <span key={i} style={{
                      width: i === carouselIdx ? 20 : 6, height: 6, borderRadius: 999,
                      background: i === carouselIdx ? '#10B981' : 'rgba(255,255,255,.45)',
                      transition: 'width .3s',
                    }} />
                  ))}
                </div>
              </>
            )}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '22px 28px', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
                  background: 'rgba(255,255,255,.14)', color: '#FFF', padding: '3px 9px', borderRadius: 8,
                }}>● {t.newsBadge}</span>
                <span style={{ fontSize: 12, color: '#CBD5E1' }}>
                  {currentNews.source} · {currentNews.duration_label}
                </span>
                {currentNews.cefr_level && (
                  <span style={{
                    fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                    background: 'rgba(16,185,129,.85)', color: '#FFF',
                  }}>{currentNews.cefr_level}</span>
                )}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#FFF', marginBottom: 6, maxWidth: 720,
                             display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                             overflow: 'hidden' }}>
                {currentNews.title}
              </div>
            </div>
          </Link>
        )}

        {/* Boshqa mavzular — birinchi rejim kartochkasi shu yerga scroll qiladi.
            `scroll-margin-top` sticky navbar ostida qolib ketmasligi uchun. */}
        <div id="home-all-topics" style={{
          fontSize: 22, fontWeight: 800, marginBottom: 20, scrollMarginTop: 80,
        }}>{t.allTopicsTitle}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 16 }}>
          {data?.categories.map((c) => (
            <Link key={c.id} to={`/topics/${c.slug}`} className="card card-hover"
              style={{
                padding: 20, textDecoration: 'none', color: 'var(--text)', borderRadius: 14,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              marginBottom: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', background: gradient(c.color),
                }}>
                  <CategoryIcon name={c.icon} />
                </div>
                {c.has_video && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
                    background: '#0F172A', color: '#FFF', padding: '3px 8px', borderRadius: 8,
                  }}>{t.videoBadge}</span>
                )}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                {lang === 'uz' ? c.name_uz : c.name_en}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Badge>{c.levels}</Badge>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {c.lessons_count} {t.lessonsUnit}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}

/** Karusel foni uchun YouTube thumbnail — YouTube uslubidagi ikki qavatli:
 *  - Orqa qavat: xuddi shu rasm blur+cover bilan (bo'shliqni to'ldiradi)
 *  - Old qavat: rasm to'liq (contain) — kesilmaydi, hammasi ko'rinadi
 *  Manba: `i.ytimg.com/vi_webp/<id>/maxresdefault.webp` (foydalanuvchi so'ragan
 *  aynan shu URL formati), xato bo'lsa `hqdefault.jpg` ga tushadi. */
function HomeThumbnail({ youtubeId, title }: { youtubeId: string; title: string }) {
  const [broken, setBroken] = useState(false)
  const [triedHq, setTriedHq] = useState(false)
  if (!youtubeId || broken) return null
  const src = triedHq
    ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
    : `https://i.ytimg.com/vi_webp/${youtubeId}/maxresdefault.webp`
  const onError = () => triedHq ? setBroken(true) : setTriedHq(true)
  return (
    <>
      {/* Orqa qavat — blur cover, bo'shliqlarni to'ldiradi (YT-style) */}
      <img
        src={src} alt="" aria-hidden loading="lazy" decoding="async"
        onError={onError}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', display: 'block',
          filter: 'blur(28px) brightness(0.7)',
          transform: 'scale(1.15)',   // blur chekkalari ko'rinmasin
        }}
      />
      {/* Old qavat — to'liq rasm, kesilmaydi */}
      <img
        src={src} alt={title} loading="lazy" decoding="async"
        onError={onError}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'contain', display: 'block',
        }}
      />
    </>
  )
}
