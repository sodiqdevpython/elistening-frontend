/**
 * Diktantni mijozda baholash.
 *
 * Backend'dagi `apps/exercises/graders.py` ning aynan JS varianti — server
 * bilan bir xil natija berishi shart. Segment matni ochiq ma'lumot (foydalanuvchi
 * "To'liq matn" tabidan ham ko'ra oladi), shuning uchun har bir tekshiruv uchun
 * API'ga chiqish shart emas — mijozning o'zi hisoblaydi.
 */

const CURLY_QUOTES = /[‘’]/g
const NUM_SEP = /(\d)[,.](\d)/g
const ORDINAL = /(\d+)(st|nd|rd|th)\b/gi
// Unicode letter, digit, whitespace yoki apostrof emas — bo'shliq bilan almashadi.
const PUNCT = /[^\p{L}\p{N}\s']/gu
const SPACE = /\s+/g

/** Backend `normalize()` bilan bir xil. */
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

export interface WordFeedback {
  w: string       // asl so'z (tinish belgilari bilan)
  found: boolean  // foydalanuvchi javobida uchradimi
  dots: string    // topilmagan so'z uchun nuqtali placeholder
}

export interface DictationResult {
  isCorrect: boolean
  score: number
  words: WordFeedback[]
  matched: number
  total: number
}

/**
 * Diktantni baholaydi va so'z darajasidagi feedback beradi.
 *
 * **Tartib bilan mos qo'yish** (in-order match): `expected` dagi har bir
 * so'zni `given` ichidan chapdan o'ngga qidiradi (cursor bilan). Bu:
 *
 *   · Ballni to'g'ri hisoblaydi (yo'qolgan so'z ballda hisobga olinmaydi)
 *   · **Aynan qaysi so'z yo'qolganini** ko'rsatadi — hatto takroriy so'zlar
 *     bo'lsa ham (masalan "a" uch marta bo'lsa, foydalanuvchi ikkitasini
 *     yozsa, uchinchisi to'g'ri o'rinda gray bo'lib ko'rinadi).
 *
 * Set-based tekshiruv takroriy so'zlar uchun noto'g'ri javob berardi —
 * shu sababli tashlab yubordik.
 */
export function gradeDictation(expected: string, given: string): DictationResult {
  const givenWords = normalize(given).split(' ').filter(Boolean)
  // Asl matnni so'zlar bo'yicha (tinish belgilari bilan) saqlab qolamiz —
  // feedback'da xuddi shunday chiroyli ko'rinadi.
  const rawWords = expected.trim().split(/\s+/).filter(Boolean)

  if (rawWords.length === 0) {
    return { isCorrect: false, score: 0, words: [], matched: 0, total: 0 }
  }

  let cursor = 0
  let matched = 0
  let total = 0
  const wordFeedback: WordFeedback[] = []

  for (const raw of rawWords) {
    const cleaned = normalize(raw)
    if (!cleaned) {
      // Faqat tinish belgisi (masalan "—") — ballda hisoblanmaydi.
      wordFeedback.push({ w: raw, found: true, dots: '' })
      continue
    }
    // Bir asl "so'z" normalizatsiyadan keyin bir necha token bo'lishi mumkin
    // (masalan "well-known" → "well known"). Har biri o'z o'rnida qidiriladi.
    const subs = cleaned.split(' ').filter(Boolean)
    let allFound = true
    for (const sub of subs) {
      total += 1
      const idx = givenWords.indexOf(sub, cursor)
      if (idx >= 0) {
        cursor = idx + 1
        matched += 1
      } else {
        allFound = false
      }
    }
    wordFeedback.push({
      w: raw,
      found: allFound,
      dots: allFound ? '' : '•'.repeat(Math.max(2, cleaned.length || 3)),
    })
  }

  if (total === 0) {
    return { isCorrect: false, score: 0, words: wordFeedback, matched: 0, total: 0 }
  }

  return {
    isCorrect: matched === total,
    score: Math.round((matched / total) * 10000) / 10000,
    words: wordFeedback,
    matched,
    total,
  }
}
