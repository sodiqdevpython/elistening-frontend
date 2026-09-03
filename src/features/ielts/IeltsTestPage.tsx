import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  fetchIeltsListeningTest, submitIeltsListeningTest,
  type IeltsSubmitResult,
} from '@/api/endpoints'
import { PageHeader } from '@/components/Layout'
import { ErrorState, Spinner } from '@/components/ui'
import { useAuth } from '@/store/auth'
import AuthGateModal from '@/components/AuthGateModal'
import { useLang, useT } from '@/i18n'
import { fill } from '@/utils/format'

// IELTS Listening test sahifasi.
// - `data.html` — parser tayyorlagan standalone HTML (audio + savollar)
// - iframe `srcDoc` orqali ko'rsatiladi (sandbox: scripts + same-origin)
// - iframe ichidagi Submit tugmasi va sayt sahifasidagi katta "Tugatish"
//   tugmasi bir xil `postMessage({type:'ielts:submit', answers})` yuboradi
// - Kirmagan foydalanuvchi umuman kira olmaydi (AuthGateModal → /auth)
export default function IeltsTestPage() {
  const t = useT()
  const { lang } = useLang()
  const { slug = '' } = useParams<{ slug: string }>()
  const isLoggedIn = useAuth((s) => s.isLoggedIn)
  const authLoading = useAuth((s) => s.loading)
  const navigate = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [result, setResult] = useState<IeltsSubmitResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string>('')
  // Foydalanuvchi "Qaytadan topshirish" bosgan bo'lsa — oldingi natija ekrani
  // yashiriladi va test (iframe) yangidan ko'rsatiladi.
  const [retaking, setRetaking] = useState(false)

  // Auth-gate: kirmagan foydalanuvchi modal ko'radi, undan yopib /auth ga o'tadi.
  const [gateOpen, setGateOpen] = useState(false)
  useEffect(() => {
    if (authLoading) return
    if (!isLoggedIn) setGateOpen(true)
  }, [authLoading, isLoggedIn])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ielts-test', slug],
    queryFn: () => fetchIeltsListeningTest(slug),
    enabled: !!slug && isLoggedIn,
    staleTime: 5 * 60_000,
  })

  // iframe → sayt aloqasi: submit natijasini yig'ib serverga yuboramiz.
  useEffect(() => {
    async function onMsg(e: MessageEvent) {
      const payload = e.data
      if (!payload || typeof payload !== 'object') return
      // Sahifa yuklandi — joriy tilni darrov yuboramiz (iframe ota sahifadan
    // oldin ham yuklanishi mumkin, shu bois u o'zi ham so'raydi).
    if (payload.type === 'ielts:ready') {
      iframeRef.current?.contentWindow?.postMessage({ type: 'ielts:lang', lang }, '*')
      return
    }
    if (payload.type !== 'ielts:submit') return
      const answers = payload.answers
      if (!answers || typeof answers !== 'object') return
      if (!isLoggedIn) {
        setGateOpen(true)
        return
      }
      setSubmitting(true)
      setSubmitError('')
      try {
        const res = await submitIeltsListeningTest(slug, answers)
        setResult(res)
        iframeRef.current?.contentWindow?.postMessage({
          type: 'ielts:reveal',
          results: res.results,
        }, '*')
        // Natija ko'rinishi uchun yuqoriga surash
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } catch (err) {
        setSubmitError(t.ieltsSubmitError)
        console.error(err)
      } finally {
        setSubmitting(false)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [slug, isLoggedIn, lang])

  /**
   * Til o'zgarganda iframe ichidagi matnlarni ham almashtiramiz.
   *
   * Test sahifasi BAZADA saqlanadi (`IeltsListeningTest.html`), ya'ni uni
   * til uchun qayta yasab bo'lmaydi. Shu bois sahifaning o'zida ikkala til
   * turadi va biz faqat qaysi biri ekanini aytamiz
   * (`backend/apps/catalog/ielts_parser.py` → `applyLang`).
   */
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'ielts:lang', lang }, '*')
  }, [lang, data])

  // Yuqoridagi "Tugatish" tugmasi — iframe'ga xabar jo'natadi, u o'z ichida
  // barcha javoblarni yig'ib bizga qaytaradi.
  const askIframeToSubmit = () => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'ielts:request-submit' }, '*')
  }

  // Ko'rsatiladigan natija: yangi topshiriq (`result`) yoki qaytilganda saqlangan
  // oldingi natija (`data.my_result`). Qaytadan topshirilayotgan bo'lsa — yo'q.
  const prevResult = !result && !retaking ? (data?.my_result ?? null) : null
  const certData = result ?? prevResult
  // Faqat OLDINGI natija ekrani bo'lsa iframe (test) yashiriladi — bu yakuniy
  // "sertifikat" ekrani. Yangi topshiriqdan keyin iframe qoladi (javoblarni
  // ko'rib chiqish uchun ranglanadi).
  const showIframe = !prevResult

  const percent = useMemo(() => {
    if (!certData || !certData.total) return 0
    return Math.round((certData.score / certData.total) * 100)
  }, [certData])

  const band = useMemo(() => bandFromScore(certData?.score ?? 0), [certData?.score])

  const retake = () => {
    setResult(null)
    setRetaking(true)
    if (iframeRef.current && data) iframeRef.current.srcdoc = data.html
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Auth-gate modal — kirmagan foydalanuvchiga sahifa ko'rinmaydi.
  if (!authLoading && !isLoggedIn) {
    return (
      <>
        <PageHeader />
        <div className="page" style={{ maxWidth: 780 }}>
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
              IELTS Listening testni topshirish uchun kirish kerak
            </div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
              Natijangizni saqlash va band ballini ko‘rish uchun akkauntingizga
              kiring.
            </div>
            <button
              onClick={() => navigate('/auth')}
              style={{
                background: 'linear-gradient(135deg,#2563EB,#7C3AED)',
                color: '#fff', border: 'none', padding: '12px 28px',
                borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: 'pointer',
              }}
            >{t.loginCta}</button>
          </div>
        </div>
        <AuthGateModal
          open={gateOpen}
          onClose={() => { setGateOpen(false); navigate('/auth') }}
          action="IELTS testni topshirish"
        />
      </>
    )
  }

  return (
    <>
      <PageHeader />
      <div className="page" style={{ maxWidth: 1800, paddingLeft: 12, paddingRight: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap',
        }}>
          <Link to="/ielts-tests" style={{
            color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14,
          }}>{t.backToIeltsList}</Link>
          {data?.title && (
            <div style={{ fontSize: 20, fontWeight: 800, flex: 1, minWidth: 200 }}>{data.title}</div>
          )}
          {/* Yuqoridagi "Tugatish" tugmasi — faqat test yechilayotganda */}
          {data && !certData && (
            <button
              onClick={askIframeToSubmit}
              disabled={submitting}
              style={{
                background: 'linear-gradient(135deg,#10B981,#059669)',
                color: '#fff', border: 'none', padding: '10px 22px',
                borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16,185,129,.25)',
                opacity: submitting ? 0.7 : 1,
              }}
            >{submitting ? 'Tekshirilmoqda…' : t.ieltsFinishAndCheck}</button>
          )}
        </div>

        {isLoading && <Spinner />}
        {isError && <ErrorState onRetry={() => refetch()} />}

        {certData && (
          <Certificate
            title={data?.title || 'IELTS Listening'}
            score={certData.score}
            total={certData.total}
            percent={percent}
            band={band}
            isPrevious={Boolean(prevResult)}
            t={t}
            onRetake={retake}
          />
        )}

        {submitError && (
          <div className="card" style={{
            padding: 14, marginBottom: 16,
            background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B',
          }}>
            {submitError}
          </div>
        )}

        {data && showIframe && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <iframe
              ref={iframeRef}
              title={data.title || 'IELTS Listening test'}
              srcDoc={data.html}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              // Kattaroq container — mavjud viewport'ning ko'p qismini oladi.
              // Navbar (~56px) + page padding (~24px) + toolbar (~60px) = ~140px.
              style={{
                width: '100%', height: 'calc(100vh - 118px)', minHeight: 860,
                border: 0, display: 'block', background: '#f5f6f8',
              }}
              allow="autoplay; encrypted-media"
            />
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Sertifikat uslubidagi natija kartasi — ball halqasi (SVG progress ring),
 * band bali, foiz va harakat tugmalari. `isPrevious` bo'lsa "oxirgi natijangiz"
 * (qaytganda), aks holda yangi topshiriq yakuni.
 */
function Certificate({
  title, score, total, percent, band, isPrevious, t, onRetake,
}: {
  title: string
  score: number
  total: number
  percent: number
  band: string
  isPrevious: boolean
  t: ReturnType<typeof useT>
  onRetake: () => void
}) {
  const R = 52
  const C = 2 * Math.PI * R
  const dash = C * Math.min(1, Math.max(0, percent / 100))
  return (
    <div className="card" style={{
      padding: 28, marginBottom: 16, position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(135deg, rgba(37,99,235,.10), rgba(124,58,237,.10))',
      border: '1px solid #7C3AED33',
      display: 'flex', gap: 26, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center',
    }}>
      {/* Ball halqasi */}
      <div style={{ position: 'relative', width: 128, height: 128, flexShrink: 0 }}>
        <svg width="128" height="128" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={R} fill="none" stroke="var(--border)" strokeWidth="10" />
          <circle
            cx="64" cy="64" r={R} fill="none" stroke="url(#ieltsGrad)" strokeWidth="10"
            strokeLinecap="round" strokeDasharray={`${dash} ${C}`}
            transform="rotate(-90 64 64)"
          />
          <defs>
            <linearGradient id="ieltsGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2563EB" /><stop offset="1" stopColor="#7C3AED" />
            </linearGradient>
          </defs>
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>/ {total}</div>
        </div>
      </div>

      {/* Matn + band + tugmalar */}
      <div style={{ flex: '1 1 260px', minWidth: 240 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', color: '#7C3AED' }}>
          {isPrevious ? t.ieltsPrevResultTitle.toUpperCase() : t.ieltsCongrats.toUpperCase()}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, lineHeight: 1.2 }}>
          {isPrevious ? title : t.ieltsResultTitle}
        </div>
        <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 14 }}>
          {fill(t.ieltsCorrectOf, { score, total })} · {percent}%
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'baseline', gap: 6, marginTop: 12,
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '8px 16px',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>{t.bandLabel}</span>
          <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>{band}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            onClick={onRetake}
            style={{
              padding: '11px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#2563EB,#7C3AED)', color: '#fff',
              fontWeight: 800, fontSize: 14, fontFamily: 'inherit',
            }}
          >↻ {t.ieltsRetake}</button>
          <Link to="/ielts-tests" style={{
            padding: '11px 20px', borderRadius: 10, textDecoration: 'none',
            border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)',
            fontWeight: 700, fontSize: 14,
          }}>{t.backToIeltsList}</Link>
        </div>
      </div>
    </div>
  )
}

function bandFromScore(score: number): string {
  const table: [number, string][] = [
    [39, '9.0'], [37, '8.5'], [35, '8.0'], [32, '7.5'], [30, '7.0'],
    [26, '6.5'], [23, '6.0'], [18, '5.5'], [16, '5.0'], [13, '4.5'],
    [11, '4.0'], [8, '3.5'], [6, '3.0'], [4, '2.5'],
  ]
  for (const [min, b] of table) {
    if (score >= min) return b
  }
  return '< 2.5'
}
