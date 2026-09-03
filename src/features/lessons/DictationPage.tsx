import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  addDictationPlayedTime, fetchDictation, fetchDictationReportReasons,
  fetchMyDictationFeedback, reactToDictation, registerDictationView,
  reportDictation, reportDictationQuestion,
} from '@/api/endpoints'
import type {
  DictationChunk, DictationWord,
  ShortMcqQuestion, ShortTfngQuestion, ShortFillGapQuestion,
} from '@/api/types'
import { PageHeader } from '@/components/Layout'
import YouTubePlayer, { type YouTubePlayerHandle } from '@/components/YouTubePlayer'
import QuestionPositionBar from '@/components/QuestionPositionBar'
import CoachTour, { firstVisible, type TourStep } from '@/components/CoachTour'
import { QuestionFeedbackModal, ReportModal } from '@/components/FeedbackModals'
import AuthGateModal from '@/components/AuthGateModal'
import {
  Badge, ChevronIcon, ErrorState, ProgressBar, Spinner,
} from '@/components/ui'
import { useAuth } from '@/store/auth'
import { useT } from '@/i18n'
import { TOUR, useTour } from '@/utils/onboarding'
import { displayLetter, shuffleOptions } from '@/utils/shuffle'
import { gradeDictation, type DictationResult } from '@/utils/grade'

const SETTINGS_KEY = 'listening.dictation.settings'

/** Chunk bo'lish rejimi:
 *  - `sentence`: FAQAT nuqta/undov/so'roq (`.`/`!`/`?`) bo'yicha bo'linadi.
 *    Har chunk = to'liq gap. Uzun bo'lsa ham to'la eshitiladi va so'zlar
 *    kesilib qolmaydi. Default rejim, ishonchli.
 *  - `clause`: hozirgi rejim — nuqta ustiga vergul/nuqta-vergul/tire (`,;:—`)
 *    ham chunk chegarasi qilinadi (agar chunk ≥18 so'z bo'lsa). Qisqaroq
 *    parchalar, lekin tez gapiruvchilarda so'zlar chegarada qolib ketishi
 *    mumkin.
 */
export type ChunkMode = 'sentence' | 'clause'

interface DictationSettings {
  showAnswerImmediately: boolean
  showFullAnswer: boolean
  playbackRate: number
  chunkMode: ChunkMode
  /** `clause` rejimida: chunk shuncha so'zdan katta bo'lsa har qanday tinish
   *  belgisi (vergul/nuqta-vergul/tire) da bo'linadi. Min 5, default 15. */
  chunkMinWords: number
}

const DEFAULT_SETTINGS: DictationSettings = {
  showAnswerImmediately: false,
  showFullAnswer: false,
  playbackRate: 1,
  chunkMode: 'sentence',
  chunkMinWords: 15,
}

const MIN_ALLOWED_WORDS = 5

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5]

// Chunk boshi/oxiriga zaxira vaqt (padding).
// - LEAD: chunk boshidan oldin — 0 (Whisper aniq boshlaydi)
// - TAIL: chunk oxiridan keyin — 700 ms. Whisper oxirgi so'zning tovushi
//   tugagan joyni belgilaydi, lekin "Rita" kabi so'zning oxirgi bo'g'ini
//   biroz uzunroq eshitiladi. Shu bois 600-700 ms qo'shib to'liq eshitishga
//   imkon beramiz.
// 200 ms lead — Whisper birinchi so'zning `start` vaqtini biroz kech
// belgilaydi (undosh bilan boshlanadigan so'zning onset'i ba'zan tashlanadi,
// masalan "Yesterday" → "sterday" eshitilishi mumkin). Bu padding chunk boshini
// biroz oldinroqdan boshlaydi va so'z boshi to'liq eshitiladi.
const CHUNK_LEAD_MS = 200
// 250 ms tail — Whisper oxirgi so'zning `end` vaqtini biroz erta belgilaydi
// (masalan "Korea" ning oxirgi bo'g'ini keyin ham eshitiladi). Bu padding
// oxirgi so'zning tovushi to'liq eshitilishini kafolatlaydi. snapChunksToWords
// bilan birga ishlaydi — u chunk end'ni aynan so'z.end ga tirashadi.
const CHUNK_TAIL_MS = 250
// To'g'ri javob berilganda 500 ms yashil ✓ ko'rsatib turib keyingi chunk'ga
// o'tamiz — foydalanuvchi to'g'ri javobini ko'rib olsin.
const AUTO_NEXT_MS = 500
// Skip bosilganda foydalanuvchi kanonik javobni ko'rib olishi uchun
// 800 ms kutamiz — keyin avtomatik keyingi chunk'ga o'tadi.
const SKIP_NEXT_MS = 800

// Qisqartmalar — bularning nuqtasi gap oxirini bildirmaydi.
const ABBREVIATIONS = new Set([
  'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'st.', 'sr.', 'jr.', 'vs.',
  'e.g.', 'i.e.', 'etc.', 'no.',
])

/** Whisper ba'zan bitta segmentga bir necha gapni joylaydi, ba'zan gapni
 *  bir necha segmentga bo'lib yuboradi. Diktantda esa **har chunk = bitta
 *  to'liq gap** bo'lishi kerak. Shu funksiya body chunklarini gap oxiri
 *  (`.` / `!` / `?`) bo'yicha qayta guruhlaydi.
 *
 *  `allWords` (Whisper so'z-darajasidagi timestamp) berilsa gaplar orasidagi
 *  audio chegara ANIQ so'z chegarasiga tushadi. Bu muhim: Whisper "year. He
 *  made" ni bitta segmentga qo'ysa, matnda "." bo'yicha bo'lish tekst bo'yicha
 *  proporsional taqsimga tushadi — bu esa "He made" ni audioda kesib qo'yishi
 *  mumkin (spiker "year." dan keyin tez o'tsa). So'z timestamp'lari bilan
 *  har gapning boshi/oxiri o'z so'z chegarasiga tushadi. */
function mergeIntoSentences(
  body: DictationChunk[],
  allWords?: DictationWord[],
): DictationChunk[] {
  const result: DictationChunk[] = []
  let buffer: DictationChunk[] = []

  const endsSentence = (text: string): boolean => {
    // Yopilish belgilaridan (") ' ]) tozalaymiz
    let t = text.trim().replace(/[)}\]"'"']+$/, '')
    if (!t) return false
    const last = t[t.length - 1]
    if (!'.!?…'.includes(last)) return false
    // Oxirgi so'z qisqartma bo'lmasin (Mr. / Dr. / etc.)
    const lastWord = t.split(/\s+/).pop() ?? ''
    if (ABBREVIATIONS.has(lastWord.toLowerCase())) return false
    return true
  }

  const flush = () => {
    if (buffer.length === 0) return
    result.push({
      start_ms: buffer[0].start_ms,
      end_ms: buffer[buffer.length - 1].end_ms,
      text: buffer.map((b) => b.text.trim()).join(' ').trim(),
    })
    buffer = []
  }

  for (const chunk of body) {
    // Bir chunk ichida bir necha gap bo'lishi mumkin — nuqta bo'yicha bo'lamiz
    const parts = splitByBoundary(chunk.text)
    if (parts.length <= 1) {
      buffer.push(chunk)
      if (endsSentence(chunk.text)) flush()
      continue
    }
    // Bir necha gap — har gap uchun ANIQ vaqt hisoblaymiz.
    // Word timestamp'lari bor bo'lsa — so'z chegaralarini ishlatamiz.
    // Yo'q bo'lsa — matn uzunligiga qarab proporsional (eski xatti-harakat).
    const partsWithTimes = assignTimesToParts(chunk, parts, allWords)
    partsWithTimes.forEach((seg, i) => {
      buffer.push(seg)
      if (endsSentence(parts[i])) flush()
    })
  }
  if (buffer.length > 0) flush()
  return result
}

/** Whisper chunk ichidagi matn bo'laklariga aniq boshi/oxiri (ms) belgilaydi.
 *  `allWords` berilsa chunk oralig'iga tushgan so'zlarni matnga qarab
 *  guruhlaydi va har guruh birinchi so'zining `start` va oxirgi so'zining
 *  `end` vaqtlarini ishlatadi. Bu spikerning haqiqiy tinish joyini beradi.
 */
function assignTimesToParts(
  chunk: DictationChunk,
  parts: string[],
  allWords?: DictationWord[],
): DictationChunk[] {
  // 1. So'z timestamp'lari yo'q bo'lsa — eski proporsional yondashuv.
  if (!allWords || allWords.length === 0) {
    return proportionalTimes(chunk, parts)
  }
  // 2. Chunk oralig'iga tushgan so'zlarni ajratamiz (kichik tolerans bilan).
  const startS = chunk.start_ms / 1000
  const endS = chunk.end_ms / 1000
  const inRange = allWords.filter(
    (w) => w.end >= startS - 0.05 && w.start <= endS + 0.05,
  )
  if (inRange.length === 0) return proportionalTimes(chunk, parts)
  // 3. Har part uchun so'z sonini olamiz va inRange dan ketma-ket kesib olamiz.
  const wordCounts = parts.map((p) => p.trim().split(/\s+/).filter(Boolean).length)
  const total = wordCounts.reduce((a, b) => a + b, 0)
  // Whisper so'z sonini biroz farqli sanashi mumkin — nomos bo'lsa fallback.
  if (total === 0 || Math.abs(total - inRange.length) > Math.max(2, Math.round(total * 0.15))) {
    return proportionalTimes(chunk, parts)
  }
  // So'zlar soni biroz farq qilsa proporsional taqsim qilamiz.
  const scale = inRange.length / total
  const out: DictationChunk[] = []
  let used = 0
  for (let i = 0; i < parts.length; i++) {
    const isLast = i === parts.length - 1
    const take = isLast
      ? inRange.length - used
      : Math.max(1, Math.round(wordCounts[i] * scale))
    const slice = inRange.slice(used, used + take)
    if (slice.length === 0) {
      out.push({ start_ms: chunk.start_ms, end_ms: chunk.end_ms, text: parts[i] })
      continue
    }
    const startMs = i === 0
      ? chunk.start_ms
      : Math.max(chunk.start_ms, Math.round(slice[0].start * 1000))
    const endMs = isLast
      ? chunk.end_ms
      : Math.min(chunk.end_ms, Math.round(slice[slice.length - 1].end * 1000))
    out.push({ start_ms: startMs, end_ms: endMs, text: parts[i] })
    used += take
  }
  return out
}

/** So'z-matnini solishtirish uchun normalize — kichik harf, faqat alfa-son
 *  belgilari qoladi ("Korea." → "korea", "you're" → "youre", "Jong-un" → "jongun"). */
