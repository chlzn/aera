"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useCurrency } from "@/context/currency-context"
import AeraLogo from "@/components/AeraLogo"

type Entry = {
  id: string
  description: string
  amount: number
  type: "income" | "expense"
  date?: string
  category?: string
}

type Investment = {
  id: string
  name: string
  type: string
  invested: number
  currentValue: number
}

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function isCurrentMonth(date?: string) {
  if (!date) return true

  const entryDate = new Date(date)
  const now = new Date()

  return (
    entryDate.getMonth() === now.getMonth() &&
    entryDate.getFullYear() === now.getFullYear()
  )
}

function formatCategory(category?: string) {
  if (!category) return "Uncategorized"
  return category
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function Home() {
  const { currency } = useCurrency()

  const [entries, setEntries] = useState<Entry[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])

  useEffect(() => {
    try {
      const savedEntries = localStorage.getItem("entries")
      const savedInvestments = localStorage.getItem("investments")

      if (savedEntries) {
        const parsedEntries = JSON.parse(savedEntries)
        setEntries(Array.isArray(parsedEntries) ? parsedEntries : [])
      }

      if (savedInvestments) {
        const parsedInvestments = JSON.parse(savedInvestments)
        setInvestments(Array.isArray(parsedInvestments) ? parsedInvestments : [])
      }
    } catch {
      setEntries([])
      setInvestments([])
    }
  }, [])

  const monthlyEntries = useMemo(
    () => entries.filter((entry) => isCurrentMonth(entry.date)),
    [entries]
  )

  const income = monthlyEntries
    .filter((entry) => entry.type === "income")
    .reduce((acc, entry) => acc + entry.amount, 0)

  const expenses = monthlyEntries
    .filter((entry) => entry.type === "expense")
    .reduce((acc, entry) => acc + entry.amount, 0)

  const investmentsTotal = investments.reduce(
    (acc, asset) => acc + (asset.currentValue || 0),
    0
  )

  const netBalance = income - expenses + investmentsTotal
  const netFlow = income - expenses

  const totalFlow = income + expenses
  const incomeWidth = totalFlow > 0 ? (income / totalFlow) * 100 : 0
  const expensesWidth = totalFlow > 0 ? (expenses / totalFlow) * 100 : 0

  const recentEntries = [...entries].slice(-5).reverse()
  const hasAnyData = entries.length > 0 || investments.length > 0

  const balanceStatus = useMemo(() => {
    if (!hasAnyData) {
      return {
        label: "No data yet",
        tone: "neutral" as const,
        message: "Start tracking to see your financial picture clearly.",
      }
    }

    if (monthlyEntries.length === 0) {
      return {
        label: "No activity this month",
        tone: "neutral" as const,
        message: "Add a transaction to keep this month updated.",
      }
    }

    if (netFlow > 0) {
      return {
        label: "Positive month",
        tone: "positive" as const,
        message: "You’re saving money this month",
      }
    }

    if (netFlow < 0) {
      return {
        label: "Spending ahead",
        tone: "negative" as const,
        message: "Your expenses are higher than your income this month.",
      }
    }

    return {
      label: "Balanced month",
      tone: "neutral" as const,
      message: "Your income and expenses are currently aligned.",
    }
  }, [hasAnyData, monthlyEntries.length, netFlow])

  const statusPillClass =
    balanceStatus.tone === "positive"
      ? "bg-[var(--accent)]/16 text-[var(--accent)] border border-[var(--accent)]/20"
      : balanceStatus.tone === "negative"
      ? "bg-white/5 text-zinc-300 border border-white/6"
      : "bg-white/5 text-zinc-300 border border-white/6"

  return (
    <main className="min-h-screen bg-black text-white px-5 py-8 pb-32">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
  <AeraLogo size={36} />
  <p className="text-zinc-500 mt-2">See your money clearly.</p>
</header>

        {!hasAnyData && (
          <section className="mb-8">
            <div className="rounded-[28px] bg-zinc-900/60 border border-white/5 shadow-[0_14px_40px_rgba(0,0,0,0.24)] p-6 sm:p-7">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                <div>
                  <p className="text-zinc-200 text-base font-medium">
                    Start tracking your money
                  </p>
                  <p className="text-zinc-500 text-sm mt-2 max-w-md">
                    Add your first transaction to begin building a clear financial view.
                  </p>
                </div>

                <Link
                  href="/spending"
                  className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] text-black px-5 py-3 text-sm font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-95"
                >
                  Add first transaction
                </Link>
              </div>
            </div>
          </section>
        )}

        <section className="mb-10">
          <div className="rounded-[30px] bg-zinc-900/72 border border-white/5 shadow-[0_14px_40px_rgba(0,0,0,0.28)] p-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <p className="text-zinc-500 text-sm mb-3">Net Balance</p>
                <h2 className="text-5xl font-semibold tracking-tight">
                  {formatCurrency(netBalance, currency)}
                </h2>
              </div>

              <span
                className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium ${statusPillClass}`}
              >
                {balanceStatus.label}
              </span>
            </div>

            <p className="mt-4 text-sm text-zinc-500">
              {balanceStatus.message}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-zinc-500">Net this month</span>
              <span
                className={
                  netFlow > 0
                    ? "text-green-500"
                    : netFlow < 0
                    ? "text-red-500"
                    : "text-zinc-300"
                }
              >
                {formatCurrency(netFlow, currency)}
              </span>
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4 mb-10">
          <div className="rounded-[26px] bg-zinc-900/55 border border-white/5 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            <p className="text-zinc-500 text-sm mb-2">Income</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(income, currency)}
            </p>
            <p className="text-xs text-zinc-600 mt-2">This month</p>
          </div>

          <div className="rounded-[26px] bg-zinc-900/55 border border-white/5 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            <p className="text-zinc-500 text-sm mb-2">Expenses</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(expenses, currency)}
            </p>
            <p className="text-xs text-zinc-600 mt-2">This month</p>
          </div>

          <div className="rounded-[26px] bg-zinc-900/55 border border-white/5 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            <p className="text-zinc-500 text-sm mb-2">Investments</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(investmentsTotal, currency)}
            </p>
            <p className="text-xs text-zinc-600 mt-2">Current value</p>
          </div>
        </section>

        <section className="rounded-[28px] bg-zinc-900/45 border border-white/5 p-6 mb-10">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-zinc-500 text-sm">This Month</p>
              <p className="text-xs text-zinc-600 mt-1">
                This month overview
              </p>
            </div>

            <span className="text-sm text-zinc-600">
              {monthlyEntries.length} transactions
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-zinc-400">Income</span>
                <span className="text-zinc-500">
                  {incomeWidth.toFixed(0)}%
                </span>
              </div>
              <div className="h-3 w-full bg-zinc-950/90 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${incomeWidth}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-zinc-400">Expenses</span>
                <span className="text-zinc-500">
                  {expensesWidth.toFixed(0)}%
                </span>
              </div>
              <div className="h-3 w-full bg-zinc-950/90 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${expensesWidth}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mb-24">
          <div className="flex items-center justify-between mb-4">
            <p className="text-zinc-500 text-sm">Recent Activity</p>
            <Link
              href="/spending"
              className="text-sm text-zinc-500 hover:text-white transition-colors duration-200 ease-out"
            >
              View all
            </Link>
          </div>

          {recentEntries.length === 0 ? (
            <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 p-6">
              <p className="text-zinc-300 text-sm">No activity yet.</p>
              <p className="text-zinc-600 text-sm mt-1">
                Start by adding your first entry.
              </p>
            </div>
          ) : (
            <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 overflow-hidden">
              {recentEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between gap-4 px-5 py-4 ${
                    index !== recentEntries.length - 1
                      ? "border-b border-white/5"
                      : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-zinc-200 truncate">{entry.description}</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      {formatCategory(entry.category)}
                    </p>
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
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

    
    </main>
  )
}