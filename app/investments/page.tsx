"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useCurrency } from "@/context/currency-context"

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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState("")

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

  const profitTone =
    totals.profit > 0
      ? "text-green-500"
      : totals.profit < 0
      ? "text-red-500"
      : "text-zinc-300"

  return (
    <>
      <main className="min-h-screen bg-black text-white px-5 py-8 pb-32">
        <div className="max-w-4xl mx-auto">
          <header className="mb-9">
            <h1 className="text-3xl font-semibold tracking-tight">Investments</h1>
            <p className="text-zinc-500 mt-2">Track your portfolio clearly.</p>
          </header>

          <section className="grid md:grid-cols-3 gap-4 mb-5">
            <div className="rounded-[26px] bg-zinc-900/55 border border-white/5 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
              <p className="text-zinc-500 text-sm mb-2">Invested</p>
              <p className="text-2xl font-semibold">
                {formatCurrency(totals.investedTotal, currency)}
              </p>
              <p className="text-xs text-zinc-600 mt-2">Total capital</p>
            </div>

            <div className="rounded-[26px] bg-zinc-900/72 border border-white/5 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
              <p className="text-zinc-500 text-sm mb-2">Current Value</p>
              <p className="text-[30px] leading-none font-semibold tracking-tight">
                {formatCurrency(totals.currentTotal, currency)}
              </p>
              <p className="text-xs text-zinc-600 mt-2">Portfolio value</p>
            </div>

            <div className="rounded-[26px] bg-zinc-900/55 border border-white/5 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
              <p className="text-zinc-500 text-sm mb-2">Profit</p>
              <p className={`text-2xl font-semibold ${profitTone}`}>
                {formatCurrency(totals.profit, currency)} (
                {totals.profitPct.toFixed(1)}%)
              </p>
              <p className="text-xs text-zinc-600 mt-2">Overall result</p>
            </div>
          </section>

          <section className="mb-8">
            <div className="rounded-[24px] bg-zinc-900/35 border border-white/5 px-5 py-4">
              <p className="text-sm text-zinc-300">{portfolioInsight}</p>
            </div>
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
                  className="relative z-10 select-none shrink-0 inline-flex items-center justify-center rounded-full bg-[var(--accent)] text-black px-4 py-3 text-sm font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-95 cursor-pointer touch-manipulation shadow-[0_4px_16px_rgba(245,166,35,0.14)]"
                >
                  + Add asset
                </button>
              </div>
            </div>
          </section>

          <section className="mb-24">
            <div className="mb-4">
              <p className="text-zinc-500 text-sm mb-4">Portfolio</p>

              <div className="flex flex-col gap-4 mb-4">
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

                <input
                  placeholder="Search assets"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-zinc-900/40 border border-white/5 rounded-[22px] px-4 py-4 outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
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
                      className={`w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-200 ease-out hover:bg-white/[0.02] active:scale-[0.99] ${
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

                        <div className="flex items-center gap-2 mt-1 text-xs text-zinc-600 flex-wrap">
                          <span>{formatAssetType(asset.type)}</span>
                          <span>•</span>
                          <span>
                            Invested {formatCurrency(asset.invested, currency)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-zinc-300 text-sm">
                          {formatCurrency(asset.currentValue, currency)}
                        </p>
                        <p
                          className={`text-sm ${
                            profit > 0
                              ? "text-green-500"
                              : profit < 0
                              ? "text-red-500"
                              : "text-zinc-400"
                          }`}
                        >
                          {formatCurrency(profit, currency)} ({pct.toFixed(1)}%)
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
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
            <Link href="/investments" className="relative text-white font-medium py-2">
              <span>Investments</span>
              <span className="absolute left-1/2 top-full mt-0.5 h-1 w-6 -translate-x-1/2 rounded-full bg-[var(--accent)]" />
            </Link>
            <Link
              href="/settings"
              className="text-zinc-500 hover:text-white transition-colors duration-200 ease-out py-2"
            >
              Settings
            </Link>
          </div>
        </nav>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={closeModal}>
          <div className="absolute inset-0 flex items-end md:items-center md:justify-center p-3 md:p-6">
            <div
              className="w-full md:max-w-lg rounded-t-[30px] md:rounded-[30px] bg-zinc-900/95 border border-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] p-4 md:p-5"
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
                  className="w-full rounded-full bg-[var(--accent)] text-black h-[50px] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-95 cursor-pointer touch-manipulation mt-1"
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