import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Select } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { getCorrection, listCorrections, reviewCorrection } from '../services/corrections'
import type { Role } from '../services/auth'
import { useResource } from '../hooks/useResource'
import { saleDate } from '../sales/presentation'
import { Pagination } from '../finance/Pagination'
import { CorrectionForm } from './CorrectionForm'
import { ReasonForm } from './ReasonForm'
import { actionLabels, statusLabels, typeLabels } from './presentation'
import './corrections.css'
const subscribe = (listener: () => void) => { window.addEventListener('hashchange', listener); return () => window.removeEventListener('hashchange', listener) }
function CorrectionDetail({ id, actor, role, saved }: { id: string; actor: string; role: Role; saved: boolean }) {
  const load = useCallback(() => getCorrection(id), [id]), { result, retry } = useResource(id, load)
  const [action, setAction] = useState<'approve' | 'reject' | null>(null), [success, setSuccess] = useState('')
  if (!result) return <LoadingState label="Talep yükleniyor…" />
  if (result.error || !result.data) return <ErrorState title="Talep yüklenemedi" description={result.error ?? 'Tekrar deneyin.'} onRetry={retry} />
  const row = result.data
  return <>
    {(saved || success) && <p role="status" className="sale-success">{success || 'Düzeltme talebi kaydedildi. Yönetici incelemesi bekleniyor.'}</p>}
    <Card title={typeLabels[row.correction_type] ?? 'Düzeltme talebi'} accessory={<Badge tone={row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'neutral' : 'warning'}>{statusLabels[row.status]}</Badge>}>
      <dl className="sale-details correction-details">
        <div><dt>Hedef işlem</dt><dd>{row.target_type === 'sale' ? 'Satış' : 'Tahsilat'} · {row.target_id}</dd></div>
        <div><dt>Talep eden</dt><dd>{row.requested_by_username}</dd></div><div><dt>Oluşturulma</dt><dd>{saleDate(row.created_at)}</dd></div>
        <div><dt>Gerekçe</dt><dd>{row.reason}</dd></div><div><dt>İstenen değişiklik</dt><dd>{row.requested_change}</dd></div>
        {row.reviewed_by_username && <><div><dt>İnceleyen yönetici</dt><dd>{row.reviewed_by_username}</dd></div><div><dt>İnceleme tarihi</dt><dd>{row.reviewed_at ? saleDate(row.reviewed_at) : 'Belirtilmedi'}</dd></div></>}
      </dl>
      <a className="text-link" href={row.target_type === 'sale' ? '#/satislar/' + row.target_id : '#/tahsilatlar'}>İlgili işlemi görüntüle</a>
      <p className="sale-help">{row.approval_explanation}</p>
      {role === 'admin' && row.status === 'pending' && <>
        {!action ? <div className="finance-actions">
          {row.can_approve && <Button onClick={() => setAction('approve')}>İptali İncele ve Onayla</Button>}
          <Button variant="secondary" onClick={() => setAction('reject')}>Talebi Reddet</Button>
        </div> : <section aria-label={action === 'approve' ? 'İptal onayı' : 'Talep reddi'}>
          <p>{action === 'approve' ? 'Onaylandığında satış iptal edilir ve güncel borcu kapatılır. Asıl kayıtlar korunur.' : 'Ret kararı finansal kayıtları değiştirmez.'}</p>
          <ReasonForm key={action} actor={actor} scope={action + ':' + id} label={action === 'approve' ? 'İptali Uygula ve Onayla' : 'Reddi Kaydet'} danger={action === 'approve'}
            send={(body, key) => reviewCorrection(id, action, body, key)} onClose={() => setAction(null)}
            onSaved={() => { setSuccess(action === 'approve' ? 'Talep onaylandı ve satış iptal edildi.' : 'Talep reddedildi.'); setAction(null); retry() }} />
        </section>}
      </>}
    </Card>
    <Card title="Talep ve inceleme geçmişi">
      {row.history.length ? <ol className="correction-history">{row.history.map((log, index) => <li key={index}>
        <strong>{actionLabels[log.action] ?? log.action}</strong><span>{log.username} · {saleDate(log.created_at)}</span><p>{log.metadata.reason}</p>
      </li>)}</ol> : <p>Bu eski talep için denetim geçmişi bulunmuyor.</p>}
    </Card>
    <a className="text-link" href="#/duzeltmeler">Taleplere dön</a>
  </>
}
function CorrectionList({ role }: { role: Role }) {
  const [status, setStatus] = useState('pending'), [page, setPage] = useState(1)
  const load = useCallback(() => listCorrections(status, page), [status, page]), { result, retry } = useResource(status + ':' + page, load)
  return <>
    <p className="sale-help">{role === 'admin' ? 'Tüm talepleri inceleyebilirsiniz.' : 'Yalnızca kendi talepleriniz gösterilir.'} Talep oluşturmak için satış detayını veya tahsilat geçmişini kullanın.</p>
    <div className="finance-actions"><a className="text-link" href="#/satislar">Satışlara git</a><a className="text-link" href="#/tahsilatlar">Tahsilatlara git</a></div>
    <Select label="Talep durumu" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}>
      <option value="pending">Bekleyen</option><option value="approved">Onaylanan</option><option value="rejected">Reddedilen</option><option value="all">Tümü</option>
    </Select>
    {!result ? <LoadingState label="Talepler yükleniyor…" /> : result.error ? <ErrorState title="Talepler yüklenemedi" description={result.error} onRetry={retry} /> : result.data && <>
      {result.data.data.length === 0 ? <EmptyState title="Düzeltme talebi bulunamadı" description="Seçilen duruma uygun talep yok." />
        : <ul className="correction-list">{result.data.data.map(row => <li key={row.id}>
          <div><a className="finance-link" href={'#/duzeltmeler/' + row.id}>{typeLabels[row.correction_type] ?? 'Düzeltme talebi'}</a>
            <Badge tone={row.status === 'pending' ? 'warning' : row.status === 'approved' ? 'success' : 'neutral'}>{statusLabels[row.status]}</Badge></div>
          <p>{row.reason}</p><small>{row.requested_by_username} · {saleDate(row.created_at)}</small>
          <small className="correction-target">{row.target_type === 'sale' ? 'Satış' : 'Tahsilat'} · {row.target_id}</small>
        </li>)}</ul>}
      <Pagination page={result.data.pagination} label="Düzeltme talebi sayfaları" onPage={setPage} />
    </>}
  </>
}
export function CorrectionsPage({ actor, role }: { actor: string; role: Role }) {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash), [saved, setSaved] = useState('')
  const [path, query] = hash.split('?'), id = path.split('/')[2], params = new URLSearchParams(query)
  const target = params.get('target_type') === 'payment' ? 'payment' : 'sale'
  useEffect(() => { document.getElementById('main-content')?.focus({ preventScroll: true }); window.scrollTo(0, 0) }, [hash])
  return <div className="corrections-page"><PageHeader title={id === 'yeni' ? 'Yeni düzeltme talebi' : id ? 'Düzeltme talebi' : 'Düzeltme talepleri'} description="İptal ve düzeltme işlemleri gerekçe ve denetim geçmişiyle izlenir." />
    {id === 'yeni' ? <CorrectionForm key={hash} actor={actor} target={target} id={params.get('target_id') ?? ''}
      onSaved={id => { setSaved(id); window.location.hash = '#/duzeltmeler/' + id }} />
      : id ? <CorrectionDetail key={hash} id={id} actor={actor} role={role} saved={saved === id} /> : <CorrectionList role={role} />}
  </div>
}
