import type { CSSProperties, ReactNode } from 'react'
import { useT } from '@/i18n'

/* --- Ikonkalar (dizayndagi stroke uslubida) ---------------------------- */
type IconProps = { size?: number; color?: string; strokeWidth?: number }

export function HeadphoneIcon({ size = 20, color = 'currentColor', strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" aria-hidden="true">
      <path d="M4 13V12A8 8 0 0 1 20 12V13" />
      <rect x="2.5" y="13" width="4" height="6" rx="1.5" />
      <rect x="17.5" y="13" width="4" height="6" rx="1.5" />
    </svg>
  )
}

export function PlayIcon({ size = 20, color = '#FFFFFF' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5L18 12L8 18.5V5.5Z" fill={color} />
    </svg>
  )
}

export function PauseIcon({ size = 20, color = '#FFFFFF' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" fill={color} />
      <rect x="14" y="5" width="4" height="14" rx="1" fill={color} />
    </svg>
  )
}

export function ChevronIcon({ size = 16, color = 'currentColor', dir = 'right' }: IconProps & { dir?: 'left' | 'right' | 'down' }) {
  const path = dir === 'left' ? 'M15 18L9 12L15 6' : dir === 'down' ? 'M6 9L12 15L18 9' : 'M9 6L15 12L9 18'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

export function SearchIcon({ size = 15, color = 'var(--text-secondary)' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="M21 21L16.5 16.5" />
    </svg>
  )
}

export function SunIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

export function MoonIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 14.5A8 8 0 1 1 9.5 3.5a6.5 6.5 0 0 0 11 11z" />
    </svg>
  )
}

export function CheckIcon({ size = 14, color = '#10B981' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17L4 12" />
    </svg>
  )
}

export function FlameIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2C12 2 6 9 6 14A6 6 0 0 0 18 14C18 10 15.5 8.5 15 7C14.5 8 14 8.5 14 8.5C14 8.5 14.5 4 12 2Z" fill="#10B981" />
    </svg>
  )
}

export function StarIcon({ size = 14, color = '#15803D' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M12 2L14.5 8.5L21.5 9.2L16.2 13.8L17.8 20.7L12 17L6.2 20.7L7.8 13.8L2.5 9.2L9.5 8.5Z" />
    </svg>
  )
}

export function CategoryIcon({ name, size = 20 }: { name: string; size?: number }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: '#FFFFFF', strokeWidth: 1.7, strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const, 'aria-hidden': true,
  }
  switch (name) {
    case 'book':
      return <svg {...common}><path d="M3 5.5C3 4.67 3.67 4 4.5 4H11V19H4.5C3.67 19 3 18.33 3 17.5V5.5Z" /><path d="M21 5.5C21 4.67 20.33 4 19.5 4H13V19H19.5C20.33 19 21 18.33 21 17.5V5.5Z" /></svg>
    case 'chat':
      return <svg {...common}><path d="M4 5H20V16H8L4 19V5Z" /></svg>
    case 'play':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M10 8.5L16 12L10 15.5V8.5Z" fill="#FFFFFF" stroke="none" /></svg>
    case 'medical':
      return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M12 7V17M7 12H17" /></svg>
    case 'wave':
      return <svg {...common}><line x1="4" y1="9" x2="4" y2="15" /><line x1="8" y1="6" x2="8" y2="18" /><line x1="12" y1="3" x2="12" y2="21" /><line x1="16" y1="6" x2="16" y2="18" /><line x1="20" y1="9" x2="20" y2="15" /></svg>
    case 'hash':
      return <svg {...common}><path d="M9 3L7 21M17 3L15 21M4 9H20M3 15H19" /></svg>
    default:
      return <HeadphoneIcon size={size} color="#FFFFFF" strokeWidth={1.7} />
  }
}

/* --- Kichik komponentlar ----------------------------------------------- */
export const GRADIENTS: Record<string, [string, string]> = {
  green: ['#10B981', '#059669'],
  blue: ['#2563EB', '#1D4ED8'],
  pink: ['#DB2777', '#BE185D'],
  amber: ['#D97706', '#B45309'],
  violet: ['#8B5CF6', '#7C3AED'],
  cyan: ['#0891B2', '#0E7490'],
}

export function gradient(color: string): string {
  const [from, to] = GRADIENTS[color] ?? GRADIENTS.green
  return `linear-gradient(135deg,${from} 0%,${to} 100%)`
}

export function Badge({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span className="badge" style={style}>{children}</span>
}

export function Spinner({ label }: { label?: string }) {
  const t = useT()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '64px 20px' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '3px solid var(--border)', borderTopColor: '#10B981',
        animation: 'spin .8s linear infinite',
      }} />
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label ?? t.loading}</span>
    </div>
  )
}

export function EmptyState({ text }: { text?: string }) {
  const t = useT()
  return (
    <div style={{ textAlign: 'center', padding: '56px 20px', color: 'var(--text-secondary)', fontSize: 14 }}>
      {text ?? t.empty}
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const t = useT()
  return (
    <div style={{ textAlign: 'center', padding: '56px 20px' }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{t.error}</div>
      {onRetry && <button className="btn btn-ghost" onClick={onRetry}>{t.retry}</button>}
    </div>
  )
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 'clamp(20px,3vw,26px)', fontWeight: 800 }}>{children}</div>
      {sub && <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

export function ProgressBar({ percent, color = '#10B981', height = 6 }: { percent: number; color?: string; height?: number }) {
  return (
    <div style={{
      height, borderRadius: height / 2, background: 'var(--border)', overflow: 'hidden', width: '100%',
    }}>
      <div style={{
        height: '100%', width: `${Math.max(0, Math.min(100, percent))}%`,
        background: color, borderRadius: height / 2, transition: 'width .3s',
      }} />
    </div>
  )
}

export function Pagination({ page, totalPages, onChange }: {
  page: number; totalPages: number; onChange: (p: number) => void
}) {
  const t = useT()
  if (totalPages <= 1) return null
  const btn: CSSProperties = {
    border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)',
    borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 32, flexWrap: 'wrap' }}>
      <button style={{ ...btn, opacity: page <= 1 ? 0.4 : 1 }} disabled={page <= 1}
        onClick={() => onChange(page - 1)}>← {t.moviesPagePrev}</button>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
        {t.moviesPageLabel} {page} / {totalPages}
      </span>
      <button style={{ ...btn, opacity: page >= totalPages ? 0.4 : 1 }} disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}>{t.moviesPageNext} →</button>
    </div>
  )
}

export function SearchField({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string
}) {
  return (
    <div style={{
      flex: '1 1 240px', maxWidth: 380, display: 'flex', alignItems: 'center', gap: 8,
      border: '1px solid var(--border)', borderRadius: 10, padding: '9px 14px',
      background: 'var(--card-bg)',
    }}>
      <SearchIcon />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        aria-label={placeholder}
        style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 14, width: '100%', color: 'var(--text)' }} />
    </div>
  )
}

export function LevelSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[]
}) {
  const t = useT()
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={t.allLevelsOption}
      style={{
        border: '1px solid var(--border)', borderRadius: 10, padding: '9px 14px',
        fontSize: 14, color: 'var(--text)', background: 'var(--card-bg)',
      }}>
      <option value="all">{t.allLevelsOption}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

export function PillTabs<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
}) {
  return (
    <div style={{
      display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 10,
      padding: 5, width: 'fit-content', flexWrap: 'wrap', maxWidth: '100%',
    }}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button key={o.value} onClick={() => onChange(o.value)} aria-pressed={active}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: active ? 'var(--card-bg)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text-secondary)',
              boxShadow: active ? '0 2px 8px rgba(15,23,42,.12)' : 'none',
              cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
            }}>{o.label}</button>
        )
      })}
    </div>
  )
}