function normalizeWord(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** OXIRGI POG'ONA — chunklar tayyor bo'lgandan keyin har chunk start/end ni
 *  aynan `words_json` dagi so'z timestamp'lariga tirash. Whisper'ning segment
 *  `end` vaqti odatda oxirgi so'zning haqiqiy tovushidan biroz oldin bo'ladi
 *  ("Korea", "Jong-un" kabi oxirgi so'z kesilib qolar edi), shu bilan birga
 *  segment `start` biroz kech bo'lishi mumkin ("Yesterday" → "sterday").
 *
 *  Strategiya: chunk matnining birinchi va oxirgi so'zini `words_json` dan
 *  chunk vaqt oraliqiga eng yaqin joyda topamiz. So'z bir necha marta
 *  uchrasa, chunk boshiga/oxiriga eng yaqin misolini tanlaymiz — bu bir xil
 *  so'z boshqa chunk'da qayta uchrashsa xato tanlamaslikni kafolatlaydi. */
function snapChunksToWords(
  chunks: DictationChunk[],
  allWords?: DictationWord[],
): DictationChunk[] {
  if (!allWords || allWords.length === 0) return chunks
  const normWords = allWords.map((w) => normalizeWord(w.word))

  const findClosest = (target: string, targetMs: number, maxDistMs: number) => {
    let bestIdx = -1
    let bestDist = Infinity
    for (let i = 0; i < normWords.length; i++) {
      if (normWords[i] !== target) continue
      // Chunk vaqtiga qanchalik yaqin?
      const wMid = (allWords[i].start + allWords[i].end) * 500  // *1000/2
      const dist = Math.abs(wMid - targetMs)
      if (dist < bestDist && dist <= maxDistMs) {
        bestIdx = i
        bestDist = dist
      }
    }
    return bestIdx
  }

  // Chunk vaqti biroz noto'g'ri bo'lishi mumkin — 3 s gacha ruxsat beramiz,
  // bu Whisper'ning odatiy xatolik oralig'idan ancha katta. Ammo shu bilan
  // birga eng yaqin misolni tanlaymiz, shu bois xato juftlashuv bo'lmaydi.
  const TOL_MS = 3000

  return chunks.map((chunk) => {
    const textWords = chunk.text.trim().split(/\s+/)
      .map(normalizeWord).filter(Boolean)
    if (textWords.length === 0) return chunk
    const first = textWords[0]
    const last = textWords[textWords.length - 1]

    const firstIdx = findClosest(first, chunk.start_ms, TOL_MS)
    const lastIdx = findClosest(last, chunk.end_ms, TOL_MS)

    // Ikkalasi ham topilmasa chunk asl vaqtlari bilan qoladi.
    if (firstIdx < 0 && lastIdx < 0) return chunk

    const start_ms = firstIdx >= 0
      ? Math.round(allWords[firstIdx].start * 1000)
      : chunk.start_ms
    const end_ms = lastIdx >= 0
      ? Math.round(allWords[lastIdx].end * 1000)
      : chunk.end_ms

    // Sanity: yangi end < yangi start bo'lib qolsa (juda kam holat, so'zlar
    // teskari topilsa) — asl vaqtlarga qaytamiz.
    if (end_ms <= start_ms) return chunk

    return { start_ms, end_ms, text: chunk.text }
  })
}

/** Matn uzunligiga qarab proporsional vaqt taqsimi — fallback. */
function proportionalTimes(chunk: DictationChunk, parts: string[]): DictationChunk[] {
  const dur = chunk.end_ms - chunk.start_ms
  const totalLen = parts.reduce((a, p) => a + p.length, 0) || 1
  const out: DictationChunk[] = []
  let t = chunk.start_ms
  parts.forEach((p, i) => {
    const partDur = Math.round((p.length / totalLen) * dur)
    const partEnd = i === parts.length - 1 ? chunk.end_ms : t + partDur
    out.push({ start_ms: t, end_ms: partEnd, text: p })
    t = partEnd
  })
  return out
}

/** Uzun chunk'larni yozishga qulay bo'lishi uchun kichikroq bo'laklarga bo'ladi.
 *
 * Qoida: agar chunk ≥ `minWords` so'zdan iborat bo'lsa, `minWords`-inchi
 * so'zdan boshlab eng BIRINCHI weak boundary (`,` `;` `:` `—`) belgisida
 * bo'linadi. Nuqta shart emas — istalgan tinish belgisi. Weak boundary
 * topilmasa umuman bo'linmaydi.
 *
 * `words` (Whisper so'z-darajasidagi timestamp) berilsa aniq vaqt bilan
 * bo'linadi. Aks holda proporsional taqsimlanadi.
 */
const WEAK_BOUNDARY = /[,;:—–.!?]$/

// Hozircha ishlatilmaydi (picker yashirilgan), lekin kodni saqlab qolamiz —
// eksport qilamiz. Kelajakda clause-mode qaytarilsa oson.
export function splitLongChunks(
  chunks: DictationChunk[],
  allWords: DictationWord[] | undefined,
  minWords: number,
): DictationChunk[] {
  if (!chunks.length) return chunks
  const n = Math.max(MIN_ALLOWED_WORDS, Math.floor(minWords))
  const out: DictationChunk[] = []
  for (const chunk of chunks) {
    const words = chunk.text.trim().split(/\s+/).filter(Boolean)
    if (words.length < n) {
      out.push(chunk)
      continue
    }
    // n-inchi so'zdan boshlab BIRINCHI weak boundary'ni topamiz — nuqta
    // kutmasdan darrov bo'lamiz (foydalanuvchi so'raganicha).
    let cutIdx = -1
    for (let i = n - 1; i < words.length - 1; i++) {
      const w = words[i].replace(/[)}\]"'"']+$/, '')
      if (WEAK_BOUNDARY.test(w)) { cutIdx = i; break }
    }
    if (cutIdx < 0) {
      // Weak boundary topilmadi — bo'lmaymiz
      out.push(chunk)
      continue
    }
    const leftWords = words.slice(0, cutIdx + 1)
    const rightWords = words.slice(cutIdx + 1)
    const leftText = leftWords.join(' ')
    const rightText = rightWords.join(' ')

    const [leftEnd, rightStart] = resolveSplitTime(
      chunk, leftWords, rightWords, allWords,
    )

    out.push({ start_ms: chunk.start_ms, end_ms: leftEnd, text: leftText })
    // Ikkinchi bo'lak yana katta bo'lsa — rekursiv bo'lamiz
    const rest = splitLongChunks(
      [{ start_ms: rightStart, end_ms: chunk.end_ms, text: rightText }],
      allWords, n,
    )
    out.push(...rest)
  }
  return out
}

/* ============================================================
 * MAJBURIY bo'lish — tinish belgisi bo'lmagan kontent uchun
 * ============================================================
 *
 * Muammo: Whisper qo'shiq va ba'zi videolarda tinish belgisisiz matn
 * qaytaradi ("We're no strangers to love You know the rules and so do I ...").
 * `mergeIntoSentences` gap oxirini (`.`/`!`/`?`) qidiradi, `splitLongChunks`
 * esa vergul kabi weak boundary'ni qidiradi — ikkalasi ham topa olmaydi va
 * BUTUN qo'shiq bitta chunk bo'lib qoladi. Foydalanuvchi bunday diktantni
 * umuman yoza olmaydi.
 *
 * Yechim: tinish belgisidan mustaqil xavfsizlik chegarasi. Chunk juda uzun
 * bo'lsa — so'z-darajasidagi timestamp'lardagi **eng katta tanaffusda**
 * bo'lamiz. Bu spikerning nafas olgan / qatorni tugatgan joyi, ya'ni matnda
 * belgi bo'lmasa ham tabiiy chegara.
 */

/** Tinish belgisisiz BLOK (qo'shiq) uchun majburiy bo'lish chegaralari.
 *  Bular FAQAT to'liq gap bo'lmagan (nuqta/undov/so'roq bilan tugamaydigan)
 *  matnlarga qo'llanadi. */
const HARD_MAX_WORDS = 16
const HARD_MAX_MS = 14000

/** TO'LIQ GAP (nuqta bilan tugaydi) uchun chegaralar — juda yuqori.
 *  Universal qoida: nuqta bilan tugagan gap BUTUN o'qiladi, gap o'rtasidan
 *  hech qachon uzilmaydi. Faqat patologik uzun gap (masalan Whisper bir
 *  necha gapni nuqtasiz qo'shib yuborgan) bo'lsa bo'linadi. */
const SENTENCE_MAX_WORDS = 40
const SENTENCE_MAX_MS = 32000

/** Bo'lakda kamida shuncha so'z qolsin — 1-2 so'zli parcha foydasiz. */
const MIN_PIECE_WORDS = 4
/** Rekursiya chuqurligi chegarasi — kutilmagan holatda cheksiz ketmasin. */
const MAX_SPLIT_DEPTH = 8

/** Matn to'liq gap chegarasi bilan tugaydimi (`.`/`!`/`?`/`…`), yopilish
 *  belgilarini (`"`, `'`, `)`) e'tiborga olib. Qisqartma (Mr., Dr.) emas. */
function endsWithSentencePunct(text: string): boolean {
  const t = text.trim().replace(/[)}\]"'"'’”]+$/, '')
  if (!t) return false
  if (!'.!?…'.includes(t[t.length - 1])) return false
  const lastWord = t.split(/\s+/).pop() ?? ''
  return !ABBREVIATIONS.has(lastWord.toLowerCase())
}

function needsForceSplit(chunk: DictationChunk): boolean {
  const words = chunk.text.trim().split(/\s+/).filter(Boolean)
  if (words.length < MIN_PIECE_WORDS * 2) return false
  const durMs = chunk.end_ms - chunk.start_ms
  // TO'LIQ GAP — butun o'qiladi (nuqtagacha). Faqat patologik uzun bo'lsa
  // bo'linadi. Bu foydalanuvchi shikoyatining yechimi: 17 so'zli gap ham
  // endi o'rtasidan uzilmaydi.
  if (endsWithSentencePunct(chunk.text)) {
    return words.length > SENTENCE_MAX_WORDS || durMs > SENTENCE_MAX_MS
  }
  // Tinish belgisiz blok (qo'shiq) — kichikroq bo'laklarga bo'linadi.
  return words.length > HARD_MAX_WORDS || durMs > HARD_MAX_MS
}

/** Chunk oralig'iga TO'LIQ tushgan so'zlar (ketma-ket kesish uchun). */
function wordsInsideChunk(
  chunk: DictationChunk, allWords?: DictationWord[],
): DictationWord[] {
  if (!allWords || allWords.length === 0) return []
  const startS = chunk.start_ms / 1000
  const endS = chunk.end_ms / 1000
  return allWords.filter((w) => w.start >= startS - 0.05 && w.end <= endS + 0.05)
}

/**
 * Majburiy bo'lish nuqtasini tanlaydi — eng katta tanaffus, lekin markazga
 * yaqinroq bo'lgani afzal.
 *
 * Chetdagi 40 ms lik arzimas tanaffus markazdagi 300 ms lik tanaffusdan
 * ustun kelib, 3/40 kabi nomutanosib bo'lish yuz bermasligi uchun har so'z
 * markazdan uzoqlashgani sari kichik jarima qo'shiladi.
 */
function bestSplitIndex(inRange: DictationWord[], wordCount: number): number {
  const lo = MIN_PIECE_WORDS - 1
  const hi = wordCount - MIN_PIECE_WORDS - 1
  if (hi < lo) return -1
  const mid = (wordCount - 1) / 2
  let bestIdx = -1
  let bestScore = -Infinity
  for (let i = lo; i <= hi; i++) {
    const cur = inRange[i]
    const next = inRange[i + 1]
    if (!cur || !next) continue
    const gapMs = (next.start - cur.end) * 1000
    // Markazdan har so'z uzoqlashgani uchun 12 ms "jarima".
    const score = gapMs - Math.abs(i - mid) * 12
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }
  return bestIdx
}

/**
 * Juda uzun chunk'larni majburan bo'ladi — tinish belgisi bo'lmasa ham.
 *
 * `mergeIntoSentences` va (yoqilgan bo'lsa) `splitLongChunks` dan KEYIN
 * ishlaydi: ular tabiiy chegaralarni topgan bo'lsa bu funksiya hech nimaga
 * tegmaydi. Faqat ular ojiz qolganda — masalan butun qo'shiq bitta chunk
 * bo'lib qolganda — aralashadi.
 */
export function forceSplitLongChunks(
  chunks: DictationChunk[],
  allWords?: DictationWord[],
  depth = 0,
): DictationChunk[] {
  if (!chunks.length || depth > MAX_SPLIT_DEPTH) return chunks
  const out: DictationChunk[] = []
  let didSplit = false

  for (const chunk of chunks) {
    if (!needsForceSplit(chunk)) {
      out.push(chunk)
      continue
    }
    const words = chunk.text.trim().split(/\s+/).filter(Boolean)
    const inRange = wordsInsideChunk(chunk, allWords)

    // So'z timestamp'lari matn bilan mos kelsa — tanaffus bo'yicha bo'lamiz.
    let cutIdx = -1
    let leftEnd = 0
    let rightStart = 0
    if (inRange.length === words.length) {
      cutIdx = bestSplitIndex(inRange, words.length)
      if (cutIdx >= 0) {
        leftEnd = Math.round(inRange[cutIdx].end * 1000)
        rightStart = Math.round(inRange[cutIdx + 1].start * 1000)
      }
    }
    if (cutIdx < 0) {
      // Timestamp yo'q yoki mos kelmadi — o'rtadan proporsional bo'lamiz.
      // Aniq emas, lekin bitta ulkan chunkdan ko'ra ancha yaxshi.
      cutIdx = Math.floor((words.length - 1) / 2)
      const ratio = (cutIdx + 1) / words.length
      const boundary = chunk.start_ms
        + Math.round(ratio * (chunk.end_ms - chunk.start_ms))
      leftEnd = boundary
      rightStart = boundary
    }

    didSplit = true
    out.push({
      start_ms: chunk.start_ms,
      end_ms: Math.max(chunk.start_ms + 1, leftEnd),
      text: words.slice(0, cutIdx + 1).join(' '),
    })
    out.push({
      start_ms: Math.min(rightStart, chunk.end_ms - 1),
      end_ms: chunk.end_ms,
      text: words.slice(cutIdx + 1).join(' '),
    })
  }

  // Bo'lingan bo'laklar hali ham uzun bo'lishi mumkin — yana o'tamiz.
  return didSplit ? forceSplitLongChunks(out, allWords, depth + 1) : out
}

/** Split vaqtlarini aniqlaydi. Words bor bo'lsa aniq, yo'q bo'lsa proporsional. */
function resolveSplitTime(
  chunk: DictationChunk,
  leftWords: string[],
  rightWords: string[],
  allWords?: DictationWord[],
): [number, number] {
  // 1. So'z timestamp'lariga urinamiz — chunk oralig'iga tushgan so'zlarni topamiz
  if (allWords && allWords.length) {
    const startS = chunk.start_ms / 1000
    const endS = chunk.end_ms / 1000
    const inRange = allWords.filter((w) => w.start >= startS - 0.05 && w.end <= endS + 0.05)
    if (inRange.length >= leftWords.length) {
      // Chap bo'lakning oxirgi so'zi = inRange[leftWords.length - 1]
      const lastLeft = inRange[leftWords.length - 1]
      const firstRight = inRange[leftWords.length]
      if (lastLeft && firstRight) {
        return [
          Math.round(lastLeft.end * 1000),
          Math.round(firstRight.start * 1000),
        ]
      }
    }
  }
  // 2. Proporsional taqsim (so'z uzunligi asosida)
  const totalLen = leftWords.join('').length + rightWords.join('').length
  const leftLen = leftWords.join('').length
  const dur = chunk.end_ms - chunk.start_ms
  const boundary = chunk.start_ms + Math.round((leftLen / (totalLen || 1)) * dur)
  return [boundary, boundary]
}

/** Matnni gap chegaralari bo'yicha bo'ladi (qisqartmalarni hurmat qiladi). */
function splitByBoundary(text: string): string[] {
  const parts: string[] = []
  const words = text.trim().split(/\s+/)
  let cur: string[] = []
  for (const w of words) {
    cur.push(w)
    const clean = w.replace(/[)}\]"'"']+$/, '')
    const last = clean[clean.length - 1]
    if ('.!?…'.includes(last) && !ABBREVIATIONS.has(clean.toLowerCase())) {
      parts.push(cur.join(' '))
      cur = []
    }
  }
  if (cur.length > 0) parts.push(cur.join(' '))
  return parts.filter((p) => p.trim().length > 0)
}

