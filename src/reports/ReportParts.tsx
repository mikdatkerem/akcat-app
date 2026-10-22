import type { ReactNode } from 'react'
import { Card, EmptyState } from '../components/ui'
import type { ReportRange } from '../services/reports'
import { formatMoney } from '../utils/format'
import { saleDate } from '../sales/presentation'

export function Metrics({ values }: { values: { key: string; label: string; value: number; money?: boolean }[] }) {
  return <dl className="report-metrics">{values.map(item => <div key={item.key}><dt>{item.label}</dt>
    <dd data-metric={item.key} className={item.money === false ? '' : 'money'}>{item.money === false ? new Intl.NumberFormat('tr-TR').format(item.value) : formatMoney(item.value)}</dd>
  </div>)}</dl>
}
export function RangeNote({ range, current = false }: { range: ReportRange; current?: boolean }) {
  return <div className="report-range">
    <p>{current ? 'Güncel bakiye: tarih aralığından bağımsız, tüm açık satışlar.' : <>Türkiye saati: {saleDate(range.from)} – {saleDate(range.to)} <span>(bitiş hariç)</span></>}</p>
    <small>Rapor zamanı: <time dateTime={range.generated_at}>{saleDate(range.generated_at)}</time> · {range.time_zone}</small>
  </div>
}
export type Column<T> = { label: string; cell: (row: T) => ReactNode }
export function ReportTable<T>({ rows, columns, rowKey, label }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; label: string }) {
  if (rows.length === 0) return <Card title={label}><EmptyState title="Rapor kaydı bulunamadı" description="Seçilen dönem ve filtrelerle eşleşen kayıt yok." /></Card>
  return <div className="report-table-surface"><table className="report-table"><caption className="visually-hidden">{label}</caption>
    <thead><tr>{columns.map(column => <th key={column.label} scope="col">{column.label}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={rowKey(row)}>{columns.map(column => <td key={column.label} data-label={column.label}>{column.cell(row)}</td>)}</tr>)}</tbody>
  </table></div>
}
