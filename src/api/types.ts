// AI transkriptdan keyin daraja avtomatik to'ldiriladi — dastlab bo'sh (''}) bo'lishi mumkin.
export type Cefr = '' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

/** Diktant mavzusi — backend `Dictation.Type` bilan bir xil. */
export type DictationTypeKey =
  | 'short_story' | 'conversation' | 'number' | 'spelling' | 'ielts'
  | 'toefl' | 'toeic' | 'news' | 'random_video' | 'ted'
  | 'kids_story'

/** Body ichidagi bitta chunk — timestamp + matn. */
export interface DictationChunk {
  start_ms: number
  end_ms: number
  text: string
}

export interface Dictation {
  id: number
  slug: string
  title: string
  type: DictationTypeKey
  type_label: string
  type_slug: string          // URL uchun: short_story → short-stories
  cefr_level: Cefr
  audio_url: string | null
  is_media: boolean
  youtube_link: string
  /** i.ytimg.com dan thumbnail yuklash uchun — 11 belgili YouTube video ID.
   *  is_media=False bo'lsa null. */
  youtube_id: string | null
  duration_sec: number
  duration_label: string
  chunks_count: number
  views: number
  likes: number
  dislikes: number
  practiced_time: number
  created_at: string
  /** Kirgan foydalanuvchining bu diktantdagi progressi (foizda).
   *  Null bo'lsa — hali ishlanmagan yoki foydalanuvchi kirmagan. */
  my_progress_percent: number | null
}

/** Whisper'dan kelgan so'z-darajasidagi timestamp (sekundlarda). */
export interface DictationWord {
  start: number
  end: number
  word: string
}

export interface DictationDetail extends Dictation {
  body: DictationChunk[]
  words_json?: DictationWord[]   // Chunk bo'lishida aniq timestamp uchun
  my_progress?: DictationProgress | null
  // AI listening test — bo'sh bo'lsa test rejimi ko'rinmaydi.
  mcq_questions?: ShortMcqQuestion[]
  tfng_questions?: ShortTfngQuestion[]
  fill_gap_questions?: ShortFillGapQuestion[]
}

export interface DictationProgress {
  percent: number
  last_index: number
  draft_answers: Record<string, unknown>
}

export interface DictationType {
  key: DictationTypeKey
  label: string
  count: number
}

// --- Eski turlar (Movies/News/... sahifalari uchun; hozircha bo'sh javob) ---
export type ContentKind = 'lesson' | 'short' | 'video' | 'movie' | 'cartoon' | 'news'

export type ExerciseType =
  | 'dictation' | 'match_word' | 'short_answer' | 'mcq' | 'true_false'
  | 'form_fill' | 'spelling' | 'numbers' | 'map_labeling'
  | 'sentence_completion' | 'matching'

export interface Category {
  id: number
  slug: string
  name_uz: string
  name_en: string
  description_uz: string
  description_en: string
  icon: 'book' | 'chat' | 'headphone' | 'play' | 'medical' | 'wave' | 'hash'
  color: string
  cefr_min: Cefr
  cefr_max: Cefr
  levels: string
  has_video: boolean
  lessons_count: number
  order: number
}

export interface Segment {
  id: number
  index: number
  label: string
  start_ms: number
  end_ms: number
  duration_label: string
  text: string
  words?: { w: string; s: number; e: number }[]
  payload: SegmentPayload
}

export interface SegmentPayload {
  before?: string
  word?: string
  after?: string
  options?: string[]
  memorize?: boolean
}

export interface ExercisePayload {
  prompt?: string
  hint?: string
  question?: string
  options?: string[]
  statement?: string
  template?: string
  blanks?: string[]
  word_bank?: string[]
  before?: string
  after?: string
  title?: string
  fields?: string[]
  length?: number
  mask?: string
  labels?: string[]
  points?: { id: string; x: number; y: number }[]
  column_a?: string[]
  column_b?: string[]
  max_words?: number
  audio_start_ms?: number
  audio_end_ms?: number
}

export interface Exercise {
  id: number
  type: ExerciseType
  title: string
  order: number
  difficulty: number
  payload: ExercisePayload
  segment: number | null
  content?: number | null
  done?: boolean
  audio?: { youtube_id: string | null; start_ms: number; end_ms: number } | null
}

export interface VocabItem {
  id: number
  kind: 'word' | 'idiom' | 'phrasal'
  term: string
  meaning_uz: string
  meaning_en: string
  line: string
  order: number
}

