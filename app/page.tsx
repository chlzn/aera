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

  const monthlyIncome = monthlyEntries
    .filter((entry) => entry.type === "income")
    .reduce((acc, entry) => acc + entry.amount, 0)

  const monthlyExpenses = monthlyEntries
    .filter((entry) => entry.type === "expense")
    .reduce((acc, entry) => acc + entry.amount, 0)

  const investmentsTotal = investments.reduce(
    (acc, asset) => acc + (asset.currentValue || 0),
    0
  )

  const totalIncome = entries
    .filter((entry) => entry.type === "income")
    .reduce((acc, entry) => acc + entry.amount, 0)

  const totalExpenses = entries
    .filter((entry) => entry.type === "expense")
    .reduce((acc, entry) => acc + entry.amount, 0)

  const cash = totalIncome - totalExpenses
  const netWorth = cash + investmentsTotal
  const netFlow = monthlyIncome - monthlyExpenses

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
        message: "Saving money this month.",
      }
    }

    if (netFlow < 0) {
      return {
        label: "Spending ahead",
        tone: "negative" as const,
        message: "Expenses are higher than income this month.",
      }
    }

    return {
      label: "Balanced month",
      tone: "neutral" as const,
      message: "Income and expenses are currently aligned.",
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

        <section className="mb-8">
          <div className="rounded-[30px] bg-zinc-900/72 border border-white/5 shadow-[0_14px_40px_rgba(0,0,0,0.28)] p-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <p className="text-zinc-500 text-sm mb-3">Net Worth</p>

                <h2 className="text-5xl font-semibold tracking-tight">
                  {formatCurrency(netWorth, currency)}
                </h2>

                <div className="mt-5 flex gap-6 flex-wrap text-sm">
                  <div className="flex flex-col">
                    <span className="text-zinc-500">Cash</span>
                    <span className="text-white font-medium">
                      {formatCurrency(cash, currency)}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-zinc-500">Investments</span>
                    <span className="text-white font-medium">
                      {formatCurrency(investmentsTotal, currency)}
                    </span>
                  </div>
                </div>
              </div>

              <span
                className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium ${statusPillClass}`}
              >
                {balanceStatus.label}
              </span>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <p className="text-sm text-zinc-400">{balanceStatus.message}</p>
        </section>

        <section className="mb-24">
          <div className="rounded-[28px] bg-zinc-900/45 border border-white/5 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-white text-sm font-medium">This month</p>
                <p className="text-xs text-zinc-600 mt-1">
                  Current monthly snapshot
                </p>
              </div>

              <span className="text-xs text-zinc-600">
                {new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  year: "numeric",
                }).format(new Date())}
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-400 text-sm">Income</span>
                <span className="text-white text-sm font-medium">
                  {formatCurrency(monthlyIncome, currency)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-400 text-sm">Expenses</span>
                <span className="text-white text-sm font-medium">
                  {formatCurrency(monthlyExpenses, currency)}
                </span>
              </div>

              <div className="h-px bg-white/5" />

              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-300 text-sm font-medium">Net</span>
                <span
                  className={`text-sm font-medium ${
                    netFlow > 0
                      ? "text-green-500"
                      : netFlow < 0
                      ? "text-red-500"
                      : "text-zinc-300"
                  }`}
                >
                  {formatCurrency(netFlow, currency)}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}