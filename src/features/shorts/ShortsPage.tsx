import {
  createContext, memo, useCallback, useContext, useEffect,
  useLayoutEffect, useMemo, useRef, useState,
} from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  fetchShort, fetchShorts, fetchMyShortFeedback, fetchShortReportReasons,
  markShortDead, reactToShort, registerShortView, reportShort, reportShortQuestion,
} from '@/api/endpoints'
import type {
  Cefr, Short, ShortContentType, ShortFillGapQuestion,
  ShortMcqQuestion, ShortTfngQuestion,
} from '@/api/types'
import ShortsPlayer, { type ShortsPlayerHandle } from '@/components/ShortsPlayer'
import QuestionPositionThermometer from '@/components/QuestionPositionThermometer'
import CoachTour, { firstVisible, type TourStep } from '@/components/CoachTour'
import { QuestionFeedbackModal, ReportModal } from '@/components/FeedbackModals'
import { ErrorState, Spinner } from '@/components/ui'
import AuthGateModal from '@/components/AuthGateModal'
import { useAuth } from '@/store/auth'
import { TOUR, useTour } from '@/utils/onboarding'
import { shortPoster } from '@/utils/youtube'
import { shuffleOptions } from '@/utils/shuffle'
import { qNum } from '@/utils/questionNumber'
import { useT } from '@/i18n'

/* ============================================================
 * Konstantalar
 * ============================================================ */

const LEVELS: Cefr[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const PAGE_SIZE = 6
/** Lentada ushlab turiladigan maksimal element (RAM chegarasi). */
const MAX_ITEMS = 60
/** Scroll to'xtaganini aniqlash — shundan keyin player almashadi. */
const SETTLE_MS = 130
/** DOM'da to'liq chiziladigan slotlar oralig'i: |i - active| <= WINDOW */
const WINDOW = 2
/** Iframe faqat 2 ta bo'ladi: faol slot + scroll yo'nalishidagi keyingisi. */
const PRELOAD_AHEAD = 1
/** Ro'yxatdan o'tmagan foydalanuvchi ko'radigan maksimal shorts soni.
 *  3-slot — kirish devori (login wall + modal). */
const GUEST_LIMIT = 2

const MUTE_KEY = 'listening.shorts.muted'
const REACTIONS_KEY = 'listening.shorts.reactions'
const SEEN_KEY = 'listening.shorts.seen'
// Nechta ko'rilgan id eslab qolinadi (localStorage). 600 id ~4KB — arzon.
// Chuqurroq oyna = ko'rilgan video ancha uzoq qaytmaydi. Odatiy foydalanuvchi
// haftasiga ~300 video ko'radi, shu bois 1 haftada takror deyarli bo'lmaydi.
const SEEN_MAX = 600
const MODE_KEY = 'listening.shorts.mode'

/** Savol rejimi: `instant` — javob berilgach darrov ranglash + isbot.
 *  `exam` — hamma savolga javob berib bo'lgangacha ranglar yashiringan,
 *  faqat oxirida natija va isbotlar ochiladi. */
type QMode = 'instant' | 'exam'
function loadMode(): QMode {
  try {
    const v = localStorage.getItem(MODE_KEY)
    return v === 'exam' ? 'exam' : 'instant'
  } catch { return 'instant' }
}
function saveMode(m: QMode) {
  try { localStorage.setItem(MODE_KEY, m) } catch { /* noop */ }
}

/** Shorts panel'ining shrift skaleri (A- / A+). 0.8 - 1.4 oralig'ida,
 *  0.1 qadam bilan yuradi. `listening.shorts.fontScale` — barcha
 *  shorts uchun umumiy. */
const FONT_SCALE_KEY = 'listening.shorts.fontScale'
function clampScale(v: number): number {
  return Math.min(1.4, Math.max(0.8, Math.round(v * 10) / 10))
}
function loadFontScale(): number {
  try {
    const v = parseFloat(localStorage.getItem(FONT_SCALE_KEY) || '1')
    return Number.isFinite(v) ? clampScale(v) : 1
  } catch { return 1 }
}
function saveFontScale(v: number) {
  try { localStorage.setItem(FONT_SCALE_KEY, String(v)) } catch { /* noop */ }
}

const sizeBtnStyle: React.CSSProperties = {
  border: 'none', background: 'transparent', color: 'var(--text-secondary)',
  cursor: 'pointer', padding: '3px 8px', borderRadius: 999,
  fontSize: 11, fontWeight: 800, fontFamily: 'inherit', minWidth: 24,
}

/** Shrift skaleri BUTUN feed uchun umumiy — bitta video'da A+/A− bosilsa
 *  BARCHA videolarga darrov ta'sir qiladi (ilgari har panel o'z holatini
 *  saqlar edi va foydalanuvchi har video'da qaytadan sozlashga majbur edi). */
const FontScaleContext = createContext<{ scale: number; bump: (d: number) => void }>({
  scale: 1, bump: () => {},
})

/** Tizimga kirmagan foydalanuvchi Shorts'ni KO'RA oladi, lekin ISHLAY olmaydi
 *  (savolga javob, like/dislike). `requireAuth()` — ruxsat bo'lsa `true`
 *  qaytaradi; aks holda `false` va kirish modalini ochadi. */
const ShortsAuthContext = createContext<{ requireAuth: (action?: string) => boolean }>({
  requireAuth: () => true,
})
/** `exclude=` ga jo'natiladigan maksimal id soni. 400 id ~2.4KB query string —
 *  har qanday proxy/nginx uchun xavfsiz (8KB limitdan ancha past). Serverga
 *  qo'shimcha yuk yo'q: bitta `NOT IN (...)` filtr. */
const EXCLUDE_MAX = 400

type Reaction = 'like' | 'dislike' | null

/* ============================================================
 * localStorage yordamchilari
 * ============================================================ */

function loadReactions(): Record<number, Reaction> {
  try {
    const raw = localStorage.getItem(REACTIONS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Reaction>
    const out: Record<number, Reaction> = {}
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(k)
      if (Number.isFinite(n) && (v === 'like' || v === 'dislike')) out[n] = v
    }
    return out
  } catch { return {} }
}

function loadSeen(): number[] {
  try {
    const arr = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')
    if (!Array.isArray(arr)) return []
    return arr.filter((x): x is number => typeof x === 'number').slice(0, SEEN_MAX)
  } catch { return [] }
}

function markSeen(id: number) {
  try {
    const list = loadSeen()
    if (list.includes(id)) return
    list.unshift(id)
    localStorage.setItem(SEEN_KEY, JSON.stringify(list.slice(0, SEEN_MAX)))
  } catch { /* noop */ }
}

function loadMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
}

/* ============================================================
 * Daraja filtri
 * ============================================================ */

/** Foydalanuvchi darajasi va bir baland → oraliq. B1 → [B1, B2]. */
function levelPair(cefr: Cefr | ''): [Cefr, Cefr] | null {
  if (!cefr) return null
  const idx = LEVELS.indexOf(cefr)
  if (idx < 0) return null
  if (idx + 1 < LEVELS.length) return [cefr, LEVELS[idx + 1]]
  return [LEVELS[idx - 1], cefr]
}

const RANGE_OPTIONS: { key: string; from: Cefr; to: Cefr }[] = [
  { key: 'A1-A2', from: 'A1', to: 'A2' },
  { key: 'A2-B1', from: 'A2', to: 'B1' },
  { key: 'B1-B2', from: 'B1', to: 'B2' },
  { key: 'B2-C1', from: 'B2', to: 'C1' },
  { key: 'C1-C2', from: 'C1', to: 'C2' },
]

/* ============================================================
 * Har bir Short uchun mahalliy holat (javoblar + reaksiya)
 * ------------------------------------------------------------
 * Sahifa darajasida saqlanadi — slot DOM'dan chiqib ketsa ham (windowing)
 * foydalanuvchi javoblari yo'qolmaydi.
 * ============================================================ */

interface ShortState {
  mcq: Record<number, string>
  tfng: Record<number, string>
  fill: Record<number, string>   // foydalanuvchi yozgan so'z
  reaction: Reaction
  likes: number | null      // null → serverdagi qiymat ishlatiladi
  dislikes: number | null
}

function emptyState(reaction: Reaction = null): ShortState {
  return { mcq: {}, tfng: {}, fill: {}, reaction, likes: null, dislikes: null }
}

function answeredCount(s: ShortState): number {
  return Object.keys(s.mcq).length + Object.keys(s.tfng).length + Object.keys(s.fill).length
}

