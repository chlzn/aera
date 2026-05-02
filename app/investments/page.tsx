"use client"

import { useEffect, useMemo, useState } from "react"
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
  return new Date().toISOString().split("T")[0]
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

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | AssetType>("all")
  const [portfolioView, setPortfolioView] = useState<"current" | "invested">(
    "current"
  )
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriodKey())

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editingHoldingKey, setEditingHoldingKey] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<"entry" | "holding">("entry")

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState("")
  const [isPortfolioOpen, setIsPortfolioOpen] = useState(true)
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
                date: asset.createdAt
                  ? new Date(asset.createdAt).toISOString().split("T")[0]
                  : getTodayDate(),
                accountId: asset.accountId || "main",
                createdAt: asset.createdAt || new Date().toISOString(),
                updatedAt: asset.updatedAt || new Date().toISOString(),
              })
            )

            const migratedHoldingValues = parsedLegacy.reduce<
              Record<string, number>
            >((acc, asset: LegacyInvestment) => {
              const key = getHoldingKey(asset.name, asset.ticker)
              acc[key] = asset.currentValue || asset.invested || 0
              return acc
            }, {})

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

  const filteredHoldings = useMemo(() => {
    return holdings.filter((holding) => {
      const matchesFilter = filter === "all" ? true : holding.type === filter
      const query = search.toLowerCase()

      const matchesSearch =
        holding.name.toLowerCase().includes(query) ||
        holding.type.toLowerCase().includes(query) ||
        holding.ticker?.toLowerCase().includes(query)

      return matchesFilter && matchesSearch
    })
  }, [holdings, filter, search])

  const filteredPeriodEntries = useMemo(() => {
    return periodEntries.filter((entry) => {
      const query = search.toLowerCase()

      const matchesSearch =
        entry.name.toLowerCase().includes(query) ||
        entry.type.toLowerCase().includes(query) ||
        entry.ticker?.toLowerCase().includes(query)

      return matchesSearch
    })
  }, [periodEntries, search])

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
    setEditingHoldingKey(null)
    setModalMode("entry")
    setError("")
  }

  const openCreateModal = () => {
    resetForm()
    setModalMode("entry")
    setIsModalOpen(true)
  }

  const openEditEntryModal = (entry: InvestmentEntry) => {
    const key = getHoldingKey(entry.name, entry.ticker)

    setModalMode("entry")
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
    setEditingHoldingKey(null)
    setError("")
    setIsModalOpen(true)
  }

  const openEditHoldingModal = (holding: PortfolioHolding) => {
    setModalMode("holding")
    setName(holding.name)
    setType(holding.type)
    setAmount("")
    setCurrentValue(String(holding.currentValue))
    setTicker(holding.ticker || "")
    setNotes("")
    setDate(getTodayDate())
    setEditingEntryId(null)
    setEditingHoldingKey(holding.key)
    setError("")
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    resetForm()
  }

  const handleSubmit = () => {
    const now = new Date().toISOString()

    if (modalMode === "holding") {
      const currentValueNumber = Number(currentValue)

      if (
        !currentValue ||
        Number.isNaN(currentValueNumber) ||
        currentValueNumber < 0
      ) {
        setError("Please enter a valid current value.")
        return
      }

      if (!editingHoldingKey) {
        setError("Unable to update this holding.")
        return
      }

      setHoldingValues((prev) => ({
        ...prev,
        [editingHoldingKey]: currentValueNumber,
      }))

      closeModal()
      return
    }

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

          <section className="mb-6">
            <div className="rounded-[30px] bg-zinc-900/72 border border-white/5 shadow-[0_14px_40px_rgba(0,0,0,0.28)] p-8">
              <div>
                <p className="text-zinc-500 text-sm mb-3">Current Value</p>
                <h2 className="text-5xl font-semibold tracking-tight">
                  {formatCurrency(totals.currentTotal, currency)}
                </h2>

                <div className="mt-5 flex gap-6 flex-wrap text-sm">
                  <div className="flex flex-col">
                    <span className="text-zinc-500">Invested</span>
                    <span className="text-white font-medium">
                      {formatCurrency(totals.investedTotal, currency)}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-zinc-500">Profit</span>
                    <span
                      className={`font-medium ${
                        totals.profit >= 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {formatCurrency(totals.profit, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <p className="text-sm text-zinc-400">{portfolioInsight}</p>
          </section>

          <section className="mb-8">
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

          <section className="mb-6">
            <button
              type="button"
              onClick={() => setIsPortfolioOpen((prev) => !prev)}
              className="w-full flex items-center justify-between text-left mb-4"
            >
              <p className="text-white text-sm font-medium">Portfolio</p>
              <span className="text-[var(--accent)] text-lg">
                {isPortfolioOpen ? "⌃" : "⌄"}
              </span>
            </button>

            {isPortfolioOpen && (
              <>
                <div className="rounded-full bg-zinc-900/45 border border-white/5 p-1.5 mb-4">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPortfolioView("current")}
                      className={`h-[42px] rounded-full text-sm transition-all duration-150 ease-out ${
                        portfolioView === "current"
                          ? "bg-[var(--accent)]/90 text-black"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Current Value
                    </button>

                    <button
                      type="button"
                      onClick={() => setPortfolioView("invested")}
                      className={`h-[42px] rounded-full text-sm transition-all duration-150 ease-out ${
                        portfolioView === "invested"
                          ? "bg-[var(--accent)]/90 text-black"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Invested Only
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as "all" | AssetType)}
                    className="w-full bg-zinc-900/40 border border-white/5 rounded-[22px] px-4 py-4 outline-none focus:border-[var(--accent)] transition-colors"
                  >
                    <option value="all">All types</option>
                    {assetTypes.map((assetType) => (
                      <option key={assetType.value} value={assetType.value}>
                        {assetType.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <input
                    placeholder="Search assets"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-zinc-900/40 border border-white/5 rounded-[22px] px-4 py-4 outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>

                {filteredHoldings.length === 0 ? (
                  <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 p-6">
                    <p className="text-zinc-300 text-sm">No investments yet.</p>
                    <p className="text-zinc-600 text-sm mt-1">
                      Start by adding your first investment.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 overflow-hidden">
                    {filteredHoldings.map((holding, index) => (
                      <button
                        key={holding.key}
                        type="button"
                        onClick={() => openEditHoldingModal(holding)}
                        className={`w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-200 ease-out hover:bg-white/[0.02] active:scale-[0.995] ${
                          index !== filteredHoldings.length - 1
                            ? "border-b border-white/5"
                            : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-zinc-200 truncate">
                              {holding.name}
                            </p>
                            {holding.ticker && (
                              <span className="text-xs text-zinc-600 uppercase">
                                {holding.ticker}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-600 flex-wrap">
                            <span>{formatAssetType(holding.type)}</span>
                            <span>•</span>
                            <span>
                              Invested {formatCurrency(holding.invested, currency)}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-zinc-300 text-sm">
                            {formatCurrency(
                              portfolioView === "current"
                                ? holding.currentValue
                                : holding.invested,
                              currency
                            )}
                          </p>

                          {portfolioView === "current" && (
                            <p
                              className={`text-[11px] mt-1 ${
                                holding.profitPct >= 0
                                  ? "text-green-500"
                                  : "text-red-500"
                              }`}
                            >
                              {holding.profitPct >= 0 ? "+" : ""}
                              {holding.profitPct.toFixed(1)}%
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          <section className="mb-24">
            <button
              type="button"
              onClick={() => setIsMonthlyOpen((prev) => !prev)}
              className="w-full flex items-center justify-between text-left mb-4"
            >
              <p className="text-white text-sm font-medium">Monthly activity</p>
              <span className="text-[var(--accent)] text-lg">
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

                {filteredPeriodEntries.length === 0 ? (
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
                      <span className="text-[var(--accent)] text-lg">
                        {isMonthlyListOpen ? "⌃" : "⌄"}
                      </span>
                    </button>

                    {isMonthlyListOpen && (
                      <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 overflow-hidden">
                        {filteredPeriodEntries.map((entry, index) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => openEditEntryModal(entry)}
                            className={`w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-200 ease-out hover:bg-white/[0.02] active:scale-[0.995] ${
                              index !== filteredPeriodEntries.length - 1
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
                  {modalMode === "holding"
                    ? "Edit holding"
                    : editingEntryId
                    ? "Edit investment"
                    : "New investment"}
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
                  disabled={modalMode === "holding"}
                  className={`${fieldClass} ${
                    modalMode === "holding" ? "opacity-70" : ""
                  }`}
                />

                <div>
                  <label className="text-xs text-zinc-500 mb-2 block">
                    Asset type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AssetType)}
                    disabled={modalMode === "holding"}
                    className={`${fieldClass} ${
                      modalMode === "holding" ? "opacity-70" : ""
                    }`}
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
                  disabled={modalMode === "holding"}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  className={`${fieldClass} ${
                    modalMode === "holding" ? "opacity-70" : ""
                  }`}
                />

                {modalMode === "entry" && (
                  <>
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
                  </>
                )}

                <input
                  placeholder="Current value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  className={fieldClass}
                />

                {modalMode === "entry" && (
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
                )}

                {error && <p className="text-sm text-red-500 pt-1">{error}</p>}

                <button
                  type="button"
                  onClick={handleSubmit}
                  className="w-full rounded-full bg-[var(--accent)] text-black h-[50px] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98] cursor-pointer touch-manipulation mt-1"
                >
                  {modalMode === "holding"
                    ? "Save holding"
                    : editingEntryId
                    ? "Save investment"
                    : "Add investment"}
                </button>

                {editingEntryId && modalMode === "entry" && (
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