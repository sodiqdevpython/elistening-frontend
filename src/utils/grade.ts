/**
 * Diktantni mijozda baholash.
 *
 * Segment matni ochiq ma'lumot (foydalanuvchi "To'liq matn" tabidan ham
 * ko'ra oladi), shuning uchun har bir tekshiruv uchun API'ga chiqish shart
 * emas — mijozning o'zi hisoblaydi. Server hech qanday mashqni baholamaydi.
 *
 * ## Nega oddiy "topildi / topilmadi" YETARLI EMAS
 *
 * Ilgari har so'z ikki holatdan birida edi: topildi yoki yo'q. Natijada
 * **xato yozilgan** so'z bilan **umuman yozilmagan** so'z bir xil ko'rinardi.
 *
 * Foydalanuvchi buni aynan shunday ko'rdi: "Long ago, in ancient China, the
 * Peacocks ruled over Gongmen City." gapida u faqat `Peacocks` ni xato yozdi
 * ("peackocks"), qolganini esa umuman yozmadi — ekranda esa beshala so'z bir
 * xil belgilandi va *"men qayerda xato qildim?"* degan savol qoldi.
 *
 * Endi uch holat bor:
 *
 *   ok       — to'g'ri yozilgan
 *   typo     — yozilgan, lekin XATO (foydalanuvchi varianti `typed` da)
 *   missing  — umuman yozilmagan
 *
 * Bundan tashqari `extra` — foydalanuvchi yozgan, lekin matnda yo'q so'zlar.
 *
 * ## Nega tekislash (alignment), oddiy qidiruv emas
 *
 * "Xato yozilgan"ni "yozilmagan"dan ajratish uchun foydalanuvchi so'zini asl
 * so'z bilan JUFTLASH kerak. Oddiy `indexOf` buni qila olmaydi: "peackocks"
 * matnda yo'q, demak u shunchaki "topilmadi" bo'lardi.
 *
 * Shu bois klassik tahrirlash masofasi (Needleman–Wunsch) bilan ikki ketma-
 * ketlik tekislanadi. Juftlash narxi o'xshashlikka bog'liq (`pairCost`):
 * o'xshash so'zlar arzon juftlanadi, begonalari esa o'chirish+qo'shishdan
 * ham qimmat — shuning uchun "peackocks" o'zining "Peacocks" iga tushadi,
 * begona so'z esa "yozilmagan" + "ortiqcha" bo'lib ajraladi.
 *
 * Gap uzunligi o'nlab so'z, shu bois O(n·m) DP sezilmaydi.
 */