function loadSettings(): DictationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch { return DEFAULT_SETTINGS }
}

/** YouTube URL / short URL / bare id — barchasidan 11-belgili video ID ni chiqaradi. */
function extractYouTubeId(url: string): string {
  if (!url) return ''
  // Standart: youtube.com/watch?v=XXXXXXXXXXX
  const m1 = url.match(/[?&]v=([^&]+)/)
  if (m1) return m1[1].slice(0, 11)
  // Short: youtu.be/XXXXXXXXXXX
  const m2 = url.match(/youtu\.be\/([^?&/]+)/)
  if (m2) return m2[1].slice(0, 11)
  // Shorts: youtube.com/shorts/XXXXXXXXXXX
  const m3 = url.match(/\/shorts\/([^?&/]+)/)
  if (m3) return m3[1].slice(0, 11)
  // Embed: youtube.com/embed/XXXXXXXXXXX
  const m4 = url.match(/\/embed\/([^?&/]+)/)
  if (m4) return m4[1].slice(0, 11)
  // Yalang id (11 belgi)
  if (/^[A-Za-z0-9_-]{11}$/.test(url.trim())) return url.trim()
  return ''
}

/**
 * Diktant sahifasi — endi bitta `Dictation` modeliga tayanadi.
 *
 * - `data.body` = timestamp'li chunklar ro'yxati (server tomonidan)
 * - Mijozda baholash — API'ga so'rov yubormaymiz
 * - `is_media=true` bo'lsa audio yonida YouTube link ham beriladi
 */
