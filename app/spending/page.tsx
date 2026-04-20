"use client"

import { useEffect, useMemo, useState } from "react"
import { useCurrency } from "@/context/currency-context"
import {
  formatPeriodLabel,
  getAvailablePeriodsFromCurrentYear,
  getCurrentPeriodKey,
  isSamePeriod,
} from "@/lib/period"

type EntryType = "income" | "expense"

type EntryCategory =
  | "salary"
  | "freelance"
  | "bonus"
  | "investment_income"
  | "refund"
  | "housing"
  | "food"
  | "transport"
  | "bills"
  | "subscription"
  | "shopping"
  | "health"
  | "entertainment"
  | "travel"
  | "education"
  | "other"

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

const incomeCategories: { value: EntryCategory; label: string }[] = [
  { value: "salary", label: "Salary" },
  { value: "freelance", label: "Freelance" },
  { value: "bonus", label: "Bonus" },
  { value: "investment_income", label: "Investment Income" },
  { value: "refund", label: "Refund" },
  { value: "other", label: "Other" },
]

const expenseCategories: { value: EntryCategory; label: string }[] = [
  { value: "housing", label: "Housing" },
  { value: "food", label: "Food" },
  { value: "transport", label: "Transport" },
  { value: "bills", label: "Bills" },
  { value: "subscription", label: "Subscription" },
  { value: "shopping", label: "Shopping" },
  { value: "health", label: "Health" },
  { value: "entertainment", label: "Entertainment" },
  { value: "travel", label: "Travel" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
]

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(date: string) {
  if (!date) return "No date"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date))
}

