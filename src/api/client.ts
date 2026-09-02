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

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
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
