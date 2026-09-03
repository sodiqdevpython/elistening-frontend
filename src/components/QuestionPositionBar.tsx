import { useEffect, useMemo, useState } from 'react'

/**
 * Savol pozitsiyalari bari — video davomiyligini yuz foiz deb hisoblab, har
 * savolning `proof_from_text` sekundini nuqta bilan ko'rsatadi. Player ijro
 * etilayotgan joyi joriy savolni yorqin qilib ajratadi.
 *
 * Default YOQIQ (uzun video). Tanlov `localStorage` da saqlanadi — sahifa yoki Short
 * almashsa ham xotirada qoladi. `localStorageKey` orqali har turdagi sahifa
 * o'z tanlovini alohida yoki umumiy tutishi mumkin (Shorts va Dictation
 * o'zaro alohida).
 */
export interface QuestionMark {
  /** UI raqami (1..N). */
  n: number
  /** Turini bildiruvchi belgi: 'MCQ' / 'TFNG' / 'Fill' — rangi shundan. */
  label: string
  /** `[X.Y] ...` ko'rinishidagi proof matni yoki tayyor sekund. */
  proof?: string
  sec?: number
}

interface Props {
  /** Video davomiyligi (soniya). */
  totalSec: number
  /** Barcha savollar ro'yxati. `proof` yoki `sec` bo'lishi kerak. */
  questions: QuestionMark[]
  /** Joriy player vaqtini (soniya) qaytaruvchi funksiya. */
  getCurrentSec: () => number
  /** Har bir sahifa turi uchun alohida kalit — masalan `listening.shorts.qpos`
   *  yoki `listening.test.qpos`. Ikkalasi bir xil kalit ishlatsa, umumiy. */
  localStorageKey: string
  /** Checkbox yorlig'i. */
  label?: string
}

function parseSec(mark: QuestionMark): number {
  if (Number.isFinite(mark.sec)) return mark.sec as number
  const m = (mark.proof || '').match(/\[\s*([0-9]+(?:\.[0-9]+)?)\s*\]/)
  return m ? parseFloat(m[1]) : NaN
}

export default function QuestionPositionBar({
  totalSec, questions, getCurrentSec, localStorageKey,
  label = "Savol pozitsiyalarini ko'rsatish",
}: Props) {
  /**
   * **UZUN videolarda default YOQIQ** (foydalanuvchi talabi: "video larda
   * savol joyi doim yoniq tursin"). Shorts'da esa opt-in bo'lib qoladi —
   * u yerda ekran tor va termometr xalaqit beradi
   * (`QuestionPositionThermometer` o'z default'ini saqlaydi).
   *
   * Foydalanuvchi ataylab o'chirsa (`'0'`) hurmat qilinadi.
   */
  const [enabled, setEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(localStorageKey) !== '0' } catch { return true }
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
    <div>
      <label
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '3px 8px', borderRadius: 999,
          fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
          cursor: 'pointer', userSelect: 'none',
        }}>
        <input type="checkbox" checked={enabled} onChange={toggle}
          style={{ cursor: 'pointer', accentColor: '#2563EB' }} />
        {label}
      </label>
      {enabled && marks.length > 0 && (
        <div style={{
          marginTop: 8, position: 'relative', height: 26,
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 999, padding: '0 10px',
        }}>
          <div style={{
            position: 'absolute', left: 10, top: 12, right: 10, height: 2,
            background: 'var(--border)', borderRadius: 2,
          }} />
          <div style={{
            position: 'absolute', left: 10, top: 12,
            width: `calc((100% - 20px) * ${Math.max(0, Math.min(1, curSec / total))})`,
            height: 2, background: '#10B981', borderRadius: 2,
            transition: 'width .25s linear',
          }} />
          {marks.map((m, i) => {
            const pct = (m.secResolved / total) * 100
            const active = i === activeIdx
            return (
              <span
                key={i}
                title={`${m.label} #${m.n} — ${m.secResolved.toFixed(1)}s`}
                style={{
                  position: 'absolute', top: '50%',
                  left: `calc(10px + (100% - 20px) * ${pct / 100})`,
                  transform: active
                    ? 'translate(-50%, -50%) scale(1.25)'
                    : 'translate(-50%, -50%)',
                  minWidth: 18, height: 18, padding: '0 5px',
                  borderRadius: 999,
                  fontSize: 10.5, fontWeight: 800,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: badgeBg(m.label, active),
                  color: '#FFF',
                  boxShadow: active ? '0 4px 12px rgba(245,158,11,.5)' : '0 2px 4px rgba(0,0,0,.15)',
                  transition: 'transform .15s',
                }}>{m.n}</span>
            )
          })}
        </div>
      )}
    </div>
  )
}
