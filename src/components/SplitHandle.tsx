import { useCallback, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { useT } from '@/i18n'

/**
 * Video | panel ajratgichi — foydalanuvchi ustunlar kengligini O'ZI suradi.
 *
 * Grid `--split-a` / `--split-b` o'zgaruvchilaridan ustun kengligini oladi
 * (`.dict-layout`, `.test-layout` — `global.css`). Ataylab inline
 * `gridTemplateColumns` EMAS: inline uslub media query'dan ustun turadi va
 * telefonda bitta ustunga tushish buzilardi. Tor ekranda ajratgich yashirin.
 *
 * Tanlov `localStorage` da (diktant va imtihon uchun alohida kalit) — keyingi
 * safar ham shu kenglik. Ikki marta bosish — asl holi; ←/→ — klaviatura bilan.
 */

const MIN = 30
const MAX = 75

const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v))

export function useSplit(storageKey: string, fallback: number) {
  const [value, setValue] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey))
      return saved >= MIN && saved <= MAX ? saved : fallback
    } catch {
      return fallback
    }
  })
  const save = useCallback((v: number) => {
    try { localStorage.setItem(storageKey, String(Math.round(v))) } catch { /* noop */ }
  }, [storageKey])
  const style = { '--split-a': `${value}fr`, '--split-b': `${100 - value}fr` } as CSSProperties
  return { value, setValue, save, style, fallback }
}

export function SplitHandle({ containerRef, split }: {
  containerRef: RefObject<HTMLElement | null>
  split: ReturnType<typeof useSplit>
}) {
  const t = useT()
  const latest = useRef(split.value)
  latest.current = split.value

  const toPercent = (clientX: number) => {
    const el = containerRef.current
    if (!el) return latest.current
    const rect = el.getBoundingClientRect()
    const css = getComputedStyle(el)
    const left = rect.left + parseFloat(css.paddingLeft || '0')
    const width = rect.width - parseFloat(css.paddingLeft || '0') - parseFloat(css.paddingRight || '0')
    return width > 0 ? clamp(((clientX - left) / width) * 100) : latest.current
  }

  const stop = (e: React.PointerEvent) => {
    if (!document.body.classList.contains('split-dragging')) return
    document.body.classList.remove('split-dragging')
    try { e.currentTarget.releasePointerCapture?.(e.pointerId) } catch { /* noop */ }
    split.save(latest.current)
  }

  const nudge = (delta: number) => {
    const next = clamp(latest.current + delta)
    split.setValue(next)
    split.save(next)
  }

  return (
    <div
      className="split-handle"
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      aria-valuenow={Math.round(split.value)}
      aria-label={t.splitHandleLabel}
      title={t.splitHandleLabel}
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault()
        // YouTube iframe kursorni "yutib" yubormasin, matn belgilanmasin.
        document.body.classList.add('split-dragging')
        // Capture bo'lmasa ham (ba'zi qalam/touch holatlari) surish ishlayversin.
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* noop */ }
      }}
      onPointerMove={(e) => {
        if (!document.body.classList.contains('split-dragging')) return
        // `latest` darrov yangilanadi: qo'yib yuborish (pointerup) oxirgi
        // qiymat render bo'lishini kutmasdan kelishi mumkin — aks holda
        // eski kenglik saqlanib qolardi.
        latest.current = toPercent(e.clientX)
        split.setValue(latest.current)
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onDoubleClick={() => { split.setValue(split.fallback); split.save(split.fallback) }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-2) }
        if (e.key === 'ArrowRight') { e.preventDefault(); nudge(2) }
      }}
    >
      <span className="split-handle-bar" aria-hidden />
    </div>
  )
}
