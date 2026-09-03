import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

const ACCESS_KEY = 'listening.access'
const REFRESH_KEY = 'listening.refresh'

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  save(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  saveAccess(access: string) {
    localStorage.setItem(ACCESS_KEY, access)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

import { unwrapProtected } from '@/utils/protect'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  // `X-Platform: web` — backend shu sarlavhaga qarab (a) sessiyani WEB
  // platformasiga bog'laydi (1 web + 1 mobil), (b) limitga yetilganda bot
  // xabari MOBIL uchun yuboriladi, web uchun esa sahifada BillingPage havolasi
  // bor (ilovadagi App Store cheklovi web'da yo'q).
  headers: { 'Content-Type': 'application/json', 'X-Platform': 'web' },
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.access
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** Bir vaqtda bir nechta 401 kelsa, refresh faqat bir marta yuboriladi. */
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStore.refresh
  if (!refresh) return null
  try {
    const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh/`, { refresh })
    tokenStore.saveAccess(data.access)
    if (data.refresh) tokenStore.save(data.access, data.refresh)
    return data.access as string
  } catch {
    tokenStore.clear()
    return null
  }
}

/**
 * Kunlik limitga yetilganda backend **403** `{error:{code:'limit_reached', kind},
 * limits:{...}}` qaytaradi. Ilova darajasidagi bitta handler (LimitGate modal)
 * shu yerda ro'yxatdan o'tadi — interceptor HAR limit 403 ni ushlab, modalni
 * ochadi. Shu bois view chaqiruvlari 403 ni "yutib yuborsa" ham foydalanuvchi
 * baribir limit oynasini ko'radi (web'da ilgari HECH NARSA ko'rinmasdi).
 */
export interface LimitPayload {
  error: { code: 'limit_reached'; kind: string; message?: string }
  limits?: import('./types').LimitsSnapshot
}

let limitHandler: ((payload: LimitPayload) => void) | null = null
export function setLimitHandler(fn: ((payload: LimitPayload) => void) | null) {
  limitHandler = fn
}

/** Xato aynan kunlik-limit (403 `limit_reached`) mi? */
export function isLimitError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  const data = error.response?.data as { error?: { code?: string } } | undefined
  return error.response?.status === 403 && data?.error?.code === 'limit_reached'
}

/** Limit 403 ning to'liq payload'i (yoki null). */
export function limitPayload(error: unknown): LimitPayload | null {
  if (!isLimitError(error)) return null
  return (error as AxiosError).response?.data as LimitPayload
}

/**
 * Javobdagi `enc` bloki — transkript va savollar "o'ralgan" holda keladi
 * (`backend/apps/common/protect.py`). Shu yerda BIR MARTA ochib, natijani
 * obyektning o'ziga qo'shib qo'yamiz: komponentlar va endpoint funksiyalari
 * hech narsani bilmaydi va o'zgarmaydi.
 *
 * Eslatma: bu shifrlash emas, oddiy scraping'ga qarshi to'siq — batafsil
 * `utils/protect.ts` izohida.
 */
api.interceptors.response.use((response) => {
  if (response.data) unwrapProtected(response.data)
  return response
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean }
    const isAuthCall = original?.url?.includes('/auth/')

    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true
      refreshPromise = refreshPromise ?? refreshAccessToken()
      const token = await refreshPromise
      refreshPromise = null
      if (token) {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      }
      window.dispatchEvent(new CustomEvent('listening:signed-out'))
    }

    // Kunlik limit — ilova darajasidagi modalni oching (mobil bilan bir xil xulq).
    if (isLimitError(error) && limitHandler) {
      try {
        limitHandler(limitPayload(error)!)
      } catch {
        /* modal xatosi asosiy oqimni buzmasin */
      }
    }
    return Promise.reject(error)
  },
)

/** Backenddan kelgan xatolik matnini o'qiydi. */
export function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: { message?: string }; detail?: string } | undefined
    return data?.error?.message || data?.detail || fallback
  }
  return fallback
}
