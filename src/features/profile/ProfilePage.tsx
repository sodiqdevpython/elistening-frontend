import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  checkUsername, fetchActivity, fetchInvites, fetchStats, requestAccountDeletion, subscribe,
  updateAvatar, updateMe,
} from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import type { Cefr } from '@/api/types'
import { PageHeader } from '@/components/Layout'
import {
  Badge, EmptyState, ErrorState, ProgressBar, Spinner,
} from '@/components/ui'
import { PlanCards } from '@/features/billing/PlanCards'
import { useAuth } from '@/store/auth'
import LimitsCard from './LimitsCard'
import PlanHistoryCard from './PlanHistoryCard'
import SessionsCard from './SessionsCard'
import { useLang, useT } from '@/i18n'
import { fill, formatMinutes } from '@/utils/format'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export default function ProfilePage() {
  const t = useT()
  const { lang } = useLang()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, isLoggedIn, loading, setUser, signOut } = useAuth()

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [level, setLevel] = useState('B1')
  const [copied, setCopied] = useState(false)
  const [planMessage, setPlanMessage] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await requestAccountDeletion()   // akkaunt o'chmaydi — admin ko'radi; login bekor qiladi
      signOut()
      navigate('/')
    } catch {
      setDeleting(false)
    }
  }

  // ── Username (mobil ilovadagi bilan bir xil qoidalar) ──
  const [username, setUsername] = useState('')
  const [usernameState, setUsernameState] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle')

  // ── Avatar ──
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState('')

  useEffect(() => {
    if (user) { setName(user.display_name); setLevel(user.cefr_level); setUsername(user.username || '') }
  }, [user])

  /**
   * Username bandligini tekshirish — 400 ms debounce (har harfda so'rov
   * yubormaymiz). O'zining username'i "band" deb ko'rsatilmasligi kerak.
   */
  useEffect(() => {
    const value = username.trim()
    if (!editing || !value || value === (user?.username || '')) { setUsernameState('idle'); return }
    setUsernameState('checking')
    let alive = true
    const id = window.setTimeout(() => {
      checkUsername(value)
        .then((r) => { if (alive) setUsernameState(r.available ? 'free' : 'taken') })
        .catch(() => { if (alive) setUsernameState('idle') })
    }, 400)
    return () => { alive = false; window.clearTimeout(id) }
  }, [username, editing, user?.username])

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return
    setAvatarError('')
    setAvatarBusy(true)
    try {
      setUser(await updateAvatar(file))
    } catch (err) {
      setAvatarError(errorMessage(err, t.avatarError))
    } finally {
      setAvatarBusy(false)
    }
  }

  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: isLoggedIn })
  const activity = useQuery({ queryKey: ['activity'], queryFn: () => fetchActivity(14), enabled: isLoggedIn })
  const invites = useQuery({ queryKey: ['invites'], queryFn: fetchInvites, enabled: isLoggedIn })

  const save = useMutation({
    mutationFn: () => updateMe({
      display_name: name.trim(),
      cefr_level: level as Cefr,
      // Bo'sh qoldirilsa yubormaymiz — server eskisini saqlab qoladi.
      ...(username.trim() ? { username: username.trim() } : {}),
    }),
    onSuccess: (updated) => {
      setUser(updated)
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const choosePlan = async (code: string) => {
    setPlanMessage('')
    try {
      await subscribe(code)
      setPlanMessage('')
    } catch (err) {
      setPlanMessage(errorMessage(err, t.paymentsSoon))
    }
  }

  const copyInvite = async () => {
    if (!user) return
    try { await navigator.clipboard.writeText(user.invite_link) } catch { /* ruxsat yo'q */ }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  if (loading) return <><PageHeader /><Spinner /></>

  if (!isLoggedIn || !user) {
    return (
      <>
        <PageHeader />
        <div className="page" style={{ maxWidth: 420, textAlign: 'center', paddingTop: 72 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px',
            background: 'linear-gradient(135deg,#10B981 0%,#2563EB 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF"
              strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" /><path d="M4 20C4 16 7.5 14 12 14C16.5 14 20 16 20 20" />
            </svg>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{t.loggedOutTitle}</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
            {t.loggedOutDesc}
          </div>
          <Link to="/auth" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
            {t.loginCta}
          </Link>
        </div>
      </>
    )
  }

  const maxHours = Math.max(0.1, ...(activity.data ?? []).map((d) => d.hours))

  return (
    <>
      <PageHeader />
      <div className="page" style={{ maxWidth: 1140, display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Profil kartasi */}
        <div className="card" style={{ padding: 24 }}>
          {!editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              {/* Rasm — bosilsa fayl tanlash ochiladi (mobil ilova bilan bir xil). */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={avatarBusy}
                title={t.avatarChange}
                aria-label={t.avatarChange}
                style={{
                  position: 'relative', width: 64, height: 64, borderRadius: '50%',
                  flexShrink: 0, padding: 0, border: 'none', background: 'transparent',
                  cursor: avatarBusy ? 'wait' : 'pointer',
                }}
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt=""
                    width={64}
                    height={64}
                    style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#10B981 0%,#2563EB 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, fontWeight: 800, color: '#FFF',
                  }}>{user.initial}</div>
                )}
                <span style={{
                  position: 'absolute', right: -2, bottom: -2,
                  width: 24, height: 24, borderRadius: '50%',
                  background: '#10B981', color: '#FFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, border: '2px solid var(--bg-secondary)',
                }} aria-hidden>{avatarBusy ? '…' : '\u270e'}</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => { pickAvatar(e.target.files?.[0]); e.target.value = '' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {user.display_name || t.defaultUserName}
                </div>
                {!!user.username && (
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>
                    @{user.username}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                  <Badge>{user.cefr_level}</Badge>
                </div>
              </div>
              {!!avatarError && (
                <div style={{ width: '100%', fontSize: 12.5, fontWeight: 600, color: '#EF4444' }}>{avatarError}</div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" style={{ padding: '9px 16px', fontSize: 13, borderRadius: 10 }}
                  onClick={() => setEditing(true)}>{t.editProfileBtn}</button>
                {/* Tariflar alohida sahifada — bot ham shu manzilni yuboradi. */}
                <button className="btn btn-ghost" style={{ padding: '9px 16px', fontSize: 13, borderRadius: 10 }}
                  onClick={() => navigate('/profile/billing')}>{t.billingTitle}</button>
                <button className="btn btn-ghost" style={{ padding: '9px 16px', fontSize: 13, borderRadius: 10 }}
                  onClick={() => { signOut(); navigate('/') }}>{t.logout}</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 460 }}>
              {/* Rasm tahrirlash rejimida ham turadi. Ilgari u faqat ko'rish
                  rejimida edi va "Tahrirlash" bosilgach yo'qolib qolardi —
                  foydalanuvchi rasmni umuman topa olmasdi. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarBusy}
                  title={t.avatarChange}
                  aria-label={t.avatarChange}
                  style={{
                    position: 'relative', width: 64, height: 64, borderRadius: '50%',
                    flexShrink: 0, padding: 0, border: 'none', background: 'transparent',
                    cursor: avatarBusy ? 'wait' : 'pointer',
                  }}
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" width={64} height={64}
                      style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{
                      width: 64, height: 64, borderRadius: '50%',
                      background: 'linear-gradient(135deg,#10B981 0%,#2563EB 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, fontWeight: 800, color: '#FFF',
                    }}>{user.initial}</div>
                  )}
                  <span style={{
                    position: 'absolute', right: -2, bottom: -2,
                    width: 24, height: 24, borderRadius: '50%',
                    background: '#10B981', color: '#FFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, border: '2px solid var(--bg-secondary)',
                  }} aria-hidden>{avatarBusy ? '…' : '✎'}</span>
                </button>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {t.avatarChange}
                  {!!avatarError && (
                    <div style={{ color: '#EF4444', fontWeight: 600, marginTop: 4 }}>{avatarError}</div>
                  )}
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => { pickAvatar(e.target.files?.[0]); e.target.value = '' }}
              />
              <div>
                <div style={labelStyle}>{t.editNameLabel}</div>
                <input className="field" value={name} onChange={(e) => setName(e.target.value)}
                  aria-label={t.editNameLabel} />
              </div>
              <div>
                <div style={labelStyle}>{t.editUsernameLabel}</div>
                <input
                  className="field"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32))}
                  placeholder="username"
                  aria-label={t.editUsernameLabel}
                />
                <div style={{
                  fontSize: 12, fontWeight: 600, marginTop: 5, minHeight: 16,
                  color: usernameState === 'taken' ? '#EF4444'
                    : usernameState === 'free' ? '#059669' : 'var(--text-secondary)',
                }}>
                  {usernameState === 'checking' && '…'}
                  {usernameState === 'free' && t.usernameFree}
                  {usernameState === 'taken' && t.usernameTaken}
                </div>
              </div>
              <div>
                <div style={labelStyle}>{t.editLevelLabel}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
                  {LEVELS.map((code) => (
                    <button key={code} onClick={() => setLevel(code)} aria-pressed={level === code}
                      style={{
                        border: `1.5px solid ${level === code ? '#10B981' : 'var(--border)'}`,
                        background: level === code ? 'var(--ok-bg)' : 'transparent',
                        color: level === code ? '#059669' : 'var(--text)',
                        borderRadius: 10, padding: '9px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      }}>{code}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button className="btn btn-primary" style={{ padding: '10px 22px', fontSize: 14 }}
                  onClick={() => save.mutate()}
                  disabled={save.isPending || usernameState === 'taken' || usernameState === 'checking'}>
                  {t.saveProfileBtn}
                </button>
                <button className="btn btn-ghost" style={{ padding: '10px 22px', fontSize: 14 }}
                  onClick={() => setEditing(false)}>{t.cancelBtn}</button>
              </div>
            </div>
          )}
        </div>

        {/* Daraja progressi va statistika */}
        <div className="card" style={{ padding: 24 }}>
          {stats.isLoading && <Spinner />}
          {stats.isError && <ErrorState onRetry={() => stats.refetch()} />}
          {stats.data && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 14, marginBottom: 16,
              }}>
                <div>
                  <div style={labelStyle}>{t.currentLevelTitle}</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{stats.data.level}</div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', fontSize: 12,
                    color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6,
                  }}>
                    <span>{t.levelProgressText} {stats.data.next_level}</span>
                    <span>{stats.data.active_time_hours}/{stats.data.required_hours} {t.hoursUnit}</span>
                  </div>
                  {/* "Taxminiy — darajangizga mos ..." izohi OLIB TASHLANDI:
                      foydalanuvchi so'radi — aniq kafolat bermaydigan,
                      taxminga asoslangan yozuvlar bo'lmasin. */}
                  <ProgressBar percent={stats.data.level_progress_percent} height={8} />
                </div>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
                gap: '14px 24px', paddingTop: 16, borderTop: '1px solid var(--border)',
              }}>
                <StatRow label={t.joinDateLabel} value={stats.data.join_date} />
                <StatRow label={t.activeDaysLabel} value={stats.data.active_days} />
                <StatRow label={t.lastActiveLabel}
                  value={stats.data.last_active_hours_ago != null
                    ? `${stats.data.last_active_hours_ago} ${t.hoursAgoLabel}` : '—'} />
                <StatRow label={t.activeTimeLabel} value={formatMinutes(stats.data.active_time_seconds ?? Math.round((stats.data.active_time_hours || 0) * 3600))} />
                <StatRow label={t.last7Label} value={formatMinutes(stats.data.last7_seconds ?? Math.round((stats.data.last7_hours || 0) * 3600))} />
                <StatRow label={t.last30Label} value={formatMinutes(stats.data.last30_seconds ?? Math.round((stats.data.last30_hours || 0) * 3600))} />
              </div>
            </>
          )}
        </div>

        {/* Kunlik faollik */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>{t.dailyActivityTitle}</div>
          {activity.isLoading && <Spinner />}
          {activity.data?.length === 0 && <EmptyState />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activity.data?.map((day) => (
              <div key={day.date} style={{
                display: 'grid', gridTemplateColumns: '90px 1fr 48px',
                alignItems: 'center', gap: 12,
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {day.date}
                </span>
                <ProgressBar percent={(day.hours / maxHours) * 100} height={10} />
                <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'right' }}>
                  {formatMinutes(day.seconds ?? Math.round((day.hours || 0) * 3600))}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tariflar */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{t.pricingTitle}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>{t.pricingDesc}</div>
          {planMessage && (
            <div style={{
              marginBottom: 16, fontSize: 13, fontWeight: 600, color: 'var(--info-text)',
              background: 'var(--info-bg)', border: '1px solid var(--info-border)',
              borderRadius: 10, padding: '10px 14px',
            }}>{planMessage}</div>
          )}
          {/* Static kartalar — /profile/billing bilan AYNAN bir xil */}
          <PlanCards currentCode={user.plan} onChoose={choosePlan} />
        </div>

        {/* Taklif havolasi */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 14, marginBottom: 16,
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{t.inviteTitle}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.inviteDesc}</div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--tint-a)', borderRadius: 12, padding: '10px 16px',
            }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#059669' }}>{user.invited_count}</span>
              <span style={{ fontSize: 12.5, color: '#059669' }}>{t.inviteCountLabel}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input readOnly value={user.invite_link} className="field"
              aria-label={t.inviteTitle} style={{ flex: 1, minWidth: 200 }} />
            <button className="btn btn-primary" style={{ padding: '11px 20px', fontSize: 14, borderRadius: 10 }}
              onClick={copyInvite}>{copied ? t.copiedLinkBtn : t.copyLinkBtn}</button>
          </div>

          {/* Sovg'a qoidasi va keyingi sovg'agacha qolgan yo'l.
              Hisob serverda (`apps/billing/rewards.py`) — bu yerda faqat
              ko'rsatiladi, hech narsa hisoblanmaydi. */}
          <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {t.inviteRewardRule}
          </div>
          {!!invites.data && invites.data.next_reward_left > 0 && (
            <div style={{ marginTop: 10 }}>
              <ProgressBar percent={Math.round((invites.data.step_progress / invites.data.step) * 100)} />
              <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>
                {fill(t.inviteNextReward, {
                  n: invites.data.next_reward_left,
                  plan: invites.data.next_reward_plan.toUpperCase(),
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <div style={{ ...labelStyle, marginBottom: 8 }}>{t.inviteRewardsTitle}</div>
            {!invites.data?.rewards.length ? (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.inviteNoRewards}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {invites.data.rewards.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span aria-hidden>🎁</span>
                    <span>{fill(t.inviteRewardRow, {
                      plan: lang === 'en' ? r.plan_name_en : r.plan_name_uz,
                      months: r.months,
                      invites: r.invites_spent,
                    })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bugungi kunlik limit — mobil ilovada bor edi, saytda yo'q edi */}
        <LimitsCard />

        {/* Tarif tarixi — faqat saytda ko'rinadi (mobil ilovada kerak emas) */}
        <PlanHistoryCard />

        {/* Kirgan qurilmalar / sessiyalar */}
        <SessionsCard />

        {/* Akkauntni o'chirish (so'rov) — Google Play talabi */}
        <div className="card" style={{ padding: 20, borderColor: '#EF444455' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{t.deleteAccount}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
            {t.deleteAccountBody}
          </div>
          <button
            onClick={() => setDeleteOpen(true)}
            style={{
              padding: '10px 18px', borderRadius: 10, border: '1px solid #EF4444',
              background: 'transparent', color: '#EF4444', fontWeight: 700, fontSize: 14,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >{t.deleteAccount}</button>
        </div>
      </div>

      {deleteOpen && (
        <div
          role="dialog" aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) setDeleteOpen(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,.62)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 16,
          }}
        >
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 18,
            padding: 26, width: '100%', maxWidth: 420, boxShadow: '0 30px 70px rgba(0,0,0,.5)',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{t.deleteAccountTitle}</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {t.deleteAccountBody}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                onClick={() => setDeleteOpen(false)} disabled={deleting}
                className="btn btn-ghost" style={{ flex: 1, padding: '11px 16px' }}
              >{t.cancelBtn}</button>
              <button
                onClick={confirmDelete} disabled={deleting}
                style={{
                  flex: 1, padding: '11px 16px', borderRadius: 10, border: 'none',
                  background: '#EF4444', color: '#fff', fontWeight: 800, fontSize: 14,
                  cursor: 'pointer', fontFamily: 'inherit', opacity: deleting ? 0.7 : 1,
                }}
              >{deleting ? '…' : t.deleteAccountConfirm}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6,
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 12 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  )
}
