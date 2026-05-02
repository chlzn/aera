"use client"

import { useEffect, useMemo, useState } from "react"
import { useCurrency } from "@/context/currency-context"
import {
  formatPeriodLabel,
  getAvailablePeriodsFromCurrentYear,
  getCurrentPeriodKey,
  isSamePeriod,
} from "@/lib/period"
import {
  type AutomationTemplate,
  type EntryCategory,
  type EntryType,
  type PaymentBehavior,
  generateEntriesForPeriod,
} from "@/lib/spending-automation"

type Entry = {
  id: string
  description: string
  amount: number
  type: EntryType
  category: EntryCategory
  date: string
  accountId: string
  createdAt: string
  updatedAt: string
}

type DisplayEntry = Entry & {
  source: "manual" | "automation"
  templateId?: string
  automationKind?: "recurring" | "installment"
  automationLabel?: string
  paymentBehavior?: PaymentBehavior
}

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(date: string) {
  if (!date) return "No date"
  const [year, month, day] = date.split("-").map(Number)

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day))
}

function formatCategory(category: string) {
  return category
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

function isDue(date: string) {
  return date <= getTodayDate()
}

export default function SpendingCategoriesPage() {
  const { currency } = useCurrency()

  const [entries, setEntries] = useState<Entry[]>([])
  const [templates, setTemplates] = useState<AutomationTemplate[]>([])
  const [paidScheduledIds, setPaidScheduledIds] = useState<string[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriodKey())
  const [expandedCategory, setExpandedCategory] =
    useState<EntryCategory | null>(null)

  useEffect(() => {
    try {
      const savedEntries = localStorage.getItem("entries")
      const savedTemplates = localStorage.getItem("automationTemplates")
      const savedPaidScheduledIds = localStorage.getItem("paidScheduledPayments")

      if (savedEntries) {
        const parsedEntries = JSON.parse(savedEntries)
        setEntries(Array.isArray(parsedEntries) ? parsedEntries : [])
      }

      if (savedTemplates) {
        const parsedTemplates = JSON.parse(savedTemplates)
        setTemplates(Array.isArray(parsedTemplates) ? parsedTemplates : [])
      }

      if (savedPaidScheduledIds) {
        const parsedPaidScheduledIds = JSON.parse(savedPaidScheduledIds)
        setPaidScheduledIds(
          Array.isArray(parsedPaidScheduledIds) ? parsedPaidScheduledIds : []
        )
      }
    } catch {
      setEntries([])
      setTemplates([])
      setPaidScheduledIds([])
    }
  }, [])

  const availablePeriods = useMemo(() => {
    return getAvailablePeriodsFromCurrentYear()
  }, [])

  const manualPeriodEntries = useMemo<DisplayEntry[]>(() => {
    return entries
      .filter((entry) => isSamePeriod(entry.date, selectedPeriod))
      .map((entry) => ({
        ...entry,
        source: "manual" as const,
      }))
  }, [entries, selectedPeriod])

  const generatedPeriodEntries = useMemo<DisplayEntry[]>(() => {
    return generateEntriesForPeriod(templates, selectedPeriod).map((entry) => ({
      ...entry,
      source: "automation" as const,
    }))
  }, [templates, selectedPeriod])

  const confirmedGeneratedEntries = useMemo(() => {
    return generatedPeriodEntries.filter((entry) => {
      const behavior = entry.paymentBehavior || "manual"

      if (behavior === "auto_paid") {
        return isDue(entry.date)
      }

      return paidScheduledIds.includes(entry.id)
    })
  }, [generatedPeriodEntries, paidScheduledIds])

  const periodEntries = useMemo<DisplayEntry[]>(() => {
    return [...manualPeriodEntries, ...confirmedGeneratedEntries].sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date)
      if (dateDiff !== 0) return dateDiff
      return b.createdAt.localeCompare(a.createdAt)
    })
  }, [manualPeriodEntries, confirmedGeneratedEntries])

  const spendingGroups = useMemo(() => {
    const expenseEntries = periodEntries.filter(
      (entry) => entry.type === "expense"
    )

    const totals = expenseEntries.reduce<
      Record<EntryCategory, { total: number; entries: DisplayEntry[] }>
    >((acc, entry) => {
      if (!acc[entry.category]) {
        acc[entry.category] = {
          total: 0,
          entries: [],
        }
      }

      acc[entry.category].total += entry.amount
      acc[entry.category].entries.push(entry)

      return acc
    }, {} as Record<EntryCategory, { total: number; entries: DisplayEntry[] }>)

    return Object.entries(totals)
      .map(([categoryName, data]) => ({
        category: categoryName as EntryCategory,
        total: data.total,
        entries: data.entries.sort((a, b) => b.date.localeCompare(a.date)),
      }))
      .filter((group) => group.category !== "other")
      .sort((a, b) => b.total - a.total)
  }, [periodEntries])

  return (
    <main className="min-h-screen bg-black text-white px-5 py-8 pb-32">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Spending groups
          </h1>
          <p className="text-zinc-500 mt-2">
            See your monthly spending by category.
          </p>
        </header>

        <section className="mb-8">
          <div className="relative">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full appearance-none bg-zinc-900/75 border border-white/12 rounded-[24px] px-4 py-4 pr-12 text-white outline-none shadow-[0_6px_18px_rgba(0,0,0,0.16)] transition-all duration-200 ease-out hover:bg-zinc-900/90 active:scale-[0.995]"
            >
              {availablePeriods.map((period) => (
                <option key={period} value={period}>
                  {formatPeriodLabel(period)}
                </option>
              ))}
            </select>

            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--accent)] text-lg">
              ⌄
            </span>
          </div>
        </section>

        {spendingGroups.length === 0 ? (
          <section className="mb-10">
            <div className="rounded-[28px] bg-zinc-900/45 border border-white/5 p-6">
              <p className="text-zinc-200 text-sm">
                No confirmed expenses in this period.
              </p>
              <p className="text-zinc-600 text-sm mt-2">
                Paid transactions will appear grouped here.
              </p>
            </div>
          </section>
        ) : (
          <section className="mb-24">
            <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 overflow-hidden">
              {spendingGroups.map((group, index) => {
                const isExpanded = expandedCategory === group.category

                return (
                  <div
                    key={group.category}
                    className={
                      index !== spendingGroups.length - 1
                        ? "border-b border-white/5"
                        : ""
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCategory((prev) =>
                          prev === group.category ? null : group.category
                        )
                      }
                      className="w-full flex items-center justify-between gap-4 px-5 py-5 text-left transition-colors duration-200 ease-out hover:bg-white/[0.02]"
                    >
                      <div className="min-w-0">
                        <p className="text-zinc-200 font-medium">
                          {formatCategory(group.category)}
                        </p>

                        {!isExpanded && (
                          <p className="text-xs text-zinc-600 mt-1">
                            {group.entries.length} transaction
                            {group.entries.length === 1 ? "" : "s"}
                          </p>
                        )}
                      </div>

                      {!isExpanded && (
                        <div className="text-right shrink-0">
                          <p className="text-zinc-300 text-sm font-medium">
                            {formatCurrency(group.total, currency)}
                          </p>
                        </div>
                      )}

                      <span className="text-[var(--accent)] text-lg">
                        {isExpanded ? "⌃" : "⌄"}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5">
                        <div className="mb-4">
                          <p className="text-zinc-500 text-xs">
                            Total this month
                          </p>
                          <p className="text-white text-lg font-medium mt-1">
                            {formatCurrency(group.total, currency)}
                          </p>
                        </div>

                        <div className="space-y-1">
                          {group.entries.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between gap-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="text-zinc-200 text-sm truncate">
                                  {entry.description}
                                </p>
                                <p className="text-xs text-zinc-600 mt-1">
                                  {formatDate(entry.date)}
                                </p>
                              </div>

                              <span className="text-red-500 text-sm font-medium shrink-0">
                                -{formatCurrency(entry.amount, currency)}
                              </span>
                            </div>
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
  )
}