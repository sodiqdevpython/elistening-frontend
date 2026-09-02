import { useEffect } from 'react'

/**
 * Kichik onboarding ipuchi — ekranni to'smaydigan "coach mark".
 *
 * Nima uchun modal emas, shu:
 *   - Ekran o'rtasini egallamaydi, orqa fon qorayimaydi — video ijro davom
 *     etaveradi va foydalanuvchi ishi to'xtamaydi ("sezilar sezilmas").
 *   - Asosiy yuk **vizualda**: har ipuchi kichik chizma bilan keladi, uzun
 *     matn yo'q (1-2 qator).
 *   - Faqat bir marta chiqadi — `utils/onboarding.ts` boshqaradi.
 *
 * Yopilishi: "Tushunarli" tugmasi, `Esc`, yoki tashqariga bosish.
 */
interface Props {
  title: string
  /** 1–2 qatorlik izoh. Uzun yozmang — vizual gapirsin. */
  text: string
  /** Kichik chizma — `HintArtPositions` / `HintArtProof` va h.k. */
  art?: React.ReactNode
  /** Ekranda qayerga qo'yiladi. Default: pastda o'ngda (rail yonida). */
  placement?: 'bottom-right' | 'bottom-center'
  onClose: () => void
}

export default function OnboardingHint({
  title, text, art, placement = 'bottom-right', onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pos: React.CSSProperties = placement === 'bottom-center'
    ? { left: '50%', transform: 'translateX(-50%)', bottom: 24 }
    : { right: 'clamp(12px, 3vw, 28px)', bottom: 'clamp(12px, 4vh, 32px)' }

  return (
    <>
      {/* Ko'rinmas qatlam — tashqariga bosilsa yopiladi. Fon qorayimaydi:
          video ko'rinib turaveradi, ish to'xtamaydi. */}
      <div
        onClick={onClose}
        aria-hidden
        style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'transparent' }}
      />
      <div
        role="dialog"
        aria-label={title}
        className={`onb-hint${placement === 'bottom-center' ? ' onb-hint--center' : ''}`}
        style={{
          position: 'fixed', zIndex: 999, ...pos,
          width: 'min(320px, calc(100vw - 24px))',
          background: 'var(--card-solid, var(--bg-secondary))',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 18px 48px rgba(15,23,42,.28)',
          padding: 16,
          display: 'flex', flexDirection: 'column', gap: 12,
          font: 'inherit',
        }}
      >
        {art && (
          <div style={{
            borderRadius: 12, padding: 12,
            background: 'var(--bg)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{art}</div>
        )}
        <div>
          <div style={{
            fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 4,
          }}>{title}</div>
          <div style={{
            fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-secondary)',
            fontWeight: 500,
          }}>{text}</div>
        </div>
        <button
          onClick={onClose}
          className="btn btn-primary"
          style={{
            alignSelf: 'stretch', padding: '9px 14px', borderRadius: 10,
            fontSize: 13, fontWeight: 800, cursor: 'pointer',
          }}
        >Tushunarli</button>
      </div>
    </>
  )
}

/* ============================================================
 * Chizmalar — matnsiz tushuntirish
 * ============================================================ */

/** Savol pozitsiyasi ko'rsatkichi: shkala + raqamli belgilar + yashil to'lish. */
export function HintArtPositions({ vertical = false }: { vertical?: boolean }) {
  const marks = [
    { at: 18, color: '#2563EB', n: '1' },
    { at: 48, color: '#7C3AED', n: '2' },
    { at: 78, color: '#F59E0B', n: '3' },
  ]
  if (vertical) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          position: 'relative', width: 20, height: 108,
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 999,
        }}>
          <div style={{
            position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
            width: 4, bottom: 4, background: 'rgba(148,163,184,.3)', borderRadius: 2,
          }} />
          <div className="onb-fill-v" style={{
            position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
            width: 4, background: 'linear-gradient(180deg,#10B981,#059669)',
            borderRadius: 2,
          }} />
          {marks.map((m) => (
            <span key={m.n} style={{
              position: 'absolute', left: '50%', top: `${m.at}%`,
              transform: 'translate(-50%,-50%)',
              width: 16, height: 16, borderRadius: 999, background: m.color,
              color: '#FFF', fontSize: 9.5, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{m.n}</span>
          ))}
        </div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          <div><span style={{ color: '#10B981' }}>▮</span> hozir shu yerdasiz</div>
          <div><span style={{ color: '#2563EB' }}>●</span> savol shu soniyada</div>
        </div>
      </div>
    )
  }
  return (
    <div style={{ width: '100%' }}>
      <div style={{
        position: 'relative', height: 26, borderRadius: 999, padding: '0 10px',
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      }}>
        <div style={{
          position: 'absolute', left: 10, right: 10, top: 12, height: 2,
          background: 'var(--border)', borderRadius: 2,
        }} />
        <div className="onb-fill-h" style={{
          position: 'absolute', left: 10, top: 12, height: 2,
          background: '#10B981', borderRadius: 2,
        }} />
        {marks.map((m) => (
          <span key={m.n} style={{
            position: 'absolute', top: '50%', left: `calc(10px + (100% - 20px) * ${m.at / 100})`,
            transform: 'translate(-50%,-50%)',
            width: 18, height: 18, borderRadius: 999, background: m.color,
            color: '#FFF', fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{m.n}</span>
        ))}
      </div>
      <div style={{
        marginTop: 8, fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
        display: 'flex', gap: 12, flexWrap: 'wrap',
      }}>
        <span><span style={{ color: '#10B981' }}>▮</span> hozirgi vaqt</span>
        <span><span style={{ color: '#2563EB' }}>●</span> savolning joyi</span>
      </div>
    </div>
  )
}

/** "Isbot" tugmasi: bosilsa video javob eshitiladigan soniyaga suriladi. */
export function HintArtProof() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 11px', borderRadius: 999,
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        fontSize: 11.5, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap',
      }}>
        <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden>
          <path d="M6 4l14 8-14 8z" fill="currentColor" />
        </svg>
        Isbot
      </span>
      <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden className="onb-arrow">
        <path d="M0 6h20M15 1l6 5-6 5" stroke="var(--text-secondary)" strokeWidth="1.8"
          fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{
        position: 'relative', width: 92, height: 54, borderRadius: 8,
        background: '#0F172A', overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 8, height: 3,
          background: 'rgba(255,255,255,.25)',
        }} />
        <div style={{
          position: 'absolute', left: 0, bottom: 8, height: 3, width: '58%',
          background: '#10B981',
        }} />
        <span style={{
          position: 'absolute', left: '58%', bottom: 9.5, transform: 'translate(-50%,50%)',
          width: 9, height: 9, borderRadius: 999, background: '#FFF',
          boxShadow: '0 0 0 3px rgba(16,185,129,.5)',
        }} />
      </div>
    </div>
  )
}
