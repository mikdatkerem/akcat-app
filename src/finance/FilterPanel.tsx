import { useId, useState, type ReactNode } from 'react'
import { Icon } from '../components/ui'
import './finance.css'

export function FilterPanel({ active, children }: { active: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false), id = useId()
  return <section className="finance-filter-panel" aria-label="Filtre ayarları">
    <button type="button" className="finance-filter-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span>Filtreler{active && <span className="finance-filter-active"> · Uygulanıyor</span>}</span>
      <Icon name="arrow" width="18" height="18" />
    </button>
    <div id={id} className="finance-filter-panel__body" hidden={!open}>{children}</div>
  </section>
}
