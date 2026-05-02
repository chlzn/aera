"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, BriefcaseBusiness } from "lucide-react"
import { useCurrency } from "@/context/currency-context"
import {
  formatPeriodLabel,
  getAvailablePeriodsFromCurrentYear,
  getCurrentPeriodKey,
  isSamePeriod,
} from "@/lib/period"

type AssetType =
  | "crypto"
  | "stock"
  | "etf"
  | "real_estate"
  | "fixed_income"
  | "cash"
  | "other"

type LegacyInvestment = {
  id: string
  name: string
  type: AssetType
  invested: number
  currentValue: number
  ticker?: string
  notes?: string
  accountId: string
  createdAt: string
  updatedAt: string
}

type InvestmentEntry = {
  id: string
  name: string
  type: AssetType
  amount: number
  ticker?: string
  notes?: string
  date: string
  accountId: string
  createdAt: string
  updatedAt: string
}

type PortfolioHolding = {
  key: string
  name: string
  type: AssetType
  invested: number
  currentValue: number
  profit: number
  profitPct: number
  ticker?: string
  latestDate: string
  entries: InvestmentEntry[]
}

const assetTypes: { value: AssetType; label: string }[] = [
  { value: "crypto", label: "Crypto" },
  { value: "stock", label: "Stock" },
  { value: "etf", label: "ETF" },
  { value: "real_estate", label: "Real Estate" },
  { value: "fixed_income", label: "Fixed Income" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
]

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatAssetType(type: string) {
  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function getTodayDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, "0")
  const day = `${now.getDate()}`.padStart(2, "0")

  return `${year}-${month}-${day}`
}

function generateId() {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function getHoldingKey(name: string, ticker?: string) {
  const cleanTicker = ticker?.trim().toUpperCase()

  if (cleanTicker) {
    return cleanTicker
  }

  return name.trim().toLowerCase().replace(/\s+/g, "-")
}

function normalizeTicker(value: string) {
  const clean = value.trim().toUpperCase()
  return clean || undefined
}

export default function Investments() {
  const { currency } = useCurrency()

  const [entries, setEntries] = useState<InvestmentEntry[]>([])
  const [holdingValues, setHoldingValues] = useState<Record<string, number>>({})
  const [entriesHydrated, setEntriesHydrated] = useState(false)

  const [name, setName] = useState("")
  const [type, setType] = useState<AssetType>("crypto")
  const [amount, setAmount] = useState("")
  const [currentValue, setCurrentValue] = useState("")
  const [ticker, setTicker] = useState("")
  const [notes, setNotes] = useState("")
  const [date, setDate] = useState(getTodayDate())

  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriodKey())
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState("")
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false)
  const [isMonthlyOpen, setIsMonthlyOpen] = useState(false)
  const [isMonthlyListOpen, setIsMonthlyListOpen] = useState(false)

  useEffect(() => {
    try {
      const savedEntries = localStorage.getItem("investmentEntries")
      const savedHoldingValues = localStorage.getItem("investmentHoldingValues")

      if (savedEntries) {
        const parsedEntries = JSON.parse(savedEntries)
        setEntries(Array.isArray(parsedEntries) ? parsedEntries : [])

        if (savedHoldingValues) {
          const parsedHoldingValues = JSON.parse(savedHoldingValues)
          setHoldingValues(
            parsedHoldingValues && typeof parsedHoldingValues === "object"
              ? parsedHoldingValues
              : {}
          )
        }
      } else {
        const legacyInvestments = localStorage.getItem("investments")

        if (legacyInvestments) {
          const parsedLegacy = JSON.parse(legacyInvestments)

          if (Array.isArray(parsedLegacy)) {
            const migratedEntries: InvestmentEntry[] = parsedLegacy.map(
              (asset: LegacyInvestment) => ({
                id: asset.id || generateId(),
                name: asset.name,
                type: asset.type,
                amount: asset.invested || 0,
                ticker: asset.ticker,
                notes: asset.notes,
                date: asset.createdAt ? asset.createdAt.slice(0, 10) : getTodayDate(),
                accountId: asset.accountId || "main",
                createdAt: asset.createdAt || new Date().toISOString(),
                updatedAt: asset.updatedAt || new Date().toISOString(),
              })
            )

            const migratedHoldingValues = parsedLegacy.reduce<Record<string, number>>(
              (acc, asset: LegacyInvestment) => {
                const key = getHoldingKey(asset.name, asset.ticker)
                acc[key] = asset.currentValue || asset.invested || 0
                return acc
              },
              {}
            )

            setEntries(migratedEntries)
            setHoldingValues(migratedHoldingValues)
          }
        }
      }
    } catch {
      setEntries([])
      setHoldingValues({})
    } finally {
      setEntriesHydrated(true)
    }
  }, [])

  const holdings = useMemo<PortfolioHolding[]>(() => {
    const grouped = entries.reduce<Record<string, InvestmentEntry[]>>(
      (acc, entry) => {
        const key = getHoldingKey(entry.name, entry.ticker)
        acc[key] = [...(acc[key] || []), entry]
        return acc
      },
      {}
    )

    return Object.entries(grouped)
      .map(([key, holdingEntries]) => {
        const sortedEntries = [...holdingEntries].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )

        const latest = sortedEntries[0]
        const invested = holdingEntries.reduce(
          (sum, entry) => sum + entry.amount,
          0
        )
        const currentValue =
          typeof holdingValues[key] === "number" ? holdingValues[key] : invested
        const profit = currentValue - invested
        const profitPct = invested > 0 ? (profit / invested) * 100 : 0

        return {
          key,
          name: latest.name,
          type: latest.type,
          ticker: latest.ticker,
          invested,
          currentValue,
          profit,
          profitPct,
          latestDate: latest.updatedAt,
          entries: holdingEntries,
        }
      })
      .sort((a, b) => b.currentValue - a.currentValue)
  }, [entries, holdingValues])

  useEffect(() => {
    if (!entriesHydrated) return

    try {
      localStorage.setItem("investmentEntries", JSON.stringify(entries))
      localStorage.setItem(
        "investmentHoldingValues",
        JSON.stringify(holdingValues)
      )

      const compatibleHoldings: LegacyInvestment[] = holdings.map((holding) => ({
        id: holding.key,
        name: holding.name,
        type: holding.type,
        invested: holding.invested,
        currentValue: holding.currentValue,
        ticker: holding.ticker,
        accountId: "main",
        createdAt: holding.latestDate,
        updatedAt: holding.latestDate,
      }))

      localStorage.setItem("investments", JSON.stringify(compatibleHoldings))
    } catch {
      // silent
    }
  }, [entries, holdingValues, holdings, entriesHydrated])

  const availablePeriods = useMemo(() => {
    return getAvailablePeriodsFromCurrentYear()
  }, [])

  const totals = useMemo(() => {
    const investedTotal = holdings.reduce(
      (acc, holding) => acc + holding.invested,
      0
    )
    const currentTotal = holdings.reduce(
      (acc, holding) => acc + holding.currentValue,
      0
    )
    const profit = currentTotal - investedTotal
    const profitPct = investedTotal > 0 ? (profit / investedTotal) * 100 : 0

    return {
      investedTotal,
      currentTotal,
      profit,
      profitPct,
    }
  }, [holdings])

  const periodEntries = useMemo(() => {
    return entries.filter((entry) => isSamePeriod(entry.date, selectedPeriod))
  }, [entries, selectedPeriod])

  const periodInvested = periodEntries.reduce(
    (acc, entry) => acc + entry.amount,
    0
  )

  const portfolioInsight = useMemo(() => {
    if (holdings.length === 0) {
      return "No data yet — add your first investment to start building your portfolio."
    }

    if (totals.profit > 0) {
      return "Your portfolio is above your invested capital."
    }

    if (totals.profit < 0) {
      return "Your portfolio is currently below your invested capital."
    }

    return "Your portfolio is currently flat."
  }, [holdings.length, totals.profit])

  const resetForm = () => {
    setName("")
    setType("crypto")
    setAmount("")
    setCurrentValue("")
    setTicker("")
    setNotes("")
    setDate(getTodayDate())
    setEditingEntryId(null)
    setError("")
  }

  const openCreateModal = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const openEditEntryModal = (entry: InvestmentEntry) => {
    const key = getHoldingKey(entry.name, entry.ticker)

    setName(entry.name)
    setType(entry.type)
    setAmount(String(entry.amount))
    setCurrentValue(
      typeof holdingValues[key] === "number" ? String(holdingValues[key]) : ""
    )
    setTicker(entry.ticker || "")
    setNotes(entry.notes || "")
    setDate(entry.date)
    setEditingEntryId(entry.id)
    setError("")
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    resetForm()
  }

  const handleSubmit = () => {
    const now = new Date().toISOString()
    const amountNumber = Number(amount)
    const cleanName = name.trim()
    const cleanTicker = normalizeTicker(ticker)

    if (!cleanName) {
      setError("Please add an asset name.")
      return
    }

    if (!amount || Number.isNaN(amountNumber) || amountNumber <= 0) {
      setError("Please enter a valid invested amount.")
      return
    }

    if (!date) {
      setError("Please select a date.")
      return
    }

    const newKey = getHoldingKey(cleanName, cleanTicker)

    if (editingEntryId) {
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === editingEntryId
            ? {
                ...entry,
                name: cleanName,
                type,
                amount: amountNumber,
                ticker: cleanTicker,
                notes: notes.trim() || undefined,
                date,
                updatedAt: now,
              }
            : entry
        )
      )
    } else {
      const newEntry: InvestmentEntry = {
        id: generateId(),
        name: cleanName,
        type,
        amount: amountNumber,
        ticker: cleanTicker,
        notes: notes.trim() || undefined,
        date,
        accountId: "main",
        createdAt: now,
        updatedAt: now,
      }

      setEntries((prev) => [newEntry, ...prev])
    }

    if (currentValue.trim()) {
      const currentValueNumber = Number(currentValue)

      if (Number.isNaN(currentValueNumber) || currentValueNumber < 0) {
        setError("Please enter a valid current value.")
        return
      }

      setHoldingValues((prev) => ({
        ...prev,
        [newKey]: currentValueNumber,
      }))
    }

    closeModal()
  }

  const handleDelete = () => {
    if (!editingEntryId) return

    setEntries((prev) => prev.filter((entry) => entry.id !== editingEntryId))
    closeModal()
  }

  const fieldClass =
    "w-full h-[46px] min-h-[46px] appearance-none bg-zinc-800/70 border border-white/5 rounded-[18px] px-4 text-white outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/25 transition-colors"

  return (
    <>
      <main className="min-h-screen bg-black text-white px-5 py-8 pb-32">
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">Investments</h1>
            <p className="text-zinc-500 mt-2">Track your portfolio clearly.</p>
          </header>

          <section>
            <button
              type="button"
              onClick={() => setIsOverviewExpanded((prev) => !prev)}
              className={`w-full rounded-[30px] bg-zinc-900/72 p-8 text-left shadow-[0_14px_40px_rgba(0,0,0,0.28)] transition-all duration-200 ease-out ${
                isOverviewExpanded
                  ? "border border-[var(--accent)]/15"
                  : "border border-white/5"
              }`}
            >
              <p className="text-zinc-500 text-sm mb-3">Current Value</p>

              <h2 className="text-5xl font-semibold tracking-tight">
                {formatCurrency(totals.currentTotal, currency)}
              </h2>

              <div
                className={`overflow-hidden transition-all duration-200 ease-out ${
                  isOverviewExpanded
                    ? "max-h-[220px] opacity-100 mt-6"
                    : "max-h-0 opacity-0 mt-0"
                }`}
              >
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 text-sm">Invested</span>
                    <span className="text-white text-sm font-medium">
                      {formatCurrency(totals.investedTotal, currency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 text-sm">Profit</span>
                    <span
                      className={`text-sm font-medium ${
                        totals.profit >= 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {formatCurrency(totals.profit, currency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 text-sm">Performance</span>
                    <span
                      className={`text-sm font-medium ${
                        totals.profitPct >= 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {totals.profitPct >= 0 ? "+" : ""}
                      {totals.profitPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </section>

          <section className="mt-6">
            <p className="text-sm text-zinc-400">{portfolioInsight}</p>
          </section>

          <div className="h-px bg-white/5 my-6" />

          <section>
            <Link
              href="/investments/portfolio"
              className="group block rounded-[28px] bg-zinc-900/55 border border-white/5 p-6 sm:p-7 transition-all duration-200 ease-out hover:bg-zinc-900/72 active:scale-[0.995]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)]/[0.06] border border-[var(--accent)]/[0.14] text-[var(--accent)] transition-colors duration-200 group-hover:bg-[var(--accent)]/[0.08] group-hover:border-[var(--accent)]/[0.18]">
                    <BriefcaseBusiness size={17} strokeWidth={2} />
                  </div>

                  <div>
                    <p className="text-white text-base font-medium">Portfolio</p>
                    <p className="text-zinc-500 text-sm mt-2">
                      See your holdings and performance.
                    </p>
                  </div>
                </div>

                <div className="text-zinc-600 transition-all duration-200 group-hover:text-zinc-400 group-hover:translate-x-[1px] group-hover:-translate-y-[1px]">
                  <ArrowUpRight size={18} strokeWidth={2} />
                </div>
              </div>
            </Link>
          </section>

          <div className="h-px bg-white/5 my-6" />

          <section>
            <div className="rounded-[26px] bg-zinc-900/45 border border-white/5 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-zinc-300 text-sm font-medium">
                    Add investment
                  </p>
                  <p className="text-zinc-500 text-sm mt-1">
                    Add a new contribution to your portfolio.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openCreateModal}
                  className="relative z-10 select-none shrink-0 inline-flex items-center justify-center rounded-full bg-[var(--accent)] text-black px-4 py-3 text-sm font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98] cursor-pointer touch-manipulation shadow-[0_4px_16px_rgba(245,166,35,0.14)]"
                >
                  + Add
                </button>
              </div>
            </div>
          </section>

          <div className="h-px bg-white/5 my-6" />

          <section className="mb-24">
            <button
              type="button"
              onClick={() => setIsMonthlyOpen((prev) => !prev)}
              className="w-full flex items-center justify-between text-left mb-4"
            >
              <p className="text-white text-sm font-medium">Monthly activity</p>
              <span className="text-zinc-500 text-lg">
                {isMonthlyOpen ? "⌃" : "⌄"}
              </span>
            </button>

            {isMonthlyOpen && (
              <>
                <div className="mb-6">
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="w-full bg-zinc-900/40 border border-white/5 rounded-[22px] px-4 py-4 outline-none focus:border-[var(--accent)] transition-colors"
                  >
                    {availablePeriods.map((period) => (
                      <option key={period} value={period}>
                        {formatPeriodLabel(period)}
                      </option>
                    ))}
                  </select>
                </div>

                <section className="mb-6">
                  <div>
                    <p className="text-white text-sm font-medium mb-2">
                      Invested in {formatPeriodLabel(selectedPeriod)}
                    </p>
                    <div className="rounded-[26px] bg-zinc-900/40 border border-white/5 p-5">
                      <p className="text-xl font-semibold">
                        {formatCurrency(periodInvested, currency)}
                      </p>
                    </div>
                  </div>
                </section>

                {periodEntries.length === 0 ? (
                  <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 p-6">
                    <p className="text-zinc-300 text-sm">
                      No investments added in this period.
                    </p>
                    <p className="text-zinc-600 text-sm mt-1">
                      Select another month or add a new investment.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setIsMonthlyListOpen((prev) => !prev)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <p className="text-white text-sm font-medium">
                        Investment entries
                      </p>
                      <span className="text-zinc-500 text-lg">
                        {isMonthlyListOpen ? "⌃" : "⌄"}
                      </span>
                    </button>

                    {isMonthlyListOpen && (
                      <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 overflow-hidden">
                        {periodEntries.map((entry, index) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => openEditEntryModal(entry)}
                            className={`w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-200 ease-out hover:bg-white/[0.02] active:scale-[0.995] ${
                              index !== periodEntries.length - 1
                                ? "border-b border-white/5"
                                : ""
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-zinc-200 truncate">
                                  {entry.name}
                                </p>
                                {entry.ticker && (
                                  <span className="text-xs text-zinc-600 uppercase">
                                    {entry.ticker}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mt-1 text-xs text-zinc-600 flex-wrap">
                                <span>{formatAssetType(entry.type)}</span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <p className="text-zinc-300 text-sm">
                                {formatCurrency(entry.amount, currency)}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 animate-[modalOverlayEnter_150ms_ease-out]"
          onClick={closeModal}
        >
          <div className="absolute inset-0 flex items-end md:items-center md:justify-center p-3 md:p-6">
            <div
              className="w-full md:max-w-lg rounded-t-[30px] md:rounded-[30px] bg-zinc-900/95 border border-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] p-4 md:p-5 animate-[modalContentEnter_180ms_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-white text-sm font-medium">
                  {editingEntryId ? "Edit investment" : "New investment"}
                </p>

                <button
                  type="button"
                  onClick={closeModal}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors duration-200 ease-out cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-3">
                <input
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={fieldClass}
                />

                <div>
                  <label className="text-xs text-zinc-500 mb-2 block">
                    Asset type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AssetType)}
                    className={fieldClass}
                  >
                    {assetTypes.map((assetType) => (
                      <option key={assetType.value} value={assetType.value}>
                        {assetType.label}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  placeholder="Ticker (optional)"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  className={fieldClass}
                />

                <input
                  placeholder="Invested amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={fieldClass}
                />

                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={fieldClass}
                />

                <input
                  placeholder="Current value (optional)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  className={fieldClass}
                />

                <div>
                  <label className="text-xs text-zinc-500 mb-2 block">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full bg-zinc-800/70 border border-white/5 rounded-[18px] px-4 py-3 text-white outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/25 transition-colors resize-none"
                    placeholder="Optional notes"
                  />
                </div>

                {error && <p className="text-sm text-red-500 pt-1">{error}</p>}

                <button
                  type="button"
                  onClick={handleSubmit}
                  className="w-full rounded-full bg-[var(--accent)] text-black h-[50px] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98] cursor-pointer touch-manipulation mt-1"
                >
                  {editingEntryId ? "Save investment" : "Add investment"}
                </button>

                {editingEntryId && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full text-center text-red-400 text-xs py-1.5 mt-1 transition-colors duration-200 ease-out hover:text-red-300 cursor-pointer"
                  >
                    Delete investment
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}