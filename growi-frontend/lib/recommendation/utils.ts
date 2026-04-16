const MS_PER_DAY = 86_400_000

export function parseJsonArray(value: string | null | undefined): number[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function parseMonthsCsv(value: string | null | undefined): number[] {
  if (!value) return []
  // Handle JSON array format
  if (value.trim().startsWith('[')) return parseJsonArray(value)
  // Handle CSV format "1,3,5"
  return value
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n))
}

export function getCurrentSeason(month: number): 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER' {
  if (month >= 3 && month <= 5) return 'SPRING'
  if (month >= 6 && month <= 8) return 'SUMMER'
  if (month >= 9 && month <= 11) return 'AUTUMN'
  return 'WINTER'
}

export function daysSince(date: Date | null | undefined, now: Date = new Date()): number {
  if (!date) return Infinity
  return (now.getTime() - new Date(date).getTime()) / MS_PER_DAY
}

export function isMonthIn(month: number, jsonArray: string | null | undefined): boolean {
  return parseJsonArray(jsonArray).includes(month)
}