const CURLY_QUOTES = /[‘’]/g
const NUM_SEP = /(\d)[,.](\d)/g
const ORDINAL = /(\d+)(st|nd|rd|th)\b/gi
// Unicode letter, digit, whitespace yoki apostrof emas — bo'shliq bilan almashadi.
const PUNCT = /[^\p{L}\p{N}\s']/gu
const SPACE = /\s+/g

/**
 * Juftlangan so'zni "tuzatish" deb hisoblash uchun eng kam o'xshashlik.
 *
 * 0.5 — ya'ni belgilarning yarmidan ko'pi mos kelishi kerak. Pastroq
 * qilsak butunlay begona so'zlar "xato yozilgan" bo'lib ko'rinardi va
 * foydalanuvchi o'zi yozmagan so'zni "tuzatishim kerak" deb o'ylardi.
 */
const TYPO_SIMILARITY = 0.5

/** Matnni taqqoslash uchun soddalashtiradi (registr, tinish belgilari, sonlar). */
export function normalize(text: string | null | undefined): string {
  if (!text) return ''
  let s = text.normalize('NFKC').toLowerCase().trim()
  s = s.replace(CURLY_QUOTES, "'")
  // Sonlar orasidagi vergul/nuqta: 1,000 → 1000. Har bir raqamdan keyin
  // qayta ko'rib chiqish uchun `while` — 100,000,000 kabi holatlar uchun.
  let prev
  do { prev = s; s = s.replace(NUM_SEP, '$1$2') } while (s !== prev)
  s = s.replace(ORDINAL, '$1')
  s = s.replace(PUNCT, ' ')
  return s.replace(SPACE, ' ').trim()
}

export type WordState = 'ok' | 'typo' | 'missing'

export interface WordFeedback {
  /** Asl so'z (tinish belgilari bilan) — ekranda shundayligicha chiqadi. */
  w: string
  state: WordState
  /** Faqat `typo` uchun: foydalanuvchi aslida nima yozgan. */
  typed: string
  /** Eski maydon — `state === 'ok'` bilan bir xil. */
  found: boolean
  /** Eski maydon — topilmagan so'z uchun nuqtali placeholder. */
  dots: string
}

export interface DictationResult {
  isCorrect: boolean
  score: number
  words: WordFeedback[]
  matched: number
  total: number
  /** Foydalanuvchi yozgan, lekin matnda yo'q so'zlar. */
  extra: string[]
}

/** Levenshtein masofasi — ikki qatorli DP (butun matritsa kerak emas). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1)

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    const swap = prev; prev = curr; curr = swap
  }
  return prev[b.length]
}

/** 0..1 — 1 bo'lsa aynan bir xil. */
function similarity(a: string, b: string): number {
  if (a === b) return 1
  const longest = Math.max(a.length, b.length)
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest
}

type Op =
  | { kind: 'ok' | 'sub'; expIndex: number; given: string }
  | { kind: 'missing'; expIndex: number }
  | { kind: 'extra'; given: string }

/**
 * Juftlash narxi: 0 — aynan bir xil, 1 — o'xshash (tuzatish), 2.5 — begona.
 *
 * **Nega 2.5, ya'ni o'chirish+qo'shishdan (1+1=2) QIMMAT.** Bir xil umumiy
 * narxga ega bir necha tekislash bo'lishi mumkin va DP ulardan istalganini
 * tanlaydi. Begona so'zlarni juftlash narxi 2 dan past bo'lsa, u chetdagi
 * mutlaqo bog'liqsiz so'zlarni juftlab qo'yardi.
 *
 * Aynan shu xato bo'lgan: foydalanuvchi "…the peackocks" deb yozganda DP
 * "peackocks" ni gapning OXIRGI so'zi "City." bilan juftlagan (narx bir xil
 * edi), natijada haqiqiy tuzatish ko'rinmay qolgan. Endi begona juftlik
 * qimmat, shu bois "peackocks" o'zining "Peacocks" iga tushadi.
 */
function pairCost(a: string, b: string): number {
  if (a === b) return 0
  return similarity(a, b) >= TYPO_SIMILARITY ? 1 : 2.5
}

/**
 * Ikki so'z ketma-ketligini tekislaydi (Needleman–Wunsch).
 *
 * O'chirish va qo'shish narxi 1, juftlash narxi esa `pairCost` dan.
 */
function align(expected: string[], given: string[]): Op[] {
  const n = expected.length
  const m = given.length

  // Juftlash narxlari oldindan — DP ham, orqaga yurish ham o'qiydi va
  // Levenshtein ikki marta hisoblanmaydi.
  const pair: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: m }, (_, j) => pairCost(expected[i], given[j])))

  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = 0; i <= n; i += 1) cost[i][0] = i
  for (let j = 0; j <= m; j += 1) cost[0][j] = j

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      cost[i][j] = Math.min(
        cost[i - 1][j - 1] + pair[i - 1][j - 1],
        cost[i - 1][j] + 1,
        cost[i][j - 1] + 1,
      )
    }
  }

  const ops: Op[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && cost[i][j] === cost[i - 1][j - 1] + pair[i - 1][j - 1]) {
      const same = expected[i - 1] === given[j - 1]
      ops.push({ kind: same ? 'ok' : 'sub', expIndex: i - 1, given: given[j - 1] })
      i -= 1; j -= 1
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      ops.push({ kind: 'missing', expIndex: i - 1 })
      i -= 1
    } else {
      ops.push({ kind: 'extra', given: given[j - 1] })
      j -= 1
    }
  }
  return ops.reverse()
}