export default function DictationPage() {
  const t = useT()
  const params = useParams()
  // Ikkala route qo'llab-quvvatlanadi: /lessons/:id VA /dictations/:slug
  const slug = params.slug ?? params.id ?? ''
  const { addPlayedSeconds, isLoggedIn } = useAuth()
  // Tizimga kirmagan foydalanuvchi diktant/imtihon boshlay olmaydi — modal chiqadi.
  const [authGate, setAuthGate] = useState<null | string>(null)

  const audioRef = useRef<HTMLAudioElement>(null)
  const ytRef = useRef<YouTubePlayerHandle>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autoNextTimer = useRef<number | null>(null)
  const stopAtMsRef = useRef<number | null>(null)

  const [tab, setTab] = useState<'dictation' | 'transcript'>('dictation')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [results, setResults] = useState<Record<number, DictationResult>>({})
  const [settings, setSettings] = useState<DictationSettings>(loadSettings)
  const [showFull, setShowFull] = useState(false)
  const [finished, setFinished] = useState(false)
  // Foydalanuvchi "Boshlash" tugmasini bosgunga qadar avtomatik ijro yo'q.
  const [started, setStarted] = useState(false)
  // Listening test rejimi — Start ekranidagi "Listening test" tugmasi bosilsa
  // yoqiladi va diktant UI o'rniga savollar paneli chiqadi.
  const [testMode, setTestMode] = useState(false)
  // Shikoyat / "savol xato tuzilgan" — Shorts'dagi bilan bir xil shartnoma.
  const [reportOpen, setReportOpen] = useState(false)
  const [questionFbOpen, setQuestionFbOpen] = useState(false)
  const [feedback, setFeedback] = useState({ reported: false, questionReported: false })
  // Like/dislike — Shorts bilan bir xil mexanizm (server HAR USER 1 marta).
  const [reaction, setReaction] = useState<'like' | 'dislike' | null>(null)
  const [reactionCounts, setReactionCounts] = useState<{ likes: number; dislikes: number }>({ likes: 0, dislikes: 0 })
  // Kunlik limitga yetildimi — kontent OCHILGANDA tekshiriladi (mobil ilova
  // bilan bir xil xulq: `app/video/[id].tsx`). `registerDictationView` limit
  // "chelagi"ga IDEMPOTENT sanaydi — bugun allaqachon ko'rilgan kontentni
  // qayta ochsa `limited:false` (limit to'lgan bo'lsa ham), YANGI kontent
  // bo'lsa `limited:true`. Limit bo'lsa player o'rniga ogohlantiruvchi blok.
  const [limited, setLimited] = useState(false)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dictation', slug],
    queryFn: () => fetchDictation(slug),
    enabled: Boolean(slug),
    // Diktant kontenti (body/words_json/savollar — katta JSON) transkript
    // tayyor bo'lgach o'zgarmaydi. 10 daqiqa kesh — orqaga qaytganda qayta
    // yuklanmaydi. (Like/view alohida endpoint orqali, bu keshga bog'liq emas.)
    staleTime: 10 * 60_000,
    gcTime: 15 * 60_000,
  })

  // Kontent ochilganda bir marta: `views`++ va kunlik limit tekshiruvi.
  // (Ilgari view faqat "Boshlash"/"Imtihon" bosilganda yozilardi; endi mobil
  // bilan bir xil — ochilganda. Limit to'lgan bo'lsa `restart`/`setTestMode`
  // ga umuman yetib bo'lmaydi, chunki player+StartCard bloklanadi.)
  const viewedSlugRef = useRef<string | null>(null)
  useEffect(() => {
    if (!data || !isLoggedIn) return
    const key = String(data.slug ?? slug)
    if (viewedSlugRef.current === key) return
    viewedSlugRef.current = key
    void registerDictationView(data.slug ?? slug, data.is_media ? 'video' : 'dictation')
      .then((r) => setLimited(r.limited))
  }, [data, isLoggedIn, slug])

  // Whisper body'sini rejimga qarab qayta guruhlaymiz:
  //   1. `mergeIntoSentences` — HAR DOIM: gap chegaralari (`.`/`!`/`?`) bo'yicha
  //   2. `splitLongChunks` — FAQAT `clause` rejimida: uzun gaplarni (~18+ so'z)
  //      weak boundary (`,` `;` `:` `—`) da qo'shimcha bo'ladi. `sentence`
  //      rejimida uzun ham bo'lsa ham to'liq gapga tegmaymiz — so'zlar chegarada
  //      kesilib ketmasin.
  const chunks: DictationChunk[] = useMemo(() => {
    const sentences = mergeIntoSentences(data?.body ?? [], data?.words_json)
    // ASOSIY QOIDA (foydalanuvchi so'radi): agar bitta chunkda 20+ so'z bo'lsa,
    // 20-inchi so'zdan boshlab BIRINCHI uchragan tinish belgisi (vergul,
    // nuqta-vergul, tire va h.k.) da to'xtaymiz. Nuqta bo'lguncha kutmaymiz —
    // uzun gaplar ham foydalanuvchi qulay yoza oladigan qismlarga bo'linadi.
    // Tinish belgisi topilmasa `splitLongChunks` bo'lmasdan qaytaradi
    // (mumkin bo'lsa qisqartirmaydi) — bu holda quyidagi xavfsizlik
    // chegarasi (`forceSplitLongChunks`) ishlaydi.
    const clauseSplit = splitLongChunks(sentences, data?.words_json, 20)
    // XAVFSIZLIK CHEGARASI: tinish belgisi umuman bo'lmagan kontentda
    // (qo'shiqlar, ba'zi videolar) yuqoridagi bo'lish ishlamaydi va butun
    // matn bitta chunk bo'lib qoladi — bunday diktantni yozib bo'lmaydi.
    // Shu bois uzun chunk'lar so'zlar orasidagi eng katta tanaffusda
    // majburan bo'linadi.
    const base = forceSplitLongChunks(clauseSplit, data?.words_json)
    // OXIRGI POG'ONA: har chunk audio boshi/oxirini so'z timestamp'lariga
    // tirash. Oxirgi so'zlar ("Korea", "Jong-un") kesilib qolmaydi.
    return snapChunksToWords(base, data?.words_json)
  }, [data])
  // Rejim / N o'zgarsa chunks ro'yxati qisqarishi mumkin — joriy index
  // oxirdan chiqmasin uchun clamp qilamiz. Foydalanuvchining pozitsiyasi
  // saqlanadi, boshiga qaytmaydi.
  useEffect(() => {
    if (chunks.length > 0 && index >= chunks.length) {
      setIndex(chunks.length - 1)
    }
  }, [chunks.length, index])
  const current = chunks[index]
  const fullAnswer = current?.text ?? ''

  // Manba tanlash: audio bor bo'lsa audio; aks holda youtube_link'dan YouTube player.
  const youtubeId = useMemo(
    () => (data && !data.audio_url && data.youtube_link)
      ? extractYouTubeId(data.youtube_link) : '',
    [data],
  )
  const hasYouTube = Boolean(youtubeId)
  const hasAudio = Boolean(data?.audio_url)

  /** Videoni/audioni berilgan soniyaga surib ijro qiladi.
   *  "Isbot" tugmasi ham, savol pozitsiyasi bari ham shundan foydalanadi.
   *  Rewind (2 s oldinroq) TestView ichida qo'llanadi — bu funksiya tayyor
   *  sekundni oladi. */
  const seekTo = useCallback((sec: number) => {
    const safe = Math.max(0, sec)
    if (audioRef.current) {
      audioRef.current.currentTime = safe
      audioRef.current.play().catch(() => {})
    } else if (ytRef.current) {
      ytRef.current.playRange(safe * 1000)
    }
  }, [])

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
    const mcq = data?.mcq_questions ?? []
    const tfng = data?.tfng_questions ?? []
    const fill = data?.fill_gap_questions ?? []
    const raw = [
      ...mcq.map((q, i) => ({ n: i + 1, label: 'MCQ', proof: q.proof_from_text })),
      ...tfng.map((q, i) => ({ n: mcq.length + i + 1, label: 'TFNG', proof: q.proof_from_text })),
      ...fill.map((q, i) => ({ n: mcq.length + tfng.length + i + 1, label: 'Fill', proof: q.proof_from_text })),
    ]
    const secOf = (p?: string) => {
      const m = (p || '').match(/\[\s*([0-9]+(?:\.[0-9]+)?)\s*\]/)
      return m ? parseFloat(m[1]) : null
    }
    const withSec = raw.map((m) => ({ ...m, sec: secOf(m.proof) }))
    withSec.sort((a, b) => {
      if (a.sec == null && b.sec == null) return 0
      if (a.sec == null) return 1
      if (b.sec == null) return -1
      return a.sec - b.sec
    })
    return withSec.map((m) => ({ n: m.n, label: m.label, proof: m.proof }))
  }, [data?.mcq_questions, data?.tfng_questions, data?.fill_gap_questions])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  // Like/dislike hisoblagichini detaildan boshlab qo'yamiz (guest ham ko'radi).
  useEffect(() => {
    if (data) setReactionCounts({ likes: data.likes ?? 0, dislikes: data.dislikes ?? 0 })
  }, [data])

  // Foydalanuvchining shikoyat holati + joriy like/dislike'i (server HAR USER
  // 1 marta). Anonim/tarmoq xatosida jimgina o'tamiz.
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    fetchMyDictationFeedback(slug)
      .then((res) => {
        if (cancelled) return
        setFeedback({ reported: res.reported, questionReported: res.question_reported })
        setReaction(res.my_reaction ?? null)
        setReactionCounts({ likes: res.likes, dislikes: res.dislikes })
      })
      .catch(() => { /* anonim — muhim emas */ })
    return () => { cancelled = true }
  }, [slug])

  // Onboarding ipuchilari — FAQAT ro'yxatdan o'tganiga 2 kundan kam bo'lgan
  // foydalanuvchiga va har biri umrida BIR MARTA (`utils/onboarding.ts`).
  //
  //  1. `testPositions` — video ostidagi "savol pozitsiyalari" checkbox'i:
  //     qayerga kelgani va qaysi savol qayerda ekanini shu yerdan ko'radi.
  //  2. `testProof`     — "Isbot" tugmasi: javob eshitiladigan soniyaga
  //     suradi (2 s oldinroqdan).
  //
  // Ikkinchisi birinchisi yopilmagunicha kutadi — bir vaqtda ikkita kartochka
  // chiqib ekranni to'ldirib qo'ymasin.
  // Test rejimida videoni O'ZIMIZNING start tugmamiz boshlaydi.
  const [testStarted, setTestStarted] = useState(false)

  /**
   * O'RGATISH (`utils/onboarding.ts`): ro'yxatdan o'tgach **1 hafta**
   * davomida, **kuniga bir marta**. Uzun videoda ekranda uch narsa bor va
   * ular birinchi qarashda tushunarsiz: chapdagi player, o'ngdagi savollar
   * paneli va video ostidagi savol-pozitsiya bari.
   */
  const tour = useTour(TOUR.video, testMode, 1200)

  const tourSteps: TourStep[] = useMemo(() => [
    {
      anchor: () => firstVisible('[data-tour="video-start"]', '.test-layout-video'),
      title: t.tourVideoStartTitle,
      text: t.tourVideoStartText,
      side: 'right',
    },
    {
      anchor: () => firstVisible('.test-layout-panel'),
      title: t.tourVideoQTitle,
      text: t.tourVideoQText,
      side: 'left',
    },
    {
      anchor: () => firstVisible('[data-tour="qpos-bar"]'),
      title: t.tourVideoPosTitle,
      text: t.tourVideoPosText,
      side: 'top',
    },
  ], [t])

  const solved = Object.values(results).filter((r) => r.isCorrect).length
  const percent = chunks.length ? Math.round((solved / chunks.length) * 100) : 0
  const isFinished = finished || (chunks.length > 0 && solved === chunks.length)
  const isLastChunk = chunks.length > 0 && index === chunks.length - 1


  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = settings.playbackRate
    // YouTube uchun ham tezlikni qo'llaymiz
    ytRef.current?.setPlaybackRate(settings.playbackRate)
  }, [settings.playbackRate, current?.start_ms])

  useEffect(() => {
    if (current) stopAtMsRef.current = current.end_ms + CHUNK_TAIL_MS
  }, [current?.start_ms, current?.end_ms])

  const playChunk = useCallback(() => {
    if (!current) return
    const startMs = Math.max(0, current.start_ms - CHUNK_LEAD_MS)
    const endMs = current.end_ms + CHUNK_TAIL_MS
    stopAtMsRef.current = endMs
    // Audio ustunlik: audio bo'lsa audio, aks holda YouTube.
    if (audioRef.current) {
      const el = audioRef.current
      el.playbackRate = settings.playbackRate
      el.currentTime = startMs / 1000
      el.play().catch(() => {})
    } else if (ytRef.current) {
      ytRef.current.playRange(startMs, endMs)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, settings.playbackRate])

  useEffect(() => {
    if (autoNextTimer.current) window.clearTimeout(autoNextTimer.current)
    setShowFull(false)
    textareaRef.current?.focus()
    // Faqat "Boshlash" tugmasi bosilganidan keyin avtomatik ijro
    if (started) playChunk()
  }, [index, current?.start_ms, playChunk, started])

  useEffect(() => {
    if (tab !== 'dictation' || isFinished) {
      audioRef.current?.pause()
      ytRef.current?.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isFinished])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const enforce = () => {
      const stopAt = stopAtMsRef.current
      if (stopAt == null || el.paused) return
      if (el.currentTime * 1000 >= stopAt) el.pause()
    }
    el.addEventListener('timeupdate', enforce)
    const timer = window.setInterval(enforce, 50)
    return () => {
      el.removeEventListener('timeupdate', enforce)
      window.clearInterval(timer)
    }
  }, [current?.start_ms])

  // --- Tinglash vaqti hisobi ---------------------------------------------
  //
  // **Qoida o'zgardi** (foydalanuvchi so'radi): ilgari har soniyada ijro
  // etilgan vaqt serverga oqib turardi — ya'ni yarim tashlab ketilgan
  // diktant ham vaqt yig'ardi. Endi vaqt FAQAT ish **oxirigacha
  // bajarilganda** bir marta qo'shiladi:
  //
  //   • diktant — barcha gaplar yozib bo'linganda (`isFinished`)
  //   • listening test — natija chiqqanda (`TestView` → `onCompleted`)
  //
  // Qo'shiladigan qiymat — audio/video **to'liq davomiyligi**: ish tugadi,
  // demak kontent to'liq tinglangan deb hisoblaymiz.
  //
  // `awardedRef` bir sessiyada ikki marta yozilib ketmasligini ta'minlaydi
  // (diktant ham, test ham bajarilsa — har biri o'z bayrog'i bilan).
  const awardedRef = useRef({ dictation: false, test: false })

  const awardCompletion = useCallback((kind: 'dictation' | 'test') => {
    if (awardedRef.current[kind]) return
    awardedRef.current[kind] = true
    const seconds = Math.max(1, Math.round(data?.duration_sec || 0))
    if (seconds <= 0) return
    void addPlayedSeconds(seconds)
    void addDictationPlayedTime(slug, seconds * 1000).catch(() => {})
  }, [addPlayedSeconds, slug, data?.duration_sec])

  // --- Baholash ----------------------------------------------------------
  const advance = useCallback(() => {
    if (autoNextTimer.current) window.clearTimeout(autoNextTimer.current)
    if (index < chunks.length - 1) setIndex((i) => i + 1)
    else setFinished(true)
  }, [chunks.length, index])

  // Diktant oxirigacha yozildi — shu paytdagina tinglash vaqti qo'shiladi.
  // `isFinished` "hamma gap to'g'ri" yoki "Yakunlash" bosilgan holatni
  // qamrab oladi (yuqorida hisoblanadi).
  useEffect(() => {
    if (isFinished) awardCompletion('dictation')
  }, [isFinished, awardCompletion])

  const check = useCallback(() => {
    if (!current) return
    const existing = results[index]
    if (existing?.isCorrect) {
      advance()
      return
    }
    const given = answers[index] ?? ''
    const result = gradeDictation(fullAnswer, given)
    setResults((r) => ({ ...r, [index]: result }))
    if (result.isCorrect) {
      setAnswers((a) => ({ ...a, [index]: fullAnswer }))
      // Vaqti aniq — sun'iy kechiktirish yo'q. Darrov keyingi chunk.
      if (AUTO_NEXT_MS > 0) {
        autoNextTimer.current = window.setTimeout(advance, AUTO_NEXT_MS)
      } else {
        advance()
      }
    }
  }, [advance, answers, current, fullAnswer, index, results])

  const goTo = useCallback((next: number) => {
    if (next < 0 || next >= chunks.length) return
    setIndex(next)
  }, [chunks.length])

  const restart = useCallback(() => {
    if (autoNextTimer.current) window.clearTimeout(autoNextTimer.current)
    setIndex(0)
    setResults({})
    setAnswers({})
    setFinished(false)
    setShowFull(false)
    // Boshidan boshlash — darrov ijro etilsin (Boshlash tugmasi qaytmaydi)
    setStarted(true)
  }, [])

  // Like/dislike — server HAR USER 1 marta (toggle). Kirmagan bo'lsa modal.
  const reactRef = useRef(0)
  const applyDictationReaction = useCallback(async (clicked: 'like' | 'dislike') => {
    if (!isLoggedIn) { setAuthGate('Baholash'); return }
    const now = Date.now()
    if (now - reactRef.current < 400) return
    reactRef.current = now
    const prev = reaction
    const before = reactionCounts
    const next: 'like' | 'dislike' | null = prev === clicked ? null : clicked
    setReaction(next)
    setReactionCounts((c) => ({
      likes: c.likes + (prev === 'like' ? -1 : 0) + (next === 'like' ? 1 : 0),
      dislikes: c.dislikes + (prev === 'dislike' ? -1 : 0) + (next === 'dislike' ? 1 : 0),
    }))
    try {
      const res = await reactToDictation(slug, clicked)
      setReaction(res.my_reaction ?? null)
      setReactionCounts({ likes: res.likes, dislikes: res.dislikes })
    } catch {
      setReaction(prev)          // xato — optimistikni qaytaramiz
      setReactionCounts(before)
    }
  }, [isLoggedIn, reaction, reactionCounts, slug])


  const finishNow = useCallback(() => {
    if (autoNextTimer.current) window.clearTimeout(autoNextTimer.current)
    setFinished(true)
  }, [])

  const skipChunk = useCallback(() => {
    if (!current) return
    setAnswers((a) => ({ ...a, [index]: fullAnswer }))
    if (autoNextTimer.current) window.clearTimeout(autoNextTimer.current)
    if (SKIP_NEXT_MS > 0) {
      autoNextTimer.current = window.setTimeout(advance, SKIP_NEXT_MS)
    } else {
      advance()
    }
  }, [advance, current, fullAnswer, index])

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      check()
      return
    }
    if (event.key === 'Control') {
      event.preventDefault()
      playChunk()
    }
  }, [check, playChunk])

  if (isLoading) return <><PageHeader /><Spinner /></>
  if (isError || !data) return <><PageHeader /><ErrorState onRetry={() => refetch()} /></>

  const result = current ? results[index] : undefined

  return (
    <>
      {/* Kontent sub-header — sarlavha + level. Duration pill'i va progress
          navbar'da (`TodayTimeIndicator`) va TestView'ning o'z hisoblagichida
          bor, shu bois bu yerda dublikat qilmaymiz. `↻ Boshidan` faqat
          diktant rejimida — imtihonda u yerdagi "Diktant" tugmasi bu vazifani
          bajaradi. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px clamp(16px,4vw,48px)', borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', minWidth: 0 }}>
          <Link to={`/topics/${data.type_slug || data.type}`}
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}>
            ‹ {data.type_label}
          </Link>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{data.title}</span>
          {data.cefr_level && <Badge>{data.cefr_level}</Badge>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Like / dislike — har doim ko'rinadi (Shorts bilan bir xil).
              Server HAR USER 1 marta cheklaydi; kirmagan bo'lsa modal chiqadi. */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <LikeButton
              active={reaction === 'like'} count={reactionCounts.likes} dir="up"
              onClick={() => applyDictationReaction('like')}
            />
            <LikeButton
              active={reaction === 'dislike'} count={reactionCounts.dislikes} dir="down"
              onClick={() => applyDictationReaction('dislike')}
            />
          </div>
          {!testMode && (<>
            <button onClick={restart} title={t.restartTitle} style={{
              fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 999,
              background: 'var(--bg-secondary)', color: 'var(--text)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}>↻ {t.restart}</button>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
              {solved} / {chunks.length}
            </span>
            <div style={{ width: 140, maxWidth: '30vw' }}>
              <ProgressBar percent={percent} />
            </div>
          </>)}
        </div>
      </div>

      <div className="page" style={{ maxWidth: testMode ? 'none' : 720, padding: testMode ? '20px clamp(12px, 2vw, 32px) 40px' : undefined }}>
        <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
          {(['dictation', 'transcript'] as const).map((key) => (
            <button key={key} onClick={() => setTab(key)} aria-pressed={tab === key}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '10px 16px',
                fontSize: 14, fontWeight: 700,
                color: tab === key ? '#10B981' : 'var(--text-secondary)',
                borderBottom: `2px solid ${tab === key ? '#10B981' : 'transparent'}`,
                marginBottom: -1,
              }}>
              {key === 'dictation' ? (testMode ? 'Imtihon' : t.dictationTabLabel) : t.transcriptTabLabel}
            </button>
          ))}
        </div>

        <div style={{ display: tab === 'transcript' ? 'block' : 'none' }}>
          <div className="card" style={{ padding: 28, fontSize: 16, lineHeight: 1.9 }}>
            {chunks.map((c, i) => <p key={i} style={{ margin: '0 0 12px' }}>{c.text}</p>)}
          </div>
        </div>

        <div style={{ display: tab === 'dictation' && chunks.length === 0 ? 'block' : 'none' }}>
          <div className="card" style={{ padding: 24, color: 'var(--text-secondary)' }}>
            Bu diktantda hali gap yo'q. Admin panelida Segment editor bilan qo'shing.
          </div>
        </div>

        <div style={{ display: tab === 'dictation' && isFinished ? 'block' : 'none' }}>
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px',
              background: 'var(--ok-bg)', color: 'var(--ok-text)',
              border: '2px solid #10B981',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }} aria-hidden>
              <svg width="30" height="30" viewBox="0 0 24 24">
                <path d="M4 12.5l5.5 5.5L20 7" stroke="currentColor" strokeWidth="2.6"
                  fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 10px' }}>
              {t.lessonDone}
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: '0 0 24px' }}>
              Barcha {chunks.length} ta gap to'g'ri yozildi.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={restart}>
                Boshidan qayta ishlash
              </button>
              <Link to={`/topics/${data.type_slug || data.type}`} className="btn btn-ghost"
                style={{ textDecoration: 'none' }}>
                Boshqa diktant
              </Link>
            </div>
          </div>
        </div>

        {/* Diktant kartochkasi — video HAR DOIM mount qilinadi, shu bilan
            YouTube fon rejimida yuklanib turadi va foydalanuvchi Boshlash
            bosgan zahoti darrov ishga tushadi. `!started` bo'lsa textbox va
            tugmalar o'rniga katta "Boshlash" (yoki "Qayta ishlash") tugmasi
            ko'rsatiladi — foydalanuvchi kutmaydi. */}
        <div style={{
          display: tab === 'dictation' && !isFinished && current && !testMode ? 'block' : 'none',
        }}>
          {current && (
          <div className="card" style={{ padding: 'clamp(16px,3vw,24px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <button onClick={() => goTo(index - 1)} disabled={index === 0}
                aria-label={t.prevAria} style={navBtn}>
                <ChevronIcon dir="left" color="var(--text-secondary)" size={18} />
              </button>
              <span style={{ fontSize: 14, fontWeight: 700, minWidth: 56, textAlign: 'center' }}>
                {index + 1} / {chunks.length}
              </span>
              <button onClick={() => goTo(index + 1)} disabled={index >= chunks.length - 1}
                aria-label={t.nextAria} style={navBtn}>
                <ChevronIcon dir="right" color="var(--text)" size={18} />
              </button>

              <div style={{ flex: 1 }} />

              <select value={settings.playbackRate}
                onChange={(e) => setSettings((s) => ({ ...s, playbackRate: Number(e.target.value) }))}
                aria-label={t.playbackRateAria}
                style={{
                  border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px',
                  background: 'var(--bg-secondary)', color: 'var(--text)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                {SPEEDS.map((s) => <option key={s} value={s}>{s}x</option>)}
              </select>
            </div>

            {limited ? (
              /* Kunlik limit — player o'rniga ogohlantirish (mobil bilan bir xil).
                 Kontent umuman ko'rsatilmaydi: player, poster va StartCard ham
                 chizilmaydi. */
              <div style={{
                marginBottom: 12, padding: '22px 20px', textAlign: 'center',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 14, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16,
                  background: 'linear-gradient(135deg,#F59E0B 0%,#EF4444 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                    stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                  </svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{t.limitTitle}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 340, lineHeight: 1.5 }}>
                  {t.limitResets}
                </div>
                <Link to="/profile/billing" className="btn btn-primary"
                  style={{ textDecoration: 'none', padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 800 }}>
                  {t.limitUpgrade}
                </Link>
              </div>
            ) : hasAudio ? (
              <audio ref={audioRef} src={data.audio_url!} controls preload="metadata"
                style={{ width: '100%', marginBottom: 6 }} />
            ) : hasYouTube ? (
              <div style={{ marginBottom: 10, position: 'relative' }}>
                <YouTubePlayer ref={ytRef} youtubeId={youtubeId} />
                {/* Foydalanuvchi Boshlash/Davom etish bosmaguncha statik
                    thumbnail turadi — video oldindan ko'rinib turmasin.
                    YouTube player ostida yuklanib turadi, bosgan zahoti
                    ijro darrov boshlanadi. */}
                {!started && !testMode && (
                  <VideoPosterOverlay
                    youtubeId={youtubeId}
                    onClick={restart}
                    primaryLabel="Boshlash"
                  />
                )}
                {started && (
                  <div style={{
                    fontSize: 11, color: 'var(--text-secondary)', marginTop: 6,
                  }}>{t.playerHint}</div>
                )}
              </div>
            ) : (
              <div style={{
                fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12,
                padding: '10px 14px', background: 'var(--bg-secondary)',
                border: '1px solid var(--border)', borderRadius: 10,
              }}>{t.noMediaAttached}</div>
            )}

            {!started && !testMode && !limited && (
              <StartCard
                title={data.title}
                chunksCount={chunks.length}
                typeLabel={data.type_label}
                cefr={data.cefr_level}
                hasTests={Boolean(
                  (data.mcq_questions?.length || 0)
                  + (data.tfng_questions?.length || 0)
                  + (data.fill_gap_questions?.length || 0),
                )}
                onStart={() => {
                  if (!isLoggedIn) { setAuthGate('Diktantni boshlash'); return }
                  // View + limit tekshiruvi kontent OCHILGANDA bo'ldi (yuqoridagi
                  // effekt). Limit to'lgan bo'lsa bu StartCard umuman ko'rinmaydi.
                  restart()
                }}
                onTest={() => {
                  if (!isLoggedIn) { setAuthGate('Imtihonni boshlash'); return }
                  setTestMode(true)
                }}
              />
            )}

            {started && (<>
            <div style={{
              fontSize: 12, color: 'var(--text-secondary)',
              display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12,
            }}>
              <span><b>Ctrl</b> — chunk'ni qayta qo'yish</span>
              <span><b>Enter</b> — tekshirish</span>
            </div>

            <textarea ref={textareaRef}
              value={answers[index] ?? ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [index]: e.target.value }))}
              onKeyDown={onKeyDown}
              placeholder={t.dictationPlaceholder} aria-label={t.dictationTabLabel}
              autoFocus
              style={{
                width: '100%', minHeight: 96,
                border: `1.5px solid ${result?.isCorrect ? '#10B981' : result ? '#F59E0B' : 'var(--border)'}`,
                borderRadius: 14, padding: 16, fontSize: 16, color: 'var(--text)',
                background: 'var(--bg-secondary)', outline: 'none', resize: 'vertical',
                lineHeight: 1.6,
              }} />

            {result && (
              <div style={{ marginTop: 14 }}>
                {result.isCorrect ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 14, fontWeight: 700, color: 'var(--ok-text)',
                  }}>
                    <IconCheck /> {t.correctLabel}
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 14, fontWeight: 700, color: '#D97706', marginBottom: 8,
                  }}>
                    {result.matched}/{result.total} to'g'ri
                  </div>
                )}
              </div>
            )}

            {result && !result.isCorrect && (showFull || settings.showAnswerImmediately) && fullAnswer && (
              <div style={{ marginTop: 8, fontSize: 16, lineHeight: 1.7 }}>
                <FeedbackLine full={fullAnswer} words={result.words} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={check}
                style={{ flex: '1 1 200px' }}>{t.checkBtn}</button>
              {isLastChunk ? (
                <button className="btn btn-ghost" onClick={finishNow}
                  style={{ background: 'var(--ok-bg)', color: 'var(--ok-text)',
                           border: '1px solid var(--ok-text)', fontWeight: 700 }}>
                  Yakunlash
                </button>
              ) : (
                <button className="btn btn-ghost" onClick={skipChunk}
                  title={t.showCanonical}>
                  {t.skipBtn}
                </button>
              )}
              {!settings.showAnswerImmediately && !showFull && result && !result.isCorrect && (
                <button className="btn btn-ghost" onClick={() => setShowFull(true)}
                  aria-label={t.showAnswer}>{t.showAnswer}</button>
              )}
            </div>

            <div style={{
              marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              {/* Hozircha faqat "nuqtagacha" rejim. Foydalanuvchi so'ragan
                  bo'lsa ChunkModePicker'ni yana ochish oson — komponent va
                  splitLongChunks logikasi joyida turibdi. */}
              {false && (
                <ChunkModePicker
                  mode={settings.chunkMode}
                  minWords={settings.chunkMinWords}
                  onChangeMode={(mode) =>
                    setSettings((s) => ({ ...s, chunkMode: mode }))}
                  onChangeMinWords={(n) =>
                    setSettings((s) => ({ ...s, chunkMinWords: n }))}
                />
              )}
              <Checkbox
                checked={settings.showAnswerImmediately}
                onChange={(v) => setSettings((s) => ({ ...s, showAnswerImmediately: v }))}
                label={t.revealOnError}
              />
              <Checkbox
                checked={settings.showFullAnswer}
                onChange={(v) => setSettings((s) => ({ ...s, showFullAnswer: v }))}
                label={t.revealAlways}
              />
            </div>

            {(result || showFull) && settings.showFullAnswer && fullAnswer && (
              <div style={{
                marginTop: 12, fontSize: 14, lineHeight: 1.6,
                padding: '10px 14px', background: 'var(--bg-secondary)',
                borderRadius: 10, color: 'var(--text-secondary)',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '.03em', display: 'block', marginBottom: 4 }}>
                  To'liq javob
                </span>
                {fullAnswer}
              </div>
            )}
            </>)}
          </div>
          )}
        </div>

        {/* Listening test rejimi — ShortsPage uslubidagi 2 ustunli layout:
            chapda video (haqiqiy player), o'ngda savollar paneli. */}
        {tab === 'dictation' && testMode && (
          // Grid `global.css` dagi `.test-layout` da — u yerda tor ekran
          // uchun media query ham bor (video tepada, savollar pastda).
          <div className="test-layout">
            {/* Chap ustun: video + tagida bar/toolbar. Sticky —
                foydalanuvchi o'ngdagi savollarni scroll qilganda video
                yuqorida qolib turadi. */}
            <div className="test-layout-video">
              <div style={{
                position: 'relative', width: '100%',
                borderRadius: 16, overflow: 'hidden',
                background: '#000',
                aspectRatio: hasYouTube ? '16/9' : undefined,
                border: '1px solid var(--border)',
              }}>
                {hasAudio ? (
                  <audio ref={audioRef} src={data.audio_url!} controls preload="metadata"
                    style={{ width: '100%', display: 'block' }} />
                ) : hasYouTube ? (
                  <>
                    <YouTubePlayer ref={ytRef} youtubeId={youtubeId} nativeControls />
                    {/* O'Z start tugmamiz. Ilgari test rejimida video o'zi
                        boshlanmasdi va foydalanuvchi YouTube iframe'ini bir
                        marta bosishga MAJBUR edi (foydalanuvchi shikoyati).
                        Bosilgach yo'qoladi. */}
                    {!testStarted && (
                      <button
                        data-tour="video-start"
                        onClick={() => { setTestStarted(true); ytRef.current?.play?.() }}
                        style={{
                          position: 'absolute', inset: 0, zIndex: 2,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: 10, border: 'none', cursor: 'pointer',
                          background: 'rgba(8,12,20,.45)', color: '#fff',
                          fontSize: 15, fontWeight: 800, fontFamily: 'inherit',
                        }}
                      >
                        <span style={{
                          width: 54, height: 54, borderRadius: '50%',
                          background: '#10B981', display: 'inline-flex',
                          alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 8px 24px rgba(16,185,129,.45)',
                        }}><IconPlay /></span>
                        {t.tourVideoStartTitle}
                      </button>
                    )}
                  </>
                ) : (
                  <div style={{
                    aspectRatio: '16/9', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: '#FFF', fontSize: 13,
                  }}>{t.noMediaShort}</div>
                )}
              </div>
              {/* Savol pozitsiyasi bari — default o'chiq (localStorage).
                  Raqamlar TestView bilan bir xil ketma-ketlikda: avval MCQ,
                  keyin TFNG, keyin fill-gap. Onboarding ipuchi ochiq bo'lsa
                  checkbox yashil halqa bilan ajraladi. */}
              <div data-tour="qpos-bar">
              <QuestionPositionBar
                totalSec={data.duration_sec}
                localStorageKey="listening.test.qpos"
                getCurrentSec={() => (
                  audioRef.current
                    ? audioRef.current.currentTime
                    : (ytRef.current?.currentTimeMs?.() ?? 0) / 1000
                )}
                questions={positionMarks}
              />
              </div>
            </div>

            {/* O'ng ustun: SCROLLABLE savollar paneli. `max-height` +
                `overflow-y: auto` + pastdagi fade — foydalanuvchi pastda
                yana content borligini ko'radi. */}
            <div className="test-layout-panel">
              <TestView
                mcq={data.mcq_questions ?? []}
                tfng={data.tfng_questions ?? []}
                fill={data.fill_gap_questions ?? []}
                onExit={() => setTestMode(false)}
                onSeek={seekTo}
                onCompleted={() => awardCompletion('test')}
                onReport={() => setReportOpen(true)}
                onQuestionFeedback={() => setQuestionFbOpen(true)}
                reported={feedback.reported}
                questionReported={feedback.questionReported}
              />
              {/* Pastdagi soyalash — "yana pastda savol bor" ko'rsatgichi.
                  Scroll oxiriga yetganda IntersectionObserver bilan yashirsa
                  ham bo'ladi, hozircha oddiy doimiy gradient. */}
              <div aria-hidden style={{
                position: 'sticky', bottom: 0, height: 40, marginTop: -40,
                pointerEvents: 'none',
                background: 'linear-gradient(180deg, transparent, var(--bg) 80%)',
              }} />
            </div>
          </div>
        )}

        {tour.open && <CoachTour steps={tourSteps} onDone={tour.finish} />}

        {reportOpen && (
          <ReportModal
            loadReasons={fetchDictationReportReasons}
            submit={(payload) => reportDictation(slug, payload)}
            onClose={() => setReportOpen(false)}
            onSubmitted={() => {
              setReportOpen(false)
              setFeedback((f) => ({ ...f, reported: true }))
            }}
          />
        )}
        {questionFbOpen && (
          <QuestionFeedbackModal
            submit={(text) => reportDictationQuestion(slug, text)}
            onClose={() => setQuestionFbOpen(false)}
            onSubmitted={() => {
              setQuestionFbOpen(false)
              setFeedback((f) => ({ ...f, questionReported: true }))
            }}
          />
        )}

      </div>

      <AuthGateModal
        open={authGate != null}
        action={authGate ?? undefined}
        onClose={() => setAuthGate(null)}
      />
    </>
  )
}

