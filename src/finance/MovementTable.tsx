import type { LedgerEntry } from '../services/finance'
import { formatMoney } from '../utils/format'
import { methodLabels, saleDate } from '../sales/presentation'
import { saleHref } from '../sales/routing'
import { customerHref } from '../customers/routing'
const labels = { sale: 'Satış', payment: 'Ödeme', reversal: 'Ters kayıt', record_reversal: 'Hatalı kayıt tersi', external_refund: 'Harici iade', cancellation: 'Satış iptali' }
export function MovementTable({ data, customers = false, daily = false, showDate = !daily, actorColumn = false, separateAmounts = false }: { data: LedgerEntry[]; customers?: boolean; daily?: boolean; showDate?: boolean; actorColumn?: boolean; separateAmounts?: boolean }) {
  return <div className="operation-table-scroll" role="region" aria-label="Finansal hareket tablosu" tabIndex={0}>
    <table className="operation-table"><caption className="visually-hidden">Satış ve ödeme hareketleri</caption>
      <thead><tr><th scope="col">{showDate ? 'Tarih / Saat' : 'Saat'}</th>{customers && <th scope="col">Müşteri</th>}<th scope="col">Tür</th><th scope="col">Ürün / Açıklama</th>{actorColumn && <th scope="col">İşlemi Yapan</th>}{separateAmounts ? <><th scope="col" className="money">Satış Tutarı</th><th scope="col" className="money">Ödenen</th></> : <th scope="col" className="money">Tutar</th>}{!daily && <th scope="col" className="money">İşlem sonrası bakiye</th>}</tr></thead>
      <tbody>{data.map(entry => {
        const credit = entry.type === 'payment' || entry.type === 'cancellation'
        return <tr key={entry.id}><td><time dateTime={entry.created_at}>{!showDate ? new Intl.DateTimeFormat('tr-TR', {timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit'}).format(new Date(entry.created_at)) : saleDate(entry.created_at)}</time></td>
          {customers && <td><a className="finance-link" href={customerHref(entry.customer_id)}>{entry.customer_name}</a></td>}
          <td>{labels[entry.type]}{!entry.effective && <small className="operation-reference">Borca etkisiz</small>}</td>
          <td><a className="finance-link" href={saleHref(entry.sale_id)}>{entry.description}</a><small className="operation-reference">{actorColumn ? (entry.method ? methodLabels[entry.method] : '') : entry.created_by_username + (entry.method ? ' · ' + methodLabels[entry.method] : '')}</small></td>
          {actorColumn && <td>{entry.created_by_username}</td>}
          {separateAmounts ? <>
            <td className="money">{entry.type === 'sale' || entry.type === 'cancellation' ? <>{entry.type === 'cancellation' ? '−' : ''}{formatMoney(entry.amount_kurus)}</> : '—'}</td>
            <td className="money">{entry.type !== 'sale' && entry.type !== 'cancellation' ? <>{entry.type === 'payment' ? '' : '−'}{formatMoney(entry.amount_kurus)}</> : '—'}</td>
          </> : <td className="money">{entry.effective ? credit ? '−' : '+' : ''}{formatMoney(entry.amount_kurus)}</td>}
          {!daily && <td className="money">{formatMoney(entry.balance_after_kurus)}</td>}</tr>
      })}</tbody>
    </table>
  </div>
}
