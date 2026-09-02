import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchContentDetail } from '@/api/endpoints'
import { PageHeader } from '@/components/Layout'
import { Badge, ErrorState, Spinner } from '@/components/ui'
import YouTubePlayer from '@/components/YouTubePlayer'
import ExerciseRunner from '@/components/ExerciseRunner'
import { useT } from '@/i18n'

export default function MovieDetailPage() {
  const t = useT()
  const { id = '' } = useParams()
  const [mode, setMode] = useState<'question' | 'match'>('question')
  const [questionIndex, setQuestionIndex] = useState(0)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['content', id],
    queryFn: () => fetchContentDetail(id),
    enabled: Boolean(id),
  })

  if (isLoading) return <><PageHeader /><Spinner /></>
  if (isError || !data) return <><PageHeader /><ErrorState onRetry={() => refetch()} /></>

  const questions = data.exercises.filter((e) =>
    mode === 'match' ? e.type === 'match_word' : e.type !== 'match_word'
  )
  const current = questions[questionIndex]

  return (
    <>
      <PageHeader />
      <div className="page" style={{ maxWidth: 900 }}>
        <Link to="/movies" style={{ fontSize: 13, fontWeight: 600 }}>‹ {t.moviesBreadcrumb}</Link>

        <div style={{ margin: '10px 0 4px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 'clamp(20px,3vw,26px)', fontWeight: 800, margin: 0 }}>{data.title}</h1>
          <Badge>{data.cefr_level}</Badge>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          {t.movieSegmentsDesc}
        </div>

        {data.youtube_id && <YouTubePlayer youtubeId={data.youtube_id} />}

        <div style={{ display: 'flex', gap: 6, margin: '20px 0', flexWrap: 'wrap' }}>
          {[
            { value: 'question', label: t.shortsModeQuestion },
            { value: 'match', label: t.shortsModeMatch },
          ].map((o) => (
            <button key={o.value} onClick={() => { setMode(o.value as 'question' | 'match'); setQuestionIndex(0) }}
              className={mode === o.value ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ fontSize: 13, padding: '8px 14px' }}>{o.label}</button>
          ))}
          {questions.length > 0 && (
            <span style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {t.shortsModeQuestion} {questionIndex + 1}/{questions.length}
            </span>
          )}
        </div>

        {current ? (
          <ExerciseRunner exercise={current}
            onDone={() => setQuestionIndex((i) => Math.min(i + 1, questions.length - 1))} />
        ) : (
          <div className="card" style={{ padding: 24, color: 'var(--text-secondary)' }}>
            {t.empty}
          </div>
        )}
      </div>
    </>
  )
}
