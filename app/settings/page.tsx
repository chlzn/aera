"use client"

import { ChangeEvent, useRef, useState } from "react"
import Link from "next/link"
import { useCurrency } from "@/context/currency-context"

type AppData = {
  currency: string
  entries: unknown[]
  investments: unknown[]
}

const STORAGE_KEYS = {
  currency: "currency",
  entries: "entries",
  investments: "investments",
} as const

export default function Settings() {
  const { currency, setCurrency } = useCurrency()

  const [confirmReset, setConfirmReset] = useState(false)
  const [message, setMessage] = useState("")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const fieldClass =
    "w-full h-[46px] min-h-[46px] appearance-none bg-zinc-800/70 border border-white/5 rounded-[18px] px-4 text-white outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/25 transition-colors"

  const handleCurrencyChange = (value: string) => {
    setCurrency(value)
    setMessage("Currency updated.")
  }

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true)
      setMessage("Press again to confirm.")
      return
    }

    try {
      localStorage.removeItem(STORAGE_KEYS.entries)
      localStorage.removeItem(STORAGE_KEYS.investments)
      localStorage.removeItem(STORAGE_KEYS.currency)

      setCurrency("USD")
      setConfirmReset(false)
      setMessage("All data has been reset.")
    } catch {
      setMessage("Something went wrong while resetting your data.")
    }
  }

  const handleExport = () => {
    try {
      const data: AppData = {
        currency: localStorage.getItem(STORAGE_KEYS.currency) || "USD",
        entries: JSON.parse(localStorage.getItem(STORAGE_KEYS.entries) || "[]"),
        investments: JSON.parse(
          localStorage.getItem(STORAGE_KEYS.investments) || "[]"
        ),
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "aera-backup.json"
      a.click()
      URL.revokeObjectURL(url)

      setMessage("Backup exported successfully.")
    } catch {
      setMessage("Could not export your data.")
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()

    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as Partial<AppData>

        localStorage.setItem(STORAGE_KEYS.currency, parsed.currency || "USD")
        localStorage.setItem(
          STORAGE_KEYS.entries,
          JSON.stringify(parsed.entries || [])
        )
        localStorage.setItem(
          STORAGE_KEYS.investments,
          JSON.stringify(parsed.investments || [])
        )

        setCurrency(parsed.currency || "USD")
        setConfirmReset(false)
        setMessage("Backup imported successfully.")
      } catch {
        setMessage("Invalid backup file.")
      }
    }

    reader.readAsText(file)
    event.target.value = ""
  }

  return (
    <main className="min-h-screen bg-black text-white px-5 py-8 pb-32">
      <div className="max-w-3xl mx-auto">
        <header className="mb-9">
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-zinc-500 mt-2">Customize your experience.</p>
        </header>

        <section className="rounded-[26px] bg-zinc-900/55 border border-white/5 p-6 shadow-[0_8px_24px_rgba(0,0,0,0.18)] mb-6">
          <p className="text-zinc-500 text-sm mb-4">Currency</p>

          <select
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className={fieldClass}
          >
            <option value="USD">USD ($)</option>
            <option value="BRL">BRL (R$)</option>
            <option value="EUR">EUR (€)</option>
          </select>
        </section>

        <section className="rounded-[26px] bg-zinc-900/45 border border-white/5 p-6 shadow-[0_8px_24px_rgba(0,0,0,0.18)] mb-6">
          <p className="text-zinc-500 text-sm mb-4">Backup</p>

          <div className="grid md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="rounded-full bg-[var(--accent)] text-black h-[50px] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-95 cursor-pointer touch-manipulation shadow-[0_4px_16px_rgba(245,166,35,0.14)]"
            >
              Export data
            </button>

            <button
              type="button"
              onClick={handleImportClick}
              className="rounded-full bg-zinc-800/85 border border-white/5 text-white h-[50px] font-medium transition-all duration-200 ease-out hover:bg-zinc-700/85 active:scale-95 cursor-pointer touch-manipulation"
            >
              Import data
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleImport}
            className="hidden"
          />
        </section>

        <section className="rounded-[26px] bg-zinc-900/40 border border-white/5 p-6 mb-6">
          <p className="text-zinc-500 text-sm mb-2">Sync & Premium</p>
          <p className="text-sm text-zinc-600">
            Bank sync, multiple accounts, cloud backup, and premium insights
            will be available in a future version.
          </p>
        </section>

        <section className="rounded-[26px] bg-zinc-900/45 border border-white/5 p-6 mb-3">
          <p className="text-zinc-500 text-sm mb-4">Reset data</p>

          <button
            type="button"
            onClick={handleReset}
            className={`w-full rounded-full h-[50px] font-medium transition-all duration-200 ease-out active:scale-95 cursor-pointer touch-manipulation ${
              confirmReset
                ? "bg-red-500 text-white hover:opacity-90"
                : "bg-zinc-800/85 border border-white/5 text-white hover:bg-zinc-700/85"
            }`}
          >
            {confirmReset ? "Confirm reset all data" : "Reset all data"}
          </button>
        </section>

        <div className="min-h-[24px] mb-24 px-1">
          {message && <p className="text-sm text-zinc-500">{message}</p>}
        </div>
      </div>

      <nav
        className="fixed z-40 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-md bg-zinc-900/80 border border-white/5 rounded-[22px] px-3 py-2 backdrop-blur-xl shadow-[0_10px_36px_rgba(0,0,0,0.38)]"
        style={{
          bottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="grid grid-cols-4 text-center text-sm">
          <Link
            href="/"
            className="text-zinc-500 hover:text-white transition-colors duration-200 ease-out py-2"
          >
            Home
          </Link>
          <Link
            href="/spending"
            className="text-zinc-500 hover:text-white transition-colors duration-200 ease-out py-2"
          >
            Spending
          </Link>
          <Link
            href="/investments"
            className="text-zinc-500 hover:text-white transition-colors duration-200 ease-out py-2"
          >
            Investments
          </Link>
          <Link href="/settings" className="relative text-white font-medium py-2">
            <span>Settings</span>
            <span className="absolute left-1/2 top-full mt-1 h-[2px] w-8 -translate-x-1/2 rounded-full bg-[var(--accent)]" />
          </Link>
        </div>
      </nav>
    </main>
  )
}