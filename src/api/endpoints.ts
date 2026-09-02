import { api } from './client'
import type {
  ActivityDay, Category, ContentDetail, ContentGroup, ContentItem, CursorPaginated,
  Dictation, DictationDetail, DictationProgress, DictationType,
  GradeResponse, LeaderboardRow, Me,
  Paginated, Plan, Stats,
} from './types'

// --- Diktantlar (asosiy) -----------------------------------------------
export interface DictationQuery {
  type?: string
  level?: string
  search?: string
  page?: number
  page_size?: number
  ordering?: string
}

export async function fetchDictations(params: DictationQuery = {}) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== 'all'),
  )
  const { data } = await api.get<Paginated<Dictation>>('/dictations/', { params: clean })
  return data
}

export async function fetchDictationTypes() {
  const { data } = await api.get<DictationType[]>('/dictations/types/')
  return data
}

export async function fetchDictation(slug: string) {
  const { data } = await api.get<DictationDetail>(`/dictations/${slug}/`)
  return data
}

export async function fetchDictationProgress(slug: string) {
  const { data } = await api.get<DictationProgress>(`/dictations/${slug}/progress/`)
  return data
}

export async function saveDictationProgress(slug: string, payload: {
  percent: number
  last_index?: number
  draft_answers?: Record<string, unknown>
}) {
  const { data } = await api.post<DictationProgress>(`/dictations/${slug}/progress/`, payload)
  return data
}

export async function addDictationPlayedTime(slug: string, ms: number) {
  const { data } = await api.post<{ practiced_time: number }>(
    `/dictations/${slug}/add-time/`, { ms },
  )
  return data
}

// --- Diktant: shikoyat / savol xatolik xabari ---------------------------
// Shorts'dagi bilan bir xil shartnoma — frontend ikkalasi uchun bitta modal
// komponentidan foydalanadi (`components/FeedbackModals.tsx`).
export async function fetchDictationReportReasons() {
  const { data } = await api.get<ShortReportReason[]>('/dictations/report-reasons/')
  return data
}

export async function reportDictation(slug: string, payload: { reason: string; text?: string }) {
  const { data } = await api.post<{ ok: true }>(`/dictations/${slug}/report/`, payload)
  return data
}

export async function reportDictationQuestion(slug: string, text: string) {
  const { data } = await api.post<{ ok: true }>(
    `/dictations/${slug}/question-feedback/`, { text },
  )
  return data
}

export async function fetchMyDictationFeedback(slug: string) {
  const { data } = await api.get<{
    reported: boolean; question_reported: boolean
    my_reaction: ReactionValue; likes: number; dislikes: number
  }>(`/dictations/${slug}/my-feedback/`)
  return data
}

// --- Shorts (AI-generatsiya qilingan qisqa video + savollar) ---
export interface ShortsQuery {
  level?: string
  levels?: string[]
  search?: string
  page?: number
  page_size?: number
  exclude?: number[]
  random?: boolean
  content_type?: string | string[]   // short/news/cartoon/movie (bir yoki bir necha)
}

export async function fetchShorts(params: ShortsQuery = {}) {
  const q: Record<string, string | number> = {}
  if (params.level && params.level !== 'all') q.level = params.level
  if (params.levels && params.levels.length) q.levels = params.levels.join(',')
  if (params.search) q.search = params.search
  if (params.page) q.page = params.page
  if (params.page_size) q.page_size = params.page_size
  if (params.exclude && params.exclude.length) q.exclude = params.exclude.join(',')
  if (params.random) q.random = '1'
  if (params.content_type) {
    q.content_type = Array.isArray(params.content_type)
      ? params.content_type.join(',')
      : params.content_type
  }
  const { data } = await api.get<Paginated<import('./types').Short>>('/shorts/', { params: q })
  return data
}

export async function fetchShort(id: number | string) {
  const { data } = await api.get<import('./types').Short>(`/shorts/${id}/`)
  return data
}

export async function markShortDead(id: number) {
  const { data } = await api.post<{ ok: true; dead: true }>(`/shorts/${id}/mark-dead/`)
  return data
}

/** Lentada video ko'rila boshlaganda chaqiriladi — `views` ni oshiradi.
 *  Ro'yxat endpoint'i `views` ni oshirmaydi, shu bois scroll qilib
 *  ko'rilgan videolar ham hisoblansin uchun alohida chaqiruv. */
export async function registerShortView(id: number) {
  const { data } = await api.post<{ views: number }>(`/shorts/${id}/view/`)
  return data
}

export type ReactionValue = 'like' | 'dislike' | null

/** Like/dislike — server HAR USER 1 MARTA cheklaydi (toggle). Bosilgan
 *  tugmani (`like`/`dislike`) yuboradi; server yangi {likes, dislikes,
 *  my_reaction} qaytaradi. Kirish shart (401 → login modal). */
export async function reactToShort(id: number, reaction: 'like' | 'dislike') {
  const { data } = await api.post<{ likes: number; dislikes: number; my_reaction: ReactionValue }>(
    `/shorts/${id}/react/`, { reaction },
  )
  return data
}

// --- Short: shikoyat / savol xatolik ---
export interface ShortReportReason { key: string; label: string }
export async function fetchShortReportReasons() {
  const { data } = await api.get<ShortReportReason[]>('/shorts/report-reasons/')
  return data
}
export async function reportShort(id: number, payload: { reason: string; text?: string }) {
  const { data } = await api.post<{ ok: true }>(`/shorts/${id}/report/`, payload)
  return data
}
export async function reportShortQuestion(id: number, text: string) {
  const { data } = await api.post<{ ok: true }>(`/shorts/${id}/question-feedback/`, { text })
  return data
}
export async function fetchMyShortFeedback(id: number) {
  const { data } = await api.get<{
    reported: boolean; question_reported: boolean; my_reaction: ReactionValue
  }>(`/shorts/${id}/my-feedback/`)
  return data
}

// --- Dictation: like/dislike + view (Short bilan bir xil mexanizm) ---
export async function reactToDictation(slug: string | number, reaction: 'like' | 'dislike') {
  const { data } = await api.post<{ likes: number; dislikes: number; my_reaction: ReactionValue }>(
    `/dictations/${slug}/react/`, { reaction },
  )
  return data
}
export async function registerDictationView(slug: string | number) {
  const { data } = await api.post<{ views: number }>(`/dictations/${slug}/view/`)
  return data
}

// --- Eski API (Movies/Songs/News uchun) -------------------------------
// Backend hozircha bo'sh javob qaytaradi — sahifalar empty state ko'rsatadi.
export async function fetchHome() {
  const { data } = await api.get<{ categories: Category[]; carousel: ContentItem[] }>('/home/')
  return data
}

/** Global sayt sozlamasi — navbar "Bog'lanish" uchun Telegram username. */
export async function fetchSiteConfig() {
  const { data } = await api.get<{ contact_telegram: string }>('/config/')
  return data
}

export async function fetchCategories() {
  const { data } = await api.get<Category[]>('/categories/')
  return data
}

export async function fetchCategoryGroups(slug: string, params?: { search?: string; level?: string; light?: boolean }) {
  const query: Record<string, string> = {}
  if (params?.search) query.search = params.search
  if (params?.level) query.level = params.level
  if (params?.light) query.light = '1'
  const { data } = await api.get<{
    category: Category
    groups: ContentGroup[]
    ungrouped: ContentItem[]
  }>(`/categories/${slug}/groups/`, { params: query })
  return data
}

export interface ContentQuery {
  kind?: string
  kind_in?: string
  level?: string
  category?: string | number
  group?: number
  gender?: string
  search?: string
  featured?: boolean
  page?: number
  page_size?: number
  ordering?: string
}

export async function fetchContentList(params: ContentQuery) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== 'all'),
  )
  const { data } = await api.get<Paginated<ContentItem>>('/content/', { params: clean })
  return data
}

export async function fetchContentDetail(id: number | string) {
  const { data } = await api.get<ContentDetail>(`/content/${id}/`)
  return data
}

export async function fetchShortsFeed(params: { level?: string; gender?: string; cursor?: string }) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v && v !== 'all'),
  )
  const { data } = await api.get<CursorPaginated<ContentDetail>>('/feed/shorts/', { params: clean })
  return data
}

export async function sendReaction(_id: number, _value: 'like' | 'dislike' | null) {
  // No-op: backend endpoint removed. Return empty stub.
  return { value: null, likes: 0, dislikes: 0 }
}

// --- Grading / progress (eski) -----------------------------------------
export async function submitAttempt(
  _exercise: number, _response: Record<string, unknown>, _timeSpentMs = 0,
) {
  return { id: 0, is_correct: false, score: 0, feedback: {} } as GradeResponse
}

export async function saveProgress(_payload: {
  content: number
  percent: number
  last_segment_index?: number
  draft_answers?: Record<string, unknown>
}) {
  return {}
}

// --- Profil / auth -----------------------------------------------------
export async function verifyOtp(code: string) {
  const { data } = await api.post<{
    access: string; refresh: string; is_new: boolean; needs_setup: boolean; user: Me
  }>('/auth/telegram/verify/', { code })
  return data
}

export async function setupProfile(payload: {
  display_name: string; cefr_level: string
  /** Interfeys tili — yangi foydalanuvchi ro'yxatdan o'tishda tanlaydi. */
  language?: 'uz' | 'en'
  invite_code?: string
}) {
  const { data } = await api.post<Me>('/auth/setup/', payload)
  return data
}

export async function fetchMe() {
  const { data } = await api.get<Me>('/me/')
  return data
}

export async function updateMe(
  payload: Partial<Pick<Me, 'display_name' | 'cefr_level' | 'language'>> & { username?: string },
) {
  const { data } = await api.patch<Me>('/me/', payload)
  return data
}

/** Username bandmi? (mobil ilova bilan bir xil endpoint) */
export async function checkUsername(username: string) {
  const { data } = await api.get<{ available: boolean; username: string; error: string | null }>(
    '/auth/username-check/', { params: { username } },
  )
  return data
}

/**
 * Profil rasmini yuklaydi (`multipart/form-data`).
 * Backend `PATCH /me/` ni ham JSON, ham multipart bilan qabul qiladi —
 * mobil ilova ham aynan shundan foydalanadi.
 */
export async function updateAvatar(file: File) {
  const form = new FormData()
  form.append('avatar', file)
  const { data } = await api.patch<Me>('/me/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function fetchStats() {
  const { data } = await api.get<Stats>('/me/stats/')
  return data
}

export async function fetchActivity(days = 14) {
  const { data } = await api.get<ActivityDay[]>('/me/activity/', { params: { days } })
  return data
}

export async function trackActivity(seconds: number) {
  const { data } = await api.post<{
    ok: boolean; today_seconds: number
  }>('/me/activity/track/', { seconds })
  return data
}

export async function fetchLeaderboard(period: 7 | 30) {
  const { data } = await api.get<{ period: number; my_hours: number; results: LeaderboardRow[] }>(
    '/leaderboard/', { params: { period } },
  )
  return data
}

export async function fetchPlans() {
  const { data } = await api.get<Plan[]>('/billing/plans/')
  return data
}

/**
 * Faol sessiyalar (qurilmalar).
 *
 * Qoida: bir vaqtda **1 web + 1 mobil**. Bu ro'yxat yangi ruxsat bermaydi,
 * u faqat qayerdan kirilganini ko'rsatadi va uzib qo'yish imkonini beradi.
 */
export async function fetchSessions() {
  const { data } = await api.get<{ results: import('./types').SessionRow[] }>('/me/sessions/')
  return data.results
}

/** Sessiyani chiqarish: `{ id }` yoki `{ others: true }`. */
export async function revokeSession(payload: { id?: number; others?: boolean }) {
  const { data } = await api.post<{ revoked: number }>('/me/sessions/revoke/', payload)
  return data
}

/** Shu qurilmadan chiqish — server sessiyani o'chiradi (token darrov kuchsiz). */
export async function logoutSession() {
  await api.post('/auth/logout/')
}

/** Taklif hisobi va olingan sovg'alar. */
export async function fetchInvites() {
  const { data } = await api.get<import('./types').InviteStats>('/me/invites/')
  return data
}

/** Tarif tarixi — qachon, qaysi tarif, qanday yo'l bilan (faqat saytda). */
export async function fetchSubscriptionHistory() {
  const { data } = await api.get<import('./types').SubscriptionHistory>('/me/subscriptions/')
  return data
}

export async function fetchMyLimits() {
  const { data } = await api.get<import('./types').LimitsSnapshot>('/me/limits/')
  return data
}

export async function subscribe(plan: string) {
  const { data } = await api.post('/billing/subscribe/', { plan })
  return data
}

export async function addVocab(_vocabItem: number) {
  return { added: true }
}

// --- IELTS Listening tests ---------------------------------------------
export interface IeltsListeningTestSummary {
  id: number
  slug: string
  title: string
  total_questions: number
  views: number
  created_at: string
}

export interface IeltsListeningTestDetail extends IeltsListeningTestSummary {
  html: string
}

export interface IeltsSubmitResult {
  score: number
  total: number
  results: Record<string, boolean>
}

export async function fetchIeltsListeningTests(page = 1) {
  const { data } = await api.get<Paginated<IeltsListeningTestSummary>>(
    '/ielts-tests/', { params: { page } },
  )
  return data
}

export async function fetchIeltsListeningTest(slug: string) {
  const { data } = await api.get<IeltsListeningTestDetail>(`/ielts-tests/${slug}/`)
  return data
}

export async function submitIeltsListeningTest(
  slug: string, answers: Record<string, string | string[]>,
) {
  const { data } = await api.post<IeltsSubmitResult>(
    `/ielts-tests/${slug}/submit/`, { answers },
  )
  return data
}
