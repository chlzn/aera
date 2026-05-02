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
  | "payments"
  | "other"

export type PaymentBehavior = "auto_paid" | "manual"

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
        paymentBehavior?: PaymentBehavior
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
        frequency: "monthly" | "biweekly" | "weekly"
        startDate: string
        paymentBehavior?: PaymentBehavior
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
  paymentBehavior: PaymentBehavior
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number)
  return { year, month, day }
}

function toDateKeyFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function addMonthsToDateKey(dateKey: string, count: number) {
  const { year, month, day } = parseDateKey(dateKey)

  const totalMonths = year * 12 + (month - 1) + count
  const nextYear = Math.floor(totalMonths / 12)
  const nextMonth = (totalMonths % 12) + 1
  const safeDay = Math.min(day, daysInMonth(nextYear, nextMonth))

  return toDateKeyFromParts(nextYear, nextMonth, safeDay)
}

function addDaysToDateKey(dateKey: string, count: number) {
  const { year, month, day } = parseDateKey(dateKey)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + count)

  return toDateKeyFromParts(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  )
}

function isSamePeriod(dateKey: string, periodKey: string) {
  return dateKey.slice(0, 7) === periodKey
}

function isBeforeOrSamePeriod(dateKey: string, periodKey: string) {
  return dateKey.slice(0, 7) <= periodKey
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

export function getScheduledPaymentId(templateId: string, date: string) {
  return `${templateId}-${date}`
}

export function generateEntriesForPeriod(
  templates: AutomationTemplate[],
  periodKey: string
): GeneratedEntry[] {
  const generated: GeneratedEntry[] = []

  for (const template of templates) {
    const startDate = template.automation.startDate
    const paymentBehavior = template.automation.paymentBehavior || "manual"

    if (!startDate || startDate.length < 10) continue
    if (!isBeforeOrSamePeriod(startDate, periodKey)) continue

    if (template.automation.kind === "recurring") {
      let cursor = startDate
      let iterations = 0

      while (cursor.slice(0, 7) <= periodKey && iterations < 1000) {
        if (isSamePeriod(cursor, periodKey)) {
          generated.push({
            id: getScheduledPaymentId(template.id, cursor),
            description: template.description,
            amount: template.automation.amount,
            type: template.type,
            category: template.category,
            date: cursor,
            accountId: template.accountId,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
            source: "automation",
            templateId: template.id,
            automationKind: "recurring",
            automationLabel:
              template.automation.frequency === "monthly" ? "Monthly" : "Weekly",
            paymentBehavior,
          })
        }

        cursor =
          template.automation.frequency === "monthly"
            ? addMonthsToDateKey(cursor, 1)
            : addDaysToDateKey(cursor, 7)

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
            ? addMonthsToDateKey(startDate, index)
            : template.automation.frequency === "weekly"
            ? addDaysToDateKey(startDate, index * 7)
            : addDaysToDateKey(startDate, index * 14)

        if (!isSamePeriod(occurrenceDate, periodKey)) continue

        generated.push({
          id: getScheduledPaymentId(template.id, occurrenceDate),
          description: template.description,
          amount: amounts[index],
          type: template.type,
          category: template.category,
          date: occurrenceDate,
          accountId: template.accountId,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
          source: "automation",
          templateId: template.id,
          automationKind: "installment",
          automationLabel: `${index + 1}/${template.automation.installmentCount}`,
          paymentBehavior,
        })
      }
    }
  }

  return generated.sort((a, b) => b.date.localeCompare(a.date))
}