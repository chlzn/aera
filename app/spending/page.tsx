"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  Car,
  Circle,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  House,
  PieChart,
  Plane,
  Plus,
  Receipt,
  Repeat,
  RotateCcw,
  Send,
  ShoppingBag,
  Tags,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react"
import { useCurrency } from "@/context/currency-context"
import { useLanguage } from "@/context/language-context"
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

type CategoryPreview = {
  category: EntryCategory
  total: number
  entries: DisplayEntry[]
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
  { value: "food", label: "Food" },
  { value: "bills", label: "Bills" },
  { value: "transport", label: "Transport" },
  { value: "subscription", label: "Subscription" },
  { value: "shopping", label: "Shopping" },
  { value: "health", label: "Health" },
  { value: "entertainment", label: "Entertainment" },
  { value: "travel", label: "Travel" },
  { value: "education", label: "Education" },
  { value: "payments", label: "Payments" },
  { value: "investments", label: "Investments" },
  { value: "housing", label: "Housing" },
  { value: "other", label: "Other" },
]

const categoryIcons: Partial<Record<EntryCategory, LucideIcon>> = {
  housing: House,
  food: UtensilsCrossed,
  transport: Car,
  bills: Receipt,
  subscription: Repeat,
  shopping: ShoppingBag,
  health: HeartPulse,
  entertainment: Gamepad2,
  travel: Plane,
  education: GraduationCap,
  payments: Send,
  investments: PieChart,
  refund: RotateCcw,
  other: Circle,
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

function getEndOfPeriodDate(periodKey: string) {
  const [year, month] = periodKey.split("-").map(Number)
  const lastDay = new Date(year, month, 0).getDate()

  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(
    2,
    "0"
  )}`
}

function getPeriodRange(startPeriod: string, endPeriod: string) {
  const [startYear, startMonth] = startPeriod.split("-").map(Number)
  const [endYear, endMonth] = endPeriod.split("-").map(Number)

  const periods: string[] = []
  let year = startYear
  let month = startMonth

  while (year < endYear || (year === endYear && month <= endMonth)) {
    periods.push(`${year}-${String(month).padStart(2, "0")}`)

    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }

  return periods
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

function getCategoryLabel(
  category: EntryCategory,
  copy: { categoriesNames: Partial<Record<string, string>> }
) {
  return copy.categoriesNames[category] ?? formatCategory(category)
}

export default function Spending() {
  const { currency } = useCurrency()
  const { copy } = useLanguage()

  const [entries, setEntries] = useState<Entry[]>([])
  const [templates, setTemplates] = useState<AutomationTemplate[]>([])
  const [paidScheduledIds, setPaidScheduledIds] = useState<string[]>([])
  const [entriesHydrated, setEntriesHydrated] = useState(false)

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

  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriodKey())
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
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
    const validCategories =
      type === "income" ? incomeCategories : expenseCategories

    const isCurrentCategoryValid = validCategories.some(
      (item) => item.value === category
    )

    if (!isCurrentCategoryValid) {
      setCategory(validCategories[0].value)
    }
  }, [type, category])

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

  const income = periodEntries
    .filter((entry) => entry.type === "income")
    .reduce((acc, entry) => acc + entry.amount, 0)

  const expenses = periodEntries
    .filter((entry) => entry.type === "expense")
    .reduce((acc, entry) => acc + entry.amount, 0)

  const net = income - expenses

  const earliestPeriod = useMemo(() => {
    const periods: string[] = []

    entries.forEach((entry) => {
      if (entry.date) periods.push(entry.date.slice(0, 7))
    })

    templates.forEach((template) => {
      if (template.automation.startDate) {
        periods.push(template.automation.startDate.slice(0, 7))
      }
    })

    if (periods.length === 0) return selectedPeriod

    return periods.sort()[0]
  }, [entries, templates, selectedPeriod])

  const cumulativePeriodKeys = useMemo(() => {
    return getPeriodRange(earliestPeriod, selectedPeriod)
  }, [earliestPeriod, selectedPeriod])

  const selectedPeriodCutoffDate = useMemo(() => {
    const currentPeriod = getCurrentPeriodKey()

    if (selectedPeriod === currentPeriod) {
      return getTodayDate()
    }

    return getEndOfPeriodDate(selectedPeriod)
  }, [selectedPeriod])

  const cumulativeManualEntries = useMemo<DisplayEntry[]>(() => {
    return entries
      .filter((entry) => entry.date <= selectedPeriodCutoffDate)
      .map((entry) => ({
        ...entry,
        source: "manual" as const,
      }))
  }, [entries, selectedPeriodCutoffDate])

  const cumulativeGeneratedEntries = useMemo<DisplayEntry[]>(() => {
    return cumulativePeriodKeys.flatMap((period) =>
      generateEntriesForPeriod(templates, period).map((entry) => ({
        ...entry,
        source: "automation" as const,
      }))
    )
  }, [templates, cumulativePeriodKeys])

  const cumulativeConfirmedGeneratedEntries = useMemo(() => {
    return cumulativeGeneratedEntries.filter((entry) => {
      if (entry.date > selectedPeriodCutoffDate) return false

      const behavior = entry.paymentBehavior || "manual"

      if (behavior === "auto_paid") {
        return isDue(entry.date)
      }

      return paidScheduledIds.includes(entry.id)
    })
  }, [cumulativeGeneratedEntries, paidScheduledIds, selectedPeriodCutoffDate])

  const cashBalance = useMemo(() => {
    const cumulativeEntries = [
      ...cumulativeManualEntries,
      ...cumulativeConfirmedGeneratedEntries,
    ]

    const totalIncome = cumulativeEntries
      .filter((entry) => entry.type === "income")
      .reduce((sum, entry) => sum + entry.amount, 0)

    const totalExpenses = cumulativeEntries
      .filter((entry) => entry.type === "expense")
      .reduce((sum, entry) => sum + entry.amount, 0)

    return totalIncome - totalExpenses
  }, [cumulativeManualEntries, cumulativeConfirmedGeneratedEntries])

  const topCategories = useMemo<CategoryPreview[]>(() => {
    const expenseEntries = periodEntries.filter((entry) => entry.type === "expense")

    const totals = expenseEntries.reduce<Record<string, CategoryPreview>>(
      (acc, entry) => {
        if (!acc[entry.category]) {
          acc[entry.category] = {
            category: entry.category,
            total: 0,
            entries: [],
          }
        }

        acc[entry.category].total += entry.amount
        acc[entry.category].entries.push(entry)
        return acc
      },
      {}
    )

    return Object.values(totals)
      .filter((group) => group.category !== "other" && group.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [periodEntries])

  const spendingInsight = useMemo(() => {
    if (periodEntries.length === 0 && generatedPeriodEntries.length > 0) {
      return copy.spending.status.scheduledOnly
    }

    if (periodEntries.length === 0) {
      return copy.spending.status.noData
    }

    if (income <= 0 && expenses > 0) {
      return copy.spending.status.noIncome
    }

    if (income <= 0 && expenses <= 0) {
      return copy.spending.status.noActivity
    }

    const spendingRatio = (expenses / income) * 100

    if (spendingRatio < 50) {
      return copy.spending.status.savingMostIncome
    }

    if (spendingRatio < 80) {
      return copy.spending.status.spendingControlled
    }

    if (spendingRatio <= 100) {
      return copy.spending.status.spendingMostIncome
    }

    return copy.spending.status.spendingMoreThanEarn
  }, [copy, periodEntries.length, generatedPeriodEntries.length, income, expenses])

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

  const fieldClass =
    "w-full h-[46px] min-h-[46px] appearance-none bg-zinc-800/70 border border-white/5 rounded-[18px] px-4 text-white outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/25 transition-colors"

  return (
    <>
      <main className="min-h-screen bg-black text-white px-5 py-8 pb-32">
        <div className="max-w-4xl mx-auto">
          <header className="mb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                  {copy.spending.title}
                </h1>
                <p className="text-zinc-500 mt-2">
                  {copy.spending.subtitle}
                </p>
              </div>
            </div>
          </header>

          <div className="mb-4">
            <div className="relative inline-block">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="appearance-none bg-transparent pr-6 text-white text-lg font-medium outline-none cursor-pointer"
              >
                {availablePeriods.map((period) => (
                  <option key={period} value={period}>
                    {formatPeriodLabel(period)}
                  </option>
                ))}
              </select>

              <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[var(--accent)] text-sm">
                ⌄
              </span>
            </div>
          </div>

          <section className="mb-6">
            <p className="text-zinc-500 text-sm mb-3">{copy.spending.cash}</p>

            <p className="text-5xl font-semibold tracking-tight text-white">
              {formatCurrency(cashBalance, currency)}
            </p>

            <div className="mt-4 flex gap-7 flex-wrap text-sm">
              <div className="flex flex-col">
                <span className="text-zinc-500">{copy.spending.income}</span>
                <span className="text-white font-medium">
                  {formatCurrency(income, currency)}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-zinc-500">{copy.spending.expenses}</span>
                <span className="text-white font-medium">
                  {formatCurrency(expenses, currency)}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-zinc-500">{copy.spending.thisMonth}</span>
                <span
                  className={`font-medium ${
                    net >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {net >= 0 ? "+" : ""}
                  {formatCurrency(net, currency)}
                </span>
              </div>
            </div>

            <p className="text-sm text-zinc-400 leading-relaxed mt-5">
              {spendingInsight}
            </p>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <Link
                href="/spending/categories"
                className="group flex flex-col items-center justify-center gap-2 py-2 transition-all duration-200 ease-out active:scale-[0.96]"
                aria-label={copy.spending.categories}
              >
                <Tags
                  size={21}
                  strokeWidth={2}
                  className="text-zinc-500 transition-colors duration-200 group-hover:text-[var(--accent)]"
                />
                <span className="text-xs text-zinc-500 transition-colors duration-200 group-hover:text-white">
                  {copy.spending.categories}
                </span>
              </Link>

              <Link
                href="/spending/scheduled"
                className="group flex flex-col items-center justify-center gap-2 py-2 transition-all duration-200 ease-out active:scale-[0.96]"
                aria-label={copy.spending.scheduled}
              >
                <Repeat
                  size={21}
                  strokeWidth={2}
                  className="text-zinc-500 transition-colors duration-200 group-hover:text-[var(--accent)]"
                />
                <span className="text-xs text-zinc-500 transition-colors duration-200 group-hover:text-white">
                  {copy.spending.scheduled}
                </span>
              </Link>

              <button
                type="button"
                onClick={openCreateModal}
                className="group flex flex-col items-center justify-center gap-2 py-2 transition-all duration-200 ease-out active:scale-[0.96]"
                aria-label={copy.spending.add}
              >
                <Plus
                  size={22}
                  strokeWidth={2}
                  className="text-[var(--accent)] transition-colors duration-200"
                />
                <span className="text-xs text-white">{copy.spending.add}</span>
              </button>
            </div>

            <div className="h-px bg-white/5 mt-5" />
          </section>

          <section className="mb-24">
            <p className="text-white text-sm font-medium mb-3">{copy.spending.topCategories}</p>

            {topCategories.length === 0 ? (
              <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 p-5">
                <p className="text-zinc-300 text-sm">{copy.emptyStates.noActivity}</p>
                <p className="text-zinc-600 text-sm mt-1">
                  {copy.emptyStates.startTracking}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 text-sm">
                {topCategories.map((group) => {
                  const Icon = categoryIcons[group.category] || Circle

                  return (
                    <div
                      key={group.category}
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          size={16}
                          strokeWidth={2}
                          className="text-zinc-500 shrink-0"
                        />
                        <span className="text-zinc-400 truncate">
                          {getCategoryLabel(group.category, copy)}
                        </span>
                      </div>

                      <span className="text-white font-medium">
                        {formatCurrency(group.total, currency)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            <Link
              href="/spending/categories"
              className="inline-flex mt-5 text-xs text-zinc-500 transition-colors duration-200 hover:text-[var(--accent)]"
            >
              {copy.spending.viewAllCategories}
            </Link>
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
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-white text-sm font-medium">
                  {editingEntryId || editingTemplateId
                    ? `${copy.actions.edit} ${copy.categories.transaction}`
                    : `${copy.actions.add} ${copy.categories.transaction}`}
                </p>

                <button
                  type="button"
                  onClick={closeModal}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors duration-200 ease-out cursor-pointer"
                >
                  {copy.actions.close}
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
                    {copy.forms.expense}
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
                    {copy.forms.income}
                  </button>
                </div>

                <input
                  placeholder={copy.forms.description}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className={fieldClass}
                />

                <div>
                  <label className="text-xs text-zinc-500 mb-2 block">
                    {copy.forms.category}
                  </label>
                  <select
                    value={category}
                    onChange={(event) =>
                      setCategory(event.target.value as EntryCategory)
                    }
                    className={fieldClass}
                  >
                    {(type === "income" ? incomeCategories : expenseCategories).map(
                      (item) => (
                        <option key={item.value} value={item.value}>
                          {getCategoryLabel(item.value, copy)}
                        </option>
                      )
                    )}
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
                    {copy.forms.oneTime}
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
                    {copy.forms.installment}
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
                    {copy.forms.recurring}
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
                      {copy.scheduled.manual}
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
                      {copy.scheduled.autoPaid}
                    </button>
                  </div>
                )}

                {automationMode === "one_time" && (
                  <div className="mt-2 space-y-3">
                    <input
                      placeholder={copy.forms.amount}
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      className={fieldClass}
                    />

                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className={fieldClass}
                    />
                  </div>
                )}

                {automationMode === "recurring" && (
                  <div className="mt-2 space-y-3">
                    <input
                      placeholder={copy.forms.amount}
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      className={fieldClass}
                    />

                    <div>
                      <label className="text-xs text-zinc-500 mb-2 block">
                        {copy.forms.frequency}
                      </label>
                      <select
                        value={recurringFrequency}
                        onChange={(event) =>
                          setRecurringFrequency(
                            event.target.value as "monthly" | "weekly"
                          )
                        }
                        className={fieldClass}
                      >
                        <option value="monthly">{copy.forms.monthly}</option>
                        <option value="weekly">{copy.forms.weekly}</option>
                      </select>
                    </div>

                    <input
                      type="date"
                      value={automationStartDate}
                      onChange={(event) =>
                        setAutomationStartDate(event.target.value)
                      }
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
                      placeholder={copy.forms.totalAmount}
                      type="number"
                      min="0"
                      step="0.01"
                      value={installmentTotalAmount}
                      onChange={(event) =>
                        setInstallmentTotalAmount(event.target.value)
                      }
                      className={fieldClass}
                    />

                    <input
                      placeholder={copy.forms.numberOfPayments}
                      type="number"
                      min="2"
                      step="1"
                      value={installmentCount}
                      onChange={(event) => setInstallmentCount(event.target.value)}
                      className={fieldClass}
                    />

                    <div>
                      <label className="text-xs text-zinc-500 mb-2 block">
                        {copy.forms.frequency}
                      </label>
                      <select
                        value={installmentFrequency}
                        onChange={(event) =>
                          setInstallmentFrequency(
                            event.target.value as
                              | "monthly"
                              | "weekly"
                              | "biweekly"
                          )
                        }
                        className={fieldClass}
                      >
                        <option value="monthly">{copy.forms.monthly}</option>
                        <option value="weekly">{copy.forms.weekly}</option>
                        <option value="biweekly">{copy.forms.biweekly}</option>
                      </select>
                    </div>

                    <input
                      type="date"
                      value={automationStartDate}
                      onChange={(event) =>
                        setAutomationStartDate(event.target.value)
                      }
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
                    ? copy.actions.saveChanges
                    : `${copy.actions.add} ${copy.categories.transaction}`}
                </button>

                {(editingEntryId || editingTemplateId) && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full text-center text-red-400 text-xs py-1 mt-2 transition-colors duration-200 ease-out hover:text-red-300 cursor-pointer"
                  >
                    {copy.actions.delete}
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
