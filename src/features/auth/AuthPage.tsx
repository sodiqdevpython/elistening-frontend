import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { checkUsername, setupProfile, updateAvatar, verifyOtp } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { PageHeader } from '@/components/Layout'
import { HeadphoneIcon } from '@/components/ui'
import HCaptchaBox from '@/components/HCaptchaBox'
import { useAuth } from '@/store/auth'
import { useLang, useT } from '@/i18n'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'elistening_bot'
// Bo'sh bo'lsa captcha o'chiq (lokal). Prod'da build vaqtida beriladi.
const HCAPTCHA_SITEKEY = import.meta.env.VITE_HCAPTCHA_SITEKEY || ''

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

  /**
   * Uch qadam: kod → TIL → profil.
   *
   * Til ENG BIRINCHI so'raladi (foydalanuvchi talabi): keyingi ekranlar
   * allaqachon tanlangan tilda ochiladi, ya'ni odam o'zi tushunadigan
   * tilda ism/daraja kiritadi. Ilgari til ism bilan daraja orasida edi.
   */
  const [step, setStep] = useState<'otp' | 'lang' | 'setup'>('otp')
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [name, setName] = useState('')
  const [level, setLevel] = useState('B1')
  // Username va rasm — IXTIYORIY (bo'sh qoldirsa ham ro'yxatdan o'tadi).
  const [username, setUsername] = useState('')
  const [unameState, setUnameState] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)
  // Interfeys tili — ro'yxatdan o'tishda tanlanadi va profilga saqlanadi.
  // Default: hozir sahifa qaysi tilda ochilgan bo'lsa o'sha.
  const [uiLang, setUiLang] = useState<'uz' | 'en'>(lang)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // hCaptcha tokeni. Captcha o'chiq bo'lsa 'disabled' (login bloklanmaydi).
  const [captchaToken, setCaptchaToken] = useState('')
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  const confirm = useCallback(async (code: string) => {
    setBusy(true)
    setError('')
    try {
      const result = await verifyOtp(code, captchaToken)
      signIn(result.access, result.refresh, result.user)
      if (result.needs_setup) {
        setName(result.user.display_name || '')
        setLevel(result.user.cefr_level || 'B1')
        setStep('lang')
      } else {
        navigate('/profile')
      }
    } catch (err) {
      setError(errorMessage(err, t.authInvalidCode))
      setDigits(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
      // Token bir martalik — xatodan keyin captchani qayta yechish kerak.
      if (HCAPTCHA_SITEKEY) { setCaptchaToken(''); window.hcaptcha?.reset() }
    } finally {
      setBusy(false)
    }
  }, [navigate, signIn, t.authInvalidCode, captchaToken])

  // 6 xonali kod to'liq kiritilishi bilan avtomatik yuboramiz — LEKIN captcha
  // yechilgan bo'lsa (yoki o'chiq bo'lsa). Aks holda kutamiz.
  useEffect(() => {
    if (step !== 'otp' || busy) return
    if (!captchaToken) return // captcha hali yechilmagan
    const code = digits.join('')
    if (code.length === 6 && /^\d{6}$/.test(code)) {
      confirm(code)
    }
  }, [digits, step, busy, confirm, captchaToken])

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
    // ko'radi (keyingi ekran allaqachon shu tilda ochiladi).
    setLang(next)
    setStep('setup')
  }

  /** Username bandligini 400 ms debounce bilan tekshiramiz. */
  useEffect(() => {
    const value = username.trim()
    if (step !== 'setup' || !value) { setUnameState('idle'); return }
    setUnameState('checking')
    let alive = true
    const id = window.setTimeout(() => {
      checkUsername(value)
        .then((r) => { if (alive) setUnameState(r.available ? 'free' : 'taken') })
        .catch(() => { if (alive) setUnameState('idle') })
    }, 400)
    return () => { alive = false; window.clearTimeout(id) }
  }, [username, step])

  const pickPhoto = (file: File | undefined) => {
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const save = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      let me = await setupProfile({
        display_name: name.trim(), cefr_level: level, language: uiLang,
        ...(username.trim() ? { username: username.trim() } : {}),
      })
      // Rasm IXTIYORIY — tanlangan bo'lsa profil saqlangandan keyin
      // yuklanadi. Yuklanmasa ham ro'yxatdan o'tish buzilmaydi.
      if (photo) {
        try { me = await updateAvatar(photo) } catch { /* rasmsiz davom etamiz */ }
      }
      setUser(me)
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

              {/* Captcha — VITE_HCAPTCHA_SITEKEY berilgan bo'lsa ko'rinadi.
                  Yechilmaguncha 6 raqamli kod yuborilmaydi. */}
              <div style={{ margin: '4px 0 14px' }}>
                <HCaptchaBox sitekey={HCAPTCHA_SITEKEY} onToken={setCaptchaToken} />
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

          {step === 'lang' && (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 10px' }}>
                {t.authLangStepTitle}
              </h1>
              <p style={{
                fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 28px',
              }}>{t.authLangStepDesc}</p>
              <div style={{ display: 'grid', gap: 10 }}>
                {([['uz', "O'zbekcha"], ['en', 'English']] as const).map(([code, label]) => (
                  <button key={code} onClick={() => pickLang(code)}
                    aria-pressed={uiLang === code}
                    style={{
                      border: `1.5px solid ${uiLang === code ? '#10B981' : 'var(--border)'}`,
                      background: uiLang === code ? 'var(--ok-bg)' : 'transparent',
                      color: uiLang === code ? '#059669' : 'var(--text)',
                      borderRadius: 12, padding: '16px 0',
                      fontSize: 16, fontWeight: 800, cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}>{label}</button>
                ))}
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
              {/* Username — IXTIYORIY. Band bo'lsa saqlash tugmasi o'chadi. */}
              <input className="field" value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32))}
                placeholder={t.authUsernameLabel} aria-label={t.authUsernameLabel} />
              <div style={{
                fontSize: 12, fontWeight: 600, minHeight: 18, textAlign: 'left',
                margin: '5px 0 14px',
                color: unameState === 'taken' ? '#EF4444'
                  : unameState === 'free' ? '#059669' : 'var(--text-secondary)',
              }}>
                {unameState === 'checking' && '…'}
                {unameState === 'free' && t.usernameFree}
                {unameState === 'taken' && t.usernameTaken}
              </div>

              {/* Rasm — IXTIYORIY, qo'ymasa ham bo'ladi. */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                  overflow: 'hidden', background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {photoPreview
                    ? <img src={photoPreview} alt="" width={52} height={52}
                        style={{ width: 52, height: 52, objectFit: 'cover' }} />
                    : <span style={{ fontSize: 20, color: 'var(--text-secondary)' }}>⊕</span>}
                </div>
                <button className="btn btn-ghost" type="button"
                  onClick={() => fileRef.current?.click()}
                  style={{ padding: '9px 16px', fontSize: 13, borderRadius: 10 }}>
                  {t.authPhotoPick}
                </button>
                {!!photo && (
                  <button className="btn btn-ghost" type="button"
                    onClick={() => { setPhoto(null); setPhotoPreview('') }}
                    style={{ padding: '9px 14px', fontSize: 13, borderRadius: 10 }}>
                    {t.authPhotoRemove}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" hidden
                  onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
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
                onClick={save} disabled={busy || !name.trim() || unameState === 'taken' || unameState === 'checking'}>
                {busy ? '…' : t.authSaveBtn}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