/**
 * Diktantni baholaydi va so'z darajasidagi feedback beradi.
 *
 * Ball semantikasi o'zgarmagan: `matched` — to'g'ri yozilgan tokenlar soni,
 * `total` — asl matndagi tokenlar soni. Ekrandagi "6/11" shu ikkisidan.
 */
export function gradeDictation(expected: string, given: string): DictationResult {
  const givenWords = normalize(given).split(' ').filter(Boolean)
  // Asl matnni so'zlar bo'yicha (tinish belgilari bilan) saqlab qolamiz —
  // feedback'da xuddi shunday chiroyli ko'rinadi.
  const rawWords = expected.trim().split(/\s+/).filter(Boolean)

  if (rawWords.length === 0) {
    return { isCorrect: false, score: 0, words: [], matched: 0, total: 0, extra: [] }
  }

  // Bir asl "so'z" normalizatsiyadan keyin bir necha token bo'lishi mumkin
  // ("well-known" → "well known"), shu bois har token qaysi asl so'zga
  // tegishli ekanini eslab qolamiz.
  const expTokens: string[] = []
  const tokenOwner: number[] = []
  rawWords.forEach((raw, rawIndex) => {
    for (const token of normalize(raw).split(' ').filter(Boolean)) {
      expTokens.push(token)
      tokenOwner.push(rawIndex)
    }
  })

  const tokenState: WordState[] = expTokens.map(() => 'missing')
  const tokenTyped: string[] = expTokens.map(() => '')
  const extra: string[] = []

  for (const op of align(expTokens, givenWords)) {
    if (op.kind === 'extra') {
      extra.push(op.given)
    } else if (op.kind === 'ok') {
      tokenState[op.expIndex] = 'ok'
    } else if (op.kind === 'sub') {
      // Juftlandi — lekin bu tuzatishmi yoki butunlay boshqa so'zmi?
      if (similarity(expTokens[op.expIndex], op.given) >= TYPO_SIMILARITY) {
        tokenState[op.expIndex] = 'typo'
        tokenTyped[op.expIndex] = op.given
      } else {
        // Yaqin emas: asl so'z yozilmagan, foydalanuvchiniki esa ortiqcha.
        tokenState[op.expIndex] = 'missing'
        extra.push(op.given)
      }
    }
  }

  const words: WordFeedback[] = rawWords.map((raw, rawIndex) => {
    const own = expTokens.map((_, k) => k).filter((k) => tokenOwner[k] === rawIndex)

    if (own.length === 0) {
      // Faqat tinish belgisi (masalan "—") — ballda hisoblanmaydi.
      return { w: raw, state: 'ok', typed: '', found: true, dots: '' }
    }

    const states = own.map((k) => tokenState[k])
    const state: WordState = states.every((s) => s === 'ok')
      ? 'ok'
      : states.some((s) => s === 'typo') ? 'typo' : 'missing'

    return {
      w: raw,
      state,
      typed: state === 'typo' ? own.map((k) => tokenTyped[k]).filter(Boolean).join(' ') : '',
      found: state === 'ok',
      dots: state === 'ok' ? '' : '•'.repeat(Math.max(2, normalize(raw).length || 3)),
    }
  })

  const total = expTokens.length
  const matched = tokenState.filter((s) => s === 'ok').length

  if (total === 0) {
    return { isCorrect: false, score: 0, words, matched: 0, total: 0, extra }
  }

  return {
    isCorrect: matched === total,
    score: Math.round((matched / total) * 10000) / 10000,
    words,
    matched,
    total,
    extra,
  }
}
