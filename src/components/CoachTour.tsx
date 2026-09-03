import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/i18n'

/**
 * "Coach tour" — ekrandagi ANIQ element ustiga o'q bilan ko'rsatib,
 * nima uchun kerakligini bir-ikki qatorda tushuntiradi.
 *
 * Nega o'q va spotlight:
 *   - Foydalanuvchi so'radi: "o'qlar bilan ko'rsatish, modalda maqsadini
 *     yozish". Ya'ni matn emas, **ko'rsatish** asosiy.
 *   - Fon qorayadi va faqat kerakli element yoritiladi — ko'z darrov
 *     o'sha yerga tushadi.
 *
 * Qachon ko'rsatilishini `utils/onboarding.ts` hal qiladi (bu komponent
 * faqat chizadi). Har qadamda **"Tashlab ketish"** bor.
 */

export interface TourStep {
  /** Ko'rsatiladigan elementni topadi. `null` qaytsa qadam tashlab ketiladi. */
  anchor: () => HTMLElement | null
  title: string
  text: string
  /**
   * Kartochka elementning qaysi tomonida tursin. Joy yetmasa avtomatik
   * qarama-qarshi tomonga o'tadi.
   */
  side?: 'top' | 'bottom' | 'left' | 'right'
}

interface Rect { top: number; left: number; width: number; height: number }

/**
 * Berilgan selektorlardan **ko'rinadigan** birinchisini qaytaradi.
 *
 * Nega kerak: bir xil vazifadagi tugma desktop va mobil tartibda BOSHQA
 * element bo'ladi (masalan Shorts'da savollar dastagi mobilda tugma,
 * desktopda esa `display:none` — panel doim yonda turadi). `querySelector`
 * yashirin elementni ham topadi va o'q ekranning chap yuqori burchagiga
 * qadalib qolardi. Shu bois o'lchami nol bo'lganlarni tashlab o'tamiz.
 */
export function firstVisible(...selectors: string[]): HTMLElement | null {
  let offscreen: HTMLElement | null = null
  for (const sel of selectors) {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      // Ekranda turgani ustun: Shorts lentasida bir xil selektor har slotda
      // topiladi va ekrandan tashqaridagisini tanlasak o'q bo'sh joyga
      // qadalardi.
      const onScreen = r.bottom > 0 && r.top < window.innerHeight
        && r.right > 0 && r.left < window.innerWidth
      if (onScreen) return el
      offscreen ??= el
    }
  }
  return offscreen
}

const CARD_W = 300
/** Kartochkaning taxminiy balandligi — ekrandan chiqib ketmasligi uchun. */
const CARD_H = 210
const GAP = 14

export default function CoachTour({ steps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  const t = useT()
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)

  const step = steps[index]

  // Elementning joyini o'lchaymiz va scroll/resize da qayta o'lchaymiz.
  const measure = useCallback(() => {
    const el = step?.anchor()
    if (!el) { setRect(null); return }
    const r = el.getBoundingClientRect()
    // Yashirin element (0×0) — o'q qadaladigan joy yo'q, markazda ko'rsatamiz.
    if (r.width < 1 || r.height < 1) { setRect(null); return }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [step])

  useLayoutEffect(() => { measure() }, [measure])

  useEffect(() => {
    const on = () => measure()
    window.addEventListener('resize', on)
    window.addEventListener('scroll', on, true)
    const id = window.setInterval(on, 500)   // layout kech o'zgarsa ham to'g'ri tursin
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('scroll', on, true)
      window.clearInterval(id)
    }
  }, [measure])

  const next = useCallback(() => {
    if (index + 1 >= steps.length) onDone()
    else setIndex((i) => i + 1)
  }, [index, steps.length, onDone])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone()
      if (e.key === 'Enter') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone, next])

  if (!step) return null

  // Element topilmasa (masalan tugma hali chizilmagan) — qadamni o'tkazamiz.
  if (!rect) {
    return (
      <Backdrop onSkip={onDone}>
        <Card
          title={step.title} text={step.text}
          style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}
          index={index} total={steps.length}
          onNext={next} onSkip={onDone} t={t}
        />
      </Backdrop>
    )
  }

  const pad = 8
  const hole = {
    top: rect.top - pad, left: rect.left - pad,
    width: rect.width + pad * 2, height: rect.height + pad * 2,
  }

  // Kartochka joyi — imkoni bo'lsa so'ralgan tomonda, aks holda teskarisida.
  const side = pickSide(step.side ?? 'bottom', hole)
  const card = cardPosition(side, hole)

  return (
    <Backdrop onSkip={onDone}>
      {/* Spotlight — elementni "kesib" oladi (katta soya bilan) */}
      <div
        aria-hidden
        style={{
          position: 'fixed', zIndex: 1201,
          top: hole.top, left: hole.left, width: hole.width, height: hole.height,
          borderRadius: 14,
          boxShadow: '0 0 0 9999px rgba(8,12,20,.72), 0 0 0 3px #10B981',
          pointerEvents: 'none',
          transition: 'all .18s ease',
        }}
      />
      <Arrow side={side} hole={hole} />
      <Card
        title={step.title} text={step.text} style={card}
        index={index} total={steps.length}
        onNext={next} onSkip={onDone} t={t}
      />
    </Backdrop>
  )
}

