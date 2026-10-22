import { useState, type FormEvent } from 'react'
import { Button, Input, Textarea } from '../components/ui'
import { reviewCorrection, type ApprovalInput, type Correction } from '../services/corrections'
import { useOperation } from './operation'

export function FinancialApproval({ row, actor, onSaved, onClose }: { row: Correction; actor: string; onSaved: () => void; onClose: () => void }) {
  const operation = useOperation<ApprovalInput>(actor, 'approve:' + row.id, (body, key) => reviewCorrection(row.id, 'approve', body, key))
  const [reason, setReason] = useState(operation.saved?.reason ?? ''), [reference, setReference] = useState(operation.saved?.refund_confirmation?.reference ?? '')
  const [confirmed, setConfirmed] = useState(operation.saved?.refund_confirmation?.confirmed ?? false), [error, setError] = useState('')
  const preview = row.financial_preview, refund = row.correction_type === 'payment_refund', locked = operation.busy || !!operation.saved
  if (!preview) return <p role="alert">Güncel finansal önizleme bulunamadı. Talebi yeniden yükleyin.</p>
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!reason.trim() || (refund && (!confirmed || !reference.trim()))) { setError('Gerekçeyi ve gerekiyorsa fiilen yapılmış iadenin teyidi ile referansını girin.'); return }
    setError('')
    if (await operation.run({ reason: reason.trim(), expected_amount_kurus: preview!.amount_kurus, expected_sale_remaining_kurus: preview!.before_sale_remaining_kurus,
      expected_customer_debt_kurus: preview!.before_customer_debt_kurus, ...(refund ? { refund_confirmation: { confirmed: true, reference: reference.trim() } } : {}) })) onSaved()
  }
  return <form className="correction-form" onSubmit={submit}>
    <p className="sale-help">{refund ? 'Bu ekran para göndermez ve banka/POS sonucunu doğrulamaz. Yalnızca asıl tahsilatla aynı ödeme yöntemiyle, uygulama dışında fiilen tamamlanmış tam iadeyi teyit edin. Farklı yöntem veya kısmi iade desteklenmez.'
      : 'Yalnızca gerçekte alınmamış veya hatalı kaydedilmiş ödemenin tam tutarını geri alın. Müşteriye para iade edildiğinde harici iade talebi kullanın.'} Satış iptal edilmez; borç yukarıdaki tutarda yeniden açılır.</p>
    <Textarea label="Onay gerekçesi" required maxLength={1000} value={reason} disabled={locked} onChange={event => setReason(event.target.value)} />
    {refund && <><Input label="Harici iade referansı / belge numarası" required maxLength={200} value={reference} disabled={locked} onChange={event => setReference(event.target.value)} />
      <label className="refund-confirmation"><input type="checkbox" checked={confirmed} disabled={locked} onChange={event => setConfirmed(event.target.checked)} required />
        Tam tutarın aynı ödeme yöntemiyle uygulama dışında müşteriye fiilen iade edildiğini doğruluyorum.</label></>}
    {error && <p role="alert" className="finance-validation">{error}</p>}
    {operation.error && <p role="alert" className="finance-validation">{operation.error}</p>}
    {operation.saved && !operation.busy && <p className="sale-help">Sonuç belirsiz. Bilgiler kilitlendi; aynı anahtarla tekrar deneyin veya geçmişi kontrol edin.</p>}
    <div className="finance-actions"><Button variant="secondary" disabled={operation.busy} onClick={onClose}>Vazgeç</Button>
      <Button type="submit" variant="danger" loading={operation.busy}>{operation.saved ? 'Aynı işlemi tekrar dene' : refund ? 'Harici İadeyi Teyit Et ve Kaydet' : 'Tam Ters Kaydı Uygula'}</Button></div>
  </form>
}