const navBtn: React.CSSProperties = {
  background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '50%',
  width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
}

/** Like / dislike tugmasi — Shorts uslubidagi (ikonka + sanoq). `dir` yo'nalish. */
function LikeButton({ active, count, dir, onClick }: {
  active: boolean; count: number; dir: 'up' | 'down'; onClick: () => void
}) {
  const color = active ? (dir === 'up' ? '#10B981' : '#EF4444') : 'var(--text-secondary)'
  return (
    <button onClick={onClick} title={dir === 'up' ? 'Yoqdi' : 'Yoqmadi'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 11px', borderRadius: 999, cursor: 'pointer',
        background: active ? (dir === 'up' ? 'var(--ok-bg)' : 'rgba(239,68,68,.12)') : 'var(--bg-secondary)',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        color, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
        transition: 'background .12s, border-color .12s, color .12s',
      }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill={active ? color : 'none'}
        stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden
        style={dir === 'down' ? { transform: 'rotate(180deg)' } : undefined}>
        <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zm0 0l4.5-7a2 2 0 0 1 1.8 2.9L12 9h6.5a2 2 0 0 1 2 2.4l-1.3 7A2 2 0 0 1 17.2 20H7" />
      </svg>
      {count > 0 && <span>{count}</span>}
    </button>
  )
}

/** Foydalanuvchi Boshlash/Davom etish bosmaguncha YouTube playeri ustida
 *  statik thumbnail ko'rsatadi. Player ostida yuklanib turadi (preload). */
function VideoPosterOverlay({ youtubeId, onClick, primaryLabel }: {
  youtubeId: string
  onClick: () => void
  primaryLabel: string
}) {
  const [broken, setBroken] = useState(false)
  const [triedHq, setTriedHq] = useState(false)
  const src = broken
    ? ''
    : triedHq
      ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
      : `https://i.ytimg.com/vi_webp/${youtubeId}/maxresdefault.webp`
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={primaryLabel}
      style={{
        position: 'absolute', inset: 0, padding: 0, margin: 0, border: 'none',
        borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
        background: '#0F172A', display: 'block',
      }}
    >
      {!broken && (
        <img
          src={src}
          alt=""
          decoding="async"
          onError={() => triedHq ? setBroken(true) : setTriedHq(true)}
          style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          }}
        />
      )}
      {/* Yumshoq qorong'ilashtiruvchi qatlam — play tugmasi kontrasti uchun */}
      <span aria-hidden style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,.15) 0%, rgba(0,0,0,.35) 100%)',
      }} />
      {/* Katta play tugmasi — YouTube-uslubi */}
      <span aria-hidden style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 76, height: 54, borderRadius: 14,
        background: 'rgba(239, 68, 68, .95)', color: '#FFF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, fontWeight: 900, letterSpacing: '-.02em',
        boxShadow: '0 10px 24px rgba(0,0,0,.35)',
      }}>▶</span>
      <span aria-hidden style={{
        position: 'absolute', left: 14, bottom: 12,
        color: '#FFF', fontSize: 13, fontWeight: 800, letterSpacing: '.01em',
        textShadow: '0 1px 4px rgba(0,0,0,.5)',
      }}>{primaryLabel}</span>
    </button>
  )
}

