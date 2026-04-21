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
  const [templates, setTemplates] = useState<AutomationTemplate[]>([])
  const [entriesHydrated, setEntriesHydrated] = useState(false)

  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [type, setType] = useState<EntryType>("expense")
  const [category, setCategory] = useState<EntryCategory>("food")
  const [date, setDate] = useState(getTodayDate())

  const [automationMode, setAutomationMode] = useState<
    "one_time" | "installment" | "recurring"
  >("one_time")
  const [recurringFrequency, setRecurringFrequency] = useState<"monthly" | "weekly">(
    "monthly"
  )
  const [installmentFrequency, setInstallmentFrequency] = useState<
    "monthly" | "biweekly"
  >("monthly")
  const [installmentTotalAmount, setInstallmentTotalAmount] = useState("")
  const [installmentCount, setInstallmentCount] = useState("2")
  const [automationStartDate, setAutomationStartDate] = useState(getTodayDate())

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | EntryType>("all")
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriodKey())
  const [categoryFilter, setCategoryFilter] = useState<"all" | EntryCategory>("all")
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    try {
      const savedEntries = localStorage.getItem("entries")
      const savedTemplates = localStorage.getItem("automationTemplates")

      if (savedEntries) {
        const parsedEntries = JSON.parse(savedEntries)
        setEntries(Array.isArray(parsedEntries) ? parsedEntries : [])
      }

      if (savedTemplates) {
        const parsedTemplates = JSON.parse(savedTemplates)
        setTemplates(Array.isArray(parsedTemplates) ? parsedTemplates : [])
      }
    } catch {
      setEntries([])
      setTemplates([])
    } finally {
      setEntriesHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!entriesHydrated) return

    try {
      localStorage.setItem("entries", JSON.stringify(entries))
      localStorage.setItem("automationTemplates", JSON.stringify(templates))
    } catch {
      // silent
    }
  }, [entries, templates, entriesHydrated])

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

  const periodEntries = useMemo<DisplayEntry[]>(() => {
    return [...manualPeriodEntries, ...generatedPeriodEntries].sort((a, b) => {
      const dateDiff =
        new Date(b.date).getTime() - new Date(a.date).getTime()

      if (dateDiff !== 0) return dateDiff

      return b.createdAt.localeCompare(a.createdAt)
    })
  }, [manualPeriodEntries, generatedPeriodEntries])

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

  const filteredTotal = useMemo(() => {
    const hasTypeFilter = filter !== "all"
    const hasCategoryFilter = categoryFilter !== "all"

    if (!hasTypeFilter && !hasCategoryFilter) return 0

    return periodEntries
      .filter((entry) => {
        const matchesType = filter === "all" ? true : entry.type === filter
        const matchesCategory =
          categoryFilter === "all" ? true : entry.category === categoryFilter

        return matchesType && matchesCategory
      })
      .reduce((sum, entry) => sum + entry.amount, 0)
  }, [periodEntries, filter, categoryFilter])

  const filteredTotalLabel = useMemo(() => {
    if (categoryFilter !== "all") {
      return formatCategory(categoryFilter)
    }

    if (filter === "income") return "Income"
    if (filter === "expense") return "Expenses"

    return ""
  }, [filter, categoryFilter])

  const shouldShowFilteredTotal =
    filter !== "all" || categoryFilter !== "all"

  const topCategories = useMemo(() => {
    const expenseEntries = periodEntries.filter((entry) => entry.type === "expense")

    if (expenseEntries.length === 0) return []

    const totals = expenseEntries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.category] = (acc[entry.category] || 0) + entry.amount
      return acc
    }, {})

    return Object.entries(totals)
      .filter(([category]) => category !== "other")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
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

    setAutomationMode("one_time")
    setRecurringFrequency("monthly")
    setInstallmentFrequency("monthly")
    setInstallmentTotalAmount("")
    setInstallmentCount("2")
    setAutomationStartDate(getTodayDate())

    setEditingEntryId(null)
    setEditingTemplateId(null)
    setError("")
  }

  const openCreateModal = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const openEditModal = (entry: DisplayEntry) => {
    if (entry.source === "manual") {
      setDescription(entry.description)
      setAmount(String(entry.amount))
      setType(entry.type)
      setCategory(entry.category)
      setDate(entry.date)
      setAutomationMode("one_time")
      setEditingEntryId(entry.id)
      setEditingTemplateId(null)
      setError("")
      setIsModalOpen(true)
      return
    }

    const template = templates.find((item) => item.id === entry.templateId)
    if (!template) return

    setDescription(template.description)
    setType(template.type)
    setCategory(template.category)
    setEditingEntryId(null)
    setEditingTemplateId(template.id)
    setError("")

    if (template.automation.kind === "recurring") {
      setAutomationMode("recurring")
      setAmount(String(template.automation.amount))
      setRecurringFrequency(template.automation.frequency)
      setAutomationStartDate(template.automation.startDate)
      setInstallmentTotalAmount("")
      setInstallmentCount("2")
    }

    if (template.automation.kind === "installment") {
      setAutomationMode("installment")
      setInstallmentTotalAmount(String(template.automation.totalAmount))
      setInstallmentCount(String(template.automation.installmentCount))
      setInstallmentFrequency(template.automation.frequency)
      setAutomationStartDate(template.automation.startDate)
      setAmount("")
    }

    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    resetForm()
  }

  const handleSubmit = () => {
  const now = new Date().toISOString()

  if (!description.trim()) {
    setError("Please add a description.")
    return
  }

  if (automationMode === "one_time") {
    const parsedAmount = Number(amount)

    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount.")
      return
    }

    if (!date) {
      setError("Please select a date.")
      return
    }

    if (editingEntryId) {
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === editingEntryId
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

    // se estava editando um template e mudou pra one-time,
    // precisa apagar o template antigo
    if (editingTemplateId) {
      setTemplates((prev) =>
        prev.filter((template) => template.id !== editingTemplateId)
      )
    }

    closeModal()
    return
  }

  if (automationMode === "recurring") {
    const parsedAmount = Number(amount)

    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount.")
      return
    }

    if (!automationStartDate) {
      setError("Please select a start date.")
      return
    }

    const recurringTemplate: AutomationTemplate = {
      id: editingTemplateId ?? generateId(),
      description: description.trim(),
      type,
      category,
      accountId: "main",
      createdAt: now,
      updatedAt: now,
      automation: {
        kind: "recurring",
        amount: parsedAmount,
        frequency: recurringFrequency,
        startDate: automationStartDate,
      },
    }

    if (editingTemplateId) {
      setTemplates((prev) =>
        prev.map((template) =>
          template.id === editingTemplateId
            ? { ...recurringTemplate, createdAt: template.createdAt }
            : template
        )
      )
    } else {
      setTemplates((prev) => [recurringTemplate, ...prev])
    }

    // se estava editando uma entry manual e mudou pra recurring,
    // precisa apagar a antiga
    if (editingEntryId) {
      setEntries((prev) =>
        prev.filter((entry) => entry.id !== editingEntryId)
      )
    }

    closeModal()
    return
  }

  if (automationMode === "installment") {
    const parsedTotal = Number(installmentTotalAmount)
    const parsedCount = Number(installmentCount)

    if (
      !installmentTotalAmount ||
      Number.isNaN(parsedTotal) ||
      parsedTotal <= 0
    ) {
      setError("Please enter a valid total amount.")
      return
    }

    if (!installmentCount || Number.isNaN(parsedCount) || parsedCount < 2) {
      setError("Please enter a valid number of payments.")
      return
    }

    if (!automationStartDate) {
      setError("Please select a start date.")
      return
    }

    const installmentTemplate: AutomationTemplate = {
      id: editingTemplateId ?? generateId(),
      description: description.trim(),
      type,
      category,
      accountId: "main",
      createdAt: now,
      updatedAt: now,
      automation: {
        kind: "installment",
        totalAmount: parsedTotal,
        installmentCount: parsedCount,
        frequency: installmentFrequency,
        startDate: automationStartDate,
      },
    }

    if (editingTemplateId) {
      setTemplates((prev) =>
        prev.map((template) =>
          template.id === editingTemplateId
            ? { ...installmentTemplate, createdAt: template.createdAt }
            : template
        )
      )
    } else {
      setTemplates((prev) => [installmentTemplate, ...prev])
    }

    // se estava editando uma entry manual e mudou pra installment,
    // precisa apagar a antiga
    if (editingEntryId) {
      setEntries((prev) =>
        prev.filter((entry) => entry.id !== editingEntryId)
      )
    }

    closeModal()
  }
}

  const handleDelete = () => {
    if (editingEntryId) {
      setEntries((prev) => prev.filter((entry) => entry.id !== editingEntryId))
      closeModal()
      return
    }

    if (editingTemplateId) {
      setTemplates((prev) =>
        prev.filter((template) => template.id !== editingTemplateId)
      )
      closeModal()
    }
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
            <section className="mb-10">
              <div className="rounded-[26px] bg-zinc-900/45 border border-[#F5A623]/20 p-5">
                <p className="text-white/80 text-sm font-medium mb-4">
                  Top categories
                </p>

                <div className="space-y-3">
                  {topCategories.map(([categoryName, total]) => (
                    <div
                      key={categoryName}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="text-zinc-300 text-sm">
                        {formatCategory(categoryName)}
                      </span>
                      <span className="text-white text-sm font-medium">
                        {formatCurrency(total, currency)}
                      </span>
                    </div>
                  ))}
                </div>
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
                isHistoryOpen ? "max-h-[2400px] opacity-100" : "max-h-0 opacity-0"
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

                {shouldShowFilteredTotal && (
                  <div>
                    <p className="text-zinc-400 text-xs">{filteredTotalLabel}</p>
                    <p className="text-white text-lg font-medium mt-1">
                      {formatCurrency(filteredTotal, currency)} this month
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-zinc-200 truncate">
                              {entry.description}
                            </p>

                            {entry.automationLabel && (
                              <span className="text-xs text-zinc-500">
                                {entry.automationLabel}
                              </span>
                            )}
                          </div>

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
                  {editingEntryId
                    ? "Edit Transaction"
                    : editingTemplateId
                    ? "Edit Automation"
                    : "New Transaction"}
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

                <div>
                  <label className="text-xs text-zinc-500 mb-2 block">
                    Automation
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setAutomationMode("one_time")}
                      className={`rounded-full h-[44px] border text-sm transition-all duration-200 ease-out active:scale-[0.98] ${
                        automationMode === "one_time"
                          ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                          : "bg-zinc-800/80 border-white/5 text-zinc-400"
                      }`}
                    >
                      One-time
                    </button>

                    <button
                      type="button"
                      onClick={() => setAutomationMode("installment")}
                      className={`rounded-full h-[44px] border text-sm transition-all duration-200 ease-out active:scale-[0.98] ${
                        automationMode === "installment"
                          ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                          : "bg-zinc-800/80 border-white/5 text-zinc-400"
                      }`}
                    >
                      Installment
                    </button>

                    <button
                      type="button"
                      onClick={() => setAutomationMode("recurring")}
                      className={`rounded-full h-[44px] border text-sm transition-all duration-200 ease-out active:scale-[0.98] ${
                        automationMode === "recurring"
                          ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                          : "bg-zinc-800/80 border-white/5 text-zinc-400"
                      }`}
                    >
                      Recurring
                    </button>
                  </div>
                </div>

                {automationMode === "one_time" && (
                  <>
                    <input
                      placeholder="Amount"
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

                {automationMode === "recurring" && (
                  <>
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
                        Frequency
                      </label>
                      <select
                        value={recurringFrequency}
                        onChange={(e) =>
                          setRecurringFrequency(
                            e.target.value as "monthly" | "weekly"
                          )
                        }
                        className={fieldClass}
                      >
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>

                    <input
                      type="date"
                      value={automationStartDate}
                      onChange={(e) => setAutomationStartDate(e.target.value)}
                      className={fieldClass}
                    />
                  </>
                )}

                {automationMode === "installment" && (
                  <>
                    <input
                      placeholder="Total amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={installmentTotalAmount}
                      onChange={(e) => setInstallmentTotalAmount(e.target.value)}
                      className={fieldClass}
                    />

                    <input
                      placeholder="Number of payments"
                      type="number"
                      min="2"
                      step="1"
                      value={installmentCount}
                      onChange={(e) => setInstallmentCount(e.target.value)}
                      className={fieldClass}
                    />

                    <div>
                      <label className="text-xs text-zinc-500 mb-2 block">
                        Frequency
                      </label>
                      <select
                        value={installmentFrequency}
                        onChange={(e) =>
                          setInstallmentFrequency(
                            e.target.value as "monthly" | "biweekly"
                          )
                        }
                        className={fieldClass}
                      >
                        <option value="monthly">Monthly</option>
                        <option value="biweekly">Every 2 weeks</option>
                      </select>
                    </div>

                    <input
                      type="date"
                      value={automationStartDate}
                      onChange={(e) => setAutomationStartDate(e.target.value)}
                      className={fieldClass}
                    />
                  </>
                )}

                {error && <p className="text-sm text-red-500 pt-1">{error}</p>}

                <button
                  type="button"
                  onClick={handleSubmit}
                  className="w-full rounded-full bg-[var(--accent)] text-black h-[50px] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98] cursor-pointer touch-manipulation mt-2"
                >
                  {editingEntryId || editingTemplateId
                    ? "Save"
                    : automationMode === "one_time"
                    ? "Add transaction"
                    : "Create automation"}
                </button>

                {(editingEntryId || editingTemplateId) && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full text-center text-red-400 text-xs py-1 mt-2 transition-colors duration-200 ease-out hover:text-red-300 cursor-pointer"
                  >
                    Delete
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