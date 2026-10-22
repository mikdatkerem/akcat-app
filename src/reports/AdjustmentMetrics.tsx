import type { AdjustmentTotals } from '../services/adjustments'
import { formatMoney } from '../utils/format'
import { Metrics } from './ReportParts'

export function AdjustmentMetrics({ totals, methods = false }: { totals: AdjustmentTotals; methods?: boolean }) {
  return <><Metrics values={[
    { key: 'reversals', label: 'Hatalı kayıt ters toplamı', value: totals.record_reversal_kurus },
    { key: 'refunds', label: 'Teyitli harici iade toplamı', value: totals.external_refund_kurus },
  ]} />
    {methods && <dl className="sale-details">
      <div><dt>Ters kayıt · nakit / kart / banka</dt><dd className="money">{formatMoney(totals.reversal_cash_kurus)} / {formatMoney(totals.reversal_card_kurus)} / {formatMoney(totals.reversal_bank_kurus)}</dd></div>
      <div><dt>Harici iade · nakit / kart / banka</dt><dd className="money">{formatMoney(totals.refund_cash_kurus)} / {formatMoney(totals.refund_card_kurus)} / {formatMoney(totals.refund_bank_kurus)}</dd></div>
    </dl>}
    <p className="report-help">Geçerli tahsilatlar, asıl tahsilat tarihinde ve güncel geçerliliğiyle hesaplanır. Ters kayıt ve iadeler kendi kayıt tarihinde ayrı gösterilir; tahsilat toplamından tekrar düşülmez. Bu değerler fiziksel kasa bakiyesi veya dönemsel net nakit akışı değildir.</p>
  </>
}
