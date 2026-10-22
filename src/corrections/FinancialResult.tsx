import type { Correction } from '../services/corrections'
import { adjustmentLabels } from '../services/adjustments'
import { formatMoney } from '../utils/format'
import { methodLabels, saleDate } from '../sales/presentation'
import { saleHref } from '../sales/routing'

export function FinancialResult({ row }: { row: Correction }) {
  const data = row.adjustment ?? row.financial_preview
  if (!data) {
    const preview = row.cancellation_preview
    return preview ? <section aria-label="Satış iptali finansal önizlemesi"><h3>İptal öncesi finansal sonuç</h3><dl className="sale-details">
      <div><dt>Satış tutarı</dt><dd className="money">{formatMoney(preview.amount_kurus)}</dd></div>
      <div><dt>Satış borcu (önce → beklenen)</dt><dd className="money">{formatMoney(preview.before_sale_remaining_kurus)} → {formatMoney(preview.after_sale_remaining_kurus)}</dd></div>
      <div><dt>Müşteri borcu (önce → beklenen)</dt><dd className="money">{formatMoney(preview.before_customer_debt_kurus)} → {formatMoney(preview.after_customer_debt_kurus)}</dd></div>
    </dl><p className="sale-help">İptal para iadesi yapmaz. Her ödeme önce teyitli harici iade veya hatalı kayıt ters kaydıyla kapatılmalıdır; onayda yeniden kontrol edilir.</p></section> : null
  }
  return <section aria-label={row.adjustment ? 'Uygulanan finansal düzeltme' : 'Finansal sonuç önizlemesi'}>
    <h3>{row.adjustment ? adjustmentLabels[row.adjustment.kind] : 'Onay öncesi finansal sonuç'}</h3>
    <dl className="sale-details correction-details">
      <div><dt>Orijinal tahsilat</dt><dd>{data.payment_id}</dd></div><div><dt>Müşteri</dt><dd>{data.customer_name}</dd></div>
      <div><dt>Tam tutar / yöntem</dt><dd className="money">{formatMoney(data.amount_kurus)} · {methodLabels[data.method]}</dd></div>
      <div><dt>Önceki satış borcu</dt><dd className="money">{formatMoney(data.before_sale_remaining_kurus)}</dd></div>
      <div><dt>{row.adjustment ? 'İşlem sonrası satış borcu' : 'Beklenen satış borcu'}</dt><dd className="money">{formatMoney(data.after_sale_remaining_kurus)}</dd></div>
      <div><dt>Önceki müşteri borcu</dt><dd className="money">{formatMoney(data.before_customer_debt_kurus)}</dd></div>
      <div><dt>{row.adjustment ? 'İşlem sonrası müşteri borcu' : 'Beklenen müşteri borcu'}</dt><dd className="money">{formatMoney(data.after_customer_debt_kurus)}</dd></div>
      {row.financial_preview && <div><dt>Orijinal işlemi yapan / tarih</dt><dd>{row.financial_preview.original_created_by_username} · {saleDate(row.financial_preview.original_created_at)}</dd></div>}
      <div><dt>Harici iade durumu</dt><dd>{row.adjustment?.kind === 'external_refund' ? 'Admin tarafından fiilen yapıldığı teyit edildi (banka/POS doğrulaması değildir).'
        : row.correction_type === 'payment_refund' ? 'Henüz kaydedilmedi; admin teyidi ve referans gerekli.' : 'Para iadesi yapılmaz; hatalı kayıt geri alınır.'}</dd></div>
      {row.adjustment && <><div><dt>Uygulayan / onaylayan</dt><dd>{row.adjustment.performed_by_username} / {row.adjustment.approved_by_username}</dd></div>
        <div><dt>Kayıt tarihi</dt><dd>{saleDate(row.adjustment.created_at)}</dd></div><div><dt>Uygulama gerekçesi</dt><dd>{row.adjustment.reason}</dd></div>
        {row.adjustment.external_reference && <><div><dt>Harici referans</dt><dd>{row.adjustment.external_reference}</dd></div>
          <div><dt>Admin teyit tarihi</dt><dd>{saleDate(row.adjustment.external_confirmed_at!)}</dd></div></>}</>}
    </dl><a className="text-link" href={saleHref(data.sale_id)}>İlgili satış ve düzeltme geçmişi</a>
    <p className="sale-help">{row.adjustment ? 'Bunlar uygulama anındaki bakiyelerdir; güncel borç satış veya müşteri detayındadır.'
      : 'Tam ters kayıt veya teyitli iade aktif satışın borcunu yeniden açar. Satış iptali ayrı bir admin onayıdır.'}</p>
  </section>
}