/** Fill-gap javob taqqoslash — kichik harflar + tinish belgisiz. */
function normalizeFillAnswer(v: string): string {
  return (v || '').toLowerCase().replace(/[^a-z0-9']/g, '').trim()
}

/* ============================================================
 * Feed sahifalash
 * ------------------------------------------------------------
 * Backend `?random=1` da `order_by("?")` qiladi — ya'ni HAR so'rovda
 * tartib boshqacha. Shu sabab `page=2` mutlaqo ishonchsiz: takroriy va
 * tushib qolgan elementlar chiqadi (eski kodda feed shu bois "chalkash"
 * edi). Yechim: har doim 1-sahifani so'raymiz, lekin allaqachon olingan
 * id'larni `exclude=` ga qo'shamiz. Natijada har so'rov FAQAT yangi
 * element qaytaradi.
 * ============================================================ */

interface PageParam {
  exclude: number[]
  /** `true` → ko'rilganlar ham qaytadan chiqariladi (katalog tugagach). */
  loop: boolean
}

export default function ShortsPage() {
  const t = useT()
  const { user } = useAuth()
  const isLoggedIn = Boolean(user)

  // Kontent turi — URL yo'lidan aniqlaymiz: /shorts → short, /news → news,
  // /movies → movie, /cartoons → cartoon.
  const contentType: ShortContentType = useMemo(() => {
    const p = window.location.pathname
    if (p.startsWith('/news')) return 'news'
    if (p.startsWith('/movies')) return 'movie'
    if (p.startsWith('/cartoons')) return 'cartoon'
    return 'short'
  }, [])

  const routeBase = useMemo(() => {
    if (contentType === 'news') return '/news'
    if (contentType === 'movie') return '/movies'
    if (contentType === 'cartoon') return '/cartoons'
    return '/shorts'
  }, [contentType])

  // Pinned id — FAQAT mount vaqtida o'qiladi. Keyin URL'ni
  // `history.replaceState` bilan yangilaymiz, shu bois router qayta
  // render qilmaydi va lenta uzilmaydi.
  const pinnedIdRef = useRef<number | null | undefined>(undefined)
  if (pinnedIdRef.current === undefined) {
    const m = window.location.pathname.match(/\/(shorts|news|movies|cartoons)\/(\d+)/)
    pinnedIdRef.current = m ? Number(m[2]) : null
  }
  const pinnedId = pinnedIdRef.current

  const userRange = useMemo(
    () => levelPair((user?.cefr_level as Cefr) || ''),
    [user?.cefr_level],
  )

  const [rangeKey, setRangeKey] = useState<'auto' | 'all' | string>('auto')

  const levelsParam = useMemo(() => {
    let range: [Cefr, Cefr] | null = null
    if (rangeKey === 'auto') range = userRange
    else if (rangeKey !== 'all') {
      const r = RANGE_OPTIONS.find((o) => o.key === rangeKey)
      range = r ? [r.from, r.to] : null
    }
    if (!range) return { levels: undefined as string[] | undefined, label: 'Hammasi' }
    const a = LEVELS.indexOf(range[0])
    const b = LEVELS.indexOf(range[1])
    if (a < 0 || b < 0) return { levels: undefined, label: 'Hammasi' }
    return {
      levels: LEVELS.slice(Math.min(a, b), Math.max(a, b) + 1) as string[],
      label: `${range[0]}–${range[1]}`,
    }
  }, [rangeKey, userRange])

  // Filtr almashsa yoki "Tozalash" bosilsa ko'rilganlar ro'yxati qayta o'qiladi.
  // "Tozalash" tugmasi olib tashlangan (loop rejimi tufayli kerak emas),
  // shu bois `setSeenEpoch` foydalanuvchi qo'lida yo'q. seenAtStart faqat
  // filtr almashganda qayta o'qiladi (`rangeKey`).
  const [seenEpoch] = useState(0)
  // HAR KIRISHDA yangi lenta. `entryEpoch` — sahifaga har kirilganda (har
  // mount'da) bir marta hosil bo'ladigan noyob qiymat. U feed queryKey'iga
  // qo'shiladi, shuning uchun `/shorts` ga qayta kirilganda react-query ESKI
  // KESH'ni (allaqachon ko'rilgan videolar) qaytarmaydi — YANGI so'rov ketadi
  // va `seenAtStart` (localStorage'dan yangilangan) ko'rilganlarni chetlashtiradi.
  // Natijada har safar imkon qadar KO'RILMAGAN videolar chiqadi.
  const [entryEpoch] = useState(() => Date.now())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const seenAtStart = useMemo(() => loadSeen(), [rangeKey, seenEpoch, entryEpoch])

  const pinnedQuery = useQuery({
    queryKey: ['shorts-pinned', pinnedId],
    queryFn: () => fetchShort(pinnedId as number),
    enabled: pinnedId != null && Number.isFinite(pinnedId),
    staleTime: 5 * 60_000,
  })

  const levelsKey = levelsParam.levels?.join(',') ?? 'all'
  // Lenta tartibi kontent turiga bog'liq:
  //   • `short` — tasodifiy (kashfiyot lentasi, YouTube Shorts kabi)
  //   • news / movie / cartoon — **eng yangilari birinchi**: foydalanuvchi
  //     yangiliklarga kirganda eng so'nggilarini ko'rishi kerak
  // Ikkalasida ham server `priority` ni qat'iy pog'ona sifatida ustun
  // qo'yadi, ko'rilganlar esa `exclude` bilan tashlab yuboriladi.
  const randomOrder = contentType === 'short'
  const feed = useInfiniteQuery({
    queryKey: ['shorts-feed', contentType, levelsKey, seenEpoch, entryEpoch],
    queryFn: ({ pageParam }) => fetchShorts({
      content_type: contentType,
      levels: levelsParam.levels,
      page_size: PAGE_SIZE,
      exclude: pageParam.exclude.slice(0, EXCLUDE_MAX),
      random: randomOrder,
    }),
    initialPageParam: { exclude: seenAtStart, loop: false } as PageParam,
    getNextPageParam: (last, allPages, lastParam): PageParam | undefined => {
      const loaded: number[] = []
      for (const p of allPages) for (const r of p.results) loaded.push(r.id)
      if (last.results.length === 0) {
        // Yangi element qolmadi. Birinchi marta bo'lsa — ko'rilganlarni
        // ham chiqaramiz (loop). Loop rejimida ham bo'sh bo'lsa MEGA-LOOP:
        // exclude ni butunlay bo'shatib qaytamiz — hech qachon dead-end
        // bo'lmaydi (bir xil videolar qaytadan aylanadi).
        if (lastParam.loop && lastParam.exclude.length === 0) return undefined
        if (lastParam.loop) return { exclude: [], loop: true }
        return { exclude: loaded, loop: true }
      }
      // Loop rejimida exclude'ni faqat oxirgi ~20 videoga cheklaymiz —
      // shu bilan bir zumda takroriy bo'lmaydi lekin server har doim
      // element qaytaradi. RAM MAX_ITEMS bilan chegaralanadi lekin loop
      // rejimida limit qo'yilmaydi.
      if (lastParam.loop) {
        const tail = loaded.slice(-20)
        return { exclude: tail, loop: true }
      }
      if (loaded.length >= MAX_ITEMS) {
        // MAX_ITEMS ga yetdik — loop rejimiga o'tamiz, ko'rilganlarni
        // qayta ko'rsata boshlaymiz.
        return { exclude: loaded.slice(-20), loop: true }
      }
      return { exclude: [...seenAtStart, ...loaded], loop: false }
    },
    // Mount davomida qayta yuklamaymiz (scroll paytida lenta sakramasin).
    staleTime: Infinity,
    // `entryEpoch` sabab har kirish yangi queryKey — eski lentalar observer'siz
    // qoladi. gcTime qisqa (30s): ular tez tozalanadi, RAM yig'ilmaydi.
    gcTime: 30_000,
    refetchOnWindowFocus: false,
  })

  // Sessiya davomida YouTube xato bergan (mavjud emas / private) Shorts id'lari.
  // Backend'da ham `is_dead=True` qilib qo'yamiz, lekin feed'ning shu paytdagi
  // ro'yxati allaqachon o'z ichida bo'lgani sabab client tomonda filtrlaymiz.
  const [deadIds, setDeadIds] = useState<Set<number>>(() => new Set())
  const reportDead = useCallback((id: number) => {
    setDeadIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
    markShortDead(id).catch(() => { /* jimgina — UI allaqachon skip qildi */ })
  }, [])

  /** Yakuniy ro'yxat: pinned + feed, o'liklar chiqarilgan.
   *
   *  MUHIM: LOOP rejimida bir video QAYTA chiqishi mumkin — bu ataylab, feed
   *  hech qachon tugamasin uchun. Shu bois GLOBAL dedup YO'Q (ilgari bor edi va
   *  loop'dagi takroriy videolar shu yerda filtrlanib, ro'yxat katalog
   *  hajmida "qotib" qolardi — foydalanuvchi oxirgi videoda to'xtardi).
   *  Faqat KETMA-KET bir xil videoni (server chekkasida deyarli bo'lmaydi,
   *  lekin ehtiyot) va o'lik videolarni tashlaymiz. Har element `key` bilan
   *  keladi — bir xil `id` bir necha marta chiqsa ham React uchun uniq. */
  const items = useMemo(() => {
    const out: { short: Short; key: string }[] = []
    const occur = new Map<number, number>()
    const push = (s: Short) => {
      if (deadIds.has(s.id)) return
      if (out.length && out[out.length - 1].short.id === s.id) return
      const n = (occur.get(s.id) ?? 0) + 1
      occur.set(s.id, n)
      out.push({ short: s, key: `${s.id}#${n}` })
    }
    if (pinnedQuery.data) push(pinnedQuery.data)
    for (const p of feed.data?.pages ?? []) for (const s of p.results) push(s)
    return out
  }, [feed.data, pinnedQuery.data, deadIds])

  // Guest (ro'yxatdan o'tmagan): faqat dastlabki GUEST_LIMIT ta shorts + 3-slot
  // kirish devori. Login qilgan: hammasi.
  const visibleItems = isLoggedIn ? items : items.slice(0, GUEST_LIMIT)
  const showGuestGate = !isLoggedIn && items.length > 0
  const gateIdx = visibleItems.length            // kirish devori sloti indeksi
  const slotCount = visibleItems.length + (showGuestGate ? 1 : 0)

  const itemsRef = useRef(visibleItems)
  itemsRef.current = visibleItems
  // Scroll chegaralari kirish devori slotini ham hisobga oladi.
  const slotCountRef = useRef(slotCount)
  slotCountRef.current = slotCount
  const hasItems = visibleItems.length > 0

  /* ---------- Scroll / faol slot ---------- */

  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // `activeIdx` — scroll paytida DARROV yangilanadi (UI, windowing uchun).
  const [activeIdx, setActiveIdx] = useState(0)
  // `playIdx` — scroll TO'XTAGACH yangilanadi. Faqat shu indeks ijro etadi.
  // Ikkiga ajratish tez scroll paytida iframe'lar mount/unmount bo'lib
  // ketishining (va noto'g'ri video ovozining) oldini oladi.
  const [playIdx, setPlayIdx] = useState(0)
  // Scroll yo'nalishi: +1 pastga, -1 yuqoriga. Oldindan yuklanadigan slot
  // shu yo'nalishda tanlanadi — natijada iframe soni 2 ta bo'lib qoladi
  // (RAM), lekin ikkala tomonga ham silliq o'tiladi.
  const [dir, setDir] = useState<1 | -1>(1)
  // Kunlik shorts limitiga yetildimi — faol slotning `view` chaqiruvi 403
  // qaytarsa `true` bo'ladi. Ijroni to'xtatadi (`playing && !limitHit`); global
  // LimitGate modali interceptor orqali allaqachon ochilgan. Oldin ko'rilgan
  // shortga qaytilsa `consume` idempotent — `false` ga qaytadi.
  const [limitHit, setLimitHit] = useState(false)

  /** Slot faol bo'lganda: "ko'rilgan" deb belgilaydi, `views`++ va limit tekshiruvi.
   *  Har KO'RISH hisoblanadi (dedup yo'q — foydalanuvchi shuni so'radi). */
  const trackView = useCallback((id: number) => {
    markSeen(id)
    void registerShortView(id).then(({ limited }) => setLimitHit(limited))
  }, [])

  const currentIndex = useCallback(() => {
    const root = scrollRef.current
    if (!root) return 0
    const h = root.clientHeight || 1
    const n = slotCountRef.current   // kirish devori slotini ham qamrab oladi
    return Math.max(0, Math.min(n - 1, Math.round(root.scrollTop / h)))
  }, [])

  // Silliq scroll animatsiyasi tugaguncha `scrollTop` eski qiymatda turadi.
  // Shu bois "keyingi" indeks jonli scroll holatidan emas, oxirgi SO'RALGAN
  // nishondan hisoblanadi — aks holda `↓` ni tez-tez bossangiz hammasi bitta
  // slotga tushib, faqat bir marta siljirdi.
  const targetRef = useRef<number | null>(null)

  const scrollToIdx = useCallback((i: number, smooth = true) => {
    const root = scrollRef.current
    if (!root) return
    const n = slotCountRef.current
    if (!n) return
    const target = Math.max(0, Math.min(n - 1, i))
    targetRef.current = target
    root.scrollTo({
      top: target * root.clientHeight,
      behavior: smooth ? 'smooth' : 'auto',
    })
  }, [])

  /** Navigatsiya uchun boshlang'ich indeks: harakatdagi nishon yoki jonli holat. */
  const navBase = useCallback(
    () => targetRef.current ?? currentIndex(),
    [currentIndex],
  )

  // DIQQAT: `hasItems` ham dependency — birinchi renderda ro'yxat bo'sh
  // bo'lgani sabab `.shorts-scroll` DOM'da yo'q. Usiz listener HECH QACHON
  // ulanmasdi va faol slot o'zgarmay qolardi.
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    let rafId = 0
    let settleId = 0
    let lastTop = root.scrollTop

    const settle = () => {
      const idx = currentIndex()
      targetRef.current = null    // animatsiya tugadi
      setPlayIdx((p) => (p === idx ? p : idx))
      const id = itemsRef.current[idx]?.short.id
      if (id != null) {
        trackView(id)
        // Router'ni bezovta qilmasdan URL'ni yangilaymiz — `navigate()`
        // butun daraxtni qayta render qilar va lenta sakrardi.
        const next = `${routeBase}/${id}`
        if (window.location.pathname !== next) {
          window.history.replaceState(window.history.state, '', next)
        }
      }
    }

    const onScroll = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0
          const top = root.scrollTop
          if (Math.abs(top - lastTop) > 4) {
            const d: 1 | -1 = top > lastTop ? 1 : -1
            lastTop = top
            setDir((prev) => (prev === d ? prev : d))
          }
          const idx = currentIndex()
          setActiveIdx((a) => (a === idx ? a : idx))
        })
      }
      window.clearTimeout(settleId)
      settleId = window.setTimeout(settle, SETTLE_MS)
    }

    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      if (rafId) cancelAnimationFrame(rafId)
      window.clearTimeout(settleId)
    }
  }, [currentIndex, hasItems, routeBase, trackView])

  // Birinchi element yuklangach uni "ko'rilgan" deb belgilaymiz.
  const firstMarkedRef = useRef(false)
  useEffect(() => {
    if (firstMarkedRef.current || !items.length) return
    firstMarkedRef.current = true
    trackView(items[0].short.id)
  }, [items, trackView])

  /* ---------- Konteyner balandligi → --slot-h ---------- */

  const [slotH, setSlotH] = useState(0)
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const measure = () => {
      const vh = window.visualViewport?.height ?? window.innerHeight
      const top = root.getBoundingClientRect().top
      root.style.height = `${Math.max(360, Math.round(vh - top))}px`
      const el = scrollRef.current
      if (el) setSlotH(el.clientHeight)
    }
    measure()
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    // `resize` hodisasi ba'zi muhitlarda (embed, devtools emulyatsiyasi)
    // kelmasligi mumkin — <html> o'lchamini kuzatib ham qayta o'lchaymiz.
    const ro = new ResizeObserver(() => measure())
    ro.observe(document.documentElement)
    return () => {
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
      ro.disconnect()
    }
  }, [hasItems])

  /* ---------- Sahifa scroll'ini bloklash ---------- */

  useEffect(() => {
    const b = document.body.style.overflow
    const h = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = b
      document.documentElement.style.overflow = h
    }
  }, [])

  /* ---------- Keyingi sahifani oldindan yuklash ---------- */

  const fetchNext = feed.fetchNextPage
  const hasNext = feed.hasNextPage
  const fetchingNext = feed.isFetchingNextPage
  const isLoadingFeed = feed.isLoading
  useEffect(() => {
    if (!hasNext || fetchingNext || isLoadingFeed) return
    // Guest'ga faqat GUEST_LIMIT ta kerak — ortiqcha sahifa yuklamaymiz.
    if (!isLoggedIn && items.length >= GUEST_LIMIT) return
    // Ro'yxat bo'sh bo'lsa ham (birinchi sahifa 0 qaytargan) keyingisini
    // chaqiramiz — foydalanuvchi darrov "bo'sh" ekranni ko'rmasin.
    if (!items.length || activeIdx >= items.length - 3) void fetchNext()
  }, [activeIdx, items.length, hasNext, fetchingNext, isLoadingFeed, fetchNext, isLoggedIn])

  // Guest kirish devoriga (3-slot) yetganda — chiroyli modal ochamiz.
  useEffect(() => {
    if (showGuestGate && activeIdx >= gateIdx) {
      setAuthGate('Yana shorts ko\'rish')
    }
  }, [showGuestGate, activeIdx, gateIdx])

  /* ---------- Shrift skaleri (butun feed uchun umumiy) ---------- */

  const [fontScale, setFontScale] = useState<number>(loadFontScale)
  const bumpFont = useCallback((delta: number) => {
    setFontScale((s) => {
      const next = clampScale(s + delta)
      saveFontScale(next)
      return next
    })
  }, [])
  const fontCtx = useMemo(() => ({ scale: fontScale, bump: bumpFont }), [fontScale, bumpFont])

  /* ---------- Auth gate (kirmagan foydalanuvchi ishlay olmaydi) ---------- */

  const [authGate, setAuthGate] = useState<null | string>(null)
  const requireAuth = useCallback((action?: string): boolean => {
    if (isLoggedIn) return true
    setAuthGate(action ?? 'Bu amal')
    return false
  }, [isLoggedIn])
  const authCtx = useMemo(() => ({ requireAuth }), [requireAuth])

  /* ---------- Ovoz ---------- */

  const [muted, setMuted] = useState(loadMuted)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const toggleMuted = useCallback(() => {
    setMuted((m) => {
      const next = !m
      try { localStorage.setItem(MUTE_KEY, next ? '1' : '0') } catch { /* noop */ }
      if (!next) setAutoplayBlocked(false)
      return next
    })
  }, [])
  const onAutoplayBlocked = useCallback(() => {
    setMuted(true)
    setAutoplayBlocked(true)
  }, [])

  /* ---------- Klaviatura ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName || ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault(); scrollToIdx(navBase() + 1)
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault(); scrollToIdx(navBase() - 1)
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMuted()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scrollToIdx, navBase, toggleMuted])

  /* ---------- Har bir Short holati ---------- */

  const savedReactionsRef = useRef<Record<number, Reaction> | null>(null)
  if (savedReactionsRef.current === null) savedReactionsRef.current = loadReactions()

  const [states, setStates] = useState<Record<number, ShortState>>({})

  // Hali tegilmagan Short'lar uchun bo'sh holat — HAR RENDERDA yangi obyekt
  // yaratilsa `memo` buzilar va butun ro'yxat qayta chizilardi. Shu bois
  // default obyektlar keshlanadi (identity barqaror).
  const defaultsRef = useRef<Map<number, ShortState>>(new Map())
  const getState = useCallback((id: number): ShortState => {
    const cur = states[id]
    if (cur) return cur
    let def = defaultsRef.current.get(id)
    if (!def) {
      def = emptyState(savedReactionsRef.current?.[id] ?? null)
      defaultsRef.current.set(id, def)
    }
    return def
  }, [states])

  const updateState = useCallback((id: number, patch: (s: ShortState) => ShortState) => {
    setStates((prev) => {
      let cur = prev[id]
      if (!cur) {
        cur = defaultsRef.current.get(id)
          ?? emptyState(savedReactionsRef.current?.[id] ?? null)
      }
      const next = patch(cur)
      if (next === cur) return prev
      return { ...prev, [id]: next }
    })
  }, [])

  /* ---------- Render ---------- */

  const showEmpty = !feed.isLoading && !feed.isFetching && !feed.isError && !items.length

  return (
    <FontScaleContext.Provider value={fontCtx}>
    <ShortsAuthContext.Provider value={authCtx}>
    <div
      ref={rootRef}
      className="shorts-root"
      style={slotH ? ({ '--slot-h': `${slotH}px` } as React.CSSProperties) : undefined}
    >
      {/* Yuqori panel — faqat daraja tanlash. Video hisobi, "Bosh sahifa" va
          ovoz tugmasi olib tashlangan (navbar + video player'ning O'ZI ularni
          taqdim etadi). "Ovozni yoqing" ogohlantirishi ko'rinadi faqat
          autoplay bloklangan holatda. */}
      <div className="shorts-bar">
        <select
          value={rangeKey}
          onChange={(e) => setRangeKey(e.target.value)}
          aria-label={t.levelRangeAria}
          style={{
            background: 'var(--bg-secondary)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 999,
            padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {userRange && <option value="auto">Sizga mos ({userRange.join('–')})</option>}
          <option value="all">{t.allLevels}</option>
          {RANGE_OPTIONS.map((r) => <option key={r.key} value={r.key}>{r.key}</option>)}
        </select>

        <div style={{ flex: 1 }} />

        {autoplayBlocked && muted && (
          <button
            onClick={toggleMuted}
            title={t.unmuteTitle}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(239,68,68,.12)', color: '#B91C1C',
              border: '1px solid rgba(239,68,68,.32)', borderRadius: 999,
              padding: '5px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
              <path d="M15.5 8.5a5 5 0 010 7M18 5.5a9 9 0 010 13" />
            </svg>
            Ovozni yoqing
          </button>
        )}
      </div>

      {feed.isLoading && !items.length && (
        <div style={{ padding: 40 }}><Spinner /></div>
      )}
      {feed.isError && !items.length && <ErrorState onRetry={() => feed.refetch()} />}

      {/* Loop rejimi tufayli bu holat deyarli hech qachon bo'lmaydi —
          feed doim aylana veradi. Faqat DB'da tanlangan daraja uchun 0 ta
          video bo'lsa ko'rinadi. Sticker/tozalash tugmasi olib tashlandi —
          neutral bitta qator matn yetadi. */}
      {showEmpty && (
        <div style={{
          padding: '60px 20px', textAlign: 'center', display: 'flex',
          flexDirection: 'column', gap: 10, alignItems: 'center',
          color: 'var(--text-secondary)',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
            <rect x="3" y="6" width="18" height="12" rx="2" />
            <path d="M9 10l6 2-6 2v-4z" fill="currentColor" stroke="none" />
          </svg>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            Bu daraja uchun kontent hali qo'shilmagan
          </div>
          <div style={{ fontSize: 12.5, maxWidth: 340, lineHeight: 1.5 }}>
            Boshqa daraja tanlang yoki keyinroq qaytib keling.
          </div>
        </div>
      )}

      {visibleItems.length > 0 && (
        <div ref={scrollRef} className="shorts-scroll">
          {visibleItems.map(({ short: s, key }, i) => (
            <div
              key={key}
              // `playing` — o'rgatish (CoachTour) selektorlari uchun ham:
              // bir xil tugma har slotda takrorlanadi, o'q FAOL slotnikiga
              // qadalishi kerak.
              className={'shorts-slot' + (i === playIdx ? ' playing' : '')}
              data-idx={i}
            >
              {Math.abs(i - activeIdx) <= WINDOW ? (
                <ShortSlot
                  short={s}
                  index={i}
                  total={slotCount}
                  // Iframe faqat 2 ta: faol slot + yo'nalish bo'yicha keyingisi.
                  mounted={i === playIdx || i === playIdx + dir * PRELOAD_AHEAD}
                  // Ijro FAQAT bittasida — ovoz shu videoniki. Kunlik limitga
                  // yetilgan bo'lsa (`limitHit`) ijro to'xtaydi — LimitGate
                  // modali ochilgan, video ortida jimgina o'ynamaydi.
                  playing={i === playIdx && !limitHit}
                  muted={muted}
                  state={getState(s.id)}
                  onUpdate={updateState}
                  onScrollTo={scrollToIdx}
                  onAutoplayBlocked={onAutoplayBlocked}
                  onDead={() => {
                    reportDead(s.id)
                    // Keyingi videoga o'tamiz (agar bor bo'lsa)
                    scrollToIdx(i + 1)
                  }}
                />
              ) : null}
            </div>
          ))}
          {/* Guest kirish devori — 3-slot. Ijro yo'q, faqat login taklifi.
              Bu yerga scroll qilinganda yuqoridagi effekt modalni ochadi. */}
          {showGuestGate && (
            <div className="shorts-slot" data-idx={gateIdx}>
              <GuestGateSlot onLogin={() => setAuthGate('Yana shorts ko\'rish')} />
            </div>
          )}
          {isLoggedIn && feed.isFetchingNextPage && (
            <div style={{ padding: 20, textAlign: 'center' }}><Spinner /></div>
          )}
        </div>
      )}

      <AuthGateModal
        open={authGate != null}
        action={authGate ?? undefined}
        onClose={() => setAuthGate(null)}
      />
    </div>
    </ShortsAuthContext.Provider>
    </FontScaleContext.Provider>
  )
}

/* ============================================================
 * Bitta Short sloti
 * ============================================================ */

interface SlotProps {
  short: Short
  index: number
  total: number
  mounted: boolean
  playing: boolean
  muted: boolean
  state: ShortState
  onUpdate: (id: number, patch: (s: ShortState) => ShortState) => void
  onScrollTo: (i: number, smooth?: boolean) => void
  onAutoplayBlocked: () => void
  onDead: () => void
}

const ShortSlot = memo(function ShortSlot({
  short, index, total, mounted, playing, muted,
  state, onUpdate, onScrollTo, onAutoplayBlocked, onDead,
}: SlotProps) {
  const t = useT()
  const playerRef = useRef<ShortsPlayerHandle>(null)
  const lastReactRef = useRef(0)
  const { requireAuth } = useContext(ShortsAuthContext)

  const likes = state.likes ?? short.likes
  const dislikes = state.dislikes ?? short.dislikes

  // Savol-pozitsiyasi termometri nima qilishini FAQAT BIR MARTA tushuntiramiz
  // — birinchi ko'rilgan videoda, kichik ipuchi kartochkasi bilan. Ilgari bu
  // yerda har slotda qayta yonib-o'chadigan puls bor edi; u har videoda
  // takrorlanib xalaqit berardi va nima uchun ekani tushunarsiz edi.
  //
  // Ipuchi faqat lentadagi BIRINCHI slotda va faqat video ijro boshlangach
  // ochiladi (`playing`) — sahifa yuklanishi bilanoq ekranga chiqmaydi.
  // Ro'yxatdan o'tganiga 2 kundan oshgan foydalanuvchiga umuman chiqmaydi
  // (`utils/onboarding.ts`).
  /**
   * O'RGATISH (`utils/onboarding.ts` qoidalari): ro'yxatdan o'tgach 3 kun
   * davomida, lentaga HAR kirganda bir marta.
   *
   * **Darrov emas** — avval video 2.5 s o'ynaydi, keyin to'xtatiladi va
   * o'qlar bilan ko'rsatiladi (o'yinlardagi kabi). Tugagach ijro davom etadi.
   */
  const tour = useTour(TOUR.shorts, playing && index === 0, 2500)

  useEffect(() => {
    if (!tour.open) return
    playerRef.current?.pause?.()
  }, [tour.open])

  const finishTour = useCallback(() => {
    tour.finish()
    playerRef.current?.play?.()
  }, [tour])

  const tourSteps: TourStep[] = useMemo(() => [
    {
      // Mobilda — pastdagi "Savollar" dastagi (`display:none` desktopda),
      // desktopda esa savollar panelining o'zi.
      anchor: () => firstVisible(
        '.shorts-slot.playing [data-tour="questions"]',
        '[data-tour="questions"]',
        '.shorts-slot.playing .shorts-panel',
        '.shorts-panel',
      ),
      title: t.tourShortsQTitle,
      text: t.tourShortsQText,
      side: 'left',
    },
    {
      // Yuqori/quyi navigatsiya guruhi mobilda yashirin — u holda videoning
      // o'zini ko'rsatamiz ("pastga suring").
      // DIQQAT: har slot o'z rail'ini chizadi, ya'ni bu selektor lentada
      // o'nlab element topadi. Faol slotdan boshlamasak, ekrandan tashqarida
      // qolgan slotning tugmasi tanlanib, o'q allaqachon o'tib ketgan
      // videoni ko'rsatardi.
      anchor: () => firstVisible(
        '.shorts-slot.playing [data-tour="next-video"]',
        '[data-tour="next-video"]',
        '.shorts-slot.playing .shorts-video',
        '.shorts-video',
      ),
      title: t.tourShortsNextTitle,
      text: t.tourShortsNextText,
      side: 'left',
    },
    {
      anchor: () => firstVisible('.shorts-slot.playing [data-tour="qpos"]', '[data-tour="qpos"]'),
      title: t.tourShortsPosTitle,
      text: t.tourShortsPosText,
      side: 'left',
    },
  ], [t])

  // Mobil bottom-sheet (YouTube komment uslubi) — savollar paneli pastdan
  // ochiladi. Desktop'da bu holat ishlatilmaydi (panel doim yonda). Yangi
  // slotga o'tilganda yopiq (default false — har slot o'z holatiga ega).
  const [sheetOpen, setSheetOpen] = useState(false)
  const totalAll = short.mcq_questions.length + short.tfng_questions.length
    + short.fill_gap_questions.length
  const doneAll = answeredCount(state)

  // Video "listening" vaqtini profilga qo'shish — user BARCHA savollarni
  // (to'g'ri yoki xato) belgilagach BIR MARTA ishlaydi. Xato/tashlab ketilsa
  // qo'shilmaydi. Effekt uchun `spawnCoinReward` kichik "uchqun" animatsiyasi.
  const totalQ = short.mcq_questions.length + short.tfng_questions.length
  const doneQ = answeredCount(state)
  const rewardedRef = useRef(false)
  useEffect(() => {
    if (rewardedRef.current) return
    if (totalQ === 0 || doneQ < totalQ) return
    rewardedRef.current = true
    const secs = Math.max(1, short.duration_sec || 0)
    void useAuth.getState().addPlayedSeconds(secs)
    spawnCoinReward(secs)
  }, [doneQ, totalQ, short.duration_sec])

  // Feedback holati — bitta user bitta videoga faqat 1 marta yuboradi.
  // Boshlanishida server'dan holatni chaqiramiz (agar auth qilingan bo'lsa).
  const [feedback, setFeedback] = useState<{ reported: boolean; questionReported: boolean }>({
    reported: false, questionReported: false,
  })
  useEffect(() => {
    let cancelled = false
    fetchMyShortFeedback(short.id)
      .then((res) => {
        if (cancelled) return
        setFeedback({ reported: res.reported, questionReported: res.question_reported })
        // Serverdagi joriy reaksiya (like/dislike tugmasi holati) — HAR USER
        // 1 marta. Login qilgan foydalanuvchida qurilmalararo to'g'ri ko'rinadi.
        onUpdate(short.id, (s) => (s.reaction === (res.my_reaction ?? null)
          ? s : { ...s, reaction: res.my_reaction ?? null }))
      })
      .catch(() => { /* anonim yoki tarmoq xatosi — jimgina */ })
    return () => { cancelled = true }
  }, [short.id, onUpdate])
  const [reportOpen, setReportOpen] = useState(false)
  const [questionFbOpen, setQuestionFbOpen] = useState(false)

  // Like/dislike — HAR USER 1 MARTA (server toggle qiladi). Bosilgan tugma
  // ('like'/'dislike') serverga yuboriladi; server oldingi reaksiyani o'qib
  // qo'yadi/oladi/almashtiradi va yangi {likes, dislikes, my_reaction} beradi.
  const applyReaction = useCallback(async (clicked: 'like' | 'dislike') => {
    if (!requireAuth('Baholash')) return
    const now = Date.now()
    if (now - lastReactRef.current < 400) return
    lastReactRef.current = now
    const prev = state.reaction
    const next: Reaction = prev === clicked ? null : clicked   // optimistik toggle
    let dl = 0, dd = 0
    if (prev === 'like') dl -= 1
    if (prev === 'dislike') dd -= 1
    if (next === 'like') dl += 1
    if (next === 'dislike') dd += 1
    onUpdate(short.id, (s) => ({
      ...s, reaction: next,
      likes: (s.likes ?? short.likes) + dl,
      dislikes: (s.dislikes ?? short.dislikes) + dd,
    }))
    try {
      const res = await reactToShort(short.id, clicked)
      // Server — haqiqat manbai: aniq sanoq va reaksiya.
      onUpdate(short.id, (s) => ({
        ...s, reaction: res.my_reaction ?? null, likes: res.likes, dislikes: res.dislikes,
      }))
    } catch {
      // Xato (401/tarmoq) — optimistik o'zgarishni qaytaramiz.
      onUpdate(short.id, (s) => ({
        ...s, reaction: prev,
        likes: (s.likes ?? short.likes) - dl,
        dislikes: (s.dislikes ?? short.dislikes) - dd,
      }))
    }
  }, [state.reaction, short.id, short.likes, short.dislikes, onUpdate, requireAuth])

  const reset = useCallback(() => {
    onUpdate(short.id, (s) => ({
      ...emptyState(s.reaction), likes: s.likes, dislikes: s.dislikes,
    }))
  }, [short.id, onUpdate])

  const goNext = useCallback(() => onScrollTo(index + 1), [index, onScrollTo])
  const goPrev = useCallback(() => onScrollTo(index - 1), [index, onScrollTo])

  const onProof = useCallback((seconds: number) => {
    playerRef.current?.seek(seconds * 1000)
    playerRef.current?.play()
  }, [])

  // Savol pozitsiyasi bari uchun umumiy ro'yxat — MCQ, TFNG, Fill.
  // Sozlama `listening.shorts.qpos` kalitida saqlanadi va butun feedga taalluqli.
  // MUHIM: uch ro'yxat (MCQ/TFNG/Fill) har biri videoni boshdan bosib o'tadi,
  // shu bois global raqamlash (1..N) bitta timeline'da CHALKASH ko'rinadi
  // (masalan 13,14,2,15). Termometr chapdan o'ngga QAT'IY 1,2,3,4,5 bo'lishi
  // uchun barcha belgilarni ISBOT VAQTI bo'yicha saralab, keyin ketma-ket
  // qayta raqamlaymiz. Isbotsiz ("Not given") belgilar oxiriga (baribir
  // termometrda ko'rsatilmaydi — vaqti yo'q).
  /** Savol pozitsiyalari.
   *
   *  **Raqam — paneldagi savol raqami** (1..N MCQ, keyin TFNG, keyin
   *  fill-gap — `TestView`/`ShortsPage` bilan AYNAN bir xil). Belgilar
   *  chizish uchun isbot vaqti bo'yicha saralanadi, lekin RAQAM O'ZGARMAYDI.
   *
   *  Ilgari ular saralangach KETMA-KET qayta raqamlanardi (1,2,3...).
   *  Natijada bardagi "3" paneldagi 3-savol EMAS edi: vaqt bo'yicha uchinchi
   *  bo'lgan TFNG#1 panelda, masalan, 6-savol bo'lardi. Foydalanuvchi belgini
   *  ko'rib panelda boshqa savolni topardi. ("Isbot" tugmasi to'g'ri ishlardi
   *  — u savolning O'Z vaqtini oladi, shu bois muammo faqat shu barda edi.)
   *
   *  Chapdan o'ngga raqamlar ketma-ket bo'lmasligi mumkin — normal, chunki
   *  har bo'lim videoni boshdan-oxir bosib o'tadi.
   */
  const positionMarks = useMemo(() => {
    const mcq = short.mcq_questions
    const tfng = short.tfng_questions
    const fill = short.fill_gap_questions
    // Raqam SERVERDAN (`qNum`) — pozitsiyadan hisoblasak, bardagi raqam
    // paneldagi savolga mos kelmasdi ("3, 1, 2, 4").
    const raw = [
      ...mcq.map((q, i) => ({ n: qNum(q, i + 1), label: 'MCQ', proof: q.proof_from_text })),
      ...tfng.map((q, i) => ({ n: qNum(q, mcq.length + i + 1), label: 'TFNG', proof: q.proof_from_text })),
      ...fill.map((q, i) => ({ n: qNum(q, mcq.length + tfng.length + i + 1), label: 'Fill', proof: q.proof_from_text })),
    ]
    const secOf = (p?: string) => parseProof(p ?? '').seconds
    const withSec = raw.map((m) => ({ ...m, sec: secOf(m.proof) }))
    withSec.sort((a, b) => {
      if (a.sec == null && b.sec == null) return 0
      if (a.sec == null) return 1
      if (b.sec == null) return -1
      return a.sec - b.sec
    })
    return withSec.map((m) => ({ n: m.n, label: m.label, proof: m.proof }))
  }, [short.mcq_questions, short.tfng_questions, short.fill_gap_questions])

  return (
    <div className="shorts-stage">
      <div className="shorts-video">
        {/* Poster HAR DOIM ostida turadi — iframe yuklanguncha qora
            ekran ko'rinmaydi va slotga qaytilganda darrov chiziladi. */}
        <Poster youtubeId={short.youtube_id} title={short.title} />
        {mounted && (
          <ShortsPlayer
            ref={playerRef}
            youtubeId={short.youtube_id}
            active={playing}
            muted={muted}
            onAutoplayBlocked={onAutoplayBlocked}
            onError={(code) => {
              // YT xato kodlaridan HAQIQATAN "video mavjud emas" degani:
              //   100 — video o'chirilgan/private
              //   101 / 150 — embed bloklangan (huquqlar, geografik)
              //   2 — noto'g'ri id (bizda bo'lmasa kerak, lekin baribir)
              if (code === 100 || code === 101 || code === 150 || code === 2) {
                onDead()
              }
            }}
          />
        )}
      </div>

      <div className="shorts-rail">
        <div className="shorts-rail-group">
          <RailBtn
            icon={<IconThumbUp filled={state.reaction === 'like'} />}
            count={likes}
            active={state.reaction === 'like'}
            title={t.liked}
            onClick={() => applyReaction('like')}
          />
          <RailBtn
            icon={<IconThumbDown filled={state.reaction === 'dislike'} />}
            count={dislikes}
            active={state.reaction === 'dislike'}
            title={t.disliked}
            onClick={() => applyReaction('dislike')}
          />
          <RailBtn
            icon={<IconRefresh />}
            label={t.againLabel}
            onClick={reset}
            title={t.clearAnswers}
          />
          <RailBtn
            icon={<IconFlag />}
            label={t.reportLabel}
            active={feedback.reported}
            onClick={() => setReportOpen(true)}
            title={feedback.reported ? t.reportAlready : t.reportSendTitle}
          />
          <RailBtn
            icon={<IconAlert />}
            label={t.questionIssueLabel}
            active={feedback.questionReported}
            onClick={() => setQuestionFbOpen(true)}
            title={feedback.questionReported ? t.questionIssueAlready : t.questionIssueMark}
          />
        </div>
        {/* Savol pozitsiyasi termometri — like'lar va up/down orasida. Default
            o'chiq. Foydalanuvchi yoqib qo'ysa `localStorage` da qoladi va
            barcha shorts uchun ta'sir qiladi. Faqat FAOL slot vaqtini oladi. */}
        {playing && positionMarks.length > 0 && (
          <div data-tour="qpos"><QuestionPositionThermometer
            totalSec={short.duration_sec}
            localStorageKey="listening.shorts.qpos"
            questions={positionMarks}
            getCurrentSec={() => (playerRef.current?.currentTimeMs?.() ?? 0) / 1000}
          /></div>
        )}
        <div className="shorts-rail-group shorts-nav-group" data-tour="next-video">
          <RailBtn icon={<IconArrow dir="up" />} onClick={goPrev} disabled={index === 0} title={t.prevLabel} />
          <RailBtn icon={<IconArrow dir="down" />} onClick={goNext} disabled={index >= total - 1} title={t.nextLabel} />
        </div>
      </div>

      {tour.open && <CoachTour steps={tourSteps} onDone={finishTour} />}

      {reportOpen && (
        <ReportModal
          loadReasons={fetchShortReportReasons}
          submit={(payload) => reportShort(short.id, payload)}
          onClose={() => setReportOpen(false)}
          onSubmitted={() => {
            setReportOpen(false)
            setFeedback((f) => ({ ...f, reported: true }))
          }}
        />
      )}
      {questionFbOpen && (
        <QuestionFeedbackModal
          submit={(text) => reportShortQuestion(short.id, text)}
          onClose={() => setQuestionFbOpen(false)}
          onSubmitted={() => {
            setQuestionFbOpen(false)
            setFeedback((f) => ({ ...f, questionReported: true }))
          }}
        />
      )}

      {/* Mobil bottom-sheet o'ram: desktop'da `display:contents` (shaffof) —
          panel avvalgidek stage'ning flex bolasi. Mobil'da FAQAT faol slot
          (`playing`) fixed sheet bo'ladi; boshqalar yashiriladi. */}
      <div className={
        'shorts-sheet'
        + (playing ? ' playing' : '')
        + (sheetOpen ? ' is-open' : '')
      }>
        <button className="shorts-sheet-handle" type="button" data-tour="questions"
          onClick={() => setSheetOpen((o) => !o)}
          aria-expanded={sheetOpen}>
          <span className="shorts-sheet-grip" aria-hidden />
          <span className="shorts-sheet-title">
            {t.questionsLabel}{totalAll > 0 ? ` · ${doneAll}/${totalAll}` : ''}
          </span>
          <span className="shorts-sheet-caret" aria-hidden>{sheetOpen ? '▾' : '▴'}</span>
        </button>
        <QuestionsPanel
          short={short}
          state={state}
          onUpdate={onUpdate}
          onProof={onProof}
          onRestart={reset}
          onNext={goNext}
          hasNext={index < total - 1}
        />
      </div>
    </div>
  )
})

/** Guest kirish devori — ro'yxatdan o'tmagan foydalanuvchi GUEST_LIMIT ta
 *  shorts'ni ko'rgach shu slot chiqadi. Video o'rniga chiroyli login kartochka.
 *  Modal esa yuqorida ochiladi (effekt orqali). */
function GuestGateSlot({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="shorts-stage" style={{ justifyContent: 'center' }}>
      <div style={{
        maxWidth: 360, textAlign: 'center', padding: '32px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 20,
      }}>
        <div style={{
          width: 62, height: 62, borderRadius: 18,
          background: 'linear-gradient(135deg,#10B981 0%,#2563EB 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 12px 26px rgba(16,185,129,.35)',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
            <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
            <circle cx="12" cy="15.5" r="1.4" fill="#FFFFFF" stroke="none" />
          </svg>
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.25 }}>
          Davom etish uchun kiring
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          Bepul akkaunt oching — cheksiz shorts, IELTS testlar va diktantlar.
        </div>
        <button onClick={onLogin} className="btn btn-primary"
          style={{ width: '100%', padding: '12px 18px', borderRadius: 12,
                   fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
          Akkauntga kirish
        </button>
      </div>
    </div>
  )
}

function Poster({ youtubeId, title }: { youtubeId: string; title: string }) {
  const [step, setStep] = useState<0 | 1 | 2>(0)
  if (!youtubeId || step === 2) {
    return (
      <div className="shorts-poster-fallback" aria-hidden>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M9 10l6 2-6 2v-4z" fill="currentColor" stroke="none" />
        </svg>
      </div>
    )
  }
  return (
    <img
      className="shorts-poster"
      src={shortPoster(youtubeId, step === 1)}
      alt={title}
      loading="lazy"
      decoding="async"
      onError={() => setStep((s) => (s === 0 ? 1 : 2))}
    />
  )
}

/* ============================================================
 * Savollar paneli
 * ============================================================ */

type Tab = 'mcq' | 'tfng' | 'fill'

function QuestionsPanel({
  short, state, onUpdate, onProof, onRestart, onNext, hasNext,
}: {
  short: Short
  state: ShortState
  onUpdate: (id: number, patch: (s: ShortState) => ShortState) => void
  onProof: (seconds: number) => void
  onRestart: () => void
  onNext: () => void
  hasNext: boolean
}) {
  const t = useT()
  const mcqTotal = short.mcq_questions.length
  const tfngTotal = short.tfng_questions.length
  const fillTotal = short.fill_gap_questions.length
  const totalQ = mcqTotal + tfngTotal + fillTotal
  const doneQ = answeredCount(state)
  const finished = totalQ > 0 && doneQ >= totalQ

  const mcqDone = Object.keys(state.mcq).length
  const tfngDone = Object.keys(state.tfng).length
  const fillDone = Object.keys(state.fill).length
  const mcqComplete = mcqTotal > 0 && mcqDone >= mcqTotal
  const tfngComplete = tfngTotal > 0 && tfngDone >= tfngTotal

  // 3 tab: MCQ → TFNG → Fill. Natija alohida tab emas — hamma savol
  // belgilangach panel ostida ko'rinadi.
  const [tab, setTab] = useState<Tab>(
    () => (mcqTotal ? 'mcq' : tfngTotal ? 'tfng' : 'fill'),
  )

  // Avtomatik keyingi tabga o'tish: bir tur savollari tugagach.
  const autoSwitchMcqRef = useRef(false)
  const autoSwitchTfngRef = useRef(false)
  useEffect(() => {
    if (!autoSwitchMcqRef.current && tab === 'mcq' && mcqComplete) {
      if (tfngTotal > 0 && !tfngComplete) {
        autoSwitchMcqRef.current = true; setTab('tfng')
      } else if (fillTotal > 0) {
        autoSwitchMcqRef.current = true; setTab('fill')
      }
    }
    if (!autoSwitchTfngRef.current && tab === 'tfng' && tfngComplete && fillTotal > 0) {
      autoSwitchTfngRef.current = true; setTab('fill')
    }
  }, [tab, mcqComplete, tfngComplete, tfngTotal, fillTotal])
  useEffect(() => { if (!mcqComplete) autoSwitchMcqRef.current = false }, [mcqComplete])
  useEffect(() => { if (!tfngComplete) autoSwitchTfngRef.current = false }, [tfngComplete])

  // Rejim (instant / exam) — user profilida (localStorage) saqlanadi.
  const [mode, setMode] = useState<QMode>(loadMode)
  const changeMode = useCallback((next: QMode) => {
    setMode(next); saveMode(next)
  }, [])

  // Shrift kattaligi — BUTUN feed uchun umumiy (Context orqali). Bitta
  // video'da A+/A− bosilsa barcha videolarga darrov ta'sir qiladi.
  const { scale: fontScale, bump: bumpFont } = useContext(FontScaleContext)
  const { requireAuth } = useContext(ShortsAuthContext)

  // Har savolga javob berish — tizimga kirishni talab qiladi. Kirmagan
  // foydalanuvchi videoni ko'ra oladi, lekin javob bera olmaydi (modal chiqadi).
  const pickMcq = useCallback((i: number, v: string) => {
    if (!requireAuth('Savolga javob berish')) return
    onUpdate(short.id, (s) => (s.mcq[i] != null ? s : { ...s, mcq: { ...s.mcq, [i]: v } }))
  }, [short.id, onUpdate, requireAuth])
  const pickTfng = useCallback((i: number, v: string) => {
    if (!requireAuth('Savolga javob berish')) return
    onUpdate(short.id, (s) => (s.tfng[i] != null ? s : { ...s, tfng: { ...s.tfng, [i]: v } }))
  }, [short.id, onUpdate, requireAuth])
  const submitFill = useCallback((i: number, v: string) => {
    if (!requireAuth('Savolga javob berish')) return
    onUpdate(short.id, (s) => (s.fill[i] != null ? s : { ...s, fill: { ...s.fill, [i]: v } }))
  }, [short.id, onUpdate, requireAuth])

  // Rejim uchun "revealed" — javob va isbotni qachon ko'rsatish kerak.
  //   instant → har savol javob berilgach darrov
  //   exam    → faqat hamma javoblar to'planganidan keyin
  const reveal = mode === 'instant' || finished

  return (
    <div className="shorts-panel" style={{ ['--sq-scale' as string]: fontScale }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{
          margin: 0, fontSize: `calc(14.5px * ${fontScale})`, fontWeight: 800,
          letterSpacing: '-.01em', flex: 1, minWidth: 0,
        }}>
          {short.title}
        </h3>
        {/* Shrift skaleri: A- / A+ tugmalari. localStorage saqlaydi. */}
        <div style={{
          display: 'inline-flex', gap: 2, background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 999, padding: 2,
        }}>
          <button type="button" onClick={() => bumpFont(-0.1)}
            disabled={fontScale <= 0.8}
            title={t.textSmaller} style={sizeBtnStyle}>A−</button>
          <button type="button" onClick={() => bumpFont(0.1)}
            disabled={fontScale >= 1.4}
            title={t.textBigger} style={sizeBtnStyle}>A+</button>
        </div>
        {(short.cefr_from || short.cefr_to) && (
          <span style={{
            fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
            background: 'var(--info-bg)', color: 'var(--info-text)',
          }}>{short.cefr_from}–{short.cefr_to}</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="shorts-tabs" style={{ flex: '1 1 auto' }}>
          <TabBtn
            active={tab === 'mcq'} disabled={mcqTotal === 0}
            onClick={() => setTab('mcq')}
            label={t.mcqTab} progress={`${mcqDone}/${mcqTotal}`}
          />
          <TabBtn
            active={tab === 'tfng'} disabled={tfngTotal === 0}
            onClick={() => setTab('tfng')}
            label="TFNG" progress={`${tfngDone}/${tfngTotal}`}
          />
          {fillTotal > 0 && (
            <TabBtn
              active={tab === 'fill'} disabled={fillTotal === 0}
              onClick={() => setTab('fill')}
              label={t.gapTab} progress={`${fillDone}/${fillTotal}`}
            />
          )}
        </div>
        <ModeToggle mode={mode} onChange={changeMode} />
      </div>

      <div className="shorts-panel-body">
        {tab === 'mcq' && (mcqTotal === 0
          ? <Empty text="Ko'p tanlov savollari yo'q." />
          : short.mcq_questions.map((q, i) => (
            <McqCard key={i} n={qNum(q, i + 1)} q={q} picked={state.mcq[i]}
              reveal={reveal}
              onPick={(v) => pickMcq(i, v)} onProof={onProof} />
          )))}

        {tab === 'tfng' && (tfngTotal === 0
          ? <Empty text="TFNG savollari yo'q."/>
          : short.tfng_questions.map((q, i) => (
            <TfngCard key={i} n={qNum(q, mcqTotal + i + 1)} q={q} picked={state.tfng[i]}
              reveal={reveal}
              onPick={(v) => pickTfng(i, v)} onProof={onProof} />
          )))}

        {tab === 'fill' && (fillTotal === 0
          ? <Empty text="Bo'shliqni to'ldirish savollari yo'q." />
          : short.fill_gap_questions.map((q, i) => (
            <FillCard key={i} n={qNum(q, mcqTotal + tfngTotal + i + 1)} q={q}
              answered={state.fill[i]}
              reveal={reveal}
              onSubmit={(v) => submitFill(i, v)} onProof={onProof} />
          )))}

        {finished && (
          <ResultTab
            short={short} state={state} finished={finished}
            onRestart={onRestart} onNext={onNext} hasNext={hasNext}
          />
        )}
      </div>
    </div>
  )
}

/** Rejim tanlagichi — sodda ikki-nuqtali segmented button. */
function ModeToggle({ mode, onChange }: {
  mode: QMode; onChange: (m: QMode) => void
}) {
  const opts: { key: QMode; label: string; hint: string }[] = [
    { key: 'instant', label: 'Darrov', hint: 'Har javob darrov ranglanadi' },
    { key: 'exam', label: 'Imtihon', hint: 'Natija oxirida ko\'rsatiladi' },
  ]
  return (
    <div title={opts.find((o) => o.key === mode)?.hint}
      style={{
        display: 'inline-flex', gap: 3, padding: 3, borderRadius: 999,
        background: 'var(--bg)', border: '1px solid var(--border)',
        alignSelf: 'stretch',
      }}
    >
      {opts.map((o) => {
        const active = mode === o.key
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            title={o.hint}
            aria-pressed={active}
            style={{
              padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
              fontSize: 11.5, fontWeight: 800,
              background: active ? 'linear-gradient(135deg,#10B981,#059669)' : 'transparent',
              color: active ? '#FFF' : 'var(--text-secondary)',
              border: 'none',
            }}
          >{o.label}</button>
        )
      })}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{text}</div>
}

function TabBtn({ active, onClick, label, progress, disabled }: {
  active: boolean; onClick: () => void; label: string; progress: string; disabled?: boolean
}) {
  return (
    <button
      className={`shorts-tab${active ? ' is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      style={disabled ? { opacity: .45, cursor: 'not-allowed' } : undefined}
    >
      <b>{label}</b>
      <small>{progress}</small>
    </button>
  )
}

function McqCard({ n, q, picked, reveal, onPick, onProof }: {
  n: number
  q: ShortMcqQuestion
  picked: string | undefined
  reveal: boolean
  onPick: (v: string) => void
  onProof: (seconds: number) => void
}) {
  const answered = picked != null
  const showResult = answered && reveal   // exam rejimida faqat finished bo'lgach
  // Variantlar ARALASHTIRILADI — AI to'g'ri javobni nomutanosib ko'p "B" ga
  // qo'yadi (real bazada o'lchandi: 50%). `useMemo` — javob berayotganda
  // ro'yxat sakramasin.
  const options = useMemo(() => shuffleOptions(q.options), [q])
  return (
    <div className="shorts-q">
      <div className="shorts-q-head">
        <span className="shorts-q-num" style={{ background: 'linear-gradient(135deg,#2563EB,#1D4ED8)' }}>{n}</span>
        <span className="shorts-q-text">{q.question}</span>
      </div>
      <div className="shorts-opt-grid">
        {options.map((o) => (
          <button
            key={o.key}
            disabled={answered}
            onClick={() => !answered && onPick(o.key)}
            className={optClass(showResult, picked === o.key, o.key === q.answer)}
          >
            <b style={{ marginRight: 6 }}>{o.letter}</b>{o.text}
          </button>
        ))}
      </div>
      {showResult && (
        <ProofRow proof={q.proof_from_text} onProof={onProof} correct={picked === q.answer} />
      )}
    </div>
  )
}

function TfngCard({ n, q, picked, reveal, onPick, onProof }: {
  n: number
  q: ShortTfngQuestion
  picked: string | undefined
  reveal: boolean
  onPick: (v: string) => void
  onProof: (seconds: number) => void
}) {
  const correct = (q.answer || '').trim().toLowerCase()
  const answered = picked != null
  const showResult = answered && reveal
  const isNotGiven = correct === 'not given'
  return (
    <div className="shorts-q">
      <div className="shorts-q-head">
        <span className="shorts-q-num" style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)' }}>{n}</span>
        <span className="shorts-q-text">{q.question}</span>
      </div>
      <div className="shorts-opt-row">
        {['True', 'False', 'Not given'].map((v) => (
          <button
            key={v}
            disabled={answered}
            onClick={() => !answered && onPick(v)}
            className={optClass(showResult, picked === v, v.toLowerCase() === correct)}
          >{v}</button>
        ))}
      </div>
      {showResult && (isNotGiven
        ? <NotGivenResult correct={(picked || '').toLowerCase() === correct} />
        : <ProofRow proof={q.proof_from_text} onProof={onProof}
            correct={(picked || '').toLowerCase() === correct} />)}
    </div>
  )
}

/** Bo'shliqni to'ldirish savoli — kirish maydoni + tekshirish. */
function FillCard({ n, q, answered, reveal, onSubmit, onProof }: {
  n: number
  q: ShortFillGapQuestion
  answered: string | undefined
  reveal: boolean
  onSubmit: (v: string) => void
  onProof: (seconds: number) => void
}) {
  const t = useT()
  const [value, setValue] = useState('')
  const done = answered != null
  const showResult = done && reveal
  // Bir necha qabul qilinadigan javob (`answers` massivi) — legacy `answer`
  // ham qo'llab-quvvatlanadi.
  const acceptedNorms = [
    ...(q.answers ?? []),
    ...(q.answer ? [q.answer] : []),
  ].map(normalizeFillAnswer).filter(Boolean)
  const correct = done && acceptedNorms.includes(normalizeFillAnswer(answered))
  const parts = useMemo(() => (q.sentence || '').split('___'), [q.sentence])

  const submit = () => {
    const v = value.trim()
    if (!v || done) return
    onSubmit(v)
  }

  return (
    <div className="shorts-q">
      <div className="shorts-q-head">
        <span className="shorts-q-num" style={{ background: 'linear-gradient(135deg,#F59E0B,#B45309)' }}>{n}</span>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '.06em',
          textTransform: 'uppercase', color: 'var(--text-secondary)',
        }}>{t.fillTheGap}</span>
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.55 }}>
        {parts.map((p, i) => (
          <span key={i}>
            {p}
            {i < parts.length - 1 && (
              done ? (
                <b style={{
                  color: reveal ? (correct ? 'var(--ok-text)' : '#B91C1C') : 'var(--text)',
                  borderBottom: `2px solid ${reveal ? (correct ? '#10B981' : '#EF4444') : '#2563EB'}`,
                  padding: '0 4px', fontWeight: 800,
                }}>{answered}</b>
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                  placeholder="___"
                  style={{
                    display: 'inline-block', width: 120, padding: '2px 8px',
                    border: 'none', borderBottom: '2px solid #2563EB',
                    background: 'transparent', color: 'var(--text)',
                    fontSize: 14.5, fontWeight: 800, outline: 'none',
                  }}
                />
              )
            )}
          </span>
        ))}
      </div>
      {!done && (
        <button
          onClick={submit}
          disabled={!value.trim()}
          className="btn btn-primary"
          style={{
            padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 800,
            alignSelf: 'flex-start',
          }}
        >{t.check}</button>
      )}
      {showResult && (
        correct ? (
          <ProofRow proof={q.proof_from_text} onProof={onProof} correct={true} />
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            padding: '7px 10px', borderRadius: 10,
            background: 'rgba(245,158,11,.14)', color: '#B45309',
            border: '1px solid #F59E0B',
          }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>✗ {t.wrongShort}</span>
            <span style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              To'g'ri javob: <b>{q.answer}</b>
            </span>
            {parseProof(q.proof_from_text).seconds != null && (
              <button
                onClick={() => onProof(parseProof(q.proof_from_text).seconds!)}
                title={t.seekVideoHere}
                style={{
                  background: 'rgba(255,255,255,.95)', color: '#111827',
                  border: '1px solid rgba(0,0,0,.14)', borderRadius: 999,
                  padding: '3px 10px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer',
                }}
              >▶ {fmtTime(parseProof(q.proof_from_text).seconds!)}</button>
            )}
          </div>
        )
      )}
    </div>
  )
}

function optClass(answered: boolean, isPicked: boolean, isAnswer: boolean): string {
  const base = 'shorts-opt'
  if (!answered) return isPicked ? `${base} is-picked` : base
  if (isAnswer) return `${base} is-correct`
  if (isPicked) return `${base} is-wrong`
  return base
}

function ProofRow({ proof, onProof, correct }: {
  proof: string; onProof: (seconds: number) => void; correct: boolean
}) {
  const t = useT()
  const { seconds, quote } = useMemo(() => parseProof(proof), [proof])
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      padding: '7px 10px', borderRadius: 10,
      background: correct ? 'var(--ok-bg)' : 'rgba(245,158,11,.14)',
      color: correct ? 'var(--ok-text)' : '#B45309',
      border: `1px solid ${correct ? '#10B981' : '#F59E0B'}`,
    }}>
      <span style={{ fontSize: 12, fontWeight: 800 }}>{correct ? "✓ To'g'ri" : '✗ Xato'}</span>
      {quote && (
        <span style={{ fontSize: 12, fontStyle: 'italic', lineHeight: 1.5, flex: 1, minWidth: 120 }}>
          “{quote}”
        </span>
      )}
      {seconds != null && (
        <button
          onClick={() => onProof(seconds)}
          title={t.seekVideoHere}
          style={{
            background: 'rgba(255,255,255,.95)', color: '#111827',
            border: '1px solid rgba(0,0,0,.14)', borderRadius: 999,
            padding: '3px 10px', fontSize: 11.5, fontWeight: 800,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >▶ {fmtTime(seconds)}</button>
      )}
    </div>
  )
}

function NotGivenResult({ correct }: { correct: boolean }) {
  const t = useT()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 10,
      background: correct ? 'var(--ok-bg)' : 'rgba(245,158,11,.14)',
      color: correct ? 'var(--ok-text)' : '#B45309',
      border: `1px solid ${correct ? '#10B981' : '#F59E0B'}`,
      fontSize: 12.5, fontWeight: 700, lineHeight: 1.5,
    }}>
      <span style={{ fontWeight: 800 }}>{correct ? "✓ To'g'ri" : '✗ Xato'}</span>
      <span>{t.correctAnswerIs} <b>Not given</b>{t.notGivenExplain}</span>
    </div>
  )
}

function ResultTab({ short, state, finished, onRestart, onNext, hasNext }: {
  short: Short
  state: ShortState
  finished: boolean
  onRestart: () => void
  onNext: () => void
  hasNext: boolean
}) {
  const rows = useMemo(() => {
    const out: { n: number; label: string; answered: boolean; correct: boolean }[] = []
    short.mcq_questions.forEach((q, i) => {
      const pick = state.mcq[i]
      out.push({ n: qNum(q, i + 1), label: 'MCQ', answered: pick != null, correct: pick === q.answer })
    })
    short.tfng_questions.forEach((q, i) => {
      const pick = state.tfng[i]
      out.push({
        n: qNum(q, short.mcq_questions.length + i + 1), label: 'TFNG',
        answered: pick != null,
        correct: (pick || '').toLowerCase() === (q.answer || '').toLowerCase(),
      })
    })
    short.fill_gap_questions.forEach((q, i) => {
      const pick = state.fill[i]
      const accepted = [
        ...(q.answers ?? []),
        ...(q.answer ? [q.answer] : []),
      ].map(normalizeFillAnswer).filter(Boolean)
      out.push({
        n: qNum(q, short.mcq_questions.length + short.tfng_questions.length + i + 1),
        label: 'Fill',
        answered: pick != null,
        correct: accepted.includes(normalizeFillAnswer(pick || '')),
      })
    })
    return out
  }, [short, state])

  const total = rows.length
  const answered = rows.filter((r) => r.answered)
  const score = answered.filter((r) => r.correct).length

  if (!finished) {
    return (
      <div style={{
        padding: 18, borderRadius: 12, background: 'var(--bg)',
        border: '1px dashed var(--border)', color: 'var(--text-secondary)',
        fontSize: 13, lineHeight: 1.55, textAlign: 'center',
      }}>
        {answered.length > 0
          ? `Hozircha ${answered.length} / ${total} savolga javob berildi.`
          : "Savollarga javob berib chiqing — bu yerda batafsil natija ko'rinadi."}
      </div>
    )
  }

  const great = score === total
  const good = score >= Math.ceil(total * 0.7)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        background: 'var(--bg)', border: '1.5px solid #10B981', borderRadius: 12,
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg,#10B981,#059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#FFF', fontSize: 22,
        }}>{great ? '🎉' : good ? '👏' : '💪'}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>
            {great ? "A'lo natija!" : good ? 'Yaxshi!' : "Yana urinib ko'ring"}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 700 }}>
            {score} / {total} to'g'ri
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {rows.map((r) => (
          <span key={`${r.label}-${r.n}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 8px', borderRadius: 8, fontSize: 11.5, fontWeight: 800,
            background: r.correct ? 'var(--ok-bg)' : 'rgba(239,68,68,.12)',
            color: r.correct ? 'var(--ok-text)' : '#EF4444',
            border: `1px solid ${r.correct ? '#10B981' : '#EF4444'}`,
          }}>
            {r.label}·{r.n} {r.correct ? '✓' : '✗'}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={onRestart} className="btn btn-ghost"
          style={{ borderRadius: 10, fontWeight: 800, flex: '1 1 140px' }}>
          ↻ Qaytadan ishlash
        </button>
        {hasNext && (
          <button onClick={onNext} className="btn btn-primary"
            style={{ borderRadius: 10, fontWeight: 800, flex: '1 1 140px' }}>
            Keyingi Short ↓
          </button>
        )}
      </div>
    </div>
  )
}

/* ============================================================
 * Rail tugmasi + yordamchilar
 * ============================================================ */

function RailBtn({ icon, count, label, active, disabled, onClick, title }: {
  icon: React.ReactNode
  count?: number
  label?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title?: string
}) {
  return (
    <button
      className={`shorts-railbtn${active ? ' is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title || label || ''}
      aria-label={title || label || ''}
    >
      <i aria-hidden>{icon}</i>
      {count != null ? <span>{fmtCount(count)}</span> : label ? <span>{label}</span> : null}
    </button>
  )
}

/* ============================================================
 * SVG ikonlar — YouTube uslubidagi tozalikda (currentColor)
 * ============================================================ */

const IconStroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function IconThumbUp({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" style={{ display: 'block' }}>
      <path
        d="M7 10v11H4a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h3zm3 0 4-7c1.5 0 3 1 3 3v3h4a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 19.6 20H10V10z"
        {...(filled ? { fill: 'currentColor', stroke: 'currentColor', strokeWidth: 1.2 } : IconStroke)}
      />
    </svg>
  )
}
function IconThumbDown({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" style={{ display: 'block' }}>
      <path
        d="M7 14V3h13.6a2 2 0 0 1 2 1.7l1.4 7A2 2 0 0 1 22 14h-4v3c0 2-1.5 3-3 3l-4-7V14zM4 4h3v10H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"
        {...(filled ? { fill: 'currentColor', stroke: 'currentColor', strokeWidth: 1.2 } : IconStroke)}
      />
    </svg>
  )
}
function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" style={{ display: 'block' }} {...IconStroke}>
      <path d="M21 12a9 9 0 1 1-3.2-6.9" />
      <path d="M21 4v5h-5" />
    </svg>
  )
}
function IconArrow({ dir }: { dir: 'up' | 'down' }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" style={{ display: 'block' }} {...IconStroke}>
      {dir === 'up' ? <path d="M12 19V5m-7 7 7-7 7 7" /> : <path d="M12 5v14m-7-7 7 7 7-7" />}
    </svg>
  )
}
function IconFlag() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" style={{ display: 'block' }} {...IconStroke}>
      <path d="M4 22V4" />
      <path d="M4 5c5-3 9 3 14 0v10c-5 3-9-3-14 0" />
    </svg>
  )
}
function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" style={{ display: 'block' }} {...IconStroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** AI isbot matni bir nechta `[sekund] matn` bo'lakdan iborat bo'lishi
 *  mumkin — masalan `"[0.0] Bir gap [4.1] Ikkinchi gap"`. Ilgari faqat
 *  BIRINCHI qavs olib tashlanardi va qolgan `[4.1]` lar iqtibos ichida
 *  ko'rinib qolardi. */
interface Proof {
  /** Videoni surish uchun vaqt (sekund). Vaqt belgisi bo'lmasa `null`. */
  seconds: number | null
  /** Vaqt belgilaridan tozalangan iqtibos. */
  quote: string
}

function parseProof(proof: string): Proof {
  const raw = (proof || '').trim()
  if (!raw) return { seconds: null, quote: '' }
  const first = raw.match(/\[\s*([0-9]+(?:\.[0-9]+)?)\s*\]/)
  const quote = raw
    .replace(/\[\s*[0-9]+(?:\.[0-9]+)?\s*\]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return { seconds: first ? parseFloat(first[1]) : null, quote }
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const r = Math.floor(sec % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}

function fmtCount(n: number): string {
  if (n < 1_000) return String(n)
  if (n < 1_000_000) {
    const k = n / 1000
    return `${k >= 100 ? Math.round(k) : k.toFixed(k >= 10 ? 0 : 1)}K`
  }
  const m = n / 1_000_000
  return `${m >= 10 ? Math.round(m) : m.toFixed(1)}M`
}

/* ============================================================
 * "Uchqun mukofot" — barcha savollar belgilangach vaqt profilga
 * qo'shilganini bildiruvchi kichik animatsiya (o'ng-pastdan
 * navbardagi 🎧 pill tomon uchib boradi).
 * ============================================================ */

/** Ekran o'ng-pastidan navbardagi bugungi vaqt indikatori tomon
 *  "+Xs 🎧" chipini uchiradi. Elementni body ga qo'shadi va animatsiya
 *  tugagach o'zi olib tashlaydi — React state kerak emas. */
function spawnCoinReward(seconds: number) {
  if (typeof document === 'undefined') return
  const el = document.createElement('div')
  el.textContent = `+${seconds}s 🎧`
  el.style.cssText = [
    'position:fixed', 'right:28px', 'bottom:60px',
    'padding:10px 16px', 'border-radius:999px',
    'background:linear-gradient(135deg,#10B981,#059669)',
    'color:#FFF', 'font-weight:800', 'font-size:14px',
    'box-shadow:0 12px 28px rgba(16,185,129,.45)',
    'z-index:9999', 'pointer-events:none',
    'transform:translate3d(0,0,0) scale(1)', 'opacity:1',
    'transition:transform 900ms cubic-bezier(.22,1,.36,1), opacity 900ms ease-out',
    'will-change:transform,opacity',
  ].join(';')
  document.body.appendChild(el)
  // Yuqoriga uchish nishoni: navbardagi 🎧 pill (Layout.tsx'da). Uni
  // topa olmasak ekranning o'ng-yuqori chetiga uchadi.
  const target = document.querySelector<HTMLElement>('[data-today-pill]')
  const rect = target?.getBoundingClientRect()
  const dx = rect ? (rect.left + rect.width / 2) - (window.innerWidth - 28 - 40) : 0
  const dy = rect ? (rect.top + rect.height / 2) - (window.innerHeight - 60 - 18) : -(window.innerHeight - 120)
  // Animatsiyani darrov RAF ichida ishga tushiramiz — brauzer boshlang'ich
  // stiliyning "yozib qo'yishini" ta'minlaydi.
  requestAnimationFrame(() => {
    el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(0.7)`
    el.style.opacity = '0'
  })
  window.setTimeout(() => { el.remove() }, 1000)
}
