"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, CircleDollarSign, Layers, Wallet } from "lucide-react"
import { useCurrency } from "@/context/currency-context"
import { getCurrentPeriodKey } from "@/lib/period"
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

type InvestmentEntry = {
  id: string
  name: string
  type:
    | "crypto"
    | "stock"
    | "etf"
    | "real_estate"
    | "fixed_income"
    | "cash"
    | "other"
  amount: number
  ticker?: string
  notes?: string
  date: string
  accountId: string
  createdAt: string
  updatedAt: string
}

type LegacyInvestment = {
  id: string
  name: string
  type: string
  invested: number
  currentValue: number
  ticker?: string
  accountId: string
  createdAt: string
  updatedAt: string
}

type DisplayEntry = Entry & {
  source: "manual" | "automation"
  templateId?: string
  automationKind?: "recurring" | "installment"
  automationLabel?: string
  paymentBehavior?: "auto_paid" | "manual"
}

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value)
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

function isDue(date: string) {
  return date <= getTodayDate()
}

function getHoldingKey(name: string, ticker?: string) {
  const cleanTicker = ticker?.trim().toUpperCase()

  if (cleanTicker) {
    return cleanTicker
  }

  return name.trim().toLowerCase().replace(/\s+/g, "-")
}

function getInsight({
  income,
  expenses,
  monthlyResult,
  portfolioValue,
  portfolioProfit,
  cashBalance,
}: {
  income: number
  expenses: number
  monthlyResult: number
  portfolioValue: number
  portfolioProfit: number
  cashBalance: number
}) {
  if (income <= 0 && expenses <= 0 && portfolioValue <= 0 && cashBalance <= 0) {
    return "Start tracking your money to see your financial picture clearly."
  }

  if (monthlyResult > 0 && portfolioProfit > 0) {
    return "Positive month overall — your cash flow and portfolio are both moving well."
  }

  if (monthlyResult > 0) {
    return "You’re saving part of your income this month."
  }

  if (income > 0 && expenses / income < 0.8) {
    return "Your spending is under control."
  }

  if (income > 0 && expenses > income) {
    return "High spending detected this month."
  }

  if (portfolioProfit > 0) {
    return "Your portfolio is above your invested capital."
  }

  if (cashBalance > 0) {
    return "You still have cash available from previous months."
  }

  return "Your financial picture is stable, but worth watching closely."
}

