"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Briefcase,
  Car,
  Circle,
  Gamepad2,
  GraduationCap,
  GripVertical,
  HeartPulse,
  House,
  PieChart,
  Plane,
  Plus,
  PlusCircle,
  Receipt,
  Repeat,
  RotateCcw,
  Send,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react"
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

type CategoryGroup = {
  key: string
  type: EntryType
  category: EntryCategory
  total: number
  entries: DisplayEntry[]
  hasHistory: boolean
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

const categoryIcons: Record<EntryCategory, LucideIcon> = {
  salary: Wallet,
  freelance: Briefcase,
  bonus: Sparkles,
  investment_income: TrendingUp,
  refund: RotateCcw,
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
  other: Circle,
}

const defaultIncomeCategoryOrder = incomeCategories.map((item) => item.value)
const defaultExpenseCategoryOrder = expenseCategories.map((item) => item.value)

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

function getGroupKey(type: EntryType, category: EntryCategory) {
  return `${type}-${category}`
}

function getCategorySortIndex(category: EntryCategory, order: EntryCategory[]) {
  const index = order.indexOf(category)
  return index === -1 ? 999 : index
}

function moveItem<T>(items: T[], from: T, to: T) {
  if (from === to) return items

  const withoutFrom = items.filter((item) => item !== from)
  const targetIndex = withoutFrom.indexOf(to)

  if (targetIndex === -1) return items

  return [
    ...withoutFrom.slice(0, targetIndex),
    from,
    ...withoutFrom.slice(targetIndex),
  ]
}

export default function SpendingCategoriesPage() {
  const { currency } = useCurrency()

  const [entries, setEntries] = useState<Entry[]>([])
  const [templates, setTemplates] = useState<AutomationTemplate[]>([])
  const [paidScheduledIds, setPaidScheduledIds] = useState<string[]>([])
  const [expenseCategoryOrder, setExpenseCategoryOrder] = useState<EntryCategory[]>(
    []
  )
  const [incomeCategoryOrder, setIncomeCategoryOrder] = useState<EntryCategory[]>(
    []
  )
  const [hydrated, setHydrated] = useState(false)

  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriodKey())
  const [activeType, setActiveType] = useState<EntryType>("expense")
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null)
  const [draggedCategory, setDraggedCategory] = useState<EntryCategory | null>(
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

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [selectedTransaction, setSelectedTransaction] =
    useState<DisplayEntry | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const typeParam = params.get("type")
      const categoryParam = params.get("category")

      if (typeParam === "income" || typeParam === "expense") {
        setActiveType(typeParam)
      }

      if (categoryParam) {
        const groupType = typeParam === "income" ? "income" : "expense"
        setExpandedGroupKey(getGroupKey(groupType, categoryParam as EntryCategory))
      }
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    try {
      const savedEntries = localStorage.getItem("entries")
      const savedTemplates = localStorage.getItem("automationTemplates")
      const savedPaidScheduledIds = localStorage.getItem("paidScheduledPayments")
      const savedExpenseOrder = localStorage.getItem("spendingExpenseCategoryOrder")
      const savedIncomeOrder = localStorage.getItem("spendingIncomeCategoryOrder")
      const legacyOrder = localStorage.getItem("spendingCategoryOrder")

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

      if (savedExpenseOrder) {
        const parsedExpenseOrder = JSON.parse(savedExpenseOrder)
        setExpenseCategoryOrder(
          Array.isArray(parsedExpenseOrder) ? parsedExpenseOrder : []
        )
      } else if (legacyOrder) {
        const parsedLegacyOrder = JSON.parse(legacyOrder)
        setExpenseCategoryOrder(
          Array.isArray(parsedLegacyOrder) ? parsedLegacyOrder : []
        )
      }

      if (savedIncomeOrder) {
        const parsedIncomeOrder = JSON.parse(savedIncomeOrder)
        setIncomeCategoryOrder(
          Array.isArray(parsedIncomeOrder) ? parsedIncomeOrder : []
        )
      }
    } catch {
      setEntries([])
      setTemplates([])
      setPaidScheduledIds([])
      setExpenseCategoryOrder([])
      setIncomeCategoryOrder([])
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return

    try {
      localStorage.setItem("entries", JSON.stringify(entries))
      localStorage.setItem("automationTemplates", JSON.stringify(templates))
      localStorage.setItem(
        "paidScheduledPayments",
        JSON.stringify(paidScheduledIds)
      )
      localStorage.setItem(
        "spendingExpenseCategoryOrder",
        JSON.stringify(expenseCategoryOrder)
      )
      localStorage.setItem(
        "spendingIncomeCategoryOrder",
        JSON.stringify(incomeCategoryOrder)
      )
    } catch {
      // silent
    }
  }, [
    entries,
    templates,
    paidScheduledIds,
    expenseCategoryOrder,
    incomeCategoryOrder,
    hydrated,
  ])

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

  const effectiveExpenseCategoryOrder = useMemo(() => {
    const existing = expenseCategoryOrder.filter((categoryName) =>
      defaultExpenseCategoryOrder.includes(categoryName)
    )

    const missing = defaultExpenseCategoryOrder.filter(
      (categoryName) => !existing.includes(categoryName)
    )

    return [...existing, ...missing]
  }, [expenseCategoryOrder])

  const effectiveIncomeCategoryOrder = useMemo(() => {
    const existing = incomeCategoryOrder.filter((categoryName) =>
      defaultIncomeCategoryOrder.includes(categoryName)
    )

    const missing = defaultIncomeCategoryOrder.filter(
      (categoryName) => !existing.includes(categoryName)
    )

    return [...existing, ...missing]
  }, [incomeCategoryOrder])

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

  const incomeGroups = useMemo<CategoryGroup[]>(() => {
    const incomeEntries = periodEntries.filter((entry) => entry.type === "income")
    const usedCategories = new Set<EntryCategory>()

    entries.forEach((entry) => {
      if (entry.type === "income") usedCategories.add(entry.category)
    })

    templates.forEach((template) => {
      if (template.type === "income") usedCategories.add(template.category)
    })

    incomeEntries.forEach((entry) => usedCategories.add(entry.category))

    const categories = Array.from(
      new Set([...effectiveIncomeCategoryOrder, ...Array.from(usedCategories)])
    ).filter((item) => defaultIncomeCategoryOrder.includes(item))

    return categories
      .map((categoryName) => {
        const groupEntries = incomeEntries
          .filter((entry) => entry.category === categoryName)
          .sort((a, b) => b.date.localeCompare(a.date))

        const total = groupEntries.reduce((sum, entry) => sum + entry.amount, 0)

        return {
          key: getGroupKey("income", categoryName),
          type: "income" as const,
          category: categoryName,
          total,
          entries: groupEntries,
          hasHistory: usedCategories.has(categoryName),
        }
      })
      .sort(
        (a, b) =>
          getCategorySortIndex(a.category, effectiveIncomeCategoryOrder) -
          getCategorySortIndex(b.category, effectiveIncomeCategoryOrder)
      )
  }, [entries, templates, periodEntries, effectiveIncomeCategoryOrder])

  const expenseGroups = useMemo<CategoryGroup[]>(() => {
    const expenseEntries = periodEntries.filter(
      (entry) => entry.type === "expense"
    )
    const usedCategories = new Set<EntryCategory>()

    entries.forEach((entry) => {
      if (entry.type === "expense") usedCategories.add(entry.category)
    })

    templates.forEach((template) => {
      if (template.type === "expense") usedCategories.add(template.category)
    })

    generatedPeriodEntries.forEach((entry) => {
      if (entry.type === "expense") usedCategories.add(entry.category)
    })

    expenseEntries.forEach((entry) => usedCategories.add(entry.category))

    const categories = Array.from(
      new Set([...effectiveExpenseCategoryOrder, ...Array.from(usedCategories)])
    ).filter((item) => defaultExpenseCategoryOrder.includes(item))

    return categories
      .map((categoryName) => {
        const groupEntries = expenseEntries
          .filter((entry) => entry.category === categoryName)
          .sort((a, b) => b.date.localeCompare(a.date))

        const total = groupEntries.reduce((sum, entry) => sum + entry.amount, 0)

        return {
          key: getGroupKey("expense", categoryName),
          type: "expense" as const,
          category: categoryName,
          total,
          entries: groupEntries,
          hasHistory: usedCategories.has(categoryName),
        }
      })
      .sort(
        (a, b) =>
          getCategorySortIndex(a.category, effectiveExpenseCategoryOrder) -
          getCategorySortIndex(b.category, effectiveExpenseCategoryOrder)
      )
  }, [
    entries,
    templates,
    periodEntries,
    generatedPeriodEntries,
    effectiveExpenseCategoryOrder,
  ])

  const activeGroups = activeType === "income" ? incomeGroups : expenseGroups
  const currentCategories =
    type === "income" ? incomeCategories : expenseCategories

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

  const openCreateModal = (selectedType: EntryType, selectedCategory: EntryCategory) => {
    resetForm()
    setType(selectedType)
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

  const handleCategoryDrop = (targetCategory: EntryCategory) => {
    if (!draggedCategory || draggedCategory === targetCategory) {
      setDraggedCategory(null)
      return
    }

    if (activeType === "expense") {
      setExpenseCategoryOrder((prev) =>
        moveItem(
          prev.length > 0 ? prev : defaultExpenseCategoryOrder,
          draggedCategory,
          targetCategory
        )
      )
    } else {
      setIncomeCategoryOrder((prev) =>
        moveItem(
          prev.length > 0 ? prev : defaultIncomeCategoryOrder,
          draggedCategory,
          targetCategory
        )
      )
    }

    setDraggedCategory(null)
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

  const renderGroup = (group: CategoryGroup) => {
    const isExpanded = expandedGroupKey === group.key
    const Icon = categoryIcons[group.category]
    const valueColor = group.type === "income" ? "text-green-500" : "text-red-500"
    const sign = group.type === "income" ? "+" : "-"
    const countLabel =
      group.type === "income"
        ? `${group.entries.length} entr${group.entries.length === 1 ? "y" : "ies"}`
        : `${group.entries.length} transaction${
            group.entries.length === 1 ? "" : "s"
          }`

    return (
      <div key={group.key} className="border-b border-white/5 last:border-b-0">
        <button
          type="button"
          draggable
          onDragStart={() => setDraggedCategory(group.category)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => handleCategoryDrop(group.category)}
          onClick={() =>
            setExpandedGroupKey((prev) => (prev === group.key ? null : group.key))
          }
          className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-200 ease-out hover:bg-white/[0.02]"
        >
          <div className="min-w-0 flex items-center gap-3">
            <GripVertical
              size={14}
              strokeWidth={2}
              className="text-zinc-700 shrink-0 cursor-grab"
            />

            <Icon
              size={18}
              strokeWidth={2}
              className={`shrink-0 transition-colors duration-200 ${
                isExpanded ? "text-zinc-300" : "text-zinc-500"
              }`}
            />

            <div className="min-w-0">
              <p className="text-zinc-200 font-medium">
                {formatCategory(group.category)}
              </p>

              {!isExpanded && (
                <p className="text-xs text-zinc-600 mt-1">{countLabel}</p>
              )}
            </div>
          </div>

          {!isExpanded && (
            <div className="text-right shrink-0 ml-auto">
              <p className={`text-sm font-medium ${valueColor}`}>
                {group.total > 0 ? sign : ""}
                {formatCurrency(group.total, currency)}
              </p>
            </div>
          )}
        </button>

        {isExpanded && (
          <div className="px-5 pb-5">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-zinc-500 text-xs">Total this month</p>
                <p className={`text-lg font-medium mt-1 ${valueColor}`}>
                  {group.total > 0 ? sign : ""}
                  {formatCurrency(group.total, currency)}
                </p>
              </div>

              <p className="text-zinc-600 text-xs">{countLabel}</p>
            </div>

            {group.entries.length === 0 ? (
              <div className="rounded-[22px] bg-zinc-950/25 border border-white/5 p-4">
                <p className="text-zinc-400 text-sm">
                  No activity in this category yet.
                </p>
                <p className="text-zinc-600 text-sm mt-1">
                  This group stays here so your flow remains familiar.
                </p>
              </div>
            ) : (
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
                        {entry.automationLabel ? ` · ${entry.automationLabel}` : ""}
                      </p>
                    </div>

                    <span className={`text-sm font-medium shrink-0 ${valueColor}`}>
                      {entry.type === "income" ? "+" : "-"}
                      {formatCurrency(entry.amount, currency)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => openCreateModal(group.type, group.category)}
              className="mt-4 w-full rounded-full bg-zinc-800/80 border border-white/5 text-zinc-200 h-[46px] text-sm font-medium transition-all duration-200 ease-out hover:bg-zinc-800 active:scale-[0.98]"
            >
              + Add {formatCategory(group.category).toLowerCase()}{" "}
              {group.type === "income" ? "income" : "expense"}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <main className="min-h-screen bg-black text-white px-5 py-8 pb-32">
        <div className="max-w-4xl mx-auto">
          <header className="mb-6">
            <Link
              href="/spending"
              className="inline-flex items-center gap-2 text-zinc-600 text-sm mb-5 transition-colors hover:text-zinc-400"
            >
              <ArrowLeft size={16} strokeWidth={2} />
              Spending
            </Link>

            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                  Categories
                </h1>
                <p className="text-zinc-500 mt-2">
                  Manage your spending and income groups.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  openCreateModal(activeType, activeGroups[0]?.category || "food")
                }
                className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-black transition-all duration-200 ease-out active:scale-[0.96]"
                aria-label="Add transaction"
              >
                <Plus size={20} strokeWidth={2} />
              </button>
            </div>
          </header>

          <div className="mb-5">
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

          <div className="mb-6 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveType("expense")
                setExpandedGroupKey(null)
              }}
              className={`rounded-full h-[42px] text-sm border transition-all duration-200 ease-out active:scale-[0.98] ${
                activeType === "expense"
                  ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                  : "bg-zinc-900/60 border-white/5 text-zinc-500"
              }`}
            >
              Expenses
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveType("income")
                setExpandedGroupKey(null)
              }}
              className={`rounded-full h-[42px] text-sm border transition-all duration-200 ease-out active:scale-[0.98] ${
                activeType === "income"
                  ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                  : "bg-zinc-900/60 border-white/5 text-zinc-500"
              }`}
            >
              Income
            </button>
          </div>

          <section className="mb-24">
            {activeGroups.length === 0 ? (
              <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 p-5">
                <p className="text-zinc-300 text-sm">No categories yet.</p>
                <p className="text-zinc-600 text-sm mt-1">
                  Add your first transaction to start building your flow.
                </p>
              </div>
            ) : (
              <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 overflow-hidden">
                {activeGroups.map((group) => renderGroup(group))}
              </div>
            )}
          </section>
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
              onClick={(event) => event.stopPropagation()}
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
              onClick={(event) => event.stopPropagation()}
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
                  onChange={(event) => setDescription(event.target.value)}
                  className={fieldClass}
                />

                <div>
                  <label className="text-xs text-zinc-500 mb-2 block">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(event) =>
                      setCategory(event.target.value as EntryCategory)
                    }
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
                      placeholder="Amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      className={fieldClass}
                    />

                    <div>
                      <label className="text-xs text-zinc-500 mb-2 block">
                        Frequency
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
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
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
                      placeholder="Total amount"
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
                      placeholder="Number of payments"
                      type="number"
                      min="2"
                      step="1"
                      value={installmentCount}
                      onChange={(event) => setInstallmentCount(event.target.value)}
                      className={fieldClass}
                    />

                    <div>
                      <label className="text-xs text-zinc-500 mb-2 block">
                        Frequency
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
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Every 2 weeks</option>
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