/**
 * `document.body` ga PORTAL orqali chiqariladi.
 *
 * Sababi: Shorts lentasidagi `.shorts-slot` da `contain: layout paint` bor
 * va u `position:fixed` uchun yangi "containing block" yasaydi — ya'ni
 * ichida chizilgan overlay ekran emas, SLOT koordinatalarida joylashadi
 * (o'lchandi: butun qatlam 109 px pastga surilgan, kartochka esa ekran
 * ostiga chiqib ketgan). Portal bilan `fixed` yana ekranga nisbatan
 * bo'ladi.
 */
function Backdrop({ children, onSkip }: { children: React.ReactNode; onSkip: () => void }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onSkip}
      style={{ position: 'fixed', inset: 0, zIndex: 1200 }}
    >
      {children}
    </div>,
    document.body,
  )
}

/** Elementga qaragan uchburchak o'q. */
function Arrow({ side, hole }: { side: TourStep['side']; hole: Rect }) {
  const size = 16
  const base: React.CSSProperties = {
    position: 'fixed', zIndex: 1202, width: 0, height: 0, pointerEvents: 'none',
  }
  const cx = hole.left + hole.width / 2
  const cy = hole.top + hole.height / 2

  if (side === 'top') {
    return <div style={{
      ...base, left: cx - size, top: hole.top - size - 2,
      borderLeft: `${size}px solid transparent`, borderRight: `${size}px solid transparent`,
      borderTop: `${size}px solid #10B981`,
    }} />
  }
  if (side === 'bottom') {
    return <div style={{
      ...base, left: cx - size, top: hole.top + hole.height + 2,
      borderLeft: `${size}px solid transparent`, borderRight: `${size}px solid transparent`,
      borderBottom: `${size}px solid #10B981`,
    }} />
  }
  if (side === 'left') {
    return <div style={{
      ...base, top: cy - size, left: hole.left - size - 2,
      borderTop: `${size}px solid transparent`, borderBottom: `${size}px solid transparent`,
      borderLeft: `${size}px solid #10B981`,
    }} />
  }
  return <div style={{
    ...base, top: cy - size, left: hole.left + hole.width + 2,
    borderTop: `${size}px solid transparent`, borderBottom: `${size}px solid transparent`,
    borderRight: `${size}px solid #10B981`,
  }} />
}

function Card({
  title, text, style, index, total, onNext, onSkip, t,
}: {
  title: string; text: string; style: React.CSSProperties
  index: number; total: number
  onNext: () => void; onSkip: () => void
  t: ReturnType<typeof useT>
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', zIndex: 1203, width: CARD_W, maxWidth: 'calc(100vw - 24px)',
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 18,
        boxShadow: '0 20px 50px rgba(8,12,20,.45)',
        ...style,
      }}
    >
      <div style={{ fontSize: 15.5, fontWeight: 800, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{text}</div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, marginTop: 16,
      }}>
        <button onClick={onSkip}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 700,
            padding: 0, fontFamily: 'inherit',
          }}>
          {t.tourSkip}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>
            {index + 1}/{total}
          </span>
          <button className="btn btn-primary" onClick={onNext}
            style={{ padding: '9px 18px', fontSize: 13.5, borderRadius: 10 }}>
            {index + 1 >= total ? t.gotIt : t.tourNext}
          </button>
        </div>
      </div>
    </div>
  )
}

/** So'ralgan tomonda joy bo'lmasa teskarisiga o'tadi. */
function pickSide(want: NonNullable<TourStep['side']>, hole: Rect): NonNullable<TourStep['side']> {
  const vh = window.innerHeight
  const vw = window.innerWidth
  const need = 190
  if (want === 'bottom' && hole.top + hole.height + need > vh) return 'top'
  if (want === 'top' && hole.top - need < 0) return 'bottom'
  if (want === 'left' && hole.left - CARD_W - GAP < 0) return 'right'
  if (want === 'right' && hole.left + hole.width + CARD_W + GAP > vw) return 'left'
  return want
}

function cardPosition(side: NonNullable<TourStep['side']>, hole: Rect): React.CSSProperties {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const clampLeft = (x: number) => Math.max(12, Math.min(x, vw - CARD_W - 12))
  // Yon tomonda turgan kartochka ekran ostiga tushib ketmasin: element
  // pastda bo'lsa (masalan Shorts'dagi ↑/↓ tugmalari) kartochka ham pastga
  // suriladi va yarmi ko'rinmay qolardi.
  const clampTop = (y: number) => Math.max(12, Math.min(y, vh - CARD_H - 12))
  const cx = hole.left + hole.width / 2

  if (side === 'top') return { left: clampLeft(cx - CARD_W / 2), bottom: vh - hole.top + GAP + 12 }
  if (side === 'bottom') return { left: clampLeft(cx - CARD_W / 2), top: hole.top + hole.height + GAP + 12 }
  if (side === 'left') return { left: Math.max(12, hole.left - CARD_W - GAP - 12), top: clampTop(hole.top) }
  return { left: clampLeft(hole.left + hole.width + GAP + 12), top: clampTop(hole.top) }
}
