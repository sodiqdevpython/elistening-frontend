import { create } from 'zustand'
import { tokenStore } from '@/api/client'
import { fetchMe, logoutSession, trackActivity } from '@/api/endpoints'
import type { Me } from '@/api/types'

interface AuthState {
  user: Me | null
  loading: boolean
  isLoggedIn: boolean
  signIn: (access: string, refresh: string, user: Me) => void
  signOut: () => void
  setUser: (user: Me) => void
  hydrate: () => Promise<void>
  /**
   * Audio ijro etilgan sekundlarni serverga yuboradi va lokal `today_seconds`
   * ni yangilaydi. Foydalanuvchi kirmagan bo'lsa jim o'tadi.
   */
  addPlayedSeconds: (seconds: number) => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  isLoggedIn: false,

  signIn: (access, refresh, user) => {
    tokenStore.save(access, refresh)
    set({ user, isLoggedIn: true, loading: false })
  },

  signOut: () => {
    // Serverdagi sessiyani ham yopamiz — aks holda `ActiveSession` qatori
    // qolib ketardi va profildagi "Kirgan qurilmalar" ro'yxatida ko'rinib
    // turardi. Javobni KUTMAYMIZ: chiqish darrov bo'lishi kerak, tarmoq
    // xatosi esa lokal tozalashni to'sib qo'ymasin.
    logoutSession().catch(() => {})
    tokenStore.clear()
    set({ user: null, isLoggedIn: false, loading: false })
  },

  setUser: (user) => set({ user, isLoggedIn: true }),

  /** Sahifa yangilanganda tokenni tekshirib, profilni qayta yuklaydi. */
  hydrate: async () => {
    if (!tokenStore.access) {
      set({ loading: false, isLoggedIn: false })
      return
    }
    try {
      const user = await fetchMe()
      set({ user, isLoggedIn: true, loading: false })
    } catch {
      tokenStore.clear()
      set({ user: null, isLoggedIn: false, loading: false })
    }
  },

  addPlayedSeconds: async (seconds) => {
    if (seconds <= 0) return
    const state = useAuth.getState()
    if (!state.isLoggedIn || !state.user) return
    try {
      const result = await trackActivity(seconds)
      set((s) => ({
        user: s.user ? { ...s.user, today_seconds: result.today_seconds } : null,
      }))
    } catch {
      /* Tarmoq xatosi — indikator biroz ortda qolishi mumkin, muhim emas */
    }
  },
}))

// Interceptor refresh qila olmaganda holatni tozalaymiz.
window.addEventListener('listening:signed-out', () => useAuth.getState().signOut())
