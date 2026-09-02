import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchCategories } from '@/api/endpoints'
import { PageHeader } from '@/components/Layout'
import {
  Badge, CategoryIcon, EmptyState, ErrorState, SearchField, SectionTitle, Spinner, gradient,
} from '@/components/ui'
import { useLang, useT } from '@/i18n'

/** "Barcha mavzular" — diktant mashqlari faqat shu bo'limda. */
export default function TopicsPage() {
  const t = useT()
  const { lang } = useLang()
  const [search, setSearch] = useState('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,   // mavzular ro'yxati kamdan-kam o'zgaradi
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data ?? []
    return (data ?? []).filter((c) =>
      c.name_uz.toLowerCase().includes(q) || c.name_en.toLowerCase().includes(q),
    )
  }, [data, search])

  return (
    <>
      <PageHeader />
      <div className="page" style={{ maxWidth: 1280 }}>
        <SectionTitle sub={t.dictationOnlyNote}>{t.allTopicsTitle}</SectionTitle>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <SearchField value={search} onChange={setSearch} placeholder={t.searchPlaceholder} />
        </div>

        {isLoading && <Spinner />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {data && filtered.length === 0 && <EmptyState text={t.moviesNoResults} />}

        <div className="grid-auto">
          {filtered.map((c) => (
            <Link key={c.id} to={`/topics/${c.slug}`} className="card card-hover"
              style={{ padding: 20, textDecoration: 'none', color: 'var(--text)', borderRadius: 14 }}>
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
