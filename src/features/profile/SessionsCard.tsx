import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSessions, revokeSession } from '@/api/endpoints'
import { Spinner } from '@/components/ui'
import { useT } from '@/i18n'

/**
 * "Kirgan qurilmalar" kartasi — profil sahifasida.
 *
 * Qoida serverda: bir vaqtda **1 web + 1 mobil** sessiya
 * (`backend/apps/accounts/auth.py`). Bu karta yangi ruxsat bermaydi — u
 * faqat qayerdan kirilganini ko'rsatadi va uzib qo'yish imkonini beradi
 * (telefon yo'qolgan, birovning kompyuterida qolib ketgan va h.k.).
 *
 * Chiqarilgan qurilma DARROV 401 oladi: server `ActiveSession` qatorini
 * o'chiradi, `session_ok` esa qator bo'lmasa rad etadi.
 *
 * Mobil ilovadagi ekran ayni shu API'dan foydalanadi
 * (`mobile/src/components/SessionsSection.tsx`) — matn/qoidalar bir xil.
 */
export default function SessionsCard() {
  const t = useT()
  const queryClient = useQueryClient()

  const sessions = useQuery({ queryKey: ['sessions'], queryFn: fetchSessions })

  const revoke = useMutation({
    mutationFn: (payload: { id?: number; others?: boolean }) => revokeSession(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  })

  const rows = sessions.data ?? []
  const others = rows.filter((r) => !r.is_current).length

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 14, flexWrap: 'wrap', marginBottom: 16,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{t.sessionsTitle}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 520, lineHeight: 1.5 }}>
            {t.sessionsDesc}
          </div>
        </div>
        {others > 0 && (
          <button
            className="btn btn-ghost"
            style={{ padding: '9px 16px', fontSize: 13, borderRadius: 10 }}
            disabled={revoke.isPending}
            onClick={() => revoke.mutate({ others: true })}
          >
            {t.sessionsRevokeOthers}
          </button>
        )}
      </div>

      {sessions.isLoading && <Spinner />}
      {!sessions.isLoading && rows.length === 0 && (
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{t.sessionsEmpty}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((row) => (
          <div
            key={row.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              border: `1.5px solid ${row.is_current ? '#10B981' : 'var(--border)'}`,
              background: row.is_current ? 'var(--ok-bg)' : 'transparent',
              borderRadius: 12, padding: '12px 14px',
            }}
          >
            <span aria-hidden style={{ fontSize: 18 }}>{row.platform === 'mobile' ? '📱' : '💻'}</span>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {row.platform === 'mobile' ? t.sessionsMobile : t.sessionsWeb}
                <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}> · {row.device}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                {row.ip_address ? `${row.ip_address} · ` : ''}
                {t.sessionsLastSeen}: {formatSeen(row.last_seen_at, t.sessionsNever)}
              </div>
            </div>
            {row.is_current ? (
              <span style={{ fontSize: 12, fontWeight: 800, color: '#059669' }}>{t.sessionsCurrent}</span>
            ) : (
              <button
                className="btn btn-ghost"
                style={{ padding: '7px 14px', fontSize: 12.5, borderRadius: 9 }}
                disabled={revoke.isPending}
                onClick={() => revoke.mutate({ id: row.id })}
              >
                {t.sessionsRevoke}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function formatSeen(value: string | null, fallback: string): string {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleString()
}