/** Diktantni boshlash yoki listening test tanlash tugmalari.
 *  Video (YouTube/audio) fon rejimida allaqachon yuklanib turadi —
 *  foydalanuvchi bosgan zahoti ijro darrov boshlanadi.
 *
 *  Agar diktantda AI-generatsiya qilingan test savollari bo'lsa "Listening
 *  test" tugmasi ham ko'rinadi. Aks holda faqat diktant tugmasi. */
function StartCard({ title, chunksCount, typeLabel, cefr, onStart, hasTests, onTest }: {
  title: string
  chunksCount: number
  typeLabel: string
  cefr: string
  hasTests: boolean
  onStart: () => void
  onTest?: () => void
}) {
  const t = useT()
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 14, padding: '20px 8px 4px', textAlign: 'center',
    }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{title}</h2>
      <div style={{
        fontSize: 13, color: 'var(--text-secondary)', display: 'flex',
        gap: 10, flexWrap: 'wrap', justifyContent: 'center',
      }}>
        <span>{typeLabel}</span>
        {cefr && <><span>·</span><span>{cefr}</span></>}
      </div>
      {/* IERARXIYA (foydalanuvchi so'radi): savollari bor kontentda
          **Listening test** asosiy harakat — u qiziqroq va kirish osonroq.
          Diktant esa ikkinchi darajaga tushadi (matnli havola).
          Savollar yo'q bo'lsa diktant o'zi asosiy tugma bo'ladi. */}
      {hasTests && onTest ? (
        /* Ikki TENG variant — bir xil rang, bir xil styling. Foydalanuvchi
           birortasini "oldindan tanlangan" deb o'ylamasin — o'zi bilib
           tanlaydi. Farq faqat ikonka va matnda. Hover'da nozik yashil
           chegara — bosishga tayyor ekanini ko'rsatadi. */
        <div className="modechoice" style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
          width: '100%', maxWidth: 520, marginTop: 6,
        }}>
          <button onClick={onTest} className="modechoice-btn" type="button">
            <span className="modechoice-icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="2.5" />
                <path d="M8 9h8M8 13h5M8 17h6" />
                <circle cx="16" cy="17" r="2.2" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <span className="modechoice-title">{t.examMode}</span>
            <span className="modechoice-desc">
              Videoni ko'rib savollarga javob bering
            </span>
          </button>
          <button onClick={onStart} className="modechoice-btn" type="button">
            <span className="modechoice-icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h16" />
                <path d="M14 4l6 6-9 9H5v-6l9-9z" />
              </svg>
            </span>
            <span className="modechoice-title">{t.dictationMode}</span>
            <span className="modechoice-desc">
              Har gapni tinglab yozib chiqing · {chunksCount} ta gap
            </span>
          </button>
        </div>
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 10, marginTop: 4,
        }}>
          <button
            onClick={onStart}
            className="btn btn-primary"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 16, padding: '15px 28px', borderRadius: 13,
              fontWeight: 800, cursor: 'pointer',
            }}
          ><IconPlay />{t.startDictation}</button>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Tayyor bo'lganda bosing — audio darrov boshlanadi.
          </div>
        </div>
      )}
    </div>
  )
}

function ChunkModePicker({ mode, minWords, onChangeMode, onChangeMinWords }: {
  mode: ChunkMode
  minWords: number
  onChangeMode: (mode: ChunkMode) => void
  onChangeMinWords: (n: number) => void
}) {
  const t = useT()
  const description = mode === 'sentence'
    ? 'Har chunk = to\'liq gap. Faqat nuqta / undov / so\'roq belgisida bo\'linadi. '
      + 'Uzun bo\'lsa ham so\'zlar chegarada kesilmaydi — ishonchli variant.'
    : `Chunk ${minWords}+ so'z bo'lsa, ${minWords}-inchi so'zdan boshlab birinchi `
      + 'uchragan tinish belgisi (vergul, nuqta-vergul, tire) da bo\'linadi. '
      + 'Qisqaroq parchalar — lekin tez gapiruvchilarda so\'zlar chegarada qolib ketishi mumkin.'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        fontSize: 13, fontWeight: 700, color: 'var(--text)',
      }}>
        <span>{t.splitModeLabel}</span>
        <select
          value={mode}
          onChange={(e) => onChangeMode(e.target.value as ChunkMode)}
          style={{
            border: '1px solid var(--border)', borderRadius: 8,
            padding: '5px 10px', background: 'var(--bg-secondary)',
            color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <option value="sentence">{t.splitBySentence}</option>
          <option value="clause">{t.splitByPunct}</option>
        </select>

        {mode === 'clause' && (
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
          }}>
            N ≥
            <input
              type="number"
              min={MIN_ALLOWED_WORDS}
              max={40}
              value={minWords}
              onChange={(e) => {
                const raw = Number(e.target.value)
                if (Number.isFinite(raw)) {
                  onChangeMinWords(Math.max(MIN_ALLOWED_WORDS, Math.min(40, Math.floor(raw))))
                }
              }}
              style={{
                width: 56, padding: '4px 8px',
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--bg-secondary)', color: 'var(--text)',
                fontSize: 13, fontWeight: 700, textAlign: 'center',
              }}
              aria-label={t.minWordsAria}
            />
            so'z
          </label>
        )}
      </label>
      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {description}
      </div>
    </div>
  )
}

function Checkbox({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label: string
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
      fontSize: 13.5, color: 'var(--text)',
    }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#2563EB' }} />
      <span>{label}</span>
    </label>
  )
}

function FeedbackLine({ full, words }: {
  full: string
  words?: { w: string; found: boolean; dots: string }[]
}) {
  if (!words || words.length === 0) {
    return <span style={{ color: 'var(--text)', wordBreak: 'break-word' }}>{full}</span>
  }
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '4px 6px',
      lineHeight: 1.9, maxWidth: '100%', overflowWrap: 'anywhere',
    }}>
      {words.map((word, index) => {
        const style: React.CSSProperties = word.found
          ? { color: '#059669', fontWeight: 700 }
          : {
              color: 'var(--text-secondary)',
              fontWeight: 500,
              textDecoration: 'underline',
              textDecorationColor: '#F59E0B',
              textDecorationThickness: 2,
              textUnderlineOffset: 3,
              background: 'rgba(245, 158, 11, .08)',
              borderRadius: 4,
              padding: '0 3px',
            }
        return (
          <span key={index} style={{ ...style, wordBreak: 'break-word' }}
            title={word.found ? 'to\'g\'ri' : 'xato yoki tushib qolgan'}>
            {word.w}
          </span>
        )
      })}
    </div>
  )
}

/* ============================================================
 * Listening test — IELTS uslubidagi savollar paneli
 * ============================================================
 *
 * Dizayn qoidalari (foydalanuvchi talabi — o'zgartirishdan oldin o'qing):
 *
 *  1. **Stiker yo'q.** Emoji ishlatilmaydi; faqat kichik SVG ikonalar va
 *     ular ham kam. Ranglar ham cheklangan: neytral (`--border`/`--text`)
 *     + to'g'ri (yashil) + xato (qizil) + bitta akцент (tanlangan javob).
 *     Turlar (MCQ/TFNG/Fill) rang bilan emas, **bo'lim sarlavhasi** bilan
 *     ajraladi.
 *  2. **Bitta shrift, bitta shkala.** Barcha o'lchamlar `fs()` orqali bitta
 *     bazadan kelib chiqadi — foydalanuvchi A− / A+ bilan butun panelni
 *     kattalashtira/kichiklashtira oladi (`fontStep` localStorage'da).
 *  3. **Ikki rejim.** `instant` — har javob darrov tekshiriladi;
 *     `exam` — javoblar oxirigacha yashirin, natija "Tekshirish" da chiqadi.
 *     Ikkala rejimda ham hamma savol belgilangach natija kartochkasi chiqadi.
 *  4. **Shart aniq yozilsin.** Har bo'lim IELTS ko'rsatmasi bilan boshlanadi,
 *     fill-in-the-gap'da esa Claude bergan `hint` AYNAN o'zgarishsiz
 *     ko'rsatiladi ("Write NO MORE THAN ONE WORD AND/OR A NUMBER…").
 */

const TEST_SETTINGS_KEY = 'listening.test.settings'

/** "Isbot" bosilganda videoni shuncha sekund ORQAROQDAN boshlaymiz.
 *  Whisper timestamp gapning aynan boshini beradi — foydalanuvchi esa
 *  kontekstsiz tushib qolmasligi uchun bir oz oldinroqdan eshitgani ma'qul. */
const PROOF_REWIND_SEC = 2

/** Panel shrift shkalasi — A− / A+ shu qadamlar bo'ylab yuradi. */
const FONT_STEPS = [0.9, 1, 1.15, 1.3, 1.5]
const DEFAULT_FONT_STEP = 2

type CheckMode = 'instant' | 'exam'

interface TestSettings {
  checkMode: CheckMode
  fontStep: number
}

const DEFAULT_TEST_SETTINGS: TestSettings = {
  checkMode: 'instant',
  fontStep: DEFAULT_FONT_STEP,
}

function loadTestSettings(): TestSettings {
  try {
    const raw = localStorage.getItem(TEST_SETTINGS_KEY)
    if (!raw) return DEFAULT_TEST_SETTINGS
    const parsed = { ...DEFAULT_TEST_SETTINGS, ...JSON.parse(raw) } as TestSettings
    // localStorage'dagi qiymat eskirgan bo'lishi mumkin — chegaraga solamiz.
    parsed.fontStep = Math.max(0, Math.min(FONT_STEPS.length - 1, Number(parsed.fontStep) || 0))
    if (parsed.checkMode !== 'exam') parsed.checkMode = 'instant'
    return parsed
  } catch { return DEFAULT_TEST_SETTINGS }
}

