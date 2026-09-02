import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setupProfile, verifyOtp } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { PageHeader } from '@/components/Layout'
import { HeadphoneIcon } from '@/components/ui'
import { useAuth } from '@/store/auth'
import { useLang, useT } from '@/i18n'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'elistening_bot'

/**
 * Kirish oqimi (soddalashtirilgan):
 *   1. Kod maydonlari birdaniga ko'rinadi (oraliq ekran yo'q)
 *   2. 6 xonali kod to'liq kiritilgach avtomatik yuboriladi
 *   3. Yangi foydalanuvchi bo'lsa profil to'ldirish ekraniga o'tadi
 * Botga o'tish tugmasi pastda, ko'makchi sifatida.
 */
export default function AuthPage() {
  const t = useT()
  const { lang, setLang } = useLang()
  const navigate = useNavigate()
  const { signIn, setUser } = useAuth()

  const [step, setStep] = useState<'otp' | 'setup'>('otp')
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [name, setName] = useState('')
  const [level, setLevel] = useState('B1')
  // Interfeys tili — ro'yxatdan o'tishda tanlanadi va profilga saqlanadi.
  // Default: hozir sahifa qaysi tilda ochilgan bo'lsa o'sha.
  const [uiLang, setUiLang] = useState<'uz' | 'en'>(lang)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  const confirm = useCallback(async (code: string) => {
    setBusy(true)
    setError('')
    try {
      const result = await verifyOtp(code)
      signIn(result.access, result.refresh, result.user)
      if (result.needs_setup) {
        setName(result.user.display_name || '')
        setLevel(result.user.cefr_level || 'B1')
        setStep('setup')
      } else {
        navigate('/profile')
      }
    } catch (err) {
      setError(errorMessage(err, t.authInvalidCode))
      setDigits(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
    } finally {
      setBusy(false)
    }
  }, [navigate, signIn, t.authInvalidCode])

  // 6 xonali kod to'liq kiritilishi bilan avtomatik yuboramiz.
  useEffect(() => {
    if (step !== 'otp' || busy) return
    const code = digits.join('')
    if (code.length === 6 && /^\d{6}$/.test(code)) {
      confirm(code)
    }
  }, [digits, step, busy, confirm])

  const setDigit = (index: number, value: string) => {
    const char = value.replace(/\D/g, '').slice(-1)
    setDigits((current) => {
      const next = [...current]
      next[index] = char
      return next
    })
    if (char && index < 5) inputs.current[index + 1]?.focus()
  }

  const onPaste = (event: React.ClipboardEvent) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length < 2) return
    event.preventDefault()
    const next = pasted.padEnd(6, ' ').split('').map((c) => (c === ' ' ? '' : c))
    setDigits(next)
    inputs.current[Math.min(pasted.length, 5)]?.focus()
  }

  const pickLang = (next: 'uz' | 'en') => {
    setUiLang(next)
    // Darrov almashtiramiz — foydalanuvchi tanlovi natijasini shu zahoti
    // ko'radi (ekran matnlari o'zgaradi).
    setLang(next)
  }

  const save = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      setUser(await setupProfile({
        display_name: name.trim(), cefr_level: level, language: uiLang,
      }))
      navigate('/')
    } catch (err) {
      setError(errorMessage(err, t.error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader />
      <div style={{
        minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 20px',
      }}>
        <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px',
            background: 'linear-gradient(135deg,#10B981 0%,#2563EB 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(16,185,129,.25)',
          }}>
            <HeadphoneIcon size={28} color="#FFFFFF" />
          </div>

          {step === 'otp' && (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 10px' }}>
                {t.authOtpTitle}
              </h1>
              <p style={{
                fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 28px',
              }}>
                <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noreferrer">
                  @{BOT_USERNAME}
                </a>{' '}botiga <b>/start</b> yozing, 6 xonali kodni oling va bu yerga kiriting.
              </p>

              <div style={{
                display: 'flex', gap: 8, marginBottom: 22, justifyContent: 'center',
                opacity: busy ? 0.6 : 1, transition: 'opacity .15s',
              }}>
                {digits.map((digit, index) => (
                  <input key={index} ref={(el) => { inputs.current[index] = el }}
                    value={digit} inputMode="numeric" maxLength={1}
                    autoFocus={index === 0} disabled={busy}
                    aria-label={`Kod belgisi ${index + 1}`}
                    onChange={(e) => setDigit(index, e.target.value)}
                    onPaste={onPaste}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !digit && index > 0) {
                        inputs.current[index - 1]?.focus()
                      }
                    }}
                    style={{
                      width: 46, height: 56,
                      border: `1.5px solid ${error ? '#EF4444' : digit ? '#2563EB' : 'var(--border)'}`,
                      borderRadius: 12, textAlign: 'center', fontSize: 22, fontWeight: 700,
                      outline: 'none', background: 'var(--bg-secondary)', color: 'var(--text)',
                      transition: 'border-color .15s',
                    }} />
                ))}
              </div>

              <div style={{
                minHeight: 22, fontSize: 13, fontWeight: 600,
                color: busy ? 'var(--text-secondary)' : '#EF4444', marginBottom: 24,
              }}>
                {busy ? 'Tekshirilmoqda...' : error}
              </div>

              <div style={{
                paddingTop: 20, borderTop: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Kodingiz yo'qmi?
                </div>
                <a href={`https://t.me/${BOT_USERNAME}?start=login`}
                  target="_blank" rel="noreferrer"
                  className="btn btn-primary" style={{ textDecoration: 'none' }}>
                  {t.authOpenBot}
                </a>
              </div>
            </>
          )}

          {step === 'setup' && (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 10px' }}>
                {t.authSetupTitle}
              </h1>
              <p style={{
                fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 28px',
              }}>{t.authSetupDesc}</p>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)}
                placeholder={t.authNamePlaceholder} aria-label={t.authNamePlaceholder}
                style={{ marginBottom: 18 }} />
              {/* Interfeys tili — faqat ikkita variant. Tanlangani darrov
                  qo'llanadi va profilga saqlanadi. */}
              <div style={{
                textAlign: 'left', fontSize: 13, fontWeight: 700,
                color: 'var(--text-secondary)', marginBottom: 8,
              }}>{t.authLanguageLabel}</div>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20,
              }}>
                {([['uz', "O'zbekcha"], ['en', 'English']] as const).map(([code, label]) => (
                  <button key={code} onClick={() => pickLang(code)}
                    aria-pressed={uiLang === code}
                    style={{
                      border: `1.5px solid ${uiLang === code ? '#10B981' : 'var(--border)'}`,
                      background: uiLang === code ? 'var(--ok-bg)' : 'transparent',
                      color: uiLang === code ? '#059669' : 'var(--text)',
                      borderRadius: 10, padding: '11px 0',
                      fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}>{label}</button>
                ))}
              </div>

              <div style={{
                textAlign: 'left', fontSize: 13, fontWeight: 700,
                color: 'var(--text-secondary)', marginBottom: 8,
              }}>{t.authLevelLabel}</div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 24,
              }}>
                {LEVELS.map((code) => (
                  <button key={code} onClick={() => setLevel(code)} aria-pressed={level === code}
                    style={{
                      border: `1.5px solid ${level === code ? '#10B981' : 'var(--border)'}`,
                      background: level === code ? 'var(--ok-bg)' : 'transparent',
                      color: level === code ? '#059669' : 'var(--text)',
                      borderRadius: 10, padding: '10px 0',
                      fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    }}>{code}</button>
                ))}
              </div>
              {error && (
                <div style={{
                  fontSize: 13, color: '#EF4444', fontWeight: 600, marginBottom: 14,
                }}>{error}</div>
              )}
              <button className="btn btn-primary" style={{ width: '100%' }}
                onClick={save} disabled={busy || !name.trim()}>
                {busy ? '…' : t.authSaveBtn}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
