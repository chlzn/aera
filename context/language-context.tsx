"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { defaultLanguage, getCopy, type Language } from "@/locales"

const STORAGE_KEY = "aera_language"

type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  copy: ReturnType<typeof getCopy>
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function isLanguage(value: string | null): value is Language {
  return value === "en-US" || value === "pt-BR"
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [languageState, setLanguageState] = useState<Language>(defaultLanguage)

  useEffect(() => {
    try {
      const savedLanguage = localStorage.getItem(STORAGE_KEY)

      if (isLanguage(savedLanguage)) {
        setLanguageState(savedLanguage)
      }
    } catch {
      // silent
    }
  }, [])

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage)

    try {
      localStorage.setItem(STORAGE_KEY, nextLanguage)
    } catch {
      // silent
    }
  }

  const copy = useMemo(() => getCopy(languageState), [languageState])

  return (
    <LanguageContext.Provider
      value={{
        language: languageState,
        setLanguage,
        copy,
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider")
  }

  return context
}