/** Javoblarni solishtirish uchun bag'rikeng normalizatsiya. */
function normAnswer(v: string): string {
  return (v || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9' ]/g, '')
}

/** Fill-gap savolining barcha qabul qilinadigan javoblari (legacy `answer` ham). */
function fillAnswers(q: ShortFillGapQuestion): string[] {
  return [...(q.answers ?? []), ...(q.answer ? [q.answer] : [])]
    .map(normAnswer)
    .filter(Boolean)
}

/** `"[12.4] quote"` dan sekund. Timestamp bo'lmasa `null` (masalan "Not given"). */
function proofSeconds(proof: string): number | null {
  const m = (proof || '').match(/\[\s*([0-9]+(?:\.[0-9]+)?)\s*\]/)
  return m ? parseFloat(m[1]) : null
}

/** Iqtibosdan barcha `[t.t]` belgilarini tozalaydi. */
function proofQuote(proof: string): string {
  return (proof || '').replace(/\[\s*[0-9]+(?:\.[0-9]+)?\s*\]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Savollarning yagona, KETMA-KET raqamlangan ro'yxati.
 *
 *  Tartib: avval barcha MCQ, keyin TFNG, keyin fill-gap — server ularni
 *  isbot vaqti bo'yicha saralab yuboradi (`shorts_pipeline._order_quiz`),
 *  shu bois har bo'lim ichida savollar video oqimi bo'ylab ketma-ket keladi.
 *  IELTS'da ham aynan shunday: 1-savolning javobi eng oldin eshitiladi. */
type TestQuestion =
  | { kind: 'mcq'; key: string; n: number; q: ShortMcqQuestion }
  | { kind: 'tfng'; key: string; n: number; q: ShortTfngQuestion }
  | { kind: 'fill'; key: string; n: number; q: ShortFillGapQuestion }

function buildQuestions(
  mcq: ShortMcqQuestion[], tfng: ShortTfngQuestion[], fill: ShortFillGapQuestion[],
): TestQuestion[] {
  const out: TestQuestion[] = []
  mcq.forEach((q, i) => out.push({ kind: 'mcq', key: `mcq-${i}`, n: out.length + 1, q }))
  tfng.forEach((q, i) => out.push({ kind: 'tfng', key: `tfng-${i}`, n: out.length + 1, q }))
  fill.forEach((q, i) => out.push({ kind: 'fill', key: `fill-${i}`, n: out.length + 1, q }))
  return out
}

function isAnswerCorrect(item: TestQuestion, given: string): boolean {
  if (!given) return false
  if (item.kind === 'mcq') return given === item.q.answer
  if (item.kind === 'tfng') {
    return given.toLowerCase() === (item.q.answer || '').toLowerCase()
  }
  return fillAnswers(item.q).includes(normAnswer(given))
}

function proofOf(item: TestQuestion): string {
  return item.q.proof_from_text || ''
}

interface TestViewProps {
  mcq: ShortMcqQuestion[]
  tfng: ShortTfngQuestion[]
  fill: ShortFillGapQuestion[]
  onExit: () => void
  /** Videoni berilgan soniyaga suradi (rewind allaqachon qo'llangan). */
  onSeek: (seconds: number) => void
  /** "Isbot" birinchi marta ko'rinib turganda ipuchi ko'rsatish uchun. */
  onProofVisible?: () => void
  /** Test yakunlanганda (natija chiqqanda) bir marta chaqiriladi —
   *  tinglash vaqti shu paytda hisobga qo'shiladi. */
  onCompleted?: () => void
  onReport: () => void
  onQuestionFeedback: () => void
  reported: boolean
  questionReported: boolean
}

function TestView({
  mcq, tfng, fill, onExit, onSeek, onProofVisible, onCompleted,
  onReport, onQuestionFeedback, reported, questionReported,
}: TestViewProps) {
  const t = useT()
  const [settings, setSettings] = useState<TestSettings>(loadTestSettings)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  // `instant` rejimida javob QACHON ochilishi:
  //   - MCQ / TFNG — variant bosilishi bilanoq
  //   - Fill-gap  — Enter yoki maydondan chiqilganda (har harfda emas!)
  // Shu bois "yozilgan qiymat" (`answers`) va "tasdiqlangan" (`committed`)
  // alohida saqlanadi. `answers` hisoblagichni to'ldiradi, `committed` esa
  // ranglashni boshqaradi.
  const [committed, setCommitted] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { localStorage.setItem(TEST_SETTINGS_KEY, JSON.stringify(settings)) } catch { /* noop */ }
  }, [settings])

  const items = useMemo(() => buildQuestions(mcq, tfng, fill), [mcq, tfng, fill])
  const total = items.length
  const answered = items.filter((i) => answers[i.key]).length
  const allAnswered = total > 0 && answered === total

  // Natija QACHON ko'rinadi:
  //   - `exam` rejimi: faqat "Tekshirish" bosilgach
  //   - `instant` rejimi: har javob darrov ranglanadi va hamma savol
  //     belgilangach natija kartochkasi o'zi chiqadi
  const revealAll = submitted || (settings.checkMode === 'instant' && allAnswered)
  const showResult = submitted || (settings.checkMode === 'instant' && allAnswered)

  const score = useMemo(
    () => items.filter((i) => isAnswerCorrect(i, answers[i.key] || '')).length,
    [items, answers],
  )

  // Natija chiqqan payt — test "oxirigacha ishlangan" deb hisoblanadi va
  // tinglash vaqti profilga qo'shiladi. Bir marta (`completedRef`).
  const completedRef = useRef(false)
  useEffect(() => {
    if (!showResult || completedRef.current) return
    completedRef.current = true
    onCompleted?.()
  }, [showResult, onCompleted])

  const scale = FONT_STEPS[settings.fontStep] ?? 1
  const fs = useCallback((base: number) => Math.round(base * scale * 10) / 10, [scale])

  const setAnswer = useCallback((key: string, value: string, commit = true) => {
    setAnswers((a) => (a[key] === value ? a : { ...a, [key]: value }))
    if (commit) setCommitted((c) => (c[key] ? c : { ...c, [key]: true }))
  }, [])

  const reset = useCallback(() => {
    setAnswers({})
    setCommitted({})
    setSubmitted(false)
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const submit = useCallback(() => {
    setSubmitted(true)
    // Natija kartochkasi panel tepasida — foydalanuvchini o'sha yerga olib
    // chiqamiz, aks holda "hech nima bo'lmadi" deb o'ylab qoladi.
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const seekProof = useCallback((proof: string) => {
    const sec = proofSeconds(proof)
    if (sec == null) return
    // Bir oz orqaroqdan — foydalanuvchi gap boshini o'tkazib yubormasin.
    onSeek(Math.max(0, sec - PROOF_REWIND_SEC))
  }, [onSeek])

  // "Isbot" tugmasi ekranda birinchi marta paydo bo'lganda ipuchi chiqarish
  // signali. Har javobdan keyin emas — faqat bir marta.
  const proofNotifiedRef = useRef(false)
  useEffect(() => {
    if (proofNotifiedRef.current || !onProofVisible) return
    const anyProof = items.some(
      (i) => (revealAll || answers[i.key]) && proofSeconds(proofOf(i)) != null,
    )
    if (!anyProof) return
    proofNotifiedRef.current = true
    onProofVisible()
  }, [items, answers, revealAll, onProofVisible])

  const jumpTo = (n: number) => {
    document.getElementById(`test-q-${n}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const sections: { kind: TestQuestion['kind']; title: string; rule: string; note: string }[] = [
    {
      kind: 'mcq',
      title: 'Multiple choice',
      rule: 'Choose the correct letter — A, B, C or D.',
      note: "Har savolga bitta to'g'ri javob.",
    },
    {
      kind: 'tfng',
      title: 'True / False / Not given',
      rule: 'Do the following statements agree with the information in the recording?',
      note: 'True — matn tasdiqlaydi · False — matn inkor qiladi · Not given — matnda yo’q.',
    },
    {
      kind: 'fill',
      title: 'Sentence completion',
      rule: 'Complete the sentences below.',
      note: "Har savolning tepasida so'z chegarasi alohida yozilgan.",
    },
  ]

  return (
    <div
      ref={panelRef}
      style={{
        display: 'flex', flexDirection: 'column', gap: fs(14),
        width: '100%', fontSize: fs(14), lineHeight: 1.55, color: 'var(--text)',
      }}
    >
      <TestToolbar
        answered={answered} total={total} fs={fs}
        settings={settings}
        onSettings={setSettings}
        onExit={onExit}
        onReport={onReport}
        onQuestionFeedback={onQuestionFeedback}
        reported={reported}
        questionReported={questionReported}
        locked={submitted}
      />

      {showResult && (
        <ResultCard
          score={score} total={total} fs={fs}
          wrong={items.filter((i) => !isAnswerCorrect(i, answers[i.key] || ''))}
          onJump={jumpTo}
          onReset={reset}
        />
      )}

      {sections.map((section) => {
        const list = items.filter((i) => i.kind === section.kind)
        if (list.length === 0) return null
        const from = list[0].n
        const to = list[list.length - 1].n
        return (
          <section key={section.kind} style={{ display: 'flex', flexDirection: 'column', gap: fs(10) }}>
            <SectionHeader
              from={from} to={to} title={section.title}
              rule={section.rule} note={section.note} fs={fs}
            />
            {list.map((item) => (
              <QuestionCard
                key={item.key}
                item={item}
                fs={fs}
                given={answers[item.key] || ''}
                reveal={revealAll || (settings.checkMode === 'instant' && Boolean(committed[item.key]))}
                locked={submitted}
                onAnswer={(v, commit) => setAnswer(item.key, v, commit)}
                onProof={() => seekProof(proofOf(item))}
              />
            ))}
          </section>
        )
      })}

      {/* Pastdagi harakat qatori. `exam` rejimida bu YAGONA tekshirish
          nuqtasi; `instant` rejimida esa savol qolib ketgan bo'lsa ham
          natijani ko'rish imkonini beradi. */}
      {total > 0 && !showResult && (
        <div style={{
          position: 'sticky', bottom: 0, paddingTop: fs(10), paddingBottom: fs(4),
          background: 'linear-gradient(180deg, transparent, var(--bg) 45%)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <button
            onClick={submit}
            className="btn btn-primary"
            disabled={answered === 0}
            style={{
              width: '100%', padding: `${fs(12)}px ${fs(18)}px`, borderRadius: 12,
              fontSize: fs(14.5), fontWeight: 800, cursor: answered ? 'pointer' : 'not-allowed',
            }}
          >{t.checkResult}</button>
          <div style={{
            fontSize: fs(11.5), fontWeight: 600, color: 'var(--text-secondary)',
            textAlign: 'center',
          }}>
            {allAnswered
              ? 'Hamma savol belgilandi'
              : `${total - answered} ta savol javobsiz`}
          </div>
        </div>
      )}
    </div>
  )
}

/* --- Toolbar ------------------------------------------------------------ */

function TestToolbar({
  answered, total, fs, settings, onSettings, onExit,
  onReport, onQuestionFeedback, reported, questionReported, locked,
}: {
  answered: number
  total: number
  fs: (n: number) => number
  settings: TestSettings
  onSettings: (fn: (s: TestSettings) => TestSettings) => void
  onExit: () => void
  onReport: () => void
  onQuestionFeedback: () => void
  reported: boolean
  questionReported: boolean
  locked: boolean
}) {
  const t = useT()
  const pct = total ? Math.round((answered / total) * 100) : 0
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 5,
      display: 'flex', flexDirection: 'column', gap: 10,
      padding: '10px 12px', borderRadius: 12,
      background: 'var(--bg)', border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: fs(15), fontWeight: 800 }}>{t.listeningTestLabel}</h3>
        <span style={{
          fontSize: fs(12), fontWeight: 700, color: 'var(--text-secondary)',
        }}>{answered} / {total}</span>
        <div style={{ flex: 1, minWidth: 40 }}>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--border)' }}>
            <div style={{
              width: `${pct}%`, height: '100%', borderRadius: 2,
              background: 'var(--text-secondary)', transition: 'width .25s',
            }} />
          </div>
        </div>
        <IconButton title={t.backToDictation} onClick={onExit} label={t.dictationMode}>
          <IconBack />
        </IconButton>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Tekshirish rejimi — test boshlangach ham almashtirsa bo'ladi,
            lekin natija chiqqach qulflanadi (baho o'zgarmasin). */}
        <SegmentedControl
          value={settings.checkMode}
          disabled={locked}
          onChange={(v) => onSettings((s) => ({ ...s, checkMode: v }))}
          options={[
            { value: 'instant', label: 'Darrov tekshirish' },
            { value: 'exam', label: 'Imtihon' },
          ]}
          fs={fs}
        />
        <div style={{ flex: 1 }} />
        {/* Matn o'lchami — butun panelga ta'sir qiladi. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FontButton
            label="A−" title={t.textSmaller}
            disabled={settings.fontStep <= 0}
            onClick={() => onSettings((s) => ({ ...s, fontStep: Math.max(0, s.fontStep - 1) }))}
          />
          <FontButton
            label="A+" title={t.textBigger}
            disabled={settings.fontStep >= FONT_STEPS.length - 1}
            onClick={() => onSettings((s) => ({
              ...s, fontStep: Math.min(FONT_STEPS.length - 1, s.fontStep + 1),
            }))}
          />
        </div>
        <IconButton
          title={reported ? 'Shikoyat allaqachon yuborilgan' : 'Shikoyat yuborish'}
          onClick={onReport} active={reported}
        ><IconFlag /></IconButton>
        <IconButton
          title={questionReported ? 'Xabar allaqachon yuborilgan' : 'Savol xato tuzilgan'}
          onClick={onQuestionFeedback} active={questionReported}
        ><IconAlert /></IconButton>
      </div>
    </div>
  )
}

function SegmentedControl<T extends string>({ value, options, onChange, disabled, fs }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  disabled?: boolean
  fs: (n: number) => number
}) {
  return (
    <div style={{
      display: 'inline-flex', padding: 2, borderRadius: 999,
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      opacity: disabled ? 0.55 : 1,
    }}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            onClick={() => !disabled && onChange(o.value)}
            disabled={disabled}
            aria-pressed={active}
            style={{
              border: 'none', borderRadius: 999, cursor: disabled ? 'default' : 'pointer',
              padding: `${fs(5)}px ${fs(12)}px`, fontSize: fs(12), fontWeight: 700,
              background: active ? 'var(--text)' : 'transparent',
              color: active ? 'var(--bg)' : 'var(--text-secondary)',
              transition: 'background .15s, color .15s',
            }}
          >{o.label}</button>
        )
      })}
    </div>
  )
}

function FontButton({ label, title, onClick, disabled }: {
  label: string; title: string; onClick: () => void; disabled?: boolean
}) {
  return (
    <button
      onClick={onClick} title={title} aria-label={title} disabled={disabled}
      style={{
        width: 30, height: 30, borderRadius: 8, cursor: disabled ? 'default' : 'pointer',
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        color: 'var(--text)', fontSize: 12.5, fontWeight: 800,
        opacity: disabled ? 0.4 : 1,
      }}
    >{label}</button>
  )
}

function IconButton({ title, onClick, children, active, label }: {
  title: string
  onClick: () => void
  children: React.ReactNode
  active?: boolean
  label?: string
}) {
  return (
    <button
      onClick={onClick} title={title} aria-label={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 30, padding: label ? '0 10px' : '0 8px', borderRadius: 8,
        cursor: 'pointer', background: 'var(--bg-secondary)',
        border: `1px solid ${active ? 'var(--ok-text)' : 'var(--border)'}`,
        color: active ? 'var(--ok-text)' : 'var(--text-secondary)',
        fontSize: 12, fontWeight: 700,
      }}
    >
      {children}
      {label && <span>{label}</span>}
    </button>
  )
}

/* --- Bo'lim sarlavhasi -------------------------------------------------- */

function SectionHeader({ from, to, title, rule, note, fs }: {
  from: number; to: number; title: string; rule: string; note: string
  fs: (n: number) => number
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      padding: `${fs(10)}px ${fs(12)}px`, borderRadius: 10,
      background: 'var(--bg-secondary)',
      borderLeft: '3px solid var(--text-secondary)',
    }}>
      <div style={{
        fontSize: fs(11), fontWeight: 800, letterSpacing: '.06em',
        textTransform: 'uppercase', color: 'var(--text-secondary)',
      }}>
        {from === to ? `Question ${from}` : `Questions ${from}–${to}`} · {title}
      </div>
      <div style={{ fontSize: fs(13.5), fontWeight: 700, color: 'var(--text)' }}>{rule}</div>
      <div style={{ fontSize: fs(11.5), fontWeight: 500, color: 'var(--text-secondary)' }}>{note}</div>
    </div>
  )
}

/* --- Bitta savol -------------------------------------------------------- */

function QuestionCard({ item, given, reveal, locked, onAnswer, onProof, fs }: {
  item: TestQuestion
  given: string
  reveal: boolean
  locked: boolean
  /** `commit=false` — qiymat yozildi, lekin hali tekshirilmasin (fill-gap). */
  onAnswer: (v: string, commit?: boolean) => void
  onProof: () => void
  fs: (n: number) => number
}) {
  const correct = isAnswerCorrect(item, given)
  const proof = proofOf(item)
  const hasProof = proofSeconds(proof) != null
  // MCQ variantlari ARALASHTIRILADI — AI to'g'ri javobni nomutanosib ko'p
  // "B" ga qo'yadi (real bazada o'lchandi: 50%). `useMemo` — javob
  // berayotganda ro'yxat sakramasin.
  const mcqOptions = useMemo(
    () => (item.kind === 'mcq' ? shuffleOptions(item.q.options) : []),
    [item],
  )

  return (
    <div
      id={`test-q-${item.n}`}
      style={{
        display: 'flex', flexDirection: 'column', gap: fs(9),
        padding: `${fs(13)}px ${fs(14)}px`, borderRadius: 12,
        background: 'var(--bg-secondary)',
        border: `1px solid ${reveal ? (correct ? '#10B981' : '#EF4444') : 'var(--border)'}`,
        transition: 'border-color .2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: fs(9) }}>
        <span style={{
          flexShrink: 0, minWidth: fs(24), height: fs(24),
          borderRadius: 7, display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: fs(12), fontWeight: 800,
          background: reveal ? (correct ? 'var(--ok-bg)' : 'rgba(239,68,68,.12)') : 'var(--bg)',
          color: reveal ? (correct ? 'var(--ok-text)' : '#B91C1C') : 'var(--text-secondary)',
          border: `1px solid ${reveal ? (correct ? '#10B981' : '#EF4444') : 'var(--border)'}`,
        }}>{item.n}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {item.kind === 'fill'
            ? <FillHint hint={item.q.hint} fs={fs} />
            : (
              <div style={{ fontSize: fs(14.5), fontWeight: 700, lineHeight: 1.5 }}>
                {item.q.question}
              </div>
            )}
        </div>
      </div>

      {item.kind === 'mcq' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: fs(6) }}>
          {mcqOptions.map((o) => (
            <OptionButton
              key={o.key} fs={fs}
              label={<><b style={{ marginRight: fs(8) }}>{o.letter}</b>{o.text}</>}
              picked={given === o.key}
              isAnswer={o.key === item.q.answer}
              reveal={reveal}
              disabled={locked}
              onClick={() => onAnswer(o.key)}
            />
          ))}
        </div>
      )}

      {item.kind === 'tfng' && (
        <div style={{ display: 'flex', gap: fs(6), flexWrap: 'wrap' }}>
          {['True', 'False', 'Not given'].map((v) => (
            <OptionButton
              key={v} fs={fs} pill
              label={v}
              picked={given === v}
              isAnswer={v.toLowerCase() === (item.q.answer || '').toLowerCase()}
              reveal={reveal}
              disabled={locked}
              onClick={() => onAnswer(v)}
            />
          ))}
        </div>
      )}

      {item.kind === 'fill' && (
        <FillSentence
          q={item.q} given={given} reveal={reveal} locked={locked}
          onAnswer={onAnswer} fs={fs}
        />
      )}

      {reveal && (
        <ProofRow
          correct={correct}
          expected={item.kind === 'fill'
            ? (item.q.answers?.length ? item.q.answers.join(' / ') : (item.q.answer || ''))
            : item.kind === 'mcq'
              // Aralashtirilgani sabab EKRANDAGI harfni ko'rsatamiz, asl
              // kalitni emas — aks holda "B" deb yozilardi-yu, ro'yxatda
              // boshqa joydagi variant turardi.
              ? `${displayLetter(mcqOptions, item.q.answer)}${item.q.options?.[item.q.answer] ? ` — ${item.q.options[item.q.answer]}` : ''}`
              : item.q.answer}
          quote={proofQuote(proof)}
          hasProof={hasProof}
          onProof={onProof}
          fs={fs}
        />
      )}
    </div>
  )
}

/** Claude bergan IELTS ko'rsatmasi — AYNAN o'zgarishsiz ko'rsatiladi. */
function FillHint({ hint, fs }: { hint?: string; fs: (n: number) => number }) {
  const text = (hint || '').trim() || 'Complete the sentence below.'
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: fs(7),
      padding: `${fs(5)}px ${fs(10)}px`, borderRadius: 8,
      background: 'var(--bg)', border: '1px dashed var(--border)',
      fontSize: fs(12), fontWeight: 700, color: 'var(--text)',
      letterSpacing: '.01em',
    }}>
      <IconPencil />
      <span>{text}</span>
    </div>
  )
}

function FillSentence({ q, given, reveal, locked, onAnswer, fs }: {
  q: ShortFillGapQuestion
  given: string
  reveal: boolean
  locked: boolean
  onAnswer: (v: string, commit?: boolean) => void
  fs: (n: number) => number
}) {
  const t = useT()
  const parts = (q.sentence || '').split('___')
  const correct = fillAnswers(q).includes(normAnswer(given))

  return (
    <div style={{ fontSize: fs(14.5), fontWeight: 600, lineHeight: 1.9 }}>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && (
            reveal ? (
              <b style={{
                padding: `0 ${fs(5)}px`,
                color: correct ? 'var(--ok-text)' : '#B91C1C',
                borderBottom: `2px solid ${correct ? '#10B981' : '#EF4444'}`,
              }}>{given || '—'}</b>
            ) : (
              <input
                type="text"
                value={given}
                disabled={locked}
                /* Yozayotganda faqat qiymat saqlanadi (`commit=false`) —
                   har harfda "xato" deb ranglanib ketmasin. Tekshirish
                   Enter yoki maydondan chiqilganda boshlanadi. */
                onChange={(e) => onAnswer(e.target.value, false)}
                onBlur={() => given.trim() && onAnswer(given.trim())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (given.trim()) onAnswer(given.trim())
                  }
                }}
                placeholder="…"
                aria-label={t.answerAria}
                style={{
                  width: fs(130), margin: `0 ${fs(4)}px`,
                  padding: `${fs(2)}px ${fs(8)}px`,
                  border: 'none',
                  borderBottom: `2px solid ${given.trim() ? 'var(--text)' : 'var(--border)'}`,
                  background: 'transparent', color: 'var(--text)',
                  fontSize: fs(14.5), fontWeight: 800, outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            )
          )}
        </span>
      ))}
    </div>
  )
}

function OptionButton({ label, picked, isAnswer, reveal, disabled, onClick, pill, fs }: {
  label: React.ReactNode
  picked: boolean
  isAnswer: boolean
  reveal: boolean
  disabled: boolean
  onClick: () => void
  pill?: boolean
  fs: (n: number) => number
}) {
  // Ranglar minimal: ochilmagan holatda faqat neytral + tanlangan uchun
  // qalinroq chegara. Ochilgach — to'g'ri (yashil) / xato (qizil).
  const showCorrect = reveal && isAnswer
  const showWrong = reveal && picked && !isAnswer
  const border = showCorrect ? '#10B981' : showWrong ? '#EF4444'
    : picked ? 'var(--text)' : 'var(--border)'
  return (
    <button
      onClick={onClick}
      disabled={disabled || reveal}
      style={{
        textAlign: 'left', cursor: disabled || reveal ? 'default' : 'pointer',
        padding: `${fs(9)}px ${fs(12)}px`, borderRadius: pill ? 999 : 9,
        fontSize: fs(13.5), fontWeight: 600, lineHeight: 1.45,
        fontFamily: 'inherit',
        background: showCorrect ? 'var(--ok-bg)'
          : showWrong ? 'rgba(239,68,68,.1)'
            : picked ? 'var(--bg)' : 'var(--bg)',
        color: showCorrect ? 'var(--ok-text)' : showWrong ? '#B91C1C' : 'var(--text)',
        border: `1.5px solid ${border}`,
        transition: 'border-color .15s, background .15s',
      }}
    >{label}</button>
  )
}

/** Javob ochilgach chiqadigan qator: to'g'ri/xato + iqtibos + "Isbot". */
function ProofRow({ correct, expected, quote, hasProof, onProof, fs }: {
  correct: boolean
  expected: string
  quote: string
  hasProof: boolean
  onProof: () => void
  fs: (n: number) => number
}) {
  const t = useT()
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: fs(9), flexWrap: 'wrap',
      padding: `${fs(8)}px ${fs(11)}px`, borderRadius: 9,
      background: correct ? 'var(--ok-bg)' : 'rgba(239,68,68,.08)',
      color: correct ? 'var(--ok-text)' : '#B91C1C',
      border: `1px solid ${correct ? 'rgba(16,185,129,.45)' : 'rgba(239,68,68,.4)'}`,
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: fs(5),
        fontSize: fs(12), fontWeight: 800, flexShrink: 0,
      }}>
        {correct ? <IconCheck /> : <IconCross />}
        {correct ? "To'g'ri" : 'Xato'}
      </span>
      {!correct && expected && (
        <span style={{ fontSize: fs(12.5), fontWeight: 700 }}>
          Javob: <b>{expected}</b>
        </span>
      )}
      {quote && (
        <span style={{
          fontSize: fs(12.5), fontStyle: 'italic', flex: '1 1 140px',
          color: 'var(--text-secondary)', lineHeight: 1.5,
        }}>&ldquo;{quote}&rdquo;</span>
      )}
      {hasProof && (
        <button
          onClick={onProof}
          title={`Videoni shu joydan (${PROOF_REWIND_SEC}s oldinroqdan) qo'yadi`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: fs(5),
            marginLeft: 'auto', flexShrink: 0,
            background: 'var(--bg)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 999,
            padding: `${fs(4)}px ${fs(11)}px`, fontSize: fs(11.5),
            fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
          }}
        ><IconPlay />{t.proofLabel}</button>
      )}
    </div>
  )
}

/* --- Natija ------------------------------------------------------------- */

function ResultCard({ score, total, wrong, onJump, onReset, fs }: {
  score: number
  total: number
  wrong: TestQuestion[]
  onJump: (n: number) => void
  onReset: () => void
  fs: (n: number) => number
}) {
  const t = useT()
  const pct = total ? Math.round((score / total) * 100) : 0
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: fs(10),
      padding: `${fs(16)}px ${fs(16)}px`, borderRadius: 12,
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: fs(14) }}>
        <div style={{
          fontSize: fs(28), fontWeight: 800, lineHeight: 1,
          color: 'var(--text)', whiteSpace: 'nowrap',
        }}>{score}<span style={{
          fontSize: fs(16), color: 'var(--text-secondary)', fontWeight: 700,
        }}> / {total}</span></div>
        <div style={{ flex: 1, minWidth: 60 }}>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--border)' }}>
            <div style={{
              width: `${pct}%`, height: '100%', borderRadius: 3,
              background: pct >= 70 ? '#10B981' : pct >= 40 ? 'var(--text-secondary)' : '#EF4444',
              transition: 'width .4s',
            }} />
          </div>
          <div style={{
            marginTop: 5, fontSize: fs(12), fontWeight: 700, color: 'var(--text-secondary)',
          }}>Test yakunlandi · {pct}%</div>
        </div>
        <button
          onClick={onReset} className="btn btn-ghost"
          style={{
            borderRadius: 10, fontWeight: 800, fontSize: fs(12.5),
            padding: `${fs(8)}px ${fs(14)}px`,
          }}
        >{t.reprocess}</button>
      </div>
      {wrong.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: fs(8), flexWrap: 'wrap' }}>
          <span style={{ fontSize: fs(12), fontWeight: 700, color: 'var(--text-secondary)' }}>
            Xato savollar:
          </span>
          {wrong.map((w) => (
            <button
              key={w.key}
              onClick={() => onJump(w.n)}
              title={`${w.n}-savolga o'tish`}
              style={{
                minWidth: fs(26), height: fs(26), borderRadius: 7,
                background: 'rgba(239,68,68,.1)', color: '#B91C1C',
                border: '1px solid rgba(239,68,68,.4)',
                fontSize: fs(12), fontWeight: 800, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >{w.n}</button>
          ))}
        </div>
      )}
    </div>
  )
}

/* --- Ikonalar (emoji YO'Q — hammasi SVG) -------------------------------- */

function IconPlay() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" aria-hidden style={{ display: 'block' }}>
      <path d="M6 4l14 8-14 8z" fill="currentColor" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden style={{ display: 'block' }}>
      <path d="M4 12.5l5.5 5.5L20 7" stroke="currentColor" strokeWidth="2.6"
        fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconCross() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden style={{ display: 'block' }}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6"
        fill="none" strokeLinecap="round" />
    </svg>
  )
}

function IconBack() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden style={{ display: 'block' }}>
      <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4"
        fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconFlag() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden style={{ display: 'block' }}>
      <path d="M5 21V4M5 4h11l-2 3.5L16 11H5" stroke="currentColor" strokeWidth="2"
        fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconAlert() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden style={{ display: 'block' }}>
      <path d="M12 4l9 16H3z" stroke="currentColor" strokeWidth="2"
        fill="none" strokeLinejoin="round" />
      <path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" />
    </svg>
  )
}

function IconPencil() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden style={{ display: 'block' }}>
      <path d="M4 20h4L20 8l-4-4L4 16z" stroke="currentColor" strokeWidth="2"
        fill="none" strokeLinejoin="round" />
    </svg>
  )
}

