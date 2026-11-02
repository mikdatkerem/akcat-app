const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' })
export const todayIstanbul = () => formatter.format(new Date())
export const validDay = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= '1900-01-01' && day <= '9998-12-30'
  && Number.isFinite(Date.parse(day + 'T12:00:00Z')) && new Date(day + 'T12:00:00Z').toISOString().slice(0, 10) === day

const labelFormatter = new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })
export function dayRangeLabel(start?: string, end?: string) {
  const label = (value: string) => labelFormatter.format(new Date(value + 'T12:00:00Z'))
  if (start && end) return start === end ? label(start) : `${label(start)} – ${label(end)}`
  if (start) return `${label(start)} tarihinden itibaren`
  if (end) return `${label(end)} tarihine kadar`
  return undefined
}
