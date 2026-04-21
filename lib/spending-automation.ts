export type EntryType = "income" | "expense"

export type EntryCategory =
  | "salary"
  | "freelance"
  | "bonus"
  | "investment_income"
  | "refund"
  | "housing"
  | "food"
  | "transport"
  | "bills"
  | "subscription"
  | "shopping"
  | "health"
  | "entertainment"
  | "travel"
  | "education"
  | "other"

export type AutomationTemplate =
  | {
      id: string
      description: string
      type: EntryType
      category: EntryCategory
      accountId: string
      createdAt: string
      updatedAt: string
      automation: {
        kind: "recurring"
        amount: number
        frequency: "monthly" | "weekly"
        startDate: string
      }
    }
  | {
      id: string
      description: string
      type: EntryType
      category: EntryCategory
      accountId: string
      createdAt: string
      updatedAt: string
      automation: {
        kind: "installment"
        totalAmount: number
        installmentCount: number
        frequency: "monthly" | "biweekly"
        startDate: string
      }
    }

export type GeneratedEntry = {
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
}

function parsePeriodKey(periodKey: string) {
  const [year, month] = periodKey.split("-").map(Number)
  return { year, monthIndex: month - 1 }
}

function startOfPeriod(periodKey: string) {
  const { year, monthIndex } = parsePeriodKey(periodKey)
  return new Date(year, monthIndex, 1, 0, 0, 0, 0)
}

function endOfPeriod(periodKey: string) {
  const { year, monthIndex } = parsePeriodKey(periodKey)
  return new Date(year, monthIndex + 1, 0, 23, 59, 59, 999)
}

function samePeriod(date: Date, periodKey: string) {
  const { year, monthIndex } = parsePeriodKey(periodKey)
  return date.getFullYear() === year && date.getMonth() === monthIndex
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addMonths(date: Date, count: number) {
  const copy = new Date(date)
  copy.setMonth(copy.getMonth() + count)
  return copy
}

function addDays(date: Date, count: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + count)
  return copy
}

function splitInstallmentAmounts(totalAmount: number, count: number) {
  const totalCents = Math.round(totalAmount * 100)
  const base = Math.floor(totalCents / count)
  const remainder = totalCents % count

  return Array.from({ length: count }, (_, index) => {
    const cents = index === count - 1 ? base + remainder : base
    return cents / 100
  })
}

export function generateEntriesForPeriod(
  templates: AutomationTemplate[],
  periodKey: string
): GeneratedEntry[] {
  const periodStart = startOfPeriod(periodKey)
  const periodEnd = endOfPeriod(periodKey)

  const generated: GeneratedEntry[] = []

  for (const template of templates) {
    const startDate = new Date(template.automation.startDate)

    if (Number.isNaN(startDate.getTime())) continue
    if (startDate > periodEnd) continue

    if (template.automation.kind === "recurring") {
      let cursor = new Date(startDate)
      let iterations = 0

      while (cursor <= periodEnd && iterations < 1000) {
        if (cursor >= periodStart && cursor <= periodEnd) {
          generated.push({
            id: `${template.id}-${toDateKey(cursor)}`,
            description: template.description,
            amount: template.automation.amount,
            type: template.type,
            category: template.category,
            date: toDateKey(cursor),
            accountId: template.accountId,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
            source: "automation",
            templateId: template.id,
            automationKind: "recurring",
            automationLabel:
              template.automation.frequency === "monthly" ? "Monthly" : "Weekly",
          })
        }

        cursor =
          template.automation.frequency === "monthly"
            ? addMonths(cursor, 1)
            : addDays(cursor, 7)

        iterations += 1
      }
    }

    if (template.automation.kind === "installment") {
      const amounts = splitInstallmentAmounts(
        template.automation.totalAmount,
        template.automation.installmentCount
      )

      for (let index = 0; index < template.automation.installmentCount; index++) {
        const occurrenceDate =
          template.automation.frequency === "monthly"
            ? addMonths(startDate, index)
            : addDays(startDate, index * 14)

        if (!samePeriod(occurrenceDate, periodKey)) continue

        generated.push({
          id: `${template.id}-${index + 1}`,
          description: template.description,
          amount: amounts[index],
          type: template.type,
          category: template.category,
          date: toDateKey(occurrenceDate),
          accountId: template.accountId,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
          source: "automation",
          templateId: template.id,
          automationKind: "installment",
          automationLabel: `${index + 1}/${template.automation.installmentCount}`,
        })
      }
    }
  }

  return generated.sort((a, b) => {
    const timeA = new Date(b.date).getTime()
    const timeB = new Date(a.date).getTime()
    return timeA - timeB
  })
}