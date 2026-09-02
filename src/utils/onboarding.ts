import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/store/auth'

/**
 * Onboarding ipuchlari — "bu tugma nima qiladi" degan qisqa tushuntirishlar.
 *
 * Mahsulot qoidasi (o'zgartirmang — foydalanuvchi aniq so'ragan):
 *
 *   1. Ro'yxatdan o'tganiga **2 kundan ko'p** bo'lgan foydalanuvchiga HECH
 *      NARSA ko'rsatilmaydi — u allaqachon biladi.
 *   2. Dastlabki 2 kun ichida ham har ipuchi **faqat bir marta** chiqadi.
 *      Har sahifaga kirganda qayta chiqmaydi — ish jarayoniga xalaqit
 *      bermaydi.
 *   3. Ipuchi matnga emas, **UX/UI ga** tayanadi: kichik modal + vizual
 *      ko'rsatkich, uzun matn yo'q.
 *
 * Ko'rsatilgani `localStorage` da belgilanadi (server tomonda holat saqlash
 * shart emas — bu shunchaki qulaylik, xavfsizlik masalasi emas).
 */

/** 2 kun — ipuchilar shu oyna ichida tirik. */
export const ONBOARDING_WINDOW_MS = 2 * 24 * 60 * 60 * 1000

const SEEN_PREFIX = 'listening.onboarding.seen.'
/** Anonim mehmon uchun `date_joined` yo'q — birinchi tashrif vaqtini o'zimiz yozamiz. */
const FIRST_VISIT_KEY = 'listening.onboarding.first_visit'

/** Barcha ipuchilarning kalitlari — bir joyda tursin, chalkashmasin. */
export const HINT = {
  /** Shorts: rail'dagi savol-pozitsiyasi termometri nima qilishi. */
  shortsPositions: 'shorts-positions',
  /** Listening test: savol pozitsiyasi bari + "Isbot" tugmasi. */
  testPositions: 'test-positions',
  /** Listening test: "Isbot" bosilganda video o'sha joyga suriladi. */
  testProof: 'test-proof',
} as const

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function safeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* private rejim — muhim emas */ }
}

/**
 * Foydalanuvchi hali "yangi"mi? — ya'ni ro'yxatdan o'tganiga 2 kundan kam.
 *
 * Kirmagan mehmon uchun birinchi tashrif vaqti mezon bo'ladi: saytga endi
 * kirgan mehmon ham yangi hisoblanadi, 2 kundan keyin esa yo'q.
 */
export function isNewUser(dateJoined?: string | null): boolean {
  if (dateJoined) {
    const joined = Date.parse(dateJoined)
    if (Number.isFinite(joined)) return Date.now() - joined < ONBOARDING_WINDOW_MS
  }
  const stored = safeGet(FIRST_VISIT_KEY)
  const first = stored ? Number(stored) : NaN
  if (!Number.isFinite(first)) {
    safeSet(FIRST_VISIT_KEY, String(Date.now()))
    return true
  }
  return Date.now() - first < ONBOARDING_WINDOW_MS
}

export function hintSeen(key: string): boolean {
  return safeGet(SEEN_PREFIX + key) === '1'
}

export function markHintSeen(key: string): void {
  safeSet(SEEN_PREFIX + key, '1')
}

/**
 * Bitta ipuchining holati.
 *
 * @param key      `HINT` dan kalit
 * @param ready    ipuchi ko'rsatilishi mumkin bo'lgan payt (masalan video
 *                 haqiqatan yangramoqda). `false` bo'lsa modal ochilmaydi —
 *                 sahifa yuklanishi bilanoq ekranni to'sib qo'ymaydi.
 * @param delayMs  `ready` bo'lgach shuncha kutib ochiladi. Foydalanuvchi
 *                 avval kontentni ko'rsin, keyin ipuchi chiqsin.
 */
export function useOnboardingHint(
  key: string,
  ready: boolean,
  delayMs = 1500,
): { open: boolean; dismiss: () => void } {
  const dateJoined = useAuth((s) => s.user?.date_joined)
  const authLoading = useAuth((s) => s.loading)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Profil hali kelmagan bo'lsa kutamiz — aks holda 3 oylik foydalanuvchiga
    // ham "yangi" deb ipuchi chiqib ketardi.
    if (!ready || authLoading) return
    if (hintSeen(key) || !isNewUser(dateJoined)) return
    const id = window.setTimeout(() => setOpen(true), delayMs)
    return () => window.clearTimeout(id)
  }, [key, ready, authLoading, dateJoined, delayMs])

  const dismiss = useCallback(() => {
    markHintSeen(key)
    setOpen(false)
  }, [key])

  return { open, dismiss }
}