function formatCategory(category: string) {
  return category
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

export default function Spending() {
  const { currency } = useCurrency()

  const [entries, setEntries] = useState<Entry[]>([])
  const [entriesHydrated, setEntriesHydrated] = useState(false)

  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [type, setType] = useState<EntryType>("expense")
  const [category, setCategory] = useState<EntryCategory>("food")
  const [date, setDate] = useState(getTodayDate())

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | EntryType>("all")
  const [categoryFilter, setCategoryFilter] = useState<"all" | EntryCategory>("all")
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriodKey())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    try {
      const savedEntries = localStorage.getItem("entries")
      if (savedEntries) {
        const parsed = JSON.parse(savedEntries)
        setEntries(Array.isArray(parsed) ? parsed : [])
      }
    } catch {
      setEntries([])
    } finally {
      setEntriesHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!entriesHydrated) return

    try {
      localStorage.setItem("entries", JSON.stringify(entries))
    } catch {
      // silent
    }
  }, [entries, entriesHydrated])

  useEffect(() => {
    const defaultCategory =
      type === "income" ? incomeCategories[0].value : expenseCategories[0].value
    setCategory(defaultCategory)
  }, [type])

  useEffect(() => {
    setCategoryFilter("all")
  }, [filter])

  const availablePeriods = useMemo(() => {
    return getAvailablePeriodsFromCurrentYear()
  }, [])

  const periodEntries = useMemo(() => {
    return entries.filter((entry) => isSamePeriod(entry.date, selectedPeriod))
  }, [entries, selectedPeriod])

  const income = periodEntries
    .filter((entry) => entry.type === "income")
    .reduce((acc, entry) => acc + entry.amount, 0)

  const expenses = periodEntries
    .filter((entry) => entry.type === "expense")
    .reduce((acc, entry) => acc + entry.amount, 0)

  const net = income - expenses

  const currentCategories =
    type === "income" ? incomeCategories : expenseCategories

  const availableFilterCategories = useMemo(() => {
    if (filter === "income") return incomeCategories
    if (filter === "expense") return expenseCategories
    return [...incomeCategories, ...expenseCategories]
  }, [filter])

  const filteredEntries = useMemo(() => {
    return periodEntries.filter((entry) => {
      const matchesType = filter === "all" ? true : entry.type === filter
      const matchesCategory =
        categoryFilter === "all" ? true : entry.category === categoryFilter
      const matchesSearch = entry.description
        .toLowerCase()
        .includes(search.toLowerCase())

      return matchesType && matchesCategory && matchesSearch
    })
  }, [periodEntries, filter, categoryFilter, search])

  const categoryTotal = useMemo(() => {
    if (filter !== "expense" || categoryFilter === "all") return 0

    return periodEntries
      .filter(
        (entry) =>
          entry.type === "expense" && entry.category === categoryFilter
      )
      .reduce((sum, entry) => sum + entry.amount, 0)
  }, [filter, categoryFilter, periodEntries])

  const topCategories = useMemo(() => {
    const expenseEntries = periodEntries.filter((entry) => entry.type === "expense")

    if (expenseEntries.length === 0) return []

    const totals = expenseEntries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.category] = (acc[entry.category] || 0) + entry.amount
      return acc
    }, {})

    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [periodEntries])

  const spendingInsight = useMemo(() => {
    if (periodEntries.length === 0) {
      return "No data yet — start tracking to understand your monthly flow."
    }

    if (income <= 0 && expenses > 0) {
      return "You’re tracking spending, but no income has been added yet."
    }

    if (income <= 0 && expenses <= 0) {
      return "No activity yet — add your first transaction to get started."
    }

    const spendingRatio = (expenses / income) * 100

    if (spendingRatio < 50) {
      return "You’re saving most of your income."
    }

    if (spendingRatio < 80) {
      return "Your spending is under control."
    }

    if (spendingRatio <= 100) {
      return "You’re spending most of your income."
    }

    return "You’re spending more than you earn this month."
  }, [periodEntries.length, income, expenses])

  const resetForm = () => {
    setDescription("")
    setAmount("")
    setType("expense")
    setCategory("food")
    setDate(getTodayDate())
    setEditingId(null)
    setError("")
  }

  const openCreateModal = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const openEditModal = (entry: Entry) => {
    setDescription(entry.description)
    setAmount(String(entry.amount))
    setType(entry.type)
    setCategory(entry.category)
    setDate(entry.date)
    setEditingId(entry.id)
    setError("")
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    resetForm()
  }

  const handleSubmit = () => {
    const parsedAmount = Number(amount)

    if (!description.trim()) {
      setError("Please add a description.")
      return
    }

    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount.")
      return
    }

    if (!date) {
      setError("Please select a date.")
      return
    }

    const now = new Date().toISOString()

    if (editingId) {
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === editingId
            ? {
                ...entry,
                description: description.trim(),
                amount: parsedAmount,
                type,
                category,
                date,
                updatedAt: now,
              }
            : entry
        )
      )
    } else {
      const newEntry: Entry = {
        id: generateId(),
        description: description.trim(),
        amount: parsedAmount,
        type,
        category,
        date,
        accountId: "main",
        createdAt: now,
        updatedAt: now,
      }

      setEntries((prev) => [newEntry, ...prev])
    }

    closeModal()
  }

  const handleDelete = () => {
    if (!editingId) return
    setEntries((prev) => prev.filter((entry) => entry.id !== editingId))
    closeModal()
  }

  const fieldClass =
    "w-full h-[46px] min-h-[46px] appearance-none bg-zinc-800/70 border border-white/5 rounded-[18px] px-4 text-white outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/25 transition-colors"

  return (
    <>
      <main className="min-h-screen bg-black text-white px-5 py-8 pb-32">
        <div className="max-w-4xl mx-auto">
          <header className="mb-6">
            <h1 className="text-3xl font-semibold tracking-tight">Spending</h1>
            <p className="text-zinc-500 mt-2">Track your cash flow clearly.</p>
          </header>

          <div className="mb-6">
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
          </div>

          <section className="mb-6">
            <div className="rounded-[30px] bg-zinc-900/72 border border-white/5 shadow-[0_14px_40px_rgba(0,0,0,0.28)] p-8">
              <div>
                <p className="text-zinc-500 text-sm mb-3">
                  {formatPeriodLabel(selectedPeriod)}
                </p>

                <h2 className="text-5xl font-semibold tracking-tight">
                  {formatCurrency(net, currency)}
                </h2>

                <div className="mt-5 flex gap-6 flex-wrap text-sm">
                  <div className="flex flex-col">
                    <span className="text-zinc-500">Income</span>
                    <span className="text-white font-medium">
                      {formatCurrency(income, currency)}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-zinc-500">Expenses</span>
                    <span className="text-white font-medium">
                      {formatCurrency(expenses, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <p className="text-sm text-zinc-400">{spendingInsight}</p>
          </section>

          <section className="mb-8">
            <div className="rounded-[26px] bg-zinc-900/45 border border-white/5 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-zinc-300 text-sm font-medium">
                    Add a new transaction
                  </p>
                  <p className="text-zinc-500 text-sm mt-1">
                    Keep your cash flow updated in seconds.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openCreateModal}
                  className="relative z-10 select-none shrink-0 inline-flex items-center justify-center rounded-full bg-[var(--accent)] text-black px-4 py-3 text-sm font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98] cursor-pointer touch-manipulation shadow-[0_4px_16px_rgba(245,166,35,0.14)]"
                >
                  + Add transaction
                </button>
              </div>
            </div>
          </section>

          {topCategories.length > 0 && (
            <section className="mb-8">
              <p className="text-white text-sm font-medium mb-4">
                Top categories this month
              </p>

              <div className="space-y-3">
                {topCategories.map(([category, total]) => (
                  <div
                    key={category}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-zinc-400 text-sm">
                      {formatCategory(category)}
                    </span>
                    <span className="text-white text-sm font-medium">
                      {formatCurrency(total, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mb-24">
            <button
              type="button"
              onClick={() => setIsHistoryOpen((prev) => !prev)}
              className="w-full flex items-center justify-between mb-4 text-left"
            >
              <p className="text-white text-sm font-medium">Transaction history</p>
              <span className="text-[var(--accent)] text-lg">
                {isHistoryOpen ? "⌃" : "⌄"}
              </span>
            </button>

            {!isHistoryOpen && (
              <p className="text-zinc-600 text-xs mb-4">
                {filteredEntries.length} transactions
              </p>
            )}

            <div
              className={`transition-[max-height,opacity] duration-200 ease-out overflow-hidden ${
                isHistoryOpen ? "max-h-[1600px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="space-y-4">
                <div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value as "all" | EntryType)}
                      className="w-full bg-zinc-900/40 border border-white/5 rounded-[22px] px-4 py-4 outline-none focus:border-[var(--accent)] transition-colors"
                    >
                      <option value="all">All types</option>
                      <option value="income">Income</option>
                      <option value="expense">Expenses</option>
                    </select>

                    <select
                      value={categoryFilter}
                      onChange={(e) =>
                        setCategoryFilter(e.target.value as "all" | EntryCategory)
                      }
                      className="w-full bg-zinc-900/40 border border-white/5 rounded-[22px] px-4 py-4 outline-none focus:border-[var(--accent)] transition-colors"
                    >
                      <option value="all">All categories</option>
                      {availableFilterCategories.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    placeholder="Search transactions"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-zinc-900/40 border border-white/5 rounded-[22px] px-4 py-4 outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>

                {filter === "expense" && categoryFilter !== "all" && (
                  <div>
                    <p className="text-zinc-400 text-xs">
                      {formatCategory(categoryFilter)}
                    </p>
                    <p className="text-white text-lg font-medium mt-1">
                      {formatCurrency(categoryTotal, currency)} this month
                    </p>
                  </div>
                )}

                {filteredEntries.length === 0 ? (
                  <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 p-6">
                    <p className="text-zinc-300 text-sm">
                      No transactions in this period.
                    </p>
                    <p className="text-zinc-600 text-sm mt-1">
                      Select another month or add a new transaction.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 overflow-hidden">
                    {filteredEntries.map((entry, index) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => openEditModal(entry)}
                        className={`w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-200 ease-out hover:bg-white/[0.02] active:scale-[0.995] ${
                          index !== filteredEntries.length - 1
                            ? "border-b border-white/5"
                            : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-zinc-200 truncate">
                            {entry.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-600 flex-wrap">
                            <span>{formatCategory(entry.category)}</span>
                            <span>•</span>
                            <span>{formatDate(entry.date)}</span>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 font-medium text-sm ${
                            entry.type === "income"
                              ? "text-green-500"
                              : "text-red-500"
                          }`}
                        >
                          {entry.type === "income" ? "+" : "-"}
                          {formatCurrency(entry.amount, currency)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
                  {editingId ? "Edit Transaction" : "New Transaction"}
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
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setType("expense")}
                    className={`flex-1 rounded-full h-[50px] border cursor-pointer touch-manipulation transition-all duration-200 ease-out active:scale-[0.98] ${
                      type === "expense"
                        ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                        : "bg-zinc-800/80 border-white/5 text-zinc-400"
                    }`}
                  >
                    Expense
                  </button>

                  <button
                    type="button"
                    onClick={() => setType("income")}
                    className={`flex-1 rounded-full h-[50px] border cursor-pointer touch-manipulation transition-all duration-200 ease-out active:scale-[0.98] ${
                      type === "income"
                        ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                        : "bg-zinc-800/80 border-white/5 text-zinc-400"
                    }`}
                  >
                    Income
                  </button>
                </div>

                <input
                  placeholder="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={fieldClass}
                />

                <input
                  placeholder="Amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={fieldClass}
                />

                <div>
                  <label className="text-xs text-zinc-500 mb-2 block">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as EntryCategory)}
                    className={fieldClass}
                  >
                    {currentCategories.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-[46px] min-h-[46px] appearance-none bg-zinc-800/70 border border-white/5 rounded-[18px] px-4 text-white outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/25 transition-colors"
                />

                {error && <p className="text-sm text-red-500 pt-1">{error}</p>}

                <button
                  type="button"
                  onClick={handleSubmit}
                  className="w-full rounded-full bg-[var(--accent)] text-black h-[50px] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98] cursor-pointer touch-manipulation mt-2"
                >
                  {editingId ? "Save transaction" : "Add transaction"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full text-center text-red-400 text-xs py-1 mt-2 transition-colors duration-200 ease-out hover:text-red-300 cursor-pointer"
                  >
                    Delete transaction
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