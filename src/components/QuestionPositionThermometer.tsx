import { useEffect, useMemo, useState } from 'react'
import { useT } from '@/i18n'

/**
 * Vertikal "termometr" — Shorts rail'iga (like/dislike tugmalari yonida)
 * qo'yiladi. Tepada checkbox: yoqilsa vertikal chiziq chiqadi.
 *   - Chiziq ustidan pastga qarab video davomiyligi yoyiladi
 *   - Har savol tegishli foizga circle bilan chiziladi (MCQ / TFNG / Fill —
 *     har biri o'ziga xos rang)
 *   - Player oldinga siljigan sari chap tomonda yashil chiziq to'ladi
 *   - Joriy savol katta va yorqin rang
 *
 * Sozlama shu localStorage kalitida saqlanadi — bir shorts'da yoqib qo'ysa,
 * boshqalarida ham qoladi.
 */
export interface ThermometerMark {
  n: number
  label: string       // 'MCQ' / 'TFNG' / 'Fill'
  proof?: string      // "[X.Y] ..."
  sec?: number
}

interface Props {
  totalSec: number
  questions: ThermometerMark[]
  getCurrentSec: () => number
  localStorageKey: string
}

/** Kichik SVG icon — vertikal 3 ta ustun (savol pozitsiyalari metaforasi). */
function IconPositions() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden style={{ display: 'block' }}>
      <rect x="4" y="14" width="4" height="7" rx="1.5" fill="currentColor" />
      <rect x="10" y="8" width="4" height="13" rx="1.5" fill="currentColor" />
      <rect x="16" y="4" width="4" height="17" rx="1.5" fill="currentColor" />
    </svg>
  )
}

function parseSec(m: ThermometerMark): number {
  if (Number.isFinite(m.sec)) return m.sec as number
  const mt = (m.proof || '').match(/\[\s*([0-9]+(?:\.[0-9]+)?)\s*\]/)
  return mt ? parseFloat(mt[1]) : NaN
}

export default function QuestionPositionThermometer({
  totalSec, questions, getCurrentSec, localStorageKey,
}: Props) {
  const t = useT()
  const [enabled, setEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(localStorageKey) === '1' } catch { return false }
  })
  const toggle = () => {
    setEnabled((prev) => {
      const next = !prev
      try { localStorage.setItem(localStorageKey, next ? '1' : '0') } catch { /* noop */ }
      return next
    })
  }

  const marks = useMemo(() => (
    questions
      .map((q) => ({ ...q, secResolved: parseSec(q) }))
      .filter((x) => Number.isFinite(x.secResolved))
  ), [questions])

  const [curSec, setCurSec] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    const tick = () => { if (alive) setCurSec(getCurrentSec() || 0) }
    const id = window.setInterval(tick, 400)
    tick()
    return () => { alive = false; window.clearInterval(id) }
  }, [enabled, getCurrentSec])

  const total = Math.max(totalSec || 0, 1)
  let activeIdx = -1
  for (let i = 0; i < marks.length; i++) {
    if (marks[i].secResolved <= curSec + 0.5) activeIdx = i
    else break
  }

  const badgeBg = (label: string, active: boolean) => {
    if (active) return 'linear-gradient(135deg,#F59E0B,#B45309)'
    if (label === 'MCQ') return '#2563EB'
    if (label === 'TFNG') return '#7C3AED'
    return '#F59E0B'   // Fill
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    }}>
      {/* Checkbox — kichik, faqat icon o'lchamda. O'rgatishni endi
          `components/CoachTour.tsx` bajaradi (spotlight o'sha yerda). */}
      <label
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 6px', borderRadius: 999,
          fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
          color: enabled ? '#10B981' : 'var(--text-secondary)',
          background: enabled ? 'rgba(16,185,129,.12)' : 'transparent',
          userSelect: 'none',
          transition: 'background .2s, color .2s',
        }}
        title={t.qposToggleTitle}
      >
        <input type="checkbox" checked={enabled} onChange={toggle}
          style={{ cursor: 'pointer', accentColor: '#10B981', width: 12, height: 12, margin: 0 }} />
        <IconPositions />
      </label>

      {enabled && marks.length > 0 && (
        <div style={{
          position: 'relative', width: 22, height: 200,
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 999,
        }}>
          {/* Playback progress — chapdan pastga to'ladi (rgb yashil) */}
          <div style={{
            position: 'absolute', top: 4, bottom: 4, left: '50%',
            transform: 'translateX(-50%)',
            width: 4, background: 'rgba(148,163,184,.25)', borderRadius: 2,
          }} />
          <div style={{
            position: 'absolute', top: 4, left: '50%',
            transform: 'translateX(-50%)',
            width: 4,
            height: `calc((100% - 8px) * ${Math.max(0, Math.min(1, curSec / total))})`,
            background: 'linear-gradient(180deg,#10B981,#059669)', borderRadius: 2,
            transition: 'height .3s linear',
          }} />
          {marks.map((m, i) => {
            const pct = (m.secResolved / total) * 100
            const active = i === activeIdx
            return (
              <span
                key={i}
                title={`${m.label} #${m.n} — ${m.secResolved.toFixed(1)}s`}
                style={{
                  position: 'absolute', left: '50%',
                  top: `calc(4px + (100% - 8px) * ${pct / 100})`,
                  transform: active
                    ? 'translate(-50%, -50%) scale(1.3)'
                    : 'translate(-50%, -50%)',
                  minWidth: 16, height: 16, padding: '0 3px',
                  borderRadius: 999,
                  fontSize: 9.5, fontWeight: 800,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: badgeBg(m.label, active),
                  color: '#FFF',
                  boxShadow: active ? '0 4px 10px rgba(245,158,11,.55)' : '0 2px 3px rgba(0,0,0,.2)',
                  border: active ? '1.5px solid #FFF' : 'none',
                  transition: 'transform .15s, box-shadow .15s',
                  cursor: 'default',
                }}>{m.n}</span>
            )
          })}
        </div>
      )}
    </div>
  )
}
