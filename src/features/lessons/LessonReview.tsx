import { useCallback, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { addVocabWord, fetchMyVocabWords, removeVocabWord } from '@/api/endpoints'
import { useAuth } from '@/store/auth'
import { useT } from '@/i18n'
import { fill } from '@/utils/format'

/**
 * Diktant matni — har so'z bosiladi va shaxsiy lug'atga qo'shiladi/olib
 * tashlanadi ("bilmayman"). Birinchi urinishda xato yozilgan so'zlar qizil.
 *
 * So'z indekslari `text.trim().split(/\s+/)` bo'yicha — `utils/grade.ts` ham
 * aynan shunday bo'ladi, shu bois `mistakes` (gap → so'z indekslari) bir xil
 * so'zlarga tushadi. Lug'at kaliti serverdagi bilan bir xil tozalanadi
 * (`backend/apps/catalog/vocab.py::clean_word`): chetdagi tinish belgilari
 * olib tashlanadi, raqam lug'atga kirmaydi.
 */

const EDGES = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu
const LETTER = /\p{L}/u

export function cleanWord(raw: string): string {
  return raw.replace(/[‘’]/g, "'").replace(EDGES, '')
}

/** Lug'at kaliti — so'z bo'lmasa (raqam, tire) bo'sh. */
export function vocabKey(raw: string): string {
  const word = cleanWord(raw)
  return LETTER.test(word) ? word.toLowerCase() : ''
}

export const splitWords = (text: string) => text.trim().split(/\s+/).filter(Boolean)

interface Chunk { text: string }

/** Lug'at holati + bosish (optimistik). Kirmagan bo'lsa `onNeedAuth`. */
function useVocabToggle(slug: string, onNeedAuth?: () => void) {
  const { isLoggedIn, user } = useAuth()
  const qc = useQueryClient()
  const key = useMemo(() => ['vocab-words', user?.id ?? 0] as const, [user?.id])
  const { data: saved = {} } = useQuery({
    queryKey: key, queryFn: fetchMyVocabWords, enabled: isLoggedIn, staleTime: 60_000,
  })
  const busy = useRef(new Set<string>())
  const [error, setError] = useState('')

  const toggle = useCallback(async (raw: string, context: string) => {
    if (!isLoggedIn) { onNeedAuth?.(); return }
    const word = vocabKey(raw)
    if (!word || busy.current.has(word)) return
    busy.current.add(word)
    setError('')
    const current = qc.getQueryData<Record<string, number>>(key) ?? {}
    const id = current[word]
    try {
      if (id != null) {
        const { [word]: _removed, ...rest } = current
        qc.setQueryData(key, rest)
        if (id > 0) await removeVocabWord(id)
      } else {
        qc.setQueryData(key, { ...current, [word]: -1 })
        const item = await addVocabWord({ word: cleanWord(raw), context, dictation: slug })
        qc.setQueryData<Record<string, number>>(key, (m) => ({ ...(m ?? {}), [word]: item.id }))
      }
      void qc.invalidateQueries({ queryKey: ['my-vocab'] })
    } catch (e) {
      qc.setQueryData(key, current)  // xato — oldingi holat
      const code = (e as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code
      setError(code ?? 'error')
    } finally {
      busy.current.delete(word)
    }
  }, [isLoggedIn, onNeedAuth, qc, key, slug])

  return { saved, toggle, error }
}

function Word({ raw, wrong, saved, onToggle }: {
  raw: string; wrong: boolean; saved: boolean; onToggle?: () => void
}) {
  const t = useT()
  const cls = `${wrong ? ' is-wrong' : ''}${saved ? ' is-saved' : ''}`
  if (!onToggle) return <span className={`tw-plain${cls}`}>{raw}</span>
  return (
    <button type="button" className={`tw-word${cls}`} onClick={onToggle} aria-pressed={saved}
      title={saved ? t.vocabRemoveTitle : t.vocabAddTitle}>
      {raw}
    </button>
  )
}

/** To'liq matn: xatolar qizil, istalgan so'z lug'atga. */
export function TranscriptWords({ chunks, slug, mistakes = {}, skipped, onNeedAuth, showHint = true }: {
  chunks: Chunk[]
  slug: string
  mistakes?: Record<number, number[]>
  /** O'tkazib yuborilgan gaplar — yonida yorliq. */
  skipped?: Set<number>
  onNeedAuth?: () => void
  showHint?: boolean
}) {
  const t = useT()
  const { saved, toggle, error } = useVocabToggle(slug, onNeedAuth)
  return (
    <div>
      {showHint && (
        <div className="tw-hint">
          <span>{t.reviewHint}</span>
          <span className="tw-legend">
            <span className="tw-plain is-wrong">{t.reviewLegendWrong}</span>
            <span className="tw-plain is-saved">{t.reviewLegendSaved}</span>
          </span>
        </div>
      )}
      {error && <div className="tw-error">{error === 'vocab_full' ? t.vocabFull : t.vocabError}</div>}
      <div className="tw-text">
        {chunks.map((chunk, ci) => {
          const wrong = new Set(mistakes[ci] ?? [])
          return (
            <p key={ci} className={skipped?.has(ci) ? 'tw-skipped' : undefined}>
              {splitWords(chunk.text).map((raw, wi) => {
                const word = vocabKey(raw)
                return (
                  <span key={wi}>
                    <Word raw={raw} wrong={wrong.has(wi)} saved={!!word && word in saved}
                      onToggle={word ? () => void toggle(raw, chunk.text) : undefined} />{' '}
                  </span>
                )
              })}
              {skipped?.has(ci) && <span className="tw-tag">{t.reviewSkippedTag}</span>}
            </p>
          )
        })}
      </div>
    </div>
  )
}

/** Xato yozilgan so'zlar — bir joyda, takrorsiz; bular ham bosiladi. */
export function MistakesList({ chunks, slug, mistakes, onNeedAuth }: {
  chunks: Chunk[]
  slug: string
  mistakes: Record<number, number[]>
  onNeedAuth?: () => void
}) {
  const t = useT()
  const { saved, toggle } = useVocabToggle(slug, onNeedAuth)
  const items = useMemo(() => {
    const seen = new Set<string>()
    const out: { raw: string; key: string; context: string }[] = []
    Object.keys(mistakes).map(Number).sort((a, b) => a - b).forEach((ci) => {
      const chunk = chunks[ci]
      if (!chunk) return
      const words = splitWords(chunk.text)
      for (const wi of mistakes[ci] ?? []) {
        const raw = words[wi]
        if (!raw) continue
        const shown = cleanWord(raw) || raw
        const dedupe = shown.toLowerCase()
        if (seen.has(dedupe)) continue
        seen.add(dedupe)
        out.push({ raw: shown, key: vocabKey(raw), context: chunk.text })
      }
    })
    return out
  }, [chunks, mistakes])

  if (!items.length) return <div className="tw-none">{t.reviewNoMistakes}</div>
  return (
    <div>
      <div className="tw-subtitle">{fill(t.reviewMistakesTitle, { n: items.length })}</div>
      <div className="tw-chips">
        {items.map((it) => (
          <Word key={it.raw} raw={it.raw} wrong saved={!!it.key && it.key in saved}
            onToggle={it.key ? () => void toggle(it.raw, it.context) : undefined} />
        ))}
      </div>
    </div>
  )
}
