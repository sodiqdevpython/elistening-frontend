import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchMyVocab } from '@/api/endpoints'
import { Spinner } from '@/components/ui'
import { useAuth } from '@/store/auth'
import { useLang, useT } from '@/i18n'
import { fill } from '@/utils/format'

/**
 * "Mening lug'atim" — diktant oxirida "bilmayman" deb bosilgan so'zlar.
 *
 * Hozircha FAQAT ko'rish: so'z, u turgan gap (so'z ajratilgan), qaysi darsdan
 * va qachon. Qo'shish/olib tashlash diktant sahifasida
 * (`features/lessons/LessonReview.tsx`). Manba: `GET /api/me/vocab/`.
 */
const PREVIEW = 30

export default function VocabCard() {
  const t = useT()
  const { lang } = useLang()
  const { user } = useAuth()
  const [all, setAll] = useState(false)
  const vocab = useQuery({ queryKey: ['my-vocab', user?.id ?? 0], queryFn: fetchMyVocab })
  const rows = vocab.data?.results ?? []
  const shown = all ? rows : rows.slice(0, PREVIEW)

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{t.vocabTitle}</div>
        {rows.length > 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {fill(t.vocabCount, { n: vocab.data?.count ?? rows.length })}
          </div>
        )}
      </div>

      {vocab.isLoading && <Spinner />}
      {!vocab.isLoading && rows.length === 0 && (
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t.vocabEmpty}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.map((row) => (
          <div key={row.id} style={{
            border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{row.display}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDate(row.created_at, lang)}</span>
            </div>
            {row.context && (
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <Highlighted text={row.context} word={row.display} />
              </div>
            )}
            {row.dictation && (
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {t.vocabFrom}:{' '}
                <Link to={`/topics/${row.dictation.type_slug}/${row.dictation.slug}`}>{row.dictation.title}</Link>
              </div>
            )}
          </div>
        ))}
      </div>

      {rows.length > PREVIEW && (
        <button type="button" className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setAll((v) => !v)}>
          {all ? t.vocabShowLess : fill(t.vocabShowAll, { n: rows.length })}
        </button>
      )}
    </div>
  )
}

/** Gapda so'zni ajratib ko'rsatadi (registrga befarq, butun so'z bo'yicha). */
function Highlighted({ text, word }: { text: string; word: string }) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(?<![\\p{L}\\p{N}])(${escaped})(?![\\p{L}\\p{N}])`, 'giu'))
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1
        ? <mark key={i} className="tw-mark">{part}</mark>
        : <span key={i}>{part}</span>))}
    </>
  )
}

function formatDate(value: string, lang: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
