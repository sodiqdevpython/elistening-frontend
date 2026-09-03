import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/store/auth'

/**
 * O'rgatish (onboarding) qoidalari — bitta joyda.
 *
 * Foydalanuvchi aniq belgilagan siyosat, o'zboshimchalik bilan
 * o'zgartirmang:
 *
 * | Nima | Kimga | Qancha vaqt | Necha marta |
 * |---|---|---|---|
 * | **Shorts** | kirgan foydalanuvchi | ro'yxatdan o'tgach **3 kun** | lentaga HAR kirganda |
 * | **Video** (uzun / listening test) | kirgan foydalanuvchi | **1 hafta** | **kuniga bir marta** |
 *
 * Qo'shimcha qoidalar:
 *
 *  - **Kirmagan mehmonga umuman ko'rsatilmaydi** (saytda mehmon bo'lishi
 *    mumkin). Ilgari `first_visit` bilan mehmonga ham chiqardi — endi yo'q.
 *  - Muddat o'tgach hech narsa ko'rsatilmaydi — odam allaqachon biladi.
 *  - **Darrov emas:** avval kontent boshlanadi (video ozgina o'ynaydi),
 *    keyin to'xtatiladi va o'rgatish boshlanadi — o'yinlardagi kabi.
 *    Buni chaqiruvchi ekran `ready` bayrog'i bilan boshqaradi.
 *  - Har turda **"Tashlab ketish"** bor — bosilsa o'sha kun/kirish uchun
 *    boshqa chiqmaydi.
 *
 * Holat `localStorage` da (bu qulaylik, xavfsizlik masalasi emas).
 */

export const TOUR = {
  /** Shorts lentasi: savollar, pastga surish, savol pozitsiyasi. */
  shorts: 'shorts',
  /** Uzun video / listening test: savollar, pozitsiya bari, rejimlar. */
  video: 'video',
} as const

export type TourKind = (typeof TOUR)[keyof typeof TOUR]

/** Har turning "yangi foydalanuvchi" oynasi. */
const WINDOW_DAYS: Record<TourKind, number> = {
  [TOUR.shorts]: 3,
  [TOUR.video]: 7,
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Shorts — har kirishda; video — kuniga bir marta. */
const SESSION_KEY = 'listening.tour.session.'   // sessionStorage (shorts)
const DAY_KEY = 'listening.tour.day.'           // localStorage (video)

function get(store: Storage | null, key: string): string | null {
  try { return store?.getItem(key) ?? null } catch { return null }
}

function set(store: Storage | null, key: string, value: string): void {
  try { store?.setItem(key, value) } catch { /* private rejim */ }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Ro'yxatdan o'tganiga shu turdagi oynadan kam vaqt o'tganmi. */
export function withinWindow(kind: TourKind, dateJoined?: string | null): boolean {
  if (!dateJoined) return false
  const joined = Date.parse(dateJoined)
  if (!Number.isFinite(joined)) return false
  return Date.now() - joined < WINDOW_DAYS[kind] * DAY_MS
}

/**
 * Shu tur hozir ko'rsatilishi kerakmi.
 *
 * `shorts` — sessiyada (kirishda) bir marta; `video` — kunda bir marta.
 */
function alreadyShown(kind: TourKind): boolean {
  if (kind === TOUR.shorts) {
    return get(typeof sessionStorage === 'undefined' ? null : sessionStorage,
      SESSION_KEY + kind) === '1'
  }
  return get(typeof localStorage === 'undefined' ? null : localStorage,
    DAY_KEY + kind) === today()
}

function markShown(kind: TourKind): void {
  if (kind === TOUR.shorts) {
    set(typeof sessionStorage === 'undefined' ? null : sessionStorage,
      SESSION_KEY + kind, '1')
    return
  }
  set(typeof localStorage === 'undefined' ? null : localStorage,
    DAY_KEY + kind, today())
}

/**
 * Bitta o'rgatish turining holati.
 *
 * @param kind    `TOUR` dan
 * @param ready   kontent tayyor va o'rgatishni boshlash mumkin (masalan
 *                video ozgina o'ynadi va to'xtatildi). `false` bo'lsa
 *                hech narsa ochilmaydi.
 * @param delayMs `ready` bo'lgach shuncha kutiladi.
 */
export function useTour(
  kind: TourKind,
  ready: boolean,
  delayMs = 600,
): { open: boolean; finish: () => void } {
  const dateJoined = useAuth((s) => s.user?.date_joined)
  const isLoggedIn = useAuth((s) => s.isLoggedIn)
  const authLoading = useAuth((s) => s.loading)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!ready || authLoading) return
    // Mehmonga umuman ko'rsatilmaydi (foydalanuvchi talabi).
    if (!isLoggedIn) return
    if (alreadyShown(kind) || !withinWindow(kind, dateJoined)) return
    const id = window.setTimeout(() => setOpen(true), delayMs)
    return () => window.clearTimeout(id)
  }, [kind, ready, authLoading, isLoggedIn, dateJoined, delayMs])

  const finish = useCallback(() => {
    markShown(kind)
    setOpen(false)
  }, [kind])

  return { open, finish }
}
