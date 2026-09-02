import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/store/auth'
import { STRINGS, type Lang, type Strings } from './strings'

interface LangContextValue {
  lang: Lang
  t: Strings
  setLang: (lang: Lang) => void
  toggleLang: () => void
}

const LangContext = createContext<LangContextValue | null>(null)
const STORAGE_KEY = 'listening.lang'

function readInitialLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'en' || saved === 'uz' ? saved : 'uz'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang)
    document.documentElement.lang = lang
  }, [lang])

  // Profildagi til — foydalanuvchi ro'yxatdan o'tishda tanlagan qiymat.
  // Kirgach (yoki sahifa yangilangach hydrate bo'lgach) bir marta qo'llanadi:
  // shu bilan boshqa qurilmada kirsa ham o'z tilida ochiladi.
  //
  // "Bir marta" muhim — keyin foydalanuvchi navbardagi UZ/EN tugmasi bilan
  // tilni almashtirsa, biz uni qaytarib bosib qo'ymaymiz.
  const profileLang = useAuth((s) => s.user?.language)
  const appliedRef = useRef(false)
  useEffect(() => {
    if (appliedRef.current) return
    if (profileLang !== 'uz' && profileLang !== 'en') return
    appliedRef.current = true
    setLangState(profileLang)
  }, [profileLang])

  const setLang = useCallback((next: Lang) => {
    // Qo'lda almashtirilsa — profildan kelgan qiymat endi ustun kelmaydi.
    appliedRef.current = true
    setLangState(next)
  }, [])
  const toggleLang = useCallback(() => {
    appliedRef.current = true
    setLangState((l) => (l === 'uz' ? 'en' : 'uz'))
  }, [])

  const value = useMemo(
    () => ({ lang, t: STRINGS[lang], setLang, toggleLang }),
    [lang, setLang, toggleLang],
  )
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang(): LangContextValue {
  const context = useContext(LangContext)
  if (!context) throw new Error('useLang faqat LangProvider ichida ishlaydi')
  return context
}

/** Qisqa yordamchi: const t = useT() */
export function useT(): Strings {
  return useLang().t
}

/** Ikki tilli maydonlardan joriy tilga mosini oladi. */
export function pick<T>(lang: Lang, uz: T, en: T): T {
  return lang === 'uz' ? uz : en
}
