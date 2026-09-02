import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from '@/components/Layout'
import { Spinner } from '@/components/ui'
import { useAuth } from '@/store/auth'

// Route darajasida code splitting.
const HomePage = lazy(() => import('@/features/home/HomePage'))
const TopicsPage = lazy(() => import('@/features/lessons/TopicsPage'))
const LessonsPage = lazy(() => import('@/features/lessons/LessonsPage'))
const DictationPage = lazy(() => import('@/features/lessons/DictationPage'))
const ShortsPage = lazy(() => import('@/features/shorts/ShortsPage'))
const VideoTopicPage = lazy(() => import('@/features/videos/VideoTopicPage'))
const IeltsListPage = lazy(() => import('@/features/ielts/IeltsListPage'))
const IeltsTestPage = lazy(() => import('@/features/ielts/IeltsTestPage'))
// News/Cartoons/Movies endi ShortsPage'ga yo'naltirilgan (bir xil AI feed).
const LeaderboardPage = lazy(() => import('@/features/leaderboard/LeaderboardPage'))
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'))
const BillingPage = lazy(() => import('./features/billing/BillingPage'))
const AuthPage = lazy(() => import('@/features/auth/AuthPage'))

export default function App() {
  const hydrate = useAuth((s) => s.hydrate)

  useEffect(() => { hydrate() }, [hydrate])

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />

          {/* Diktant oqimi — hierarxik URL: /topics/:type/:slug */}
          <Route path="topics" element={<TopicsPage />} />
          <Route path="topics/:type" element={<LessonsPage />} />
          <Route path="topics/:type/:slug" element={<DictationPage />} />
          {/* Legacy — eski havolalar buzilmasin uchun */}
          <Route path="lessons/:id" element={<DictationPage />} />
          <Route path="dictations/:slug" element={<DictationPage />} />

          {/* IELTS mock-imtihon sahifalari o'chirildi — IELTS endi shunchaki
              diktant mavzusi: /topics/ielts-listening. Eski havolalar bosh
              sahifaga yo'naltiriladi (pastdagi `*` route). */}

          {/* IELTS Listening testlar — engnovate.com kabi manbadan olib kelingan
              tayyor testlar, HTML iframe srcdoc'da ko'rsatiladi. */}
          <Route path="ielts-tests" element={<IeltsListPage />} />
          <Route path="ielts-tests/:slug" element={<IeltsTestPage />} />

          {/* Media */}
          <Route path="shorts" element={<ShortsPage />} />
          <Route path="shorts/:id" element={<ShortsPage />} />
          {/* Video kontent turlari — bir xil ShortsPage komponenti,
              content_type filtri bilan (backend AI pipeline'i o'shani sozlaydi). */}
          <Route path="news" element={<ShortsPage />} />
          <Route path="news/:id" element={<ShortsPage />} />
          {/* Filmlar / Multfilmlar — GRID ro'yxat (/topics/news kabi). Bitta
              videoni ochish esa vertikal feed'da (`/movies/:id`). */}
          <Route path="movies" element={<VideoTopicPage />} />
          <Route path="movies/:id" element={<ShortsPage />} />
          <Route path="cartoons" element={<VideoTopicPage />} />
          <Route path="cartoons/:id" element={<ShortsPage />} />
          {/* Eski Movies detail sahifasi endi ishlatilmaydi lekin importlarni
              olib tashlamaymiz — kelajakda kerak bo'lishi mumkin. */}
          {/* Eski soxta /videos sahifasi o'chirildi — "Videolar" endi
              `random_video` diktant mavzusi. */}
          <Route path="videos" element={<Navigate to="/topics/random-videos" replace />} />

          {/* Foydalanuvchi */}
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          {/* Tarif tanlash — Telegram bot limitga yetilganda shu yerga
              yo'naltiradi (ilovada tashqi to'lov havolasi bo'lmasligi kerak). */}
          <Route path="profile/billing" element={<BillingPage />} />
          <Route path="auth" element={<AuthPage />} />
          <Route path="invite/:code" element={<AuthPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
