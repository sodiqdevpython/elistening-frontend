import { useState } from 'react'
import type { Exercise } from '@/api/types'
import { submitAttempt } from '@/api/endpoints'
import { useT } from '@/i18n'

interface Props {
  exercise: Exercise
  onDone?: () => void
}

/** 11 mashq turini bitta joyda chizadi va serverga yuboradi (dictation'dan tashqari). */
export default function ExerciseRunner({ exercise, onDone }: Props) {
  const t = useT()
  const [answer, setAnswer] = useState<Record<string, unknown>>({})
  const [feedback, setFeedback] = useState<{ correct: boolean; msg?: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      const r = await submitAttempt(exercise.id, answer)
      setFeedback({ correct: r.is_correct })
      if (r.is_correct) onDone?.()
    } catch {
      setFeedback({ correct: false, msg: 'Xato' })
    } finally { setBusy(false) }
  }

  const p = exercise.payload

  return (
    <div className="card" style={{ padding: 24, borderRadius: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase',
                     letterSpacing: '.04em', marginBottom: 6 }}>
        {exercise.type}
      </div>
      {exercise.title && (
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{exercise.title}</div>
      )}

      {(exercise.type === 'mcq') && p.options && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {p.options.map((opt, i) => (
            <button key={i} onClick={() => setAnswer({ index: i })}
              style={{
                border: `1.5px solid ${answer.index === i ? '#2563EB' : 'var(--border)'}`,
                background: answer.index === i ? '#EFF6FF' : 'var(--card-bg)',
                color: answer.index === i ? '#2563EB' : 'var(--text)',
                borderRadius: 10, padding: '11px 14px', textAlign: 'left',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>{String.fromCharCode(65 + i)}. {opt}</button>
          ))}
        </div>
      )}

      {exercise.type === 'true_false' && (
        <div style={{ display: 'flex', gap: 10 }}>
          {[true, false].map((v) => (
            <button key={String(v)} onClick={() => setAnswer({ value: v })}
              style={{
                flex: 1, border: `1.5px solid ${answer.value === v ? '#10B981' : 'var(--border)'}`,
                background: answer.value === v ? '#ECFDF5' : 'var(--card-bg)',
                color: answer.value === v ? '#059669' : 'var(--text)',
                borderRadius: 10, padding: '11px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>{v ? 'True' : 'False'}</button>
          ))}
        </div>
      )}

      {exercise.type === 'short_answer' && (
        <div>
          {p.question && <div style={{ fontSize: 14, marginBottom: 10 }}>{p.question}</div>}
          <input type="text"
            onChange={(e) => setAnswer({ text: e.target.value })}
            placeholder={p.hint || ''}
            style={{
              width: '100%', border: '1.5px solid var(--border)', borderRadius: 10,
              padding: '10px 14px', fontSize: 14,
            }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button disabled={busy} onClick={submit} className="btn btn-primary" style={{ flex: 1 }}>
          {t.checkBtn}
        </button>
      </div>

      {feedback && (
        <div style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 10,
          background: feedback.correct ? '#ECFDF5' : '#FEF2F2',
          color: feedback.correct ? '#059669' : '#DC2626',
          fontSize: 13, fontWeight: 700,
        }}>
          {feedback.correct ? '✓ ' + t.correctLabel : '⚠ ' + (feedback.msg ?? t.incorrectLabel)}
        </div>
      )}
    </div>
  )
}
