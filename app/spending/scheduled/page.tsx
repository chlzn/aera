"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, CheckCircle2, Clock3, Repeat } from "lucide-react"
import { useCurrency } from "@/context/currency-context"
import {
  formatPeriodLabel,
  getAvailablePeriodsFromCurrentYear,
  getCurrentPeriodKey,
} from "@/lib/period"
import {
  type AutomationTemplate,
  type EntryCategory,
  type EntryType,
  type PaymentBehavior,
  generateEntriesForPeriod,
} from "@/lib/spending-automation"

type DisplayEntry = {
  id: string
  description: string
  amount: number
  type: EntryType
  category: EntryCategory
  date: string
  accountId: string
  createdAt: string
  updatedAt: string
  source: "automation"
  templateId: string
  automationKind: "recurring" | "installment"
  automationLabel?: string
  paymentBehavior?: PaymentBehavior
}

type RecurringTemplate = Extract<
  AutomationTemplate,
  { automation: { kind: "recurring" } }
>

type InstallmentTemplate = Extract<
  AutomationTemplate,
  { automation: { kind: "installment" } }
>

function isRecurringTemplate(
  template: AutomationTemplate
): template is RecurringTemplate {
  return template.automation.kind === "recurring"
}

function isInstallmentTemplate(
  template: AutomationTemplate
): template is InstallmentTemplate {
  return template.automation.kind === "installment"
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

export default function ScheduledPaymentsPage() {
  const { currency } = useCurrency()

  const [templates, setTemplates] = useState<AutomationTemplate[]>([])
  const [paidScheduledIds, setPaidScheduledIds] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriodKey())

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [editingKind, setEditingKind] = useState<"recurring" | "installment">(
    "recurring"
  )

  const [description, setDescription] = useState("")
  const [type, setType] = useState<EntryType>("expense")
  const [category, setCategory] = useState<EntryCategory>("food")
  const [paymentBehavior, setPaymentBehavior] =
    useState<PaymentBehavior>("manual")

  const [amount, setAmount] = useState("")
  const [recurringFrequency, setRecurringFrequency] = useState<
    "monthly" | "weekly"
  >("monthly")

  const [installmentTotalAmount, setInstallmentTotalAmount] = useState("")
  const [installmentCount, setInstallmentCount] = useState("")
  const [installmentFrequency, setInstallmentFrequency] = useState<
    "monthly" | "weekly" | "biweekly"
  >("monthly")

  const [startDate, setStartDate] = useState(getTodayDate())
  const [error, setError] = useState("")

  useEffect(() => {
    try {
      const savedTemplates = localStorage.getItem("automationTemplates")
      const savedPaidScheduledIds = localStorage.getItem("paidScheduledPayments")

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
      setTemplates([])
      setPaidScheduledIds([])
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return

    try {
      localStorage.setItem("automationTemplates", JSON.stringify(templates))
      localStorage.setItem(
        "paidScheduledPayments",
        JSON.stringify(paidScheduledIds)
      )
    } catch {
      // silent
    }
  }, [templates, paidScheduledIds, hydrated])

  const availablePeriods = useMemo(() => {
    return getAvailablePeriodsFromCurrentYear()
  }, [])

  const scheduledEntries = useMemo<DisplayEntry[]>(() => {
    return generateEntriesForPeriod(templates, selectedPeriod).sort((a, b) =>
      a.date.localeCompare(b.date)
    )
  }, [templates, selectedPeriod])

  const recurringTemplates = useMemo<RecurringTemplate[]>(() => {
    return templates.filter(isRecurringTemplate)
  }, [templates])

  const installmentTemplates = useMemo<InstallmentTemplate[]>(() => {
    return templates.filter(isInstallmentTemplate)
  }, [templates])

  const paidEntries = useMemo(() => {
    return scheduledEntries.filter((entry) => {
      const behavior = entry.paymentBehavior || "manual"

      if (behavior === "auto_paid") {
        return isDue(entry.date)
      }

      return paidScheduledIds.includes(entry.id)
    })
  }, [scheduledEntries, paidScheduledIds])

  const upcomingEntries = useMemo(() => {
    return scheduledEntries.filter((entry) => {
      const behavior = entry.paymentBehavior || "manual"

      if (behavior === "auto_paid") {
        return !isDue(entry.date)
      }

      return !paidScheduledIds.includes(entry.id)
    })
  }, [scheduledEntries, paidScheduledIds])

  const currentCategories =
    type === "income" ? incomeCategories : expenseCategories

  const resetEditForm = () => {
    setEditingTemplateId(null)
    setEditingKind("recurring")
    setDescription("")
    setType("expense")
    setCategory("food")
    setPaymentBehavior("manual")
    setAmount("")
    setRecurringFrequency("monthly")
    setInstallmentTotalAmount("")
    setInstallmentCount("")
    setInstallmentFrequency("monthly")
    setStartDate(getTodayDate())
    setError("")
  }

  const closeEdit = () => {
    setIsEditOpen(false)
    resetEditForm()
  }

  const openEditTemplate = (template: AutomationTemplate) => {
    setEditingTemplateId(template.id)
    setDescription(template.description)
    setType(template.type)
    setCategory(template.category)
    setPaymentBehavior(template.automation.paymentBehavior || "manual")
    setStartDate(template.automation.startDate)
    setError("")

    if (template.automation.kind === "recurring") {
      setEditingKind("recurring")
      setAmount(String(template.automation.amount))
      setRecurringFrequency(template.automation.frequency)
      setInstallmentTotalAmount("")
      setInstallmentCount("")
      setInstallmentFrequency("monthly")
    }

    if (template.automation.kind === "installment") {
      setEditingKind("installment")
      setAmount("")
      setInstallmentTotalAmount(String(template.automation.totalAmount))
      setInstallmentCount(String(template.automation.installmentCount))
      setInstallmentFrequency(template.automation.frequency)
      setRecurringFrequency("monthly")
    }

    setIsEditOpen(true)
  }

  const openEditFromEntry = (entry: DisplayEntry) => {
    const template = templates.find((item) => item.id === entry.templateId)
    if (!template) return
    openEditTemplate(template)
  }

  const markScheduledAsPaid = (entry: DisplayEntry) => {
    setPaidScheduledIds((prev) => {
      if (prev.includes(entry.id)) return prev
      return [...prev, entry.id]
    })
  }

  const unmarkScheduledAsPaid = (entry: DisplayEntry) => {
    setPaidScheduledIds((prev) => prev.filter((id) => id !== entry.id))
  }

  const handleSaveTemplate = () => {
    if (!editingTemplateId) return

    const now = new Date().toISOString()

    if (!description.trim()) {
      setError("Please add a description.")
      return
    }

    if (!startDate) {
      setError("Please select a start date.")
      return
    }

    const existingTemplate = templates.find(
      (template) => template.id === editingTemplateId
    )

    if (!existingTemplate) return

    if (editingKind === "recurring") {
      const parsedAmount = Number(amount)

      if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        setError("Please enter a valid amount.")
        return
      }

      const updatedTemplate: AutomationTemplate = {
        id: existingTemplate.id,
        description: description.trim(),
        type,
        category,
        accountId: existingTemplate.accountId,
        createdAt: existingTemplate.createdAt,
        updatedAt: now,
        automation: {
          kind: "recurring",
          amount: parsedAmount,
          frequency: recurringFrequency,
          startDate,
          paymentBehavior,
        },
      }

      setTemplates((prev) =>
        prev.map((template) =>
          template.id === editingTemplateId ? updatedTemplate : template
        )
      )

      closeEdit()
      return
    }

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

    const updatedTemplate: AutomationTemplate = {
      id: existingTemplate.id,
      description: description.trim(),
      type,
      category,
      accountId: existingTemplate.accountId,
      createdAt: existingTemplate.createdAt,
      updatedAt: now,
      automation: {
        kind: "installment",
        totalAmount: parsedTotal,
        installmentCount: parsedCount,
        frequency: installmentFrequency,
        startDate,
        paymentBehavior,
      },
    }

    setTemplates((prev) =>
      prev.map((template) =>
        template.id === editingTemplateId ? updatedTemplate : template
      )
    )

    closeEdit()
  }

  const handleDeleteTemplate = () => {
    if (!editingTemplateId) return

    setTemplates((prev) =>
      prev.filter((template) => template.id !== editingTemplateId)
    )

    setPaidScheduledIds((prev) =>
      prev.filter((id) => !id.startsWith(`${editingTemplateId}-`))
    )

    closeEdit()
  }

  const fieldClass =
    "w-full h-[46px] min-h-[46px] appearance-none bg-zinc-800/70 border border-white/5 rounded-[18px] px-4 text-white outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/25 transition-colors"

  return (
    <>
      <main className="min-h-screen bg-black text-white px-5 py-8 pb-32">
        <div className="max-w-4xl mx-auto">
          <header className="mb-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link
                  href="/spending"
                  className="inline-flex items-center gap-2 text-zinc-500 text-sm mb-4 active:scale-[0.98]"
                >
                  <ArrowLeft size={16} strokeWidth={2} />
                  Spending
                </Link>

                <h1 className="text-3xl font-semibold tracking-tight">
                  Scheduled
                </h1>
                <p className="text-zinc-500 mt-2">
                  Manage recurring and upcoming payments.
                </p>
              </div>

              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900/60 border border-white/5 text-zinc-400">
                <Repeat size={19} strokeWidth={2} />
              </div>
            </div>
          </header>

          <div className="mb-6">
            <div className="relative inline-block">
              <select
                value={selectedPeriod}
                onChange={(event) => setSelectedPeriod(event.target.value)}
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

          <section className="mb-8">
            <p className="text-white text-sm font-medium mb-3">Upcoming</p>

            {upcomingEntries.length === 0 ? (
              <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 p-5">
                <p className="text-zinc-300 text-sm">
                  No upcoming scheduled payments.
                </p>
                <p className="text-zinc-600 text-sm mt-1">
                  Recurring and installment items will appear here.
                </p>
              </div>
            ) : (
              <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 overflow-hidden">
                {upcomingEntries.map((entry, index) => {
                  const isManual =
                    (entry.paymentBehavior || "manual") === "manual"

                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between gap-4 px-5 py-4 ${
                        index !== upcomingEntries.length - 1
                          ? "border-b border-white/5"
                          : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => openEditFromEntry(entry)}
                        className="min-w-0 text-left flex-1"
                      >
                        <div className="flex items-center gap-2">
                          <Clock3
                            size={15}
                            strokeWidth={2}
                            className="text-zinc-600 shrink-0"
                          />
                          <p className="text-zinc-200 text-sm truncate">
                            {entry.description}
                          </p>
                        </div>

                        <p className="text-xs text-zinc-600 mt-1">
                          {formatDate(entry.date)} ·{" "}
                          {formatCategory(entry.category)}
                          {entry.automationLabel
                            ? ` · ${entry.automationLabel}`
                            : ""}
                        </p>
                      </button>

                      <div className="text-right shrink-0">
                        <p
                          className={`text-sm font-medium ${
                            entry.type === "income"
                              ? "text-green-500"
                              : "text-red-500"
                          }`}
                        >
                          {entry.type === "income" ? "+" : "-"}
                          {formatCurrency(entry.amount, currency)}
                        </p>

                        {isManual ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              markScheduledAsPaid(entry)
                            }}
                            className="mt-2 text-[11px] text-[var(--accent)]"
                          >
                            Mark paid
                          </button>
                        ) : (
                          <p className="mt-2 text-[11px] text-zinc-600">
                            Auto-paid
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <div className="h-px bg-white/5 mb-8" />

          <section className="mb-8">
            <p className="text-white text-sm font-medium mb-3">Recurring</p>

            {recurringTemplates.length === 0 ? (
              <p className="text-zinc-600 text-sm">No recurring items yet.</p>
            ) : (
              <div className="grid gap-3">
                {recurringTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => openEditTemplate(template)}
                    className="flex items-center justify-between gap-4 text-left transition-colors duration-200 hover:bg-white/[0.02] rounded-[18px] py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-zinc-300 text-sm truncate">
                        {template.description}
                      </p>
                      <p className="text-zinc-600 text-xs mt-1">
                        {template.automation.frequency === "monthly"
                          ? "Monthly"
                          : "Weekly"}{" "}
                        · {formatCategory(template.category)} ·{" "}
                        {template.automation.paymentBehavior === "auto_paid"
                          ? "Auto-paid"
                          : "Manual"}
                      </p>
                    </div>

                    <p
                      className={`text-sm font-medium shrink-0 ${
                        template.type === "income"
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                    >
                      {template.type === "income" ? "+" : "-"}
                      {formatCurrency(template.automation.amount, currency)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="h-px bg-white/5 mb-8" />

          <section className="mb-8">
            <p className="text-white text-sm font-medium mb-3">Installments</p>

            {installmentTemplates.length === 0 ? (
              <p className="text-zinc-600 text-sm">No installment plans yet.</p>
            ) : (
              <div className="grid gap-3">
                {installmentTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => openEditTemplate(template)}
                    className="flex items-center justify-between gap-4 text-left transition-colors duration-200 hover:bg-white/[0.02] rounded-[18px] py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-zinc-300 text-sm truncate">
                        {template.description}
                      </p>
                      <p className="text-zinc-600 text-xs mt-1">
                        {template.automation.installmentCount} payments ·{" "}
                        {formatCategory(template.category)} ·{" "}
                        {template.automation.paymentBehavior === "auto_paid"
                          ? "Auto-paid"
                          : "Manual"}
                      </p>
                    </div>

                    <p
                      className={`text-sm font-medium shrink-0 ${
                        template.type === "income"
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                    >
                      {template.type === "income" ? "+" : "-"}
                      {formatCurrency(
                        template.automation.totalAmount /
                          template.automation.installmentCount,
                        currency
                      )}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="h-px bg-white/5 mb-8" />

          <section className="mb-24">
            <p className="text-white text-sm font-medium mb-3">Paid</p>

            {paidEntries.length === 0 ? (
              <p className="text-zinc-600 text-sm">
                No scheduled payments paid in this period.
              </p>
            ) : (
              <div className="rounded-[26px] bg-zinc-900/25 border border-white/5 overflow-hidden">
                {paidEntries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between gap-4 px-5 py-4 ${
                      index !== paidEntries.length - 1
                        ? "border-b border-white/5"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => openEditFromEntry(entry)}
                      className="min-w-0 text-left flex-1"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2
                          size={15}
                          strokeWidth={2}
                          className="text-zinc-600 shrink-0"
                        />
                        <p className="text-zinc-300 text-sm truncate">
                          {entry.description}
                        </p>
                      </div>

                      <p className="text-xs text-zinc-600 mt-1">
                        {formatDate(entry.date)} ·{" "}
                        {formatCategory(entry.category)}
                      </p>
                    </button>

                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-medium ${
                          entry.type === "income"
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {entry.type === "income" ? "+" : "-"}
                        {formatCurrency(entry.amount, currency)}
                      </p>

                      {(entry.paymentBehavior || "manual") === "manual" && (
                        <button
                          type="button"
                          onClick={() => unmarkScheduledAsPaid(entry)}
                          className="mt-2 text-[11px] text-zinc-600"
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {isEditOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 animate-[modalOverlayEnter_150ms_ease-out]"
          onClick={closeEdit}
        >
          <div className="absolute inset-0 flex items-end md:items-center md:justify-center p-3 md:p-6">
            <div
              className="w-full md:max-w-lg rounded-t-[30px] md:rounded-[30px] bg-zinc-900/95 border border-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] p-4 md:p-5 animate-[modalContentEnter_180ms_ease-out]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-white text-sm font-medium">
                  Edit scheduled item
                </p>

                <button
                  type="button"
                  onClick={closeEdit}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors duration-200 ease-out cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType("expense")}
                    className={`rounded-full h-[44px] text-sm border transition-all duration-200 ease-out active:scale-[0.98] ${
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
                    className={`rounded-full h-[44px] text-sm border transition-all duration-200 ease-out active:scale-[0.98] ${
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

                {editingKind === "recurring" && (
                  <>
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
                  </>
                )}

                {editingKind === "installment" && (
                  <>
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
                      onChange={(event) =>
                        setInstallmentCount(event.target.value)
                      }
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
                  </>
                )}

                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className={fieldClass}
                />

                {error && <p className="text-sm text-red-500 pt-1">{error}</p>}

                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="w-full rounded-full bg-[var(--accent)] text-black h-[50px] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98] cursor-pointer touch-manipulation mt-2"
                >
                  Save scheduled item
                </button>

                <button
                  type="button"
                  onClick={handleDeleteTemplate}
                  className="w-full text-center text-red-400 text-xs py-1 mt-2 transition-colors duration-200 ease-out hover:text-red-300 cursor-pointer"
                >
                  Delete scheduled item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}