import { useState, type FormEvent } from 'react'
import { Button, Card, ErrorState, HelpDisclosure, Select, Textarea } from '../components/ui'
import { createCorrection, type CorrectionInput, type CorrectionType } from '../services/corrections'
import { useOperation } from './operation'
import { typeLabels } from './presentation'

export function CorrectionForm({ actor, target, id, onSaved }: { actor: string; target: 'sale' | 'payment'; id: string; onSaved: (id: string) => void }) {
  const operation = useOperation<CorrectionInput>(actor, 'create:' + target + ':' + id, async (body, key) => { const result = await createCorrection(body, key); onSaved(result.id) })
  const [type, setType] = useState<CorrectionType>(() => operation.saved?.correction_type ?? (target === 'sale' ? 'sale_cancel' : 'payment_reversal'))
  const [reason, setReason] = useState(() => operation.saved?.reason ?? ''), [change, setChange] = useState(() => operation.saved?.requested_change ?? '')
  const [validation, setValidation] = useState('')
  const locked = operation.busy || !!operation.saved
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!reason.trim() || !change.trim()) { setValidation('Gerekçeyi ve istenen değişikliği girin.'); return }
    setValidation(''); await operation.run({ target_type: target, target_id: id, correction_type: type, reason: reason.trim(), requested_change: change.trim() })
  }
  if (!/^[a-f0-9-]{36}$/i.test(id)) return <ErrorState title="Hedef kayıt seçilmedi" description="Satış veya tahsilat geçmişinden ilgili işlemi seçerek talep oluşturun." />
  return <Card title="Düzeltilecek işlem">
    <p className="correction-target">{target === 'sale' ? 'Satış' : 'Tahsilat'} · {id}</p>
    <a className="text-link" href={target === 'sale' ? '#/satislar/' + id : '#/tahsilatlar'}>İlgili kaydı görüntüle</a>
    <p className="sale-help">Talep oluşturmak finansal kayıtları değiştirmez; admin onayı gerekir.</p>
    <HelpDisclosure title="Hangi düzeltmeler yapılabilir?">
      <p>Tam hatalı tahsilat ters kaydı veya fiilen yapılmış harici iade admin tarafından uygulanabilir.</p>
      <p>Ödemeli satış, bütün ödemeleri bu süreçlerle kapatıldıktan sonra ayrı taleple iptal edilebilir.</p>
      <p>Tutar/yöntem değiştirme ve kısmi düzeltme desteklenmez.</p>
    </HelpDisclosure>
    <form className="correction-form" onSubmit={submit}>
      <Select label="Düzeltme türü" value={type} disabled={locked} onChange={event => setType(event.target.value as CorrectionType)}>
        {Object.entries(typeLabels).filter(([key]) => key.startsWith(target + '_')).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </Select>
      <Textarea label="Talep gerekçesi" required maxLength={1000} rows={3} value={reason} disabled={locked} onChange={event => setReason(event.target.value)} />
      <Textarea label="İstenen değişiklik" required maxLength={1000} rows={3} value={change} disabled={locked} onChange={event => setChange(event.target.value)} />
      {validation && <p role="alert" className="finance-validation">{validation}</p>}
      {operation.error && <ErrorState title="Talep kaydı doğrulanamadı" description={operation.error} />}
      {operation.saved && !operation.busy && <p className="sale-help">Bilgiler kilitlendi. Aynı taleple tekrar deneyebilir veya talep geçmişini kontrol edebilirsiniz.</p>}
      <div className="finance-actions"><a className="text-link" href="#/duzeltmeler">Talep geçmişi</a>
        <Button type="submit" loading={operation.busy}>{operation.saved ? 'Aynı talebi tekrar dene' : 'Talep Oluştur'}</Button></div>
    </form>
  </Card>
}
