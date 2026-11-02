import { Button, Input } from '../components/ui'
import { todayIstanbul, validDay } from '../utils/day'
function shift(day: string, step: number) { const value = new Date(day + 'T12:00:00Z'); value.setUTCDate(value.getUTCDate() + step); return value.toISOString().slice(0, 10) }
export function DayNavigator({ day, onChange, maxDay = '9998-12-30', dateInput = true, periodLabel }: { day: string; onChange: (day: string) => void; maxDay?: string; dateInput?: boolean; periodLabel?: string }) {
  const showReturn = day !== todayIstanbul() || !!periodLabel
  return <nav className={`finance-day-nav${dateInput ? '' : ' finance-day-nav--readonly'}`} aria-label="İşlem günü">
    <Button variant="secondary" disabled={day <= '1900-01-01'} onClick={() => onChange(shift(day, -1))}>← Önceki gün</Button>
    {dateInput ? <Input label={day === todayIstanbul() ? 'İşlem tarihi · Bugün' : 'İşlem tarihi'} type="date" min="1900-01-01" max={maxDay} value={day}
      onChange={event => { if (validDay(event.target.value) && event.target.value <= maxDay) onChange(event.target.value) }} />
      : <span className="finance-day-label" role="status">{periodLabel || <><time dateTime={day}>{new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(day + 'T12:00:00Z'))}</time>{day === todayIstanbul() && <small>Bugün</small>}</>}</span>}
    <Button variant="secondary" disabled={day >= maxDay} onClick={() => onChange(shift(day, 1))}>Sonraki gün →</Button>
    <Button variant="ghost" className={`finance-day-return${showReturn ? '' : ' finance-day-return--hidden'}`} disabled={!showReturn} aria-hidden={!showReturn || undefined} tabIndex={showReturn ? undefined : -1} onClick={() => onChange(todayIstanbul())}>Bugüne Dön</Button>
  </nav>
}
