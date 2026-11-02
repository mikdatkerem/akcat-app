import { Input } from '../components/ui'

export function AmountRangeFields({ debt = false, minimum, maximum, onMinimum, onMaximum }: {
  debt?: boolean; minimum: string; maximum: string; onMinimum: (value: string) => void; onMaximum: (value: string) => void
}) {
  return <>
    <Input label={debt ? 'Minimum borç (₺)' : 'Minimum tutar (₺)'} inputMode="decimal" maxLength={32} value={minimum} placeholder="Alt sınır yok" onChange={event => onMinimum(event.target.value)} />
    <Input label={debt ? 'Maksimum borç (₺)' : 'Maksimum tutar (₺)'} inputMode="decimal" maxLength={32} value={maximum} placeholder="Üst sınır yok" onChange={event => onMaximum(event.target.value)} />
  </>
}
