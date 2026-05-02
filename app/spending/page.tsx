"use client"

import { useEffect, useMemo, useState } from "react"
import { History, LayoutGrid, Plus, Tags } from "lucide-react"
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

type SpendingTab = "overview" | "groups" | "activity"

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

function formatRecurringFrequencyLabel(frequency: "monthly" | "weekly") {
  return frequency === "monthly" ? "every month" : "every week"
}

function formatInstallmentFrequencyLabel(
  frequency: "monthly" | "weekly" | "biweekly"
) {
  if (frequency === "monthly") return "every month"
  if (frequency === "weekly") return "every week"
  return "every 2 weeks"
}

function isDue(date: string) {
  return date <= getTodayDate()
}

export default function Spending() {
  const { currency } = useCurrency()

  const [entries, setEntries] = useState<Entry[]>([])
  const [templates, setTemplates] = useState<AutomationTemplate[]>([])
  const [paidScheduledIds, setPaidScheduledIds] = useState<string[]>([])
  const [entriesHydrated, setEntriesHydrated] = useState(false)

  const [activeTab, setActiveTab] = useState<SpendingTab>("overview")
  const [expandedCategory, setExpandedCategory] = useState<EntryCategory | null>(
    null
  )

  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [type, setType] = useState<EntryType>("expense")
  const [category, setCategory] = useState<EntryCategory>("food")
  const [date, setDate] = useState(getTodayDate())

  const [automationMode, setAutomationMode] = useState<
    "one_time" | "installment" | "recurring"
  >("one_time")
  const [paymentBehavior, setPaymentBehavior] =
    useState<PaymentBehavior>("manual")
  const [recurringFrequency, setRecurringFrequency] = useState<
    "monthly" | "weekly"
  >("monthly")
  const [installmentFrequency, setInstallmentFrequency] = useState<
    "monthly" | "weekly" | "biweekly"
  >("monthly")
  const [installmentTotalAmount, setInstallmentTotalAmount] = useState("")
  const [installmentCount, setInstallmentCount] = useState("")
  const [automationStartDate, setAutomationStartDate] = useState(getTodayDate())

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | EntryType>("all")
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriodKey())
  const [categoryFilter, setCategoryFilter] = useState<"all" | EntryCategory>(
    "all"
  )
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)

  const [selectedTransaction, setSelectedTransaction] =
    useState<DisplayEntry | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isScheduledOpen, setIsScheduledOpen] = useState(true)
  const [error, setError] = useState("")

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
    } finally {
      setEntriesHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!entriesHydrated) return

    try {
      localStorage.setItem("entries", JSON.stringify(entries))
      localStorage.setItem("automationTemplates", JSON.stringify(templates))
      localStorage.setItem(
        "paidScheduledPayments",
        JSON.stringify(paidScheduledIds)
      )
    } catch {
      // silent
    }
  }, [entries, templates, paidScheduledIds, entriesHydrated])

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

  const confirmedGeneratedEntries = useMemo(() => {
    return generatedPeriodEntries.filter((entry) => {
      const behavior = entry.paymentBehavior || "manual"

      if (behavior === "auto_paid") {
        return isDue(entry.date)
      }

      return paidScheduledIds.includes(entry.id)
    })
  }, [generatedPeriodEntries, paidScheduledIds])

  const scheduledEntries = useMemo(() => {
    return generatedPeriodEntries
      .filter((entry) => {
        const behavior = entry.paymentBehavior || "manual"

        if (behavior === "auto_paid") {
          return !isDue(entry.date)
        }

        return !paidScheduledIds.includes(entry.id)
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [generatedPeriodEntries, paidScheduledIds])

  const periodEntries = useMemo<DisplayEntry[]>(() => {
    return [...manualPeriodEntries, ...confirmedGeneratedEntries].sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date)
      if (dateDiff !== 0) return dateDiff
      return b.createdAt.localeCompare(a.createdAt)
    })
  }, [manualPeriodEntries, confirmedGeneratedEntries])

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

  const shouldShowFilteredTotal = filter !== "all" || categoryFilter !== "all"

  const topCategories = useMemo(() => {
    const expenseEntries = periodEntries.filter(
      (entry) => entry.type === "expense"
    )

    if (expenseEntries.length === 0) return []

    const totals = expenseEntries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.category] = (acc[entry.category] || 0) + entry.amount
      return acc
    }, {})

    return Object.entries(totals)
      .filter(([categoryName]) => categoryName !== "other")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
  }, [periodEntries])

  const spendingGroups = useMemo(() => {
    const expenseEntries = periodEntries.filter(
      (entry) => entry.type === "expense"
    )

    const totals = expenseEntries.reduce<
      Record<
        EntryCategory,
        {
          total: number
          entries: DisplayEntry[]
        }
      >
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

  const spendingInsight = useMemo(() => {
    if (periodEntries.length === 0 && scheduledEntries.length > 0) {
      return "You have scheduled payments, but nothing confirmed yet this month."
    }

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
  }, [periodEntries.length, scheduledEntries.length, income, expenses])

  const installmentPreview = useMemo(() => {
    const parsedTotal = Number(installmentTotalAmount)
    const parsedCount =
      installmentCount.trim() === "" ? 2 : Number(installmentCount)

    if (
      automationMode !== "installment" ||
      Number.isNaN(parsedTotal) ||
      parsedTotal <= 0 ||
      Number.isNaN(parsedCount) ||
      parsedCount < 2
    ) {
      return ""
    }

    const perPayment = parsedTotal / parsedCount

    return `${formatCurrency(parsedTotal, currency)} total → ${formatCurrency(
      perPayment,
      currency
    )} ${formatInstallmentFrequencyLabel(
      installmentFrequency
    )} · ${parsedCount} payments`
  }, [
    automationMode,
    installmentTotalAmount,
    installmentCount,
    installmentFrequency,
    currency,
  ])

  const recurringPreview = useMemo(() => {
    const parsedAmount = Number(amount)

    if (
      automationMode !== "recurring" ||
      Number.isNaN(parsedAmount) ||
      parsedAmount <= 0
    ) {
      return ""
    }

    const signal = type === "income" ? "+" : "-"

    return `${signal}${formatCurrency(
      parsedAmount,
      currency
    )} ${formatRecurringFrequencyLabel(recurringFrequency)}`
  }, [automationMode, amount, recurringFrequency, type, currency])

  const resetForm = () => {
    setDescription("")
    setAmount("")
    setType("expense")
    setCategory("food")
    setDate(getTodayDate())

    setAutomationMode("one_time")
    setPaymentBehavior("manual")
    setRecurringFrequency("monthly")
    setInstallmentFrequency("monthly")
    setInstallmentTotalAmount("")
    setInstallmentCount("")
    setAutomationStartDate(getTodayDate())

    setEditingEntryId(null)
    setEditingTemplateId(null)
    setError("")
  }

  const openCreateModal = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const openCreateModalForCategory = (selectedCategory: EntryCategory) => {
    resetForm()
    setType("expense")
    setCategory(selectedCategory)
    setAutomationMode("one_time")
    setIsModalOpen(true)
  }

  const openTransactionDetail = (entry: DisplayEntry) => {
    setSelectedTransaction(entry)
    setIsDetailOpen(true)
  }

  const closeTransactionDetail = () => {
    setSelectedTransaction(null)
    setIsDetailOpen(false)
  }

  const openEditModal = (entry: DisplayEntry) => {
    closeTransactionDetail()

    if (entry.source === "manual") {
      setDescription(entry.description)
      setAmount(String(entry.amount))
      setType(entry.type)
      setCategory(entry.category)
      setDate(entry.date)

      setAutomationMode("one_time")
      setPaymentBehavior("manual")
      setRecurringFrequency("monthly")
      setInstallmentFrequency("monthly")
      setInstallmentTotalAmount("")
      setInstallmentCount("")
      setAutomationStartDate(entry.date)

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
    setPaymentBehavior(template.automation.paymentBehavior || "manual")
    setEditingEntryId(null)
    setEditingTemplateId(template.id)
    setError("")

    if (template.automation.kind === "recurring") {
      setAutomationMode("recurring")
      setAmount(String(template.automation.amount))
      setRecurringFrequency(template.automation.frequency)
      setAutomationStartDate(template.automation.startDate)
      setDate(template.automation.startDate)
      setInstallmentTotalAmount("")
      setInstallmentCount("")
    }

    if (template.automation.kind === "installment") {
      setAutomationMode("installment")
      setInstallmentTotalAmount(String(template.automation.totalAmount))
      setInstallmentCount(String(template.automation.installmentCount))
      setInstallmentFrequency(template.automation.frequency)
      setAutomationStartDate(template.automation.startDate)
      setDate(template.automation.startDate)
      setAmount("")
    }

    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    resetForm()
  }

  const markScheduledAsPaid = (entry: DisplayEntry) => {
    setPaidScheduledIds((prev) => {
      if (prev.includes(entry.id)) return prev
      return [...prev, entry.id]
    })
  }

  const deleteDisplayEntry = (entry: DisplayEntry) => {
    if (entry.source === "manual") {
      setEntries((prev) => prev.filter((item) => item.id !== entry.id))
      closeTransactionDetail()
      return
    }

    if (entry.templateId) {
      setTemplates((prev) =>
        prev.filter((template) => template.id !== entry.templateId)
      )
      closeTransactionDetail()
    }
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
          paymentBehavior,
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
      const parsedCount =
        installmentCount.trim() === "" ? 2 : Number(installmentCount)

      if (
        !installmentTotalAmount ||
        Number.isNaN(parsedTotal) ||
        parsedTotal <= 0
      ) {
        setError("Please enter a valid total amount.")
        return
      }

      if (Number.isNaN(parsedCount) || parsedCount < 2) {
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
          paymentBehavior,
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

  const handleQuickAction = (tab: SpendingTab | "add") => {
    if (tab === "add") {
      openCreateModal()
      return
    }

    setActiveTab(tab)
  }

  const fieldClass =
    "w-full h-[46px] min-h-[46px] appearance-none bg-zinc-800/70 border border-white/5 rounded-[18px] px-4 text-white outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/25 transition-colors"

  const quickActions: {
    value: SpendingTab | "add"
    label: string
    icon: typeof LayoutGrid
  }[] = [
    { value: "overview", label: "Overview", icon: LayoutGrid },
    { value: "groups", label: "Groups", icon: Tags },
    { value: "activity", label: "Activity", icon: History },
    { value: "add", label: "Add", icon: Plus },
  ]

  return (
    <>
      <main className="min-h-screen bg-black text-white px-5 py-8 pb-32">
        <div className="max-w-4xl mx-auto">
          <header className="mb-5">
            <h1 className="text-3xl font-semibold tracking-tight">Spending</h1>
            <p className="text-zinc-500 mt-2">Track your cash flow clearly.</p>
          </header>

          <div className="mb-5">
            <div className="relative">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full appearance-none bg-zinc-900/60 border border-white/5 rounded-[24px] px-4 py-4 pr-12 text-white outline-none transition-all duration-200 ease-out hover:bg-zinc-900/80 active:scale-[0.995]"
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

          <section className="mb-5">
            <p className="text-5xl font-semibold tracking-tight text-white">
              {formatCurrency(net, currency)}
            </p>

            <div className="mt-4 flex gap-7 flex-wrap text-sm">
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
          </section>

          <nav className="mb-6">
            <div className="grid grid-cols-4 gap-2">
              {quickActions.map((item) => {
                const Icon = item.icon
                const isActive = item.value !== "add" && activeTab === item.value
                const isAdd = item.value === "add"

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleQuickAction(item.value)}
                    className="flex flex-col items-center justify-center gap-2 py-2 transition-all duration-200 ease-out active:scale-[0.96]"
                  >
                    <Icon
                      size={22}
                      strokeWidth={2}
                      className={`transition-colors duration-200 ${
                        isAdd || isActive
                          ? "text-[var(--accent)]"
                          : "text-zinc-500/80"
                      }`}
                    />

                    <span
                      className={`text-[11px] font-medium transition-colors duration-200 ${
                        isActive
                          ? "text-white"
                          : isAdd
                          ? "text-zinc-300"
                          : "text-zinc-500/80"
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </nav>

          {activeTab === "overview" && (
            <section className="mb-24 space-y-6">
              <div>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {spendingInsight}
                </p>
              </div>

              {topCategories.length > 0 && (
                <div>
                  <div className="mb-3">
                    <p className="text-white text-sm font-medium">
                      Top categories
                    </p>
                    <p className="text-zinc-600 text-xs mt-1">
                      Your biggest spending areas this month.
                    </p>
                  </div>

                  <div className="grid gap-3 text-sm">
                    {topCategories.map(([categoryName, total]) => (
                      <div
                        key={categoryName}
                        className="flex items-center justify-between gap-4"
                      >
                        <span className="text-zinc-400">
                          {formatCategory(categoryName)}
                        </span>
                        <span className="text-white font-medium">
                          {formatCurrency(total, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scheduledEntries.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setIsScheduledOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between text-left mb-3"
                  >
                    <div>
                      <p className="text-white text-sm font-medium">
                        Scheduled payments
                      </p>
                      <p className="text-zinc-600 text-xs mt-1">
                        Upcoming and unpaid items.
                      </p>
                    </div>

                    <span className="text-zinc-500 text-lg">
                      {isScheduledOpen ? "⌃" : "⌄"}
                    </span>
                  </button>

                  {isScheduledOpen && (
                    <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 overflow-hidden">
                      {scheduledEntries.slice(0, 5).map((entry, index) => {
                        const behavior = entry.paymentBehavior || "manual"
                        const isManual = behavior === "manual"

                        return (
                          <div
                            key={entry.id}
                            className={`flex items-center justify-between gap-4 px-5 py-4 ${
                              index !== Math.min(scheduledEntries.length, 5) - 1
                                ? "border-b border-white/5"
                                : ""
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => openTransactionDetail(entry)}
                              className="min-w-0 text-left flex-1"
                            >
                              <p className="text-zinc-200 text-sm truncate">
                                {entry.description}
                              </p>

                              <p className="text-xs text-zinc-600 mt-1">
                                {formatCurrency(entry.amount, currency)} ·{" "}
                                {formatDate(entry.date)}
                              </p>
                            </button>

                            {isManual ? (
                              <button
                                type="button"
                                onClick={() => markScheduledAsPaid(entry)}
                                className="shrink-0 rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/[0.07] text-[var(--accent)] px-3 py-2 text-xs font-medium transition-all duration-200 ease-out active:scale-[0.98]"
                              >
                                Mark paid
                              </button>
                            ) : (
                              <span className="shrink-0 text-xs text-zinc-600">
                                Upcoming
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {activeTab === "groups" && (
            <section className="mb-24">
              {spendingGroups.length === 0 ? (
                <div className="rounded-[28px] bg-zinc-900/45 border border-white/5 p-6">
                  <p className="text-zinc-200 text-sm">No spending groups yet.</p>
                  <p className="text-zinc-600 text-sm mt-2">
                    Add expenses to see where your money is going.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-zinc-600 text-xs mb-3">
                    Total Groups · {spendingGroups.length}
                  </p>

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

                            <span className="text-zinc-500 text-lg">
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
                                  <button
                                    key={entry.id}
                                    type="button"
                                    onClick={() => openTransactionDetail(entry)}
                                    className="w-full flex items-center justify-between gap-4 py-3 text-left transition-colors duration-200 ease-out hover:bg-white/[0.02]"
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
                                  </button>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  openCreateModalForCategory(group.category)
                                }
                                className="mt-4 w-full rounded-full bg-zinc-800/80 border border-white/5 text-zinc-200 h-[46px] text-sm font-medium transition-all duration-200 ease-out hover:bg-zinc-800 active:scale-[0.98]"
                              >
                                + Add{" "}
                                {formatCategory(group.category).toLowerCase()}{" "}
                                expense
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </section>
          )}

          {activeTab === "activity" && (
            <section className="mb-24">
              <div className="space-y-4">
                <div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <select
                      value={filter}
                      onChange={(e) =>
                        setFilter(e.target.value as "all" | EntryType)
                      }
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
                    <p className="text-zinc-500 text-xs">{filteredTotalLabel}</p>
                    <p className="text-white text-lg font-medium mt-1">
                      {formatCurrency(filteredTotal, currency)} this month
                    </p>
                  </div>
                )}

                {filteredEntries.length === 0 ? (
                  <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 p-6">
                    <p className="text-zinc-300 text-sm">
                      No confirmed transactions in this period.
                    </p>
                    <p className="text-zinc-600 text-sm mt-1">
                      Scheduled payments will appear here once paid.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 overflow-hidden">
                    {filteredEntries.map((entry, index) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => openTransactionDetail(entry)}
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
            </section>
          )}
        </div>
      </main>

      {isDetailOpen && selectedTransaction && (
        <div
          className="fixed inset-0 z-50 bg-black/60 animate-[modalOverlayEnter_150ms_ease-out]"
          onClick={closeTransactionDetail}
        >
          <div className="absolute inset-0 flex items-end md:items-center md:justify-center p-3 md:p-6">
            <div
              className="w-full md:max-w-lg rounded-t-[30px] md:rounded-[30px] bg-zinc-900/95 border border-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] p-4 md:p-5 animate-[modalContentEnter_180ms_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-white text-sm font-medium">
                  Transaction detail
                </p>

                <button
                  type="button"
                  onClick={closeTransactionDetail}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors duration-200 ease-out cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {selectedTransaction.description}
                  </h2>

                  <p
                    className={`text-xl font-medium mt-2 ${
                      selectedTransaction.type === "income"
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {selectedTransaction.type === "income" ? "+" : "-"}
                    {formatCurrency(selectedTransaction.amount, currency)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[22px] bg-zinc-800/50 border border-white/5 p-4">
                    <p className="text-zinc-500 text-xs mb-2">Category</p>
                    <p className="text-white text-sm font-medium">
                      {formatCategory(selectedTransaction.category)}
                    </p>
                  </div>

                  <div className="rounded-[22px] bg-zinc-800/50 border border-white/5 p-4">
                    <p className="text-zinc-500 text-xs mb-2">Type</p>
                    <p className="text-white text-sm font-medium">
                      {selectedTransaction.type === "income"
                        ? "Income"
                        : "Expense"}
                    </p>
                  </div>
                </div>

                <div className="rounded-[22px] bg-zinc-800/40 border border-white/5 p-4">
                  <p className="text-zinc-500 text-xs mb-2">Date</p>
                  <p className="text-white text-sm font-medium">
                    {formatDate(selectedTransaction.date)}
                  </p>
                </div>

                {(selectedTransaction.automationKind ||
                  selectedTransaction.automationLabel) && (
                  <div className="rounded-[22px] bg-zinc-800/40 border border-white/5 p-4">
                    <p className="text-zinc-500 text-xs mb-2">Schedule</p>
                    <p className="text-white text-sm font-medium">
                      {selectedTransaction.automationKind === "installment"
                        ? "Installment"
                        : "Recurring"}
                      {selectedTransaction.automationLabel
                        ? ` · ${selectedTransaction.automationLabel}`
                        : ""}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => openEditModal(selectedTransaction)}
                  className="w-full rounded-full bg-[var(--accent)] text-black h-[50px] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98] cursor-pointer touch-manipulation mt-1"
                >
                  Edit transaction
                </button>

                <button
                  type="button"
                  onClick={() => deleteDisplayEntry(selectedTransaction)}
                  className="w-full text-center text-red-400 text-xs py-1.5 transition-colors duration-200 ease-out hover:text-red-300 cursor-pointer"
                >
                  Delete transaction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  {editingEntryId || editingTemplateId
                    ? "Edit transaction"
                    : "New transaction"}
                </p>

                <button
                  type="button"
                  onClick={closeModal}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors duration-200 ease-out cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-4">
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setType("expense")}
                    className={`flex-1 rounded-full h-[44px] text-sm border cursor-pointer touch-manipulation transition-all duration-200 ease-out active:scale-[0.98] ${
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
                    className={`flex-1 rounded-full h-[44px] text-sm border cursor-pointer touch-manipulation transition-all duration-200 ease-out active:scale-[0.98] ${
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

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAutomationMode("one_time")}
                    className={`rounded-full h-[44px] text-sm border transition-all duration-200 ease-out active:scale-[0.98] ${
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
                    className={`rounded-full h-[44px] text-sm border transition-all duration-200 ease-out active:scale-[0.98] ${
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
                    className={`rounded-full h-[44px] text-sm border transition-all duration-200 ease-out active:scale-[0.98] ${
                      automationMode === "recurring"
                        ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                        : "bg-zinc-800/80 border-white/5 text-zinc-400"
                    }`}
                  >
                    Recurring
                  </button>
                </div>

                {automationMode !== "one_time" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentBehavior("manual")}
                      className={`rounded-full h-[42px] text-sm border transition-all duration-200 ease-out active:scale-[0.98] ${
                        paymentBehavior === "manual"
                          ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                          : "bg-zinc-800/80 border-white/5 text-zinc-400"
                      }`}
                    >
                      Manual
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentBehavior("auto_paid")}
                      className={`rounded-full h-[42px] text-sm border transition-all duration-200 ease-out active:scale-[0.98] ${
                        paymentBehavior === "auto_paid"
                          ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                          : "bg-zinc-800/80 border-white/5 text-zinc-400"
                      }`}
                    >
                      Auto-paid
                    </button>
                  </div>
                )}

                {automationMode === "one_time" && (
                  <div className="mt-2 space-y-3">
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
                  </div>
                )}

                {automationMode === "recurring" && (
                  <div className="mt-2 space-y-3">
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

                    {recurringPreview && (
                      <p className="text-xs text-zinc-500 pt-1">
                        {recurringPreview}
                      </p>
                    )}
                  </div>
                )}

                {automationMode === "installment" && (
                  <div className="mt-2 space-y-3">
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
                            e.target.value as "monthly" | "weekly" | "biweekly"
                          )
                        }
                        className={fieldClass}
                      >
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Every 2 weeks</option>
                      </select>
                    </div>

                    <input
                      type="date"
                      value={automationStartDate}
                      onChange={(e) => setAutomationStartDate(e.target.value)}
                      className={fieldClass}
                    />

                    {installmentPreview && (
                      <p className="text-xs text-zinc-500 pt-1">
                        {installmentPreview}
                      </p>
                    )}
                  </div>
                )}

                {error && <p className="text-sm text-red-500 pt-1">{error}</p>}

                <button
                  type="button"
                  onClick={handleSubmit}
                  className="w-full rounded-full bg-[var(--accent)] text-black h-[50px] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98] cursor-pointer touch-manipulation mt-2"
                >
                  {editingEntryId || editingTemplateId
                    ? "Save transaction"
                    : "Add transaction"}
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