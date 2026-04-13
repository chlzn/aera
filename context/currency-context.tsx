"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react"

type CurrencyContextType = {
  currency: string
  setCurrency: (value: string) => void
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

const CURRENCY_KEY = "currency"

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState("USD")

  useEffect(() => {
    const saved = localStorage.getItem(CURRENCY_KEY)
    if (saved) setCurrencyState(saved)
  }, [])

  const setCurrency = (value: string) => {
    setCurrencyState(value)
    localStorage.setItem(CURRENCY_KEY, value)
  }

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
    }),
    [currency]
  )

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const context = useContext(CurrencyContext)

  if (!context) {
    throw new Error("useCurrency must be used inside CurrencyProvider")
  }

  return context
}