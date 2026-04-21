"use client"

import { useEffect, useMemo, useState } from "react"
import { useCurrency } from "@/context/currency-context"
import type { AutomationTemplate } from "@/lib/spending-automation"
import {
  type SimulatorAdjustment,
  type SimulatorPeriodOption,
  buildFutureSummaries,
  getCurrentCashFromEntries,
  getSimulatorStatus,
} from "@/lib/future-simulator"

type Entry = {
  id: string
  description: string
  amount: number
  type: "income" | "expense"
  date?: string
  category?: string
}

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function getTodayDate() {
  return new Date().toISOString().split("T")[0]
}

function formatMonthLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(date))
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

export default function FutureSimulatorPage() {
  const { currency } = useCurrency()

  const [entries, setEntries] = useState<Entry[]>([])
  const [templates, setTemplates] = useState<AutomationTemplate[]>([])
  const [adjustments, setAdjustments] = useState<SimulatorAdjustment[]>([])
  const [hydrated, setHydrated] = useState(false)

  const [period, setPeriod] = useState<SimulatorPeriodOption>("3M")

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAdjustmentId, setEditingAdjustmentId] = useState<string | null>(
    null
  )
  const [adjustmentType, setAdjustmentType] = useState<"income" | "expense">(
    "expense"
  )
  const [adjustmentAmount, setAdjustmentAmount] = useState("")
  const [adjustmentDate, setAdjustmentDate] = useState(getTodayDate())
  const [adjustmentNote, setAdjustmentNote] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    try {
      const savedEntries = localStorage.getItem("entries")
      const savedTemplates = localStorage.getItem("automationTemplates")
      const savedAdjustments = localStorage.getItem("futureSimulatorAdjustments")

      if (savedEntries) {
        const parsedEntries = JSON.parse(savedEntries)
        setEntries(Array.isArray(parsedEntries) ? parsedEntries : [])
      }

      if (savedTemplates) {
        const parsedTemplates = JSON.parse(savedTemplates)
        setTemplates(Array.isArray(parsedTemplates) ? parsedTemplates : [])
      }

      if (savedAdjustments) {
        const parsedAdjustments = JSON.parse(savedAdjustments)
        setAdjustments(Array.isArray(parsedAdjustments) ? parsedAdjustments : [])
      }
    } catch {
      setEntries([])
      setTemplates([])
      setAdjustments([])
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return

    try {
      localStorage.setItem(
        "futureSimulatorAdjustments",
        JSON.stringify(adjustments)
      )
    } catch {
      // silent
    }
  }, [adjustments, hydrated])

  const currentCash = useMemo(() => {
    return getCurrentCashFromEntries(
      entries.map((entry) => ({
        type: entry.type,
        amount: entry.amount,
      }))
    )
  }, [entries])

  const summaries = useMemo(() => {
    return buildFutureSummaries({
      templates,
      adjustments,
      period,
      fromDate: new Date(),
    })
  }, [templates, adjustments, period])

  const totalProjectedChange = useMemo(() => {
    return summaries.reduce((sum, month) => sum + month.netChange, 0)
  }, [summaries])

  const finalRemaining = currentCash + totalProjectedChange
  const statusMessage = getSimulatorStatus(totalProjectedChange)

  const hasBaseData = entries.length > 0 || templates.length > 0
  const hasAnyData = hasBaseData || adjustments.length > 0

  const visibleAdjustments = useMemo(() => {
    return [...adjustments].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  }, [adjustments])

  const resetModal = () => {
    setEditingAdjustmentId(null)
    setAdjustmentType("expense")
    setAdjustmentAmount("")
    setAdjustmentDate(getTodayDate())
    setAdjustmentNote("")
    setError("")
  }

  const openCreateModal = () => {
    resetModal()
    setIsModalOpen(true)
  }

  const openEditModal = (adjustment: SimulatorAdjustment) => {
    setEditingAdjustmentId(adjustment.id)
    setAdjustmentType(adjustment.type)
    setAdjustmentAmount(String(adjustment.amount))
    setAdjustmentDate(adjustment.date)
    setAdjustmentNote(adjustment.note || "")
    setError("")
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    resetModal()
  }

  const handleSaveAdjustment = () => {
    const parsedAmount = Number(adjustmentAmount)

    if (!adjustmentAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount.")
      return
    }

    if (!adjustmentDate) {
      setError("Please select a date.")
      return
    }

    const now = new Date().toISOString()

    if (editingAdjustmentId) {
      setAdjustments((prev) =>
        prev.map((adjustment) =>
          adjustment.id === editingAdjustmentId
            ? {
                ...adjustment,
                type: adjustmentType,
                amount: parsedAmount,
                date: adjustmentDate,
                note: adjustmentNote.trim() || undefined,
                updatedAt: now,
              }
            : adjustment
        )
      )
    } else {
      const newAdjustment: SimulatorAdjustment = {
        id: generateId(),
        type: adjustmentType,
        amount: parsedAmount,
        date: adjustmentDate,
        note: adjustmentNote.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      }

      setAdjustments((prev) => [newAdjustment, ...prev])
    }

    closeModal()
  }

  const handleDeleteAdjustment = () => {
    if (!editingAdjustmentId) return

    setAdjustments((prev) =>
      prev.filter((adjustment) => adjustment.id !== editingAdjustmentId)
    )
    closeModal()
  }

  return (
    <>
      <main className="min-h-screen bg-black text-white px-5 py-8 pb-32">
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">
              Future balance
            </h1>
            <p className="text-zinc-500 mt-2">
              See how your money evolves over time.
            </p>
          </header>

          <section className="mb-8">
            <div className="rounded-full bg-zinc-900/45 border border-white/5 p-1.5">
              <div className="grid grid-cols-4 gap-1.5">
                {(["1M", "3M", "6M", "12M"] as SimulatorPeriodOption[]).map(
                  (option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPeriod(option)}
                      className={`h-[42px] rounded-full text-sm transition-all duration-150 ease-out ${
                        period === option
                          ? "bg-[var(--accent)]/90 text-black"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {option}
                    </button>
                  )
                )}
              </div>
            </div>
          </section>

          {!hasAnyData ? (
            <section className="mb-10">
              <div className="rounded-[28px] bg-zinc-900/45 border border-white/5 p-6">
                <p className="text-zinc-200 text-sm">No data to simulate yet.</p>
                <p className="text-zinc-600 text-sm mt-2">
                  Add transactions or adjustments to begin.
                </p>
              </div>
            </section>
          ) : (
            <>
              <section className="mb-6">
                <div className="rounded-[30px] bg-zinc-900/72 border border-white/5 shadow-[0_14px_40px_rgba(0,0,0,0.28)] p-8">
                  <p className="text-zinc-600 text-sm mb-3">
                    In {period.replace("M", "")} month
                    {period === "1M" ? "" : "s"}
                  </p>

                  <h2 className="text-5xl font-semibold tracking-tight">
                    {formatCurrency(finalRemaining, currency)}
                  </h2>

                  <p className="mt-5 text-sm text-zinc-400">{statusMessage}</p>
                </div>
              </section>

              <section className="mb-8">
                <div className="rounded-[26px] bg-zinc-900/45 border border-white/5 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-zinc-300 text-sm font-medium">
                        Adjustments
                      </p>
                      <p className="text-zinc-500 text-sm mt-1">
                        Simulate one-time future changes.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="relative z-10 select-none shrink-0 inline-flex items-center justify-center rounded-full bg-[var(--accent)]/88 text-black px-4 py-3 text-sm font-medium transition-all duration-200 ease-out hover:bg-[var(--accent)] active:scale-[0.98]"
                    >
                      + Add adjustment
                    </button>
                  </div>
                </div>
              </section>

              {visibleAdjustments.length > 0 && (
                <section className="mb-10">
                  <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 overflow-hidden">
                    {visibleAdjustments.map((adjustment, index) => (
                      <button
                        key={adjustment.id}
                        type="button"
                        onClick={() => openEditModal(adjustment)}
                        className={`w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-200 ease-out hover:bg-white/[0.02] ${
                          index !== visibleAdjustments.length - 1
                            ? "border-b border-white/5"
                            : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-zinc-200 truncate">
                            {adjustment.note?.trim() || "Adjustment"}
                          </p>
                          <p className="text-xs text-zinc-600 mt-2">
                            {formatMonthLabel(adjustment.date)}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 text-sm font-medium ${
                            adjustment.type === "income"
                              ? "text-green-500"
                              : "text-red-500"
                          }`}
                        >
                          {adjustment.type === "income" ? "+" : "-"}
                          {formatCurrency(adjustment.amount, currency)}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="mb-24">
                <div className="mb-4">
                  <p className="text-zinc-400 text-sm font-medium">
                    Monthly breakdown
                  </p>
                </div>

                <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 overflow-hidden">
                  {summaries.map((month, index) => (
                    <div
                      key={month.periodKey}
                      className={`flex items-center justify-between gap-4 px-5 py-5 ${
                        index !== summaries.length - 1
                          ? "border-b border-white/5"
                          : ""
                      }`}
                    >
                      <span className="text-zinc-300 font-medium">
                        {month.label}
                      </span>

                      <span
                        className={`shrink-0 text-base font-medium ${
                          month.netChange > 0
                            ? "text-green-500"
                            : month.netChange < 0
                            ? "text-red-500"
                            : "text-zinc-400"
                        }`}
                      >
                        {month.netChange > 0 ? "+" : ""}
                        {formatCurrency(month.netChange, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={closeModal}>
          <div className="absolute inset-0 flex items-end md:items-center md:justify-center p-3 md:p-6">
            <div
              className="w-full md:max-w-lg rounded-t-[30px] md:rounded-[30px] bg-zinc-900/95 border border-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] p-4 md:p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-white text-sm font-medium">
                  {editingAdjustmentId ? "Edit adjustment" : "New adjustment"}
                </p>

                <button
                  type="button"
                  onClick={closeModal}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors duration-200 ease-out"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType("expense")}
                    className={`flex-1 rounded-full h-[44px] text-sm border transition-all duration-200 ease-out ${
                      adjustmentType === "expense"
                        ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                        : "bg-zinc-800/80 border-white/5 text-zinc-400"
                    }`}
                  >
                    Expense
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustmentType("income")}
                    className={`flex-1 rounded-full h-[44px] text-sm border transition-all duration-200 ease-out ${
                      adjustmentType === "income"
                        ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                        : "bg-zinc-800/80 border-white/5 text-zinc-400"
                    }`}
                  >
                    Income
                  </button>
                </div>

                <input
                  placeholder="Amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  className="w-full h-[46px] min-h-[46px] appearance-none bg-zinc-800/70 border border-white/5 rounded-[18px] px-4 text-white outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/25 transition-colors"
                />

                <input
                  type="date"
                  value={adjustmentDate}
                  onChange={(e) => setAdjustmentDate(e.target.value)}
                  className="w-full h-[46px] min-h-[46px] appearance-none bg-zinc-800/70 border border-white/5 rounded-[18px] px-4 text-white outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/25 transition-colors"
                />

                <input
                  placeholder="Optional note"
                  value={adjustmentNote}
                  onChange={(e) => setAdjustmentNote(e.target.value)}
                  className="w-full h-[46px] min-h-[46px] appearance-none bg-zinc-800/70 border border-white/5 rounded-[18px] px-4 text-white outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/25 transition-colors"
                />

                {error && <p className="text-sm text-red-500">{error}</p>}

                <button
                  type="button"
                  onClick={handleSaveAdjustment}
                  className="w-full rounded-full bg-[var(--accent)] text-black h-[50px] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98]"
                >
                  Save adjustment
                </button>

                {editingAdjustmentId && (
                  <button
                    type="button"
                    onClick={handleDeleteAdjustment}
                    className="w-full text-center text-red-400 text-xs py-1 transition-colors duration-200 ease-out hover:text-red-300"
                  >
                    Delete adjustment
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