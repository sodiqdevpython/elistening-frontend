import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { HeadphoneIcon } from './ui'

/**
 * Akkauntga kirishni talab qiluvchi modal — foydalanuvchi tizimga kirmasdan
 * turib ish (diktant/imtihon boshlash, savolga javob berish, like bosish) qilsa
 * chiroyli tarzda kirishni taklif qiladi.
 *
 * Ishlatilishi: `const gate = useAuthGate()` — `gate.require(() => {...})` yoki
 * to'g'ridan-to'g'ri `<AuthGateModal open={...} onClose={...} />`.
 *
 * Foydalanuvchini bloklaydi, lekin fon (masalan Shorts video) ko'rinib turadi —
 * u nima uchun kirish kerakligini tushunadi.
 */
export default function AuthGateModal({ open, onClose, action }: {
  open: boolean
  onClose: () => void
  /** Ixtiyoriy: "... uchun akkauntingizga kiring" — nima ish bloklangani. */
  action?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,.62)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 300, padding: 16,
      }}
    >
      <div style={{
        position: 'relative',
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '30px 26px 26px', width: '100%', maxWidth: 380,
        boxShadow: '0 30px 70px rgba(0,0,0,.5)', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
      }}>
        <button
          onClick={onClose} aria-label="Yopish"
          style={{
            position: 'absolute', top: 12, right: 12,
            width: 30, height: 30, borderRadius: '50%',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            cursor: 'pointer', fontSize: 16, fontWeight: 800,
            color: 'var(--text-secondary)', lineHeight: 0,
          }}
        >×</button>

        <div style={{
          width: 60, height: 60, borderRadius: 18,
          background: 'linear-gradient(135deg,#10B981 0%,#2563EB 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 12px 26px rgba(16,185,129,.35)',
        }}>
          <HeadphoneIcon size={28} color="#FFFFFF" strokeWidth={2} />
        </div>

        <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.25 }}>
          Davom etish uchun kiring
        </div>
        <div style={{
          fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: 300,
        }}>
          {action
            ? `${action} uchun akkauntingizga kiring.`
            : 'Mashqlarni boshlash va natijalaringizni saqlash uchun akkauntingizga kiring.'}
          {' '}Bir necha soniya oladi.
        </div>

        <Link
          to="/auth"
          className="btn btn-primary"
          style={{
            width: '100%', textDecoration: 'none', padding: '12px 18px',
            borderRadius: 12, fontSize: 15, fontWeight: 800,
          }}
        >Akkauntga kirish</Link>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
            fontFamily: 'inherit', padding: '4px 8px',
          }}
        >Hozircha kerak emas</button>
      </div>
    </div>
  )
}
