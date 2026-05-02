"use client"

import { useEffect, useMemo, useState } from "react"
import { useCurrency } from "@/context/currency-context"

type AssetType =
  | "crypto"
  | "stock"
  | "etf"
  | "real_estate"
  | "fixed_income"
  | "cash"
  | "other"

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

type PortfolioGroup = {
  type: AssetType
  label: string
  invested: number
  currentValue: number
  profit: number
  profitPct: number
  holdings: PortfolioHolding[]
}

const assetTypeLabels: Record<AssetType, string> = {
  crypto: "Crypto",
  stock: "Stocks",
  etf: "ETF",
  real_estate: "Real Estate",
  fixed_income: "Fixed Income",
  cash: "Cash",
  other: "Other",
}

const assetTypeOrder: AssetType[] = [
  "crypto",
  "stock",
  "etf",
  "real_estate",
  "fixed_income",
  "cash",
  "other",
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

export default function PortfolioPage() {
  const { currency } = useCurrency()

  const [entries, setEntries] = useState<InvestmentEntry[]>([])
  const [holdingValues, setHoldingValues] = useState<Record<string, number>>({})
  const [hydrated, setHydrated] = useState(false)

  const [expandedGroup, setExpandedGroup] = useState<AssetType | null>(null)
  const [selectedHoldingKey, setSelectedHoldingKey] = useState<string | null>(
    null
  )
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isInvestMoreOpen, setIsInvestMoreOpen] = useState(false)

  const [currentValue, setCurrentValue] = useState("")
  const [investMoreAmount, setInvestMoreAmount] = useState("")
  const [investMoreDate, setInvestMoreDate] = useState(getTodayDate())
  const [error, setError] = useState("")

  useEffect(() => {
    try {
      const savedEntries = localStorage.getItem("investmentEntries")
      const savedHoldingValues = localStorage.getItem("investmentHoldingValues")

      if (savedEntries) {
        const parsedEntries = JSON.parse(savedEntries)
        setEntries(Array.isArray(parsedEntries) ? parsedEntries : [])
      }

      if (savedHoldingValues) {
        const parsedHoldingValues = JSON.parse(savedHoldingValues)
        setHoldingValues(
          parsedHoldingValues && typeof parsedHoldingValues === "object"
            ? parsedHoldingValues
            : {}
        )
      }
    } catch {
      setEntries([])
      setHoldingValues({})
    } finally {
      setHydrated(true)
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

  const groups = useMemo<PortfolioGroup[]>(() => {
    return assetTypeOrder
      .map((type) => {
        const groupHoldings = holdings
          .filter((holding) => holding.type === type)
          .sort((a, b) => b.currentValue - a.currentValue)

        const invested = groupHoldings.reduce(
          (sum, holding) => sum + holding.invested,
          0
        )

        const currentValue = groupHoldings.reduce(
          (sum, holding) => sum + holding.currentValue,
          0
        )

        const profit = currentValue - invested
        const profitPct = invested > 0 ? (profit / invested) * 100 : 0

        return {
          type,
          label: assetTypeLabels[type],
          invested,
          currentValue,
          profit,
          profitPct,
          holdings: groupHoldings,
        }
      })
      .filter((group) => group.holdings.length > 0)
  }, [holdings])

  const totals = useMemo(() => {
    const investedTotal = holdings.reduce(
      (sum, holding) => sum + holding.invested,
      0
    )

    const currentTotal = holdings.reduce(
      (sum, holding) => sum + holding.currentValue,
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

  useEffect(() => {
    if (!hydrated) return

    try {
      localStorage.setItem("investmentEntries", JSON.stringify(entries))
      localStorage.setItem(
        "investmentHoldingValues",
        JSON.stringify(holdingValues)
      )

      const compatibleHoldings = holdings.map((holding) => ({
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
  }, [entries, holdingValues, holdings, hydrated])

  const selectedHolding = useMemo(() => {
    return holdings.find((holding) => holding.key === selectedHoldingKey) || null
  }, [holdings, selectedHoldingKey])

  const openHoldingDetail = (holding: PortfolioHolding) => {
    setSelectedHoldingKey(holding.key)
    setCurrentValue(String(holding.currentValue))
    setError("")
    setIsDetailOpen(true)
  }

  const closeHoldingDetail = () => {
    setIsDetailOpen(false)
    setSelectedHoldingKey(null)
    setCurrentValue("")
    setError("")
  }

  const handleSaveHolding = () => {
    if (!selectedHolding) return

    const parsedCurrentValue = Number(currentValue)

    if (
      !currentValue ||
      Number.isNaN(parsedCurrentValue) ||
      parsedCurrentValue < 0
    ) {
      setError("Please enter a valid current value.")
      return
    }

    setHoldingValues((prev) => ({
      ...prev,
      [selectedHolding.key]: parsedCurrentValue,
    }))

    closeHoldingDetail()
  }

  const openInvestMore = () => {
    if (!selectedHolding) return
    setInvestMoreAmount("")
    setInvestMoreDate(getTodayDate())
    setError("")
    setIsInvestMoreOpen(true)
  }

  const closeInvestMore = () => {
    setIsInvestMoreOpen(false)
    setInvestMoreAmount("")
    setInvestMoreDate(getTodayDate())
    setError("")
  }

  const handleInvestMore = () => {
    if (!selectedHolding) return

    const parsedAmount = Number(investMoreAmount)

    if (!investMoreAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount.")
      return
    }

    if (!investMoreDate) {
      setError("Please select a date.")
      return
    }

    const now = new Date().toISOString()

    const newEntry: InvestmentEntry = {
      id: generateId(),
      name: selectedHolding.name,
      type: selectedHolding.type,
      amount: parsedAmount,
      ticker: selectedHolding.ticker,
      date: investMoreDate,
      accountId: "main",
      createdAt: now,
      updatedAt: now,
    }

    setEntries((prev) => [newEntry, ...prev])
    closeInvestMore()
    closeHoldingDetail()
  }

  const fieldClass =
    "w-full h-[46px] min-h-[46px] appearance-none bg-zinc-800/70 border border-white/5 rounded-[18px] px-4 text-white outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/25 transition-colors"

  return (
    <>
      <main className="min-h-screen bg-black text-white px-5 py-8 pb-32">
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
            <p className="text-zinc-500 mt-2">
              See your holdings and performance.
            </p>
          </header>

          {groups.length > 0 && (
            <section className="mb-6">
              <div className="rounded-[30px] bg-black border border-white/5 shadow-[0_14px_40px_rgba(0,0,0,0.28)] p-8">
                <p className="text-zinc-500 text-sm mb-3">Portfolio Value</p>

                <h2 className="text-5xl font-semibold tracking-tight text-white">
                  {formatCurrency(totals.currentTotal, currency)}
                </h2>

                <div className="mt-5 flex gap-6 flex-wrap text-sm">
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

                  <div className="flex flex-col">
                    <span className="text-zinc-500">Performance</span>
                    <span
                      className={`font-medium ${
                        totals.profitPct >= 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {totals.profitPct >= 0 ? "+" : ""}
                      {totals.profitPct.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-zinc-500">Invested</span>
                    <span className="text-white font-medium">
                      {formatCurrency(totals.investedTotal, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {groups.length === 0 ? (
            <section className="mb-10">
              <div className="rounded-[28px] bg-zinc-900/45 border border-white/5 p-6">
                <p className="text-zinc-200 text-sm">No holdings yet.</p>
                <p className="text-zinc-600 text-sm mt-2">
                  Add investments to start building your portfolio.
                </p>
              </div>
            </section>
          ) : (
            <section className="mb-24">
              <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 overflow-hidden">
                {groups.map((group, groupIndex) => {
                  const isExpanded = expandedGroup === group.type

                  return (
                    <div
                      key={group.type}
                      className={
                        groupIndex !== groups.length - 1
                          ? "border-b border-white/5"
                          : ""
                      }
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedGroup((prev) =>
                            prev === group.type ? null : group.type
                          )
                        }
                        className="w-full flex items-center justify-between gap-4 px-5 py-5 text-left transition-colors duration-200 ease-out hover:bg-white/[0.02]"
                      >
                        <div className="min-w-0">
                          <p className="text-zinc-200 font-medium">
                            {group.label}
                          </p>

                          {!isExpanded && (
                            <p className="text-xs text-zinc-600 mt-1">
                              {group.holdings.length} holding
                              {group.holdings.length === 1 ? "" : "s"}
                            </p>
                          )}
                        </div>

                        {!isExpanded && (
                          <div className="text-right shrink-0">
                            <p className="text-zinc-300 text-sm font-medium">
                              {formatCurrency(group.currentValue, currency)}
                            </p>
                            <p
                              className={`text-xs mt-1 ${
                                group.profitPct >= 0
                                  ? "text-green-500"
                                  : "text-red-500"
                              }`}
                            >
                              {group.profitPct >= 0 ? "+" : ""}
                              {group.profitPct.toFixed(1)}%
                            </p>
                          </div>
                        )}

                        <span className="text-zinc-500 text-lg">
                          {isExpanded ? "⌃" : "⌄"}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="px-5 pb-5">
                          <div className="space-y-1">
                            {group.holdings.map((holding) => (
                              <button
                                key={holding.key}
                                type="button"
                                onClick={() => openHoldingDetail(holding)}
                                className="w-full flex items-center justify-between gap-4 py-3 text-left transition-colors duration-200 ease-out hover:bg-white/[0.02]"
                              >
                                <div className="min-w-0">
                                  <p className="text-zinc-200 truncate">
                                    {holding.name}
                                  </p>
                                </div>

                                <div className="text-right shrink-0">
                                  <p className="text-zinc-300 text-sm font-medium">
                                    {formatCurrency(
                                      holding.currentValue,
                                      currency
                                    )}
                                  </p>
                                  <p
                                    className={`text-xs mt-1 ${
                                      holding.profitPct >= 0
                                        ? "text-green-500"
                                        : "text-red-500"
                                    }`}
                                  >
                                    {holding.profitPct >= 0 ? "+" : ""}
                                    {holding.profitPct.toFixed(1)}%
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      {isDetailOpen && selectedHolding && (
        <div
          className="fixed inset-0 z-50 bg-black/60 animate-[modalOverlayEnter_150ms_ease-out]"
          onClick={closeHoldingDetail}
        >
          <div className="absolute inset-0 flex items-end md:items-center md:justify-center p-3 md:p-6">
            <div
              className="w-full md:max-w-lg rounded-t-[30px] md:rounded-[30px] bg-zinc-900/95 border border-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] p-4 md:p-5 animate-[modalContentEnter_180ms_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-white text-sm font-medium">Holding detail</p>

                <button
                  type="button"
                  onClick={closeHoldingDetail}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors duration-200 ease-out cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {selectedHolding.name}
                    </h2>

                    {selectedHolding.ticker && (
                      <span className="text-xs text-zinc-600 uppercase">
                        {selectedHolding.ticker}
                      </span>
                    )}
                  </div>

                  <p className="text-zinc-500 text-sm mt-2">
                    {formatAssetType(selectedHolding.type)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[22px] bg-zinc-800/50 border border-white/5 p-4">
                    <p className="text-zinc-500 text-xs mb-2">Invested</p>
                    <p className="text-white text-sm font-medium">
                      {formatCurrency(selectedHolding.invested, currency)}
                    </p>
                  </div>

                  <div className="rounded-[22px] bg-zinc-800/50 border border-white/5 p-4">
                    <p className="text-zinc-500 text-xs mb-2">Performance</p>
                    <p
                      className={`text-sm font-medium ${
                        selectedHolding.profitPct >= 0
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                    >
                      {selectedHolding.profitPct >= 0 ? "+" : ""}
                      {selectedHolding.profitPct.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-500 mb-2 block">
                    Current value
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    className={fieldClass}
                  />
                </div>

                <div className="rounded-[22px] bg-zinc-800/40 border border-white/5 p-4">
                  <p className="text-zinc-500 text-xs mb-2">Profit / Loss</p>
                  <p
                    className={`text-sm font-medium ${
                      selectedHolding.profit >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {formatCurrency(selectedHolding.profit, currency)}
                  </p>
                </div>

                {error && <p className="text-sm text-red-500 pt-1">{error}</p>}

                <button
                  type="button"
                  onClick={openInvestMore}
                  className="w-full rounded-full bg-[var(--accent)] text-black h-[50px] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98] cursor-pointer touch-manipulation mt-1"
                >
                  Invest more
                </button>

                <button
                  type="button"
                  onClick={handleSaveHolding}
                  className="w-full text-center text-zinc-400 text-sm py-1.5 transition-colors duration-200 ease-out hover:text-white cursor-pointer"
                >
                  Save holding
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isInvestMoreOpen && selectedHolding && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 animate-[modalOverlayEnter_150ms_ease-out]"
          onClick={closeInvestMore}
        >
          <div className="absolute inset-0 flex items-end md:items-center md:justify-center p-3 md:p-6">
            <div
              className="w-full md:max-w-lg rounded-t-[30px] md:rounded-[30px] bg-zinc-900/95 border border-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] p-4 md:p-5 animate-[modalContentEnter_180ms_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-white text-sm font-medium">
                  Invest more in {selectedHolding.name}
                </p>

                <button
                  type="button"
                  onClick={closeInvestMore}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors duration-200 ease-out cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-3">
                <input
                  placeholder="Amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={investMoreAmount}
                  onChange={(e) => setInvestMoreAmount(e.target.value)}
                  className={fieldClass}
                />

                <input
                  type="date"
                  value={investMoreDate}
                  onChange={(e) => setInvestMoreDate(e.target.value)}
                  className={fieldClass}
                />

                {error && <p className="text-sm text-red-500 pt-1">{error}</p>}

                <button
                  type="button"
                  onClick={handleInvestMore}
                  className="w-full rounded-full bg-[var(--accent)] text-black h-[50px] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98] cursor-pointer touch-manipulation mt-1"
                >
                  Add contribution
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}