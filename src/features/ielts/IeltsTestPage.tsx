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

// IELTS Listening test sahifasi.
// - `data.html` — parser tayyorlagan standalone HTML (audio + savollar)
// - iframe `srcDoc` orqali ko'rsatiladi (sandbox: scripts + same-origin)
// - iframe ichidagi Submit tugmasi va sayt sahifasidagi katta "Tugatish"
//   tugmasi bir xil `postMessage({type:'ielts:submit', answers})` yuboradi
// - Kirmagan foydalanuvchi umuman kira olmaydi (AuthGateModal → /auth)
export default function IeltsTestPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const isLoggedIn = useAuth((s) => s.isLoggedIn)
  const authLoading = useAuth((s) => s.loading)
  const navigate = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [result, setResult] = useState<IeltsSubmitResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string>('')

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
        setSubmitError('Tekshirishda xato. Qayta urinib ko‘ring.')
        console.error(err)
      } finally {
        setSubmitting(false)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [slug, isLoggedIn])

  // Yuqoridagi "Tugatish" tugmasi — iframe'ga xabar jo'natadi, u o'z ichida
  // barcha javoblarni yig'ib bizga qaytaradi.
  const askIframeToSubmit = () => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'ielts:request-submit' }, '*')
  }

  const percent = useMemo(() => {
    if (!result || !result.total) return 0
    return Math.round((result.score / result.total) * 100)
  }, [result])

  const band = useMemo(() => bandFromScore(result?.score ?? 0), [result?.score])

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
            >Akkauntga kirish</button>
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
      <div className="page" style={{ maxWidth: 1500 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap',
        }}>
          <Link to="/ielts-tests" style={{
            color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14,
          }}>← IELTS testlar</Link>
          {data?.title && (
            <div style={{ fontSize: 20, fontWeight: 800, flex: 1, minWidth: 200 }}>{data.title}</div>
          )}
          {/* Yuqoridagi "Tugatish" tugmasi — istalgan payt bosish mumkin */}
          {data && !result && (
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
            >{submitting ? 'Tekshirilmoqda…' : '✓ Tugatish va tekshirish'}</button>
          )}
        </div>

        {isLoading && <Spinner />}
        {isError && <ErrorState onRetry={() => refetch()} />}

        {result && (
          <div className="card" style={{
            padding: 20, marginBottom: 16,
            background: 'linear-gradient(135deg, rgba(37,99,235,.08), rgba(124,58,237,.08))',
            borderColor: '#2563EB33',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '.04em' }}>
                  NATIJA
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1, marginTop: 4 }}>
                  {result.score} / {result.total}
                </div>
                <div style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 14 }}>
                  {percent}% · Band ≈ <b style={{ color: 'var(--text)' }}>{band}</b>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => {
                    setResult(null)
                    if (iframeRef.current && data) {
                      iframeRef.current.srcdoc = data.html
                    }
                  }}
                  style={{
                    padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text)', cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >↻ Qayta topshirish</button>
                <Link to="/ielts-tests" style={{
                  padding: '10px 16px', borderRadius: 8,
                  background: '#2563EB', color: '#fff', textDecoration: 'none', fontWeight: 700,
                }}>Boshqa test</Link>
              </div>
            </div>
          </div>
        )}

        {submitError && (
          <div className="card" style={{
            padding: 14, marginBottom: 16,
            background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B',
          }}>
            {submitError}
          </div>
        )}

        {data && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <iframe
              ref={iframeRef}
              title={data.title || 'IELTS Listening test'}
              srcDoc={data.html}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              // Kattaroq container — mavjud viewport'ning ko'p qismini oladi.
              // Navbar (~56px) + page padding (~24px) + toolbar (~60px) = ~140px.
              style={{
                width: '100%', height: 'calc(100vh - 150px)', minHeight: 720,
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
