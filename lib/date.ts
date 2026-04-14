export function isCurrentMonth(dateString?: string) {
  if (!dateString) return false

  const date = new Date(dateString)
  const now = new Date()

  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  )
}