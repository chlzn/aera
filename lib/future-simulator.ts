import {
  type AutomationTemplate,
  generateEntriesForPeriod,
} from "@/lib/spending-automation"

export type SimulatorAdjustment = {
  id: string
  type: "income" | "expense"
  amount: number
  date: string
  note?: string
  createdAt: string
  updatedAt: string
}

export type SimulatorPeriodOption = "1M" | "3M" | "6M" | "12M"

export type FutureMonthSummary = {
  periodKey: string
  label: string
  recurringIncome: number
  recurringExpenses: number
  installmentExpenses: number
  installmentIncome: number
  adjustmentsIncome: number
  adjustmentsExpenses: number
  netChange: number
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1)
}

function toPeriodKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  return `${year}-${month}`
}

function toPeriodLabel(periodKey: string) {
  const [year, month] = periodKey.split("-").map(Number)
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, 1))
}

function monthsFromOption(option: SimulatorPeriodOption) {
  if (option === "1M") return 1
  if (option === "3M") return 3
  if (option === "6M") return 6
  return 12
}

function isSamePeriod(date: string, periodKey: string) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return false
  const year = d.getFullYear()
  const month = `${d.getMonth() + 1}`.padStart(2, "0")
  return `${year}-${month}` === periodKey
}

export function getCurrentCashFromEntries(
  entries: Array<{ type: "income" | "expense"; amount: number }>
) {
  const income = entries
    .filter((entry) => entry.type === "income")
    .reduce((sum, entry) => sum + entry.amount, 0)

  const expenses = entries
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + entry.amount, 0)

  return income - expenses
}

export function buildFutureSummaries(params: {
  templates: AutomationTemplate[]
  adjustments: SimulatorAdjustment[]
  period: SimulatorPeriodOption
  fromDate?: Date
}) {
  const { templates, adjustments, period, fromDate = new Date() } = params

  const startMonth = getMonthStart(fromDate)
  const count = monthsFromOption(period)

  const months: FutureMonthSummary[] = []

  for (let index = 1; index <= count; index++) {
    const targetMonth = addMonths(startMonth, index)
    const periodKey = toPeriodKey(targetMonth)

    const generated = generateEntriesForPeriod(templates, periodKey)

    const recurringIncome = generated
      .filter(
        (entry) =>
          entry.automationKind === "recurring" && entry.type === "income"
      )
      .reduce((sum, entry) => sum + entry.amount, 0)

    const recurringExpenses = generated
      .filter(
        (entry) =>
          entry.automationKind === "recurring" && entry.type === "expense"
      )
      .reduce((sum, entry) => sum + entry.amount, 0)

    const installmentIncome = generated
      .filter(
        (entry) =>
          entry.automationKind === "installment" && entry.type === "income"
      )
      .reduce((sum, entry) => sum + entry.amount, 0)

    const installmentExpenses = generated
      .filter(
        (entry) =>
          entry.automationKind === "installment" && entry.type === "expense"
      )
      .reduce((sum, entry) => sum + entry.amount, 0)

    const adjustmentsIncome = adjustments
      .filter(
        (adjustment) =>
          adjustment.type === "income" && isSamePeriod(adjustment.date, periodKey)
      )
      .reduce((sum, adjustment) => sum + adjustment.amount, 0)

    const adjustmentsExpenses = adjustments
      .filter(
        (adjustment) =>
          adjustment.type === "expense" && isSamePeriod(adjustment.date, periodKey)
      )
      .reduce((sum, adjustment) => sum + adjustment.amount, 0)

    const netChange =
      recurringIncome -
      recurringExpenses +
      installmentIncome -
      installmentExpenses +
      adjustmentsIncome -
      adjustmentsExpenses

    months.push({
      periodKey,
      label: toPeriodLabel(periodKey),
      recurringIncome,
      recurringExpenses,
      installmentIncome,
      installmentExpenses,
      adjustmentsIncome,
      adjustmentsExpenses,
      netChange,
    })
  }

  return months
}

export function getSimulatorStatus(finalChange: number) {
  if (finalChange < 0) return "You may run short this period."
  if (finalChange <= 300) return "Tight balance ahead."
  return "You're on track."
}