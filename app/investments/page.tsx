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

type Investment = {
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

export default function Investments() {
  const { currency } = useCurrency()

  const [assets, setAssets] = useState<Investment[]>([])
  const [assetsHydrated, setAssetsHydrated] = useState(false)

  const [name, setName] = useState("")
  const [type, setType] = useState<AssetType>("crypto")
  const [invested, setInvested] = useState("")
  const [currentValue, setCurrentValue] = useState("")
  const [ticker, setTicker] = useState("")
  const [notes, setNotes] = useState("")

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | AssetType>("all")
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriodKey())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState("")
  const [isPortfolioOpen, setIsPortfolioOpen] = useState(true)
  const [isMonthlyOpen, setIsMonthlyOpen] = useState(false)

  useEffect(() => {
    try {
      const savedAssets = localStorage.getItem("investments")
      if (savedAssets) {
        const parsed = JSON.parse(savedAssets)
        setAssets(Array.isArray(parsed) ? parsed : [])
      }
    } catch {
      setAssets([])
    } finally {
      setAssetsHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!assetsHydrated) return

    try {
      localStorage.setItem("investments", JSON.stringify(assets))
    } catch {
      // silent
    }
  }, [assets, assetsHydrated])

  const availablePeriods = useMemo(() => {
    return getAvailablePeriodsFromCurrentYear()
  }, [])

  const totals = useMemo(() => {
    const investedTotal = assets.reduce((acc, asset) => acc + asset.invested, 0)
    const currentTotal = assets.reduce(
      (acc, asset) => acc + asset.currentValue,
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
  }, [assets])

  const periodAssets = useMemo(() => {
    return assets.filter((asset) => isSamePeriod(asset.createdAt, selectedPeriod))
  }, [assets, selectedPeriod])

  const periodInvested = periodAssets.reduce(
    (acc, asset) => acc + asset.invested,
    0
  )

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesFilter = filter === "all" ? true : asset.type === filter
      const query = search.toLowerCase()

      const matchesSearch =
        asset.name.toLowerCase().includes(query) ||
        asset.type.toLowerCase().includes(query) ||
        asset.ticker?.toLowerCase().includes(query)

      return matchesFilter && matchesSearch
    })
  }, [assets, filter, search])

  const filteredPeriodAssets = useMemo(() => {
    return periodAssets.filter((asset) => {
      const query = search.toLowerCase()

      const matchesSearch =
        asset.name.toLowerCase().includes(query) ||
        asset.type.toLowerCase().includes(query) ||
        asset.ticker?.toLowerCase().includes(query)

      return matchesSearch
    })
  }, [periodAssets, search])

  const portfolioInsight = useMemo(() => {
    if (assets.length === 0) {
      return "No data yet — add your first asset to start tracking performance."
    }

    if (totals.profit > 0) {
      return "Your portfolio is above your invested capital."
    }

    if (totals.profit < 0) {
      return "Your portfolio is currently below your invested capital."
    }

    return "Your portfolio is currently flat."
  }, [assets.length, totals.profit])

  const resetForm = () => {
    setName("")
    setType("crypto")
    setInvested("")
    setCurrentValue("")
    setTicker("")
    setNotes("")
    setEditingId(null)
    setError("")
  }

  const openCreateModal = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const openEditModal = (asset: Investment) => {
    setName(asset.name)
    setType(asset.type)
    setInvested(String(asset.invested))
    setCurrentValue(String(asset.currentValue))
    setTicker(asset.ticker || "")
    setNotes(asset.notes || "")
    setEditingId(asset.id)
    setError("")
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    resetForm()
  }

  const handleSubmit = () => {
    const investedNumber = Number(invested)
    const currentValueNumber = Number(currentValue)

    if (!name.trim()) {
      setError("Please add an asset name.")
      return
    }

    if (!invested || Number.isNaN(investedNumber) || investedNumber < 0) {
      setError("Please enter a valid invested amount.")
      return
    }

    if (
      !currentValue ||
      Number.isNaN(currentValueNumber) ||
      currentValueNumber < 0
    ) {
      setError("Please enter a valid current value.")
      return
    }

    const now = new Date().toISOString()

    if (editingId) {
      setAssets((prev) =>
        prev.map((asset) =>
          asset.id === editingId
            ? {
                ...asset,
                name: name.trim(),
                type,
                invested: investedNumber,
                currentValue: currentValueNumber,
                ticker: ticker.trim() || undefined,
                notes: notes.trim() || undefined,
                updatedAt: now,
              }
            : asset
        )
      )
    } else {
      const newAsset: Investment = {
        id: generateId(),
        name: name.trim(),
        type,
        invested: investedNumber,
        currentValue: currentValueNumber,
        ticker: ticker.trim() || undefined,
        notes: notes.trim() || undefined,
        accountId: "main",
        createdAt: now,
        updatedAt: now,
      }

      setAssets((prev) => [newAsset, ...prev])
    }

    closeModal()
  }

  const handleDelete = () => {
    if (!editingId) return
    setAssets((prev) => prev.filter((asset) => asset.id !== editingId))
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
                <p className="text-zinc-300 text-sm font-medium">
                  Add a new asset
                </p>

                <button
                  type="button"
                  onClick={openCreateModal}
                  className="relative z-10 select-none shrink-0 inline-flex items-center justify-center rounded-full bg-[var(--accent)] text-black px-4 py-3 text-sm font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98] cursor-pointer touch-manipulation shadow-[0_4px_16px_rgba(245,166,35,0.14)]"
                >
                  + Add asset
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

                {filteredAssets.length === 0 ? (
                  <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 p-6">
                    <p className="text-zinc-300 text-sm">No investments yet.</p>
                    <p className="text-zinc-600 text-sm mt-1">
                      Start by adding your first asset.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 overflow-hidden">
                    {filteredAssets.map((asset, index) => {
                      const profit = asset.currentValue - asset.invested
                      const pct =
                        asset.invested > 0 ? (profit / asset.invested) * 100 : 0

                      return (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => openEditModal(asset)}
                          className={`w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-200 ease-out hover:bg-white/[0.02] active:scale-[0.995] ${
                            index !== filteredAssets.length - 1
                              ? "border-b border-white/5"
                              : ""
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-zinc-200 truncate">{asset.name}</p>
                              {asset.ticker && (
                                <span className="text-xs text-zinc-600 uppercase">
                                  {asset.ticker}
                                </span>
                              )}
                            </div>

                            <div className="mt-1">
  <div className="flex items-center gap-2 text-xs text-zinc-600 flex-wrap">
    <span>{formatAssetType(asset.type)}</span>
    <span>•</span>
    <span>Invested {formatCurrency(asset.invested, currency)}</span>
  </div>

  <p
    className={`text-[11px] mt-1 ${
      pct >= 0 ? "text-green-500" : "text-red-500"
    }`}
  >
    {pct >= 0 ? "+" : ""}
    {pct.toFixed(1)}%
  </p>
</div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-zinc-300 text-sm">
                              {formatCurrency(asset.currentValue, currency)}
                            </p>
                          </div>
                        </button>
                      )
                    })}
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

                {filteredPeriodAssets.length === 0 ? (
                  <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 p-6">
                    <p className="text-zinc-300 text-sm">No assets added in this period.</p>
                    <p className="text-zinc-600 text-sm mt-1">
                      Select another month or add a new asset.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 overflow-hidden">
                    {filteredPeriodAssets.map((asset, index) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => openEditModal(asset)}
                        className={`w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-200 ease-out hover:bg-white/[0.02] active:scale-[0.995] ${
                          index !== filteredPeriodAssets.length - 1
                            ? "border-b border-white/5"
                            : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-zinc-200 truncate">{asset.name}</p>
                            {asset.ticker && (
                              <span className="text-xs text-zinc-600 uppercase">
                                {asset.ticker}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-600 flex-wrap">
                            <span>{formatAssetType(asset.type)}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-zinc-300 text-sm">
                            {formatCurrency(asset.invested, currency)}
                          </p>
                        </div>
                      </button>
                    ))}
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
                <p className="text-zinc-400 text-sm">
                  {editingId ? "Edit Asset" : "New Asset"}
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
                  placeholder="Invested"
                  type="number"
                  min="0"
                  step="0.01"
                  value={invested}
                  onChange={(e) => setInvested(e.target.value)}
                  className={fieldClass}
                />

                <input
                  placeholder="Current value"
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
                  {editingId ? "Save asset" : "Add asset"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full text-center text-red-400 text-xs py-1.5 mt-1 transition-colors duration-200 ease-out hover:text-red-300 cursor-pointer"
                  >
                    Delete asset
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