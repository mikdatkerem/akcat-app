import { AdjustmentHistory } from '../finance/AdjustmentHistory'
import { useCallback } from 'react'
import { Badge, Card, ErrorState, LoadingState } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { getSale, type Sale, type SaleSummary } from '../services/sales'
import { useResource } from '../hooks/useResource'
import { DirectionsLink } from '../components/DirectionsLink'
import { formatMoney } from '../utils/format'

import { saleDate, methodLabels } from './presentation'
import { paymentHref } from '../finance/routing'
import { CancelSale } from '../corrections/CancelSale'
import { correctionHref } from '../services/corrections'
import '../corrections/corrections.css'
export function PaymentBadge({ sale }: { sale: SaleSummary }) {
  if (sale.status === 'cancelled') return <Badge tone="neutral">İptal edildi</Badge>
  return <Badge tone={sale.payment_status === 'paid' ? 'success' : sale.payment_status === 'partial' ? 'warning' : 'info'}>
    {sale.payment_status === 'paid' ? 'Ödendi' : sale.payment_status === 'partial' ? 'Kısmi ödeme' : 'Veresiye'}
  </Badge>
}
export function SaleRecord({ id, receipt, actor }: { id: string; receipt?: Sale; actor: string }) {
  const load = useCallback(() => getSale(id), [id])
  const { result, retry } = useResource(id, load)
  if (!result) return <><PageHeader title="Satış detayı" description="Satış bilgileri yükleniyor." /><LoadingState label="Satış yükleniyor…" /></>
  if (result.error || !result.data) return <><PageHeader title="Satış detayı" description="Satış bilgileri alınamadı." /><ErrorState title="Satış görüntülenemedi" description={result.error ?? 'Lütfen tekrar deneyin.'} onRetry={retry} /><a className="text-link" href="#/satislar">Satış geçmişine dön</a></>
  const sale = result.data
  return <>
    <PageHeader title="Satış detayı" description={`${saleDate(sale.created_at)} · ${sale.created_by_username}`}
      actions={<a className="ui-button ui-button--primary" href="#/yeni-satis">Yeni satış</a>} />
    {receipt && <p className="sale-success" role="status">Satış kaydedildi. Teslimat ve ödeme bilgileri aşağıdadır.</p>}
    <div className="sale-record">
      <Card title="Müşteri ve satış" accessory={<PaymentBadge sale={sale} />}>
        <dl className="sale-details">
          <div><dt>Müşteri</dt><dd>{sale.customer.name}</dd></div><div><dt>Telefon</dt><dd>{sale.customer.phone || 'Belirtilmedi'}</dd></div>
          <div><dt>Adres</dt><dd>{sale.customer.address || 'Belirtilmedi'}<DirectionsLink address={sale.customer.address} /></dd></div><div><dt>Satış durumu</dt><dd>{sale.status === 'completed' ? 'Tamamlandı (teslim edildi)' : 'İptal edildi'}</dd></div>
          <div><dt>İşlemi yapan</dt><dd>{sale.created_by_username}</dd></div><div><dt>Oluşturulma</dt><dd><time dateTime={sale.created_at}>{saleDate(sale.created_at)}</time></dd></div>
        </dl>
      </Card>
      <Card title="Satılan ürünler">
        <ul className="sale-snapshot-items">{sale.items.map(item => {
          const customPrice = item.list_unit_price_kurus !== null && item.list_unit_price_kurus !== item.unit_price_kurus
          const difference = item.list_unit_price_kurus === null ? null : BigInt(item.unit_price_kurus) - BigInt(item.list_unit_price_kurus)
          const totalDifference = difference === null ? null : difference * BigInt(item.quantity)
          return <li key={item.id}>
            <div><div className="sale-price-indicator"><strong>{item.product_name_snapshot} × {item.quantity}</strong>
              {customPrice && <Badge tone="info">Özel fiyat</Badge>}</div>
              <small>Liste fiyatı: {item.list_unit_price_kurus === null ? 'Bu eski kayıtta bulunmuyor.' : customPrice
                ? <del className="money">{formatMoney(item.list_unit_price_kurus)}</del> : <span className="money">{formatMoney(item.list_unit_price_kurus)}</span>}</small>
              <small>Satış fiyatı: <span className="money">{formatMoney(item.unit_price_kurus)}</span></small>
              {customPrice && difference !== null && totalDifference !== null && <>
                <small>Birim fiyat farkı: <span className="money">{difference > 0n ? '+' : ''}{formatMoney(difference)}</span></small>
                <small>Toplam fiyat farkı: <span className="money">{totalDifference > 0n ? '+' : ''}{formatMoney(totalDifference)}</span></small>
              </>}
            </div>
            <div className="sale-line-total"><small>Satır toplamı</small><strong className="money">{formatMoney(item.line_total_kurus)}</strong></div>
          </li>
        })}</ul>
        <p className="sale-help">Satış anındaki ad ve fiyatlar gösterilir.</p>
      </Card>
      <Card title="Ödeme ve kalan borç">
        <dl className="sale-totals">
          <div><dt>Satış toplamı</dt><dd className="money">{formatMoney(sale.total_kurus)}</dd></div>
          <div><dt>Ödenen</dt><dd className="money">{formatMoney(sale.paid_kurus)}</dd></div>
          <div><dt>Kalan borç</dt><dd className="money">{formatMoney(sale.remaining_kurus)}</dd></div>
        </dl>
        {sale.status === 'completed' && sale.remaining_kurus > 0 && <div className="finance-actions"><a className="ui-button ui-button--secondary" href={paymentHref(sale.customer_id, sale.id)}>Bu satışa tahsilat al</a></div>}
        {sale.payments.length === 0 ? <p className="sale-credit">Geçerli ödeme kaydı bulunmuyor.{sale.remaining_kurus > 0 ? ' Satış veresiye.' : ''}</p>
          : <ul className="sale-payment-list" aria-label="Geçerli ödeme hareketleri">{sale.payments.map(payment => <li key={payment.id}>
            <div><strong>{payment.is_initial ? 'İlk ödeme' : 'Ödeme'} · {methodLabels[payment.method]}</strong>
              <small>{saleDate(payment.created_at)} · {payment.created_by_username}</small></div><span className="money">{formatMoney(payment.amount_kurus)}</span>
          <a className="text-link" href={correctionHref('payment', payment.id)}>Tahsilat düzeltmesi / iade talebi</a>
          </li>)}</ul>}
      </Card>
    </div>
    <AdjustmentHistory filter={{ sale_id: sale.id }} />
    <Card title="İptal ve düzeltme">
      <CancelSale sale={sale} actor={actor} onSaved={retry} />
      <div className="finance-actions"><a className="text-link" href={correctionHref('sale', sale.id)}>Düzeltme Talebi Oluştur</a></div>
      {sale.cancellation_history.length > 0 && <ul className="correction-history" aria-label="İptal geçmişi">{sale.cancellation_history.map((log, index) => <li key={index}>
        <strong>Satış iptal edildi</strong><span>{log.username} · {saleDate(log.created_at)}</span><p>{log.reason}</p>
        {log.correction_id && <a className="text-link" href={'#/duzeltmeler/' + log.correction_id}>Onaylanan düzeltme talebi</a>}
      </li>)}</ul>}
      {sale.status === 'cancelled' && sale.cancellation_history.length === 0 && <p>Bu eski iptal için gerekçe ve kullanıcı bilgisi bulunmuyor.</p>}
    </Card>
    <a className="text-link" href="#/satislar">Satış geçmişine dön</a>
  </>
}
