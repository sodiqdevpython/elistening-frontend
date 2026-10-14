import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { searchUsers } from '@/api/endpoints'
import UserAvatar from '@/components/UserAvatar'
import { useT } from '@/i18n'

/** Server ham 2 harfdan kam so'rovga bo'sh javob beradi (`public.py`). */
const MIN_CHARS = 2
const DEBOUNCE_MS = 300

/**
 * Foydalanuvchi qidiruvi — ism yoki o'zi tanlagan @username bo'yicha.
 * Natija bosilsa ochiq profil (`/u/:id`). Faqat kirganlarga ko'rsatiladi —
 * endpoint ham shunday (30 so'rov/daqiqa).
 */
export default function UserSearch() {
  const t = useT()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setQ(text.trim().replace(/^@/, '')), DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [text])

  // Tashqariga bosilsa ro'yxat yopiladi.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const enabled = q.length >= MIN_CHARS
  const results = useQuery({
    queryKey: ['user-search', q],
    queryFn: () => searchUsers(q),
    enabled,
    staleTime: 30_000,
  })
  const rows = enabled ? results.data ?? [] : []
  const typed = text.trim().replace(/^@/, '')

  const go = (id: number) => {
    setOpen(false)
    navigate(`/u/${id}`)
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', width: '100%' }}>
      <input
        className="field"
        type="search"
        value={text}
        placeholder={t.userSearchPlaceholder}
        aria-label={t.userSearchPlaceholder}
        maxLength={60}
        onChange={(e) => { setText(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur() }
          if (e.key === 'Enter' && rows[0]) go(rows[0].id)
        }}
        style={{ width: '100%' }}
      />

      {open && typed.length > 0 && (
        <div role="listbox" style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 30,
          background: 'var(--navbar-bg)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: 'var(--shadow-md)', padding: 6,
          maxHeight: 360, overflowY: 'auto',
        }}>
          {typed.length < MIN_CHARS ? (
            <Note text={t.userSearchHint} />
          ) : results.isFetching && !results.data ? (
            <Note text={t.loading} />
          ) : results.isError ? (
            <Note text={t.error} />
          ) : rows.length === 0 ? (
            <Note text={t.userSearchEmpty} />
          ) : (
            rows.map((u) => (
              <Link
                key={u.id}
                to={`/u/${u.id}`}
                role="option"
                aria-selected={false}
                onClick={() => setOpen(false)}
                className="user-search-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                  borderRadius: 8, color: 'inherit', textDecoration: 'none', minWidth: 0,
                }}
              >
                <UserAvatar url={u.avatar_url} initial={u.initial} size={32} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{u.name}</div>
                  {(u.username || u.cefr_level) && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {[u.username && `@${u.username}`, u.cefr_level].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function Note({ text }: { text: string }) {
  return (
    <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>{text}</div>
  )
}
