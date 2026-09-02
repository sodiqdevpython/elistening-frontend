import { useEffect, useState } from 'react'
import type { ShortReportReason } from '@/api/endpoints'

/**
 * Shikoyat va "savol xato tuzilgan" modallari — **Shorts va Diktant test
 * sahifasi uchun umumiy**.
 *
 * Komponentlar API funksiyalarini prop orqali oladi (`loadReasons`, `submit`),
 * shu bois bir xil UI ikkala endpoint to'plami bilan ham ishlaydi:
 *   - Shorts:   `/shorts/{id}/report/`, `/shorts/{id}/question-feedback/`
 *   - Diktant:  `/dictations/{slug}/report/`, `/dictations/{slug}/question-feedback/`
 */

export function ModalShell({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: 16,
      }}
    >
      <div style={{
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 20, width: '100%', maxWidth: 460,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 60px rgba(0,0,0,.45)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h3>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            aria-label="Yopish"
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              cursor: 'pointer', fontSize: 15, fontWeight: 800,
              color: 'var(--text-secondary)',
            }}
          >×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Server javobidan foydalanuvchiga ko'rsatiladigan matn chiqaradi.
 *  409 (allaqachon yuborilgan) — xato emas, "yuborilgan" deb hisoblanadi. */
function describeError(e: unknown): { alreadySent: boolean; message: string } {
  const err = e as { response?: { status?: number; data?: { detail?: string } } }
  const status = err?.response?.status
  if (status === 409) return { alreadySent: true, message: '' }
  if (status === 401) return { alreadySent: false, message: 'Yuborish uchun kirish kerak.' }
  return {
    alreadySent: false,
    message: err?.response?.data?.detail || "Yubora olmadik. Qaytadan urinib ko'ring.",
  }
}

export function ReportModal({ loadReasons, submit, onClose, onSubmitted }: {
  loadReasons: () => Promise<ShortReportReason[]>
  submit: (payload: { reason: string; text?: string }) => Promise<unknown>
  onClose: () => void
  onSubmitted: () => void
}) {
  const [reasons, setReasons] = useState<ShortReportReason[]>([])
  const [chosen, setChosen] = useState<string>('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    loadReasons()
      .then((r) => { if (!cancelled) setReasons(r) })
      .catch(() => { if (!cancelled) setError("Sabablarni yuklab bo'lmadi.") })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = async () => {
    if (!chosen) { setError('Iltimos, sabab tanlang.'); return }
    setBusy(true); setError('')
    try {
      await submit({ reason: chosen, text: text.trim() || undefined })
      onSubmitted()
    } catch (e: unknown) {
      const { alreadySent, message } = describeError(e)
      if (alreadySent) onSubmitted()
      else setError(message)
    } finally { setBusy(false) }
  }

  return (
    <ModalShell title="Shikoyat yuborish" onClose={onClose}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Ushbu video haqida sababni tanlang. Ma&apos;muriyat ko&apos;rib chiqadi.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {reasons.map((r) => {
          const active = chosen === r.key
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setChosen(r.key)}
              disabled={busy}
              style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 10,
                cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
                background: active ? 'var(--ok-bg)' : 'var(--bg-secondary)',
                color: active ? 'var(--ok-text)' : 'var(--text)',
                border: `1.5px solid ${active ? '#10B981' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <span aria-hidden style={{
                width: 16, height: 16, borderRadius: '50%',
                border: `2px solid ${active ? '#10B981' : 'var(--border)'}`,
                background: active ? '#10B981' : 'transparent',
                flexShrink: 0,
              }} />
              {r.label}
            </button>
          )
        })}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
        placeholder="Ixtiyoriy — qo'shimcha izoh yozing (masalan: aniq daqiqa, kontekst)…"
        rows={3}
        style={{
          width: '100%', border: '1px solid var(--border)', borderRadius: 10,
          padding: '10px 12px', fontSize: 13, resize: 'vertical',
          background: 'var(--bg-secondary)', color: 'var(--text)',
          fontFamily: 'inherit',
        }}
      />
      {error && <ErrorLine text={error} />}
      <ModalActions busy={busy} onClose={onClose} onSubmit={send} submitLabel="Yuborish" />
    </ModalShell>
  )
}

export function QuestionFeedbackModal({ submit, onClose, onSubmitted }: {
  submit: (text: string) => Promise<unknown>
  onClose: () => void
  onSubmitted: () => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    if (text.trim().length < 3) { setError('Iltimos, batafsilroq yozing.'); return }
    setBusy(true); setError('')
    try {
      await submit(text.trim())
      onSubmitted()
    } catch (e: unknown) {
      const { alreadySent, message } = describeError(e)
      if (alreadySent) onSubmitted()
      else setError(message)
    } finally { setBusy(false) }
  }

  return (
    <ModalShell title="Savol xato tuzilgan" onClose={onClose}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Qaysi savol qanday xato deb hisoblaysiz? Ma&apos;muriyat AI natijasini
        qayta ko&apos;rib chiqadi.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
        placeholder='Masalan: "1-savol xato tuzilgan, to‘g‘ri javob True bo‘ladi"'
        rows={5}
        autoFocus
        style={{
          width: '100%', border: '1px solid var(--border)', borderRadius: 10,
          padding: '10px 12px', fontSize: 13.5, resize: 'vertical',
          background: 'var(--bg-secondary)', color: 'var(--text)',
          fontFamily: 'inherit', minHeight: 100,
        }}
      />
      {error && <ErrorLine text={error} />}
      <ModalActions busy={busy} onClose={onClose} onSubmit={send} submitLabel="Yuborish" />
    </ModalShell>
  )
}

function ErrorLine({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 12, color: '#B91C1C', padding: '8px 10px',
      background: 'rgba(239,68,68,.1)', borderRadius: 8,
    }}>{text}</div>
  )
}

function ModalActions({ busy, onClose, onSubmit, submitLabel }: {
  busy: boolean
  onClose: () => void
  onSubmit: () => void
  submitLabel: string
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button
        onClick={onClose} disabled={busy}
        className="btn btn-ghost"
        style={{ borderRadius: 10, fontWeight: 700, flex: '1 1 100px' }}
      >Bekor qilish</button>
      <button
        onClick={onSubmit} disabled={busy}
        className="btn btn-primary"
        style={{ borderRadius: 10, fontWeight: 800, flex: '1 1 140px' }}
      >{busy ? 'Yuborilmoqda…' : submitLabel}</button>
    </div>
  )
}
