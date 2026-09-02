/**
 * MCQ variantlarini aralashtirish.
 *
 * ## Nima uchun kerak
 *
 * Claude to'g'ri javobni tasodifiy joyga qo'ymaydi. Real bazada o'lchandi
 * (2026-09-01, 53 ta MCQ): **50% javob "B"** (A — 24%, C — 24%), ya'ni
 * kutilgan 33% dan 1.5 barobar ko'p. Doim "B" tanlagan foydalanuvchi
 * tinglamasdan savollarning yarmini to'g'ri topardi.
 *
 * ## Qanday ishlaydi
 *
 * Variantlar **KALITI o'zgarmaydi** (`A`/`B`/`C`/`D`) — faqat ko'rsatish
 * tartibi aralashadi. Shu bois javobni tekshirish (`picked === q.answer`)
 * hech qanday o'zgarishsiz ishlayveradi.
 *
 * Foydalanuvchiga esa **joylashuv harfi** ko'rsatiladi (1-variant "A",
 * 2-variant "B", ...) — aks holda ro'yxat "C, A, D, B" bo'lib g'alati
 * ko'rinardi. Shu sabab to'g'ri javobni ko'rsatganda ham original kalit
 * emas, `displayLetter()` ishlatilishi kerak.
 *
 * Tartib **har ochilishda yangi** (Fisher–Yates) — lekin komponent ichida
 * `useMemo` bilan qotirilgan, ya'ni javob berayotganda sakramaydi.
 */
export interface ShuffledOption {
  /** Ma'lumotdagi asl kalit — javobni tekshirish uchun. */
  key: string
  /** Variant matni. */
  text: string
  /** Ekranda ko'rinadigan harf (joylashuvga qarab): A, B, C, ... */
  letter: string
}

/** Fisher–Yates — nusxa ustida, asl massivga tegmaydi. */
function fisherYates<T>(input: T[]): T[] {
  const a = [...input]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const LETTERS = 'ABCDEFGH'

export function shuffleOptions(options: Record<string, string> | undefined): ShuffledOption[] {
  const entries = Object.entries(options || {})
  return fisherYates(entries).map(([key, text], i) => ({
    key,
    text,
    letter: LETTERS[i] ?? String(i + 1),
  }))
}

/** Asl kalit ekranda qaysi harf bilan ko'rsatilayotganini qaytaradi. */
export function displayLetter(shuffled: ShuffledOption[], key: string): string {
  return shuffled.find((o) => o.key === key)?.letter ?? key
}
