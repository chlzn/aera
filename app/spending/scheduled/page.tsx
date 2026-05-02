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
      localStorage.setItem(
        "paidScheduledPayments",
        JSON.stringify(paidScheduledIds)
      )
    } catch {
      // silent
    }
  }, [paidScheduledIds, hydrated])

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

  const markScheduledAsPaid = (entry: DisplayEntry) => {
    setPaidScheduledIds((prev) => {
      if (prev.includes(entry.id)) return prev
      return [...prev, entry.id]
    })
  }

  const unmarkScheduledAsPaid = (entry: DisplayEntry) => {
    setPaidScheduledIds((prev) => prev.filter((id) => id !== entry.id))
  }

  return (
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
                const isManual = (entry.paymentBehavior || "manual") === "manual"

                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between gap-4 px-5 py-4 ${
                      index !== upcomingEntries.length - 1
                        ? "border-b border-white/5"
                        : ""
                    }`}
                  >
                    <div className="min-w-0">
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
                    </div>

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
                          onClick={() => markScheduledAsPaid(entry)}
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
                <div
                  key={template.id}
                  className="flex items-center justify-between gap-4"
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
                </div>
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
                <div
                  key={template.id}
                  className="flex items-center justify-between gap-4"
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
                </div>
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
                  <div className="min-w-0">
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
                      {formatDate(entry.date)} · {formatCategory(entry.category)}
                    </p>
                  </div>

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
  )
}