export interface ContentItem {
  id: number
  slug?: string
  kind: ContentKind
  title: string
  description: string
  youtube_id: string | null
  duration_sec: number
  duration_label: string
  cefr_level: Cefr
  /** Kirgan foydalanuvchining bu diktantdagi progressi (foizda).
   *  Null = hali ishlanmagan yoki foydalanuvchi kirmagan. */
  my_progress_percent?: number | null
  category: number | null
  category_slug: string | null
  group: number | null
  tags: string[]
  speaker_gender: string
  accent: string
  is_featured: boolean
  published_at: string | null
  thumb_gradient: string
  accent_from: string
  accent_to: string
  thumbnail_url: string | null
  audio_url: string | null
  artist: string
  genre: string
  source: string
  summary: string
  likes: number
  dislikes: number
}

export interface ContentDetail extends ContentItem {
  segments: Segment[]
  exercises: Exercise[]
  vocab_items: VocabItem[]
  dictation_enabled: boolean
  my_reaction: 'like' | 'dislike' | null
  my_progress: { percent: number; last_segment_index: number; draft_answers: Record<string, unknown> } | null
  stats: Record<string, number>
}

export interface ContentGroup {
  id: number
  title: string
  category: number
  order: number
  is_open_by_default: boolean
  lessons_count: number
  lessons: ContentItem[]
}


// --- Pagination ---------------------------------------------------------
// --- Shorts (AI-generatsiya qilingan qisqa video + savollar) ---

/**
 * Savol raqami — **serverdan** keladi (`number`), pozitsiyadan emas.
 *
 * Sabab: raqamlash MCQ → TFNG → Fill tartibida edi va har bo'lim videoni
 * boshidan oxirigacha alohida bosib o'tardi. Natijada 2-savolning javobi
 * 51-soniyada, 3-niki esa 18-soniyada eshitilishi mumkin edi — foydalanuvchi
 * buni "3, 1, 2, 4" deb ko'rdi. Server endi har savolga videoning
 * XRONOLOGIK tartibidagi raqamini yozadi
 * (`backend/apps/catalog/shorts_pipeline.py::_number_globally`).
 *
 * Eski yozuvlarda maydon bo'lmasligi mumkin — `qNum()` (`utils/questionNumber`)
 * u holda pozitsiyaga qaytadi.
 */
export interface QuestionNumbered {
  number?: number
}

export interface ShortMcqQuestion extends QuestionNumbered {
  question: string
  options: Record<string, string>   // { A, B, C, D }
  answer: string                    // 'A' | 'B' | 'C' | 'D'
  proof_from_text: string           // "[12.3] iqtibos"
}
export interface ShortTfngQuestion extends QuestionNumbered {
  question: string
  answer: 'True' | 'False' | 'Not given' | string
  proof_from_text: string
}
export interface ShortFillGapQuestion extends QuestionNumbered {
  /** Ichida "___" bo'lgan gap. */
  sentence: string
  /** Eskicha yagona javob (legacy). */
  answer?: string
  /** IELTS uslubidagi barcha qabul qilinadigan variantlar
   *  (masalan `["10", "ten"]` yoki `["colour", "color"]`). */
  answers?: string[]
  /** IELTS ko'rsatmasi — "Write NO MORE THAN X WORDS AND/OR A NUMBER…" */
  hint?: string
  proof_from_text: string
}
export type ShortContentType = 'short' | 'news' | 'cartoon' | 'movie'
export interface Short {
  id: number
  content_type: ShortContentType
  /**
   * Player tik (9:16) yoki keng (16:9) chizilishi — server HAVOLADAN
   * aniqlaydi: `/shorts/` bo'lsa `true`, oddiy `watch?v=` bo'lsa `false`.
   * `content_type` ga bog'liq emas: Filmlar bo'limiga qo'shilgan oddiy
   * video ham keng player oladi (`Short.is_vertical`).
   * Eski javoblarda bo'lmasligi mumkin — `undefined` = tik (eski xulq).
   */
  is_vertical?: boolean
  youtube_id: string
  youtube_link: string
  title: string
  duration_sec: number
  cefr_from: string
  cefr_to: string
  tags: string[]
  mcq_questions: ShortMcqQuestion[]
  tfng_questions: ShortTfngQuestion[]
  fill_gap_questions: ShortFillGapQuestion[]
  views: number
  likes: number
  dislikes: number
  created_at: string
}

export interface Paginated<T> {
  count: number
  page: number
  page_size: number
  total_pages: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface CursorPaginated<T> {
  next: string | null
  previous: string | null
  results: T[]
}

// --- Foydalanuvchi ------------------------------------------------------
export interface Me {
  id: number
  username: string
  display_name: string
  initial: string
  avatar_url: string | null
  telegram_username: string
  cefr_level: Cefr
  next_level: Cefr
  required_hours: number
  gender: string
  language: string
  last_active_at: string | null
  invite_code: string
  /** Taklif havolasi — BOTGA olib boradi (`t.me/<bot>?start=<kod>`). */
  invite_link: string
  /** JAMI olib kelgan yangi foydalanuvchilar (sovg'a olingach ham kamaymaydi). */
  invited_count: number
  /** Keyingi sovg'agacha yana nechta taklif kerak. */
  invites_to_next_reward: number
  date_joined: string
  plan: string
  today_seconds: number
}

export interface Stats {
  join_date: string
  active_days: number
  last_active_hours_ago: number | null
  active_time_hours: number
  last7_hours: number
  last30_hours: number
  // Aniq soniyalar — frontend smart format ("45s"/"12m"/"1h 23m") uchun
  active_time_seconds: number
  last7_seconds: number
  last30_seconds: number
  level: Cefr
  next_level: Cefr
  required_hours: number
  level_progress_percent: number
}

export interface ActivityDay {
  date: string
  seconds: number
  hours: number
}

export interface LeaderboardRow {
  rank: number
  user_id: number
  name: string
  username: string
  initial: string
  /** Foydalanuvchi rasm qo'ygan bo'lsa to'liq URL, aks holda `null`. */
  avatar_url: string | null
  hours: number
  is_me: boolean
}

export interface Plan {
  id: number
  code: string
  name_uz: string
  name_en: string
  price_uzs: number
  price_usd: string
  price_label_uz: string
  price_label_en: string
  features_uz: string[]
  features_en: string[]
  is_default: boolean
  order: number
  /** `null` = cheksiz, `0` = umuman mumkin emas, N = kuniga N ta. */
  daily_shorts_limit: number | null
  daily_video_limit: number | null
  daily_dictation_limit: number | null
  daily_ielts_limit: number | null
}

export interface LimitBucket {
  limit: number | null
  used: number
  remaining: number | null
}

/** `GET /api/me/limits/` — joriy tarif + bugungi sarf. */
export interface LimitsSnapshot {
  plan: string
  plan_name_uz: string
  plan_name_en: string
  date: string
  limits: { shorts: LimitBucket; video: LimitBucket; dictation: LimitBucket; ielts: LimitBucket }
}

export interface GradeResponse {
  id: number
  is_correct: boolean
  score: number
  feedback: {
    words?: { w: string; found: boolean; dots: string }[]
    blanks?: Record<string, boolean>
    fields?: Record<string, boolean>
    matched?: number
    total?: number
  }
}


/** `GET /api/me/sessions/` — bitta faol qurilma. */
export interface SessionRow {
  id: number
  platform: 'web' | 'mobile' | string
  /** "Chrome · Windows" ko'rinishidagi qisqa nom (server tayyorlaydi). */
  device: string
  ip_address: string | null
  created_at: string
  last_seen_at: string | null
  is_current: boolean
}

/** `GET /api/me/invites/` — taklif hisobi va olingan sovg'alar. */
export interface InviteStats {
  invited_total: number
  granted_plus_months: number
  granted_pro_months: number
  next_reward_plan: string
  next_reward_at: number
  next_reward_left: number
  step: number
  step_progress: number
  tiers: { plan: string; invites: number }[]
  rewards: {
    id: number
    plan: string
    plan_name_uz: string
    plan_name_en: string
    months: number
    invites_spent: number
    created_at: string
  }[]
}

/** Tarif tarixining bitta yozuvi (`GET /api/me/subscriptions/`). */
export interface SubscriptionEventRow {
  id: number
  plan: string
  plan_name_uz: string
  plan_name_en: string
  /** `paid` | `invite` | `manual` | `test` | `free` */
  reason: string
  reason_label: string
  months: number
  started_at: string
  expires_at: string | null
  note: string
  created_at: string
}

export interface SubscriptionHistory {
  current: {
    plan: string
    plan_name_uz: string
    plan_name_en: string
    status: string
    reason: string
    started_at: string
    expires_at: string | null
    is_active: boolean
  } | null
  results: SubscriptionEventRow[]
}


/**
 * `GET /api/app-ad/` — ochilishda chiqadigan reklama (backend `AppAd`).
 *
 * Ikkita rasm: `image_web_url` sayt uchun (keng), `image_url` mobil uchun
 * (tik). Sayt rasmi bo'sh bo'lsa server o'zi mobil rasmni qaytaradi.
 */
export interface AppAd {
  id: number
  image_url: string
  image_web_url: string
  title: string
  body: string
  link_url: string
  duration_sec: number
}