export default function Home() {
  const { currency } = useCurrency()

  const [entries, setEntries] = useState<Entry[]>([])
  const [templates, setTemplates] = useState<AutomationTemplate[]>([])
  const [paidScheduledIds, setPaidScheduledIds] = useState<string[]>([])

  const [investmentEntries, setInvestmentEntries] = useState<InvestmentEntry[]>(
    []
  )
  const [holdingValues, setHoldingValues] = useState<Record<string, number>>({})
  const [legacyInvestments, setLegacyInvestments] = useState<
    LegacyInvestment[]
  >([])

  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const savedEntries = localStorage.getItem("entries")
      const savedTemplates = localStorage.getItem("automationTemplates")
      const savedPaidScheduledIds = localStorage.getItem("paidScheduledPayments")
      const savedInvestmentEntries = localStorage.getItem("investmentEntries")
      const savedHoldingValues = localStorage.getItem("investmentHoldingValues")
      const savedLegacyInvestments = localStorage.getItem("investments")

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

      if (savedInvestmentEntries) {
        const parsedInvestmentEntries = JSON.parse(savedInvestmentEntries)
        setInvestmentEntries(
          Array.isArray(parsedInvestmentEntries) ? parsedInvestmentEntries : []
        )
      }

      if (savedHoldingValues) {
        const parsedHoldingValues = JSON.parse(savedHoldingValues)
        setHoldingValues(
          parsedHoldingValues && typeof parsedHoldingValues === "object"
            ? parsedHoldingValues
            : {}
        )
      }

      if (savedLegacyInvestments) {
        const parsedLegacyInvestments = JSON.parse(savedLegacyInvestments)
        setLegacyInvestments(
          Array.isArray(parsedLegacyInvestments) ? parsedLegacyInvestments : []
        )
      }
    } catch {
      setEntries([])
      setTemplates([])
      setPaidScheduledIds([])
      setInvestmentEntries([])
      setHoldingValues({})
      setLegacyInvestments([])
    } finally {
      setHydrated(true)
    }
  }, [])

  const currentPeriod = getCurrentPeriodKey()

  const monthlyManualEntries = useMemo<DisplayEntry[]>(() => {
    return entries
      .filter((entry) => entry.date.slice(0, 7) === currentPeriod)
      .map((entry) => ({
        ...entry,
        source: "manual" as const,
      }))
  }, [entries, currentPeriod])

  const monthlyGeneratedEntries = useMemo<DisplayEntry[]>(() => {
    return generateEntriesForPeriod(templates, currentPeriod).map((entry) => ({
      ...entry,
      source: "automation" as const,
    }))
  }, [templates, currentPeriod])

  const monthlyConfirmedGeneratedEntries = useMemo(() => {
    return monthlyGeneratedEntries.filter((entry) => {
      const behavior = entry.paymentBehavior || "manual"

      if (behavior === "auto_paid") {
        return isDue(entry.date)
      }

      return paidScheduledIds.includes(entry.id)
    })
  }, [monthlyGeneratedEntries, paidScheduledIds])

  const monthlyEntries = useMemo(() => {
    return [...monthlyManualEntries, ...monthlyConfirmedGeneratedEntries]
  }, [monthlyManualEntries, monthlyConfirmedGeneratedEntries])

  const monthlyIncome = useMemo(() => {
    return monthlyEntries
      .filter((entry) => entry.type === "income")
      .reduce((sum, entry) => sum + entry.amount, 0)
  }, [monthlyEntries])

  const monthlyExpenses = useMemo(() => {
    return monthlyEntries
      .filter((entry) => entry.type === "expense")
      .reduce((sum, entry) => sum + entry.amount, 0)
  }, [monthlyEntries])

  const monthlyResult = monthlyIncome - monthlyExpenses

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

    if (periods.length === 0) return currentPeriod

    return periods.sort()[0]
  }, [entries, templates, currentPeriod])

  const cumulativePeriodKeys = useMemo(() => {
    return getPeriodRange(earliestPeriod, currentPeriod)
  }, [earliestPeriod, currentPeriod])

  const currentPeriodCutoffDate = useMemo(() => {
    return currentPeriod === getCurrentPeriodKey()
      ? getTodayDate()
      : getEndOfPeriodDate(currentPeriod)
  }, [currentPeriod])

  const cumulativeManualEntries = useMemo<DisplayEntry[]>(() => {
    return entries
      .filter((entry) => entry.date <= currentPeriodCutoffDate)
      .map((entry) => ({
        ...entry,
        source: "manual" as const,
      }))
  }, [entries, currentPeriodCutoffDate])

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
      if (entry.date > currentPeriodCutoffDate) return false

      const behavior = entry.paymentBehavior || "manual"

      if (behavior === "auto_paid") {
        return isDue(entry.date)
      }

      return paidScheduledIds.includes(entry.id)
    })
  }, [cumulativeGeneratedEntries, paidScheduledIds, currentPeriodCutoffDate])

  const cumulativeEntries = useMemo(() => {
    return [...cumulativeManualEntries, ...cumulativeConfirmedGeneratedEntries]
  }, [cumulativeManualEntries, cumulativeConfirmedGeneratedEntries])

  const cashBalance = useMemo(() => {
    const totalIncome = cumulativeEntries
      .filter((entry) => entry.type === "income")
      .reduce((sum, entry) => sum + entry.amount, 0)

    const totalExpenses = cumulativeEntries
      .filter((entry) => entry.type === "expense")
      .reduce((sum, entry) => sum + entry.amount, 0)

    return totalIncome - totalExpenses
  }, [cumulativeEntries])

  const portfolioTotals = useMemo(() => {
    if (investmentEntries.length > 0) {
      const grouped = investmentEntries.reduce<Record<string, InvestmentEntry[]>>(
        (acc, entry) => {
          const key = getHoldingKey(entry.name, entry.ticker)
          acc[key] = [...(acc[key] || []), entry]
          return acc
        },
        {}
      )

      return Object.entries(grouped).reduce(
        (acc, [key, holdingEntries]) => {
          const invested = holdingEntries.reduce(
            (sum, entry) => sum + entry.amount,
            0
          )
          const currentValue =
            typeof holdingValues[key] === "number"
              ? holdingValues[key]
              : invested

          return {
            invested: acc.invested + invested,
            currentValue: acc.currentValue + currentValue,
          }
        },
        { invested: 0, currentValue: 0 }
      )
    }

    return legacyInvestments.reduce(
      (acc, investment) => {
        return {
          invested: acc.invested + (investment.invested || 0),
          currentValue:
            acc.currentValue +
            (investment.currentValue || investment.invested || 0),
        }
      },
      { invested: 0, currentValue: 0 }
    )
  }, [investmentEntries, holdingValues, legacyInvestments])

  const portfolioProfit = portfolioTotals.currentValue - portfolioTotals.invested

  const portfolio = portfolioTotals.currentValue
  const netWorth = cashBalance + portfolio

  const cashPct =
    netWorth > 0 ? Math.max(0, Math.min(100, (cashBalance / netWorth) * 100)) : 0
  const portfolioPct =
    netWorth > 0 ? Math.max(0, Math.min(100, (portfolio / netWorth) * 100)) : 0

  const insight = getInsight({
    income: monthlyIncome,
    expenses: monthlyExpenses,
    monthlyResult,
    portfolioValue: portfolio,
    portfolioProfit,
    cashBalance,
  })

  const statusLabel = useMemo(() => {
    if (monthlyResult > 0 && portfolioProfit > 0) return "Positive overall"
    if (monthlyResult > 0) return "Positive month"
    if (monthlyIncome > 0 && monthlyExpenses / monthlyIncome < 0.8) {
      return "Spending controlled"
    }
    if (monthlyIncome > 0 && monthlyExpenses > monthlyIncome) {
      return "High spending"
    }
    if (portfolio > cashBalance) return "Asset heavy"
    return "Tracking"
  }, [
    monthlyResult,
    portfolioProfit,
    monthlyIncome,
    monthlyExpenses,
    portfolio,
    cashBalance,
  ])

  return (
    <main className="min-h-screen bg-black text-white px-5 py-8 pb-32">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-semibold tracking-tight">
            Aera<span className="text-[var(--accent)]">.</span>
          </h1>
          <p className="text-zinc-500 mt-2">
            Your financial life, clearly understood.
          </p>
        </header>

        <section className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-3">
            <p className="text-zinc-500 text-sm">Net Worth</p>

            <span className="rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/[0.08] px-3 py-1 text-xs text-[var(--accent)]">
              {statusLabel}
            </span>
          </div>

          <h2 className="text-6xl font-semibold tracking-tight text-white">
            {hydrated
              ? formatCurrency(netWorth, currency)
              : formatCurrency(0, currency)}
          </h2>
        </section>

        <section className="mb-7">
          <div className="grid grid-cols-3 gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={15} strokeWidth={2} className="text-zinc-600" />
                <p className="text-zinc-500 text-xs">Cash</p>
              </div>
              <p className="text-white text-sm font-medium">
                {formatCurrency(cashBalance, currency)}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Layers size={15} strokeWidth={2} className="text-zinc-600" />
                <p className="text-zinc-500 text-xs">Portfolio</p>
              </div>
              <p className="text-white text-sm font-medium">
                {formatCurrency(portfolio, currency)}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <CircleDollarSign
                  size={15}
                  strokeWidth={2}
                  className="text-zinc-600"
                />
                <p className="text-zinc-500 text-xs">Monthly</p>
              </div>
              <p
                className={`text-sm font-medium ${
                  monthlyResult >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {monthlyResult >= 0 ? "+" : ""}
                {formatCurrency(monthlyResult, currency)}
              </p>
            </div>
          </div>
        </section>

        <div className="h-px bg-white/5 mb-7" />

        <section className="mb-8">
          <p className="text-white text-sm font-medium mb-2">
            Financial status
          </p>
          <p className="text-zinc-400 text-sm leading-relaxed">{insight}</p>
        </section>

        <div className="h-px bg-white/5 mb-7" />

        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white text-sm font-medium">Composition</p>
            <p className="text-zinc-600 text-xs">Cash vs Portfolio</p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-zinc-400">Cash</span>
                <span className="text-zinc-500">
                  {netWorth > 0 ? `${cashPct.toFixed(0)}%` : "0%"}
                </span>
              </div>
              <div className="h-2 rounded-full bg-zinc-900 overflow-hidden">
                <div
                  className="h-full rounded-full bg-white/30 transition-all duration-300"
                  style={{ width: `${cashPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-zinc-400">Portfolio</span>
                <span className="text-zinc-500">
                  {netWorth > 0 ? `${portfolioPct.toFixed(0)}%` : "0%"}
                </span>
              </div>
              <div className="h-2 rounded-full bg-zinc-900 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--accent)]/70 transition-all duration-300"
                  style={{ width: `${portfolioPct}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-white/5 mb-7" />

        <section className="mb-24">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white text-sm font-medium">This month</p>
            <ArrowUpRight size={16} strokeWidth={2} className="text-zinc-600" />
          </div>

          <div className="grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Income</span>
              <span className="text-white font-medium">
                {formatCurrency(monthlyIncome, currency)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Expenses</span>
              <span className="text-white font-medium">
                {formatCurrency(monthlyExpenses, currency)}
              </span>
            </div>

            <div className="h-px bg-white/5 my-1" />

            <div className="flex items-center justify-between">
              <span className="text-zinc-300">Result</span>
              <span
                className={`font-medium ${
                  monthlyResult >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {monthlyResult >= 0 ? "+" : ""}
                {formatCurrency(monthlyResult, currency)}
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}