import type { AdjustmentTotals } from '../services/adjustments'
import { formatMoney } from '../utils/format'
import { Metrics } from './ReportParts'
import { HelpDisclosure } from '../components/ui'

export function AdjustmentMetrics({ totals, methods = false }: { totals: AdjustmentTotals; methods?: boolean }) {
  return <><Metrics values={[
    { key: 'reversals', label: 'Hatalı kayıt ters toplamı', value: totals.record_reversal_kurus },
    { key: 'refunds', label: 'Teyitli harici iade toplamı', value: totals.external_refund_kurus },
  ]} />
    {methods && <dl className="sale-details">
      <div><dt>Ters kayıt · nakit / kart / banka</dt><dd className="money">{formatMoney(totals.reversal_cash_kurus)} / {formatMoney(totals.reversal_card_kurus)} / {formatMoney(totals.reversal_bank_kurus)}</dd></div>
      <div><dt>Harici iade · nakit / kart / banka</dt><dd className="money">{formatMoney(totals.refund_cash_kurus)} / {formatMoney(totals.refund_card_kurus)} / {formatMoney(totals.refund_bank_kurus)}</dd></div>
    </dl>}
    <HelpDisclosure title="Ters kayıt ve iade toplamları hakkında">
      <p>Geçerli tahsilatlar, asıl tahsilat tarihinde ve güncel geçerliliğiyle hesaplanır.</p>
      <p>Ters kayıt ve iadeler kendi kayıt tarihinde ayrı gösterilir; tahsilat toplamından tekrar düşülmez.</p>
      <p>Bu değerler fiziksel kasa bakiyesi veya dönemsel net nakit akışı değildir.</p>
    </HelpDisclosure>
  </>
}
