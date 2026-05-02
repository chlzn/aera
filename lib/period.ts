export function getPeriodKey(dateString?: string) {
  if (!dateString) return null
  return dateString.slice(0, 7)
}

export function formatPeriodLabel(periodKey: string) {
  const [year, month] = periodKey.split("-").map(Number)
  const date = new Date(year, month - 1, 1)

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date)
}

export function isSamePeriod(dateString: string | undefined, periodKey: string) {
  if (!dateString) return false
  return dateString.slice(0, 7) === periodKey
}

export function getCurrentPeriodKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function getAvailablePeriodsFromCurrentYear() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  const periods: string[] = []

  for (let month = currentMonth; month >= 0; month--) {
    periods.push(`${currentYear}-${String(month + 1).padStart(2, "0")}`)
  }

  return periods
}