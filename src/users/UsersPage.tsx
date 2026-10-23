import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react'
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, Select } from '../components/ui'
import { PageHeader } from '../pages/PageHeader'
import { useResource } from '../hooks/useResource'
import { getUser, listUsers, type ManagedUser, type UserFilter } from '../services/users'
import { Pagination } from '../finance/Pagination'
import { UserForm } from './UserForm'
import { PasswordReset } from './PasswordReset'
import './users.css'
const date = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'medium', timeStyle: 'short' })
const subscribe = (notify: () => void) => { window.addEventListener('hashchange', notify); return () => window.removeEventListener('hashchange', notify) }
const href = (id: string) => '#/calisanlar/' + encodeURIComponent(id)
function UserList() {
  const [q, setQ] = useState(''), [search, setSearch] = useState(''), [status, setStatus] = useState<UserFilter['status']>('all'), [page, setPage] = useState(1)
  const load = useCallback(() => listUsers({ q: search, status, page, pageSize: 20 }), [search, status, page])
  const { result, retry } = useResource(`${search}:${status}:${page}`, load)
  function submit(event: FormEvent) { event.preventDefault(); setSearch(q.trim()); setPage(1); if (search === q.trim()) retry() }
  return <>
    <PageHeader title="Çalışanlar" description="Kullanıcı hesapları, roller ve oturum güvenliği." actions={<a className="ui-button ui-button--primary" href="#/calisanlar/yeni">Çalışan ekle</a>} />
    <form className="user-filters" onSubmit={submit}><Input label="Kullanıcı adı ara" type="search" value={q} maxLength={100} onChange={event => setQ(event.target.value)} />
      <Select label="Hesap durumu filtresi" value={status} onChange={event => { setStatus(event.target.value as UserFilter['status']); setPage(1) }}><option value="all">Tümü</option><option value="active">Aktif</option><option value="inactive">Pasif</option></Select>
      <Button variant="secondary" type="submit">Ara</Button></form>
    {!result ? <LoadingState label="Hesaplar yükleniyor…" /> : result.error ? <ErrorState title="Çalışanlar yüklenemedi" description={result.error} onRetry={retry} /> : result.data && <>
      {result.data.data.length === 0 ? <Card title="Çalışan hesapları"><EmptyState title="Hesap bulunamadı" description="Bu arama ve durum filtresiyle eşleşen hesap yok." /></Card> : <div className="user-list-surface"><table className="user-table">
        <caption className="visually-hidden">Çalışan hesapları</caption><thead><tr><th>Kullanıcı adı</th><th>Rol</th><th>Hesap durumu</th><th>Oluşturulma</th><th>İşlem</th></tr></thead>
        <tbody>{result.data.data.map(user => <tr key={user.id}><td data-label="Kullanıcı adı"><a className="text-link" href={href(user.id)}>{user.username}</a></td>
          <td data-label="Rol">{user.role === 'admin' ? 'Admin' : 'Çalışan'}</td><td data-label="Hesap durumu"><Badge tone={user.is_active ? 'success' : 'neutral'}>{user.is_active ? 'Aktif' : 'Pasif'}</Badge></td>
          <td data-label="Oluşturulma"><time dateTime={user.created_at}>{date.format(new Date(user.created_at))}</time></td><td><a className="ui-button ui-button--ghost" href={href(user.id) + '/duzenle'} aria-label={user.username + ' hesabını düzenle'}>Düzenle</a></td></tr>)}</tbody>
      </table></div>}
      <Pagination page={result.data.pagination} label="Çalışan sayfaları" onPage={setPage} />
    </>}
  </>
}
function UserRecord({ id, mode, actor, notice, saved }: { id: string; mode?: string; actor: string; notice?: string; saved: (user: ManagedUser) => void }) {
  const load = useCallback(() => getUser(id), [id]), { result, retry } = useResource(id, load)
  if (!result) return <LoadingState label="Hesap yükleniyor…" />
  if (result.error || !result.data) return <><PageHeader title="Çalışan hesabı" description="Hesap bilgileri alınamadı." /><ErrorState title="Hesap yüklenemedi" description={result.error ?? 'Kullanıcı bulunamadı.'} onRetry={retry} /></>
  const user = result.data
  if (mode === 'duzenle') return <UserForm account={user} actor={actor} onSaved={saved} />
  if (mode === 'parola') return <PasswordReset account={user} actor={actor} onSaved={saved} />
  return <>
    <PageHeader title={user.username} description="Hesap ve yetki bilgileri." actions={<a className="ui-button ui-button--secondary" href={href(id) + '/duzenle'}>Hesabı düzenle</a>} />
    {notice && <p className="user-success" role="status">{notice}</p>}
    <Card title="Hesap bilgileri" accessory={<Badge tone={user.is_active ? 'success' : 'neutral'}>{user.is_active ? 'Aktif' : 'Pasif'}</Badge>}>
      <dl className="user-details"><div><dt>Kullanıcı adı</dt><dd>{user.username}</dd></div><div><dt>Rol</dt><dd>{user.role === 'admin' ? 'Admin' : 'Çalışan'}</dd></div>
        <div><dt>Oluşturulma</dt><dd>{date.format(new Date(user.created_at))}</dd></div><div><dt>Güncellenme</dt><dd>{date.format(new Date(user.updated_at))}</dd></div></dl>
      <div className="user-actions"><a className="ui-button ui-button--secondary" href={href(id) + '/parola'}>Parola sıfırla</a><a className="ui-button ui-button--ghost" href="#/calisanlar">Çalışan listesine dön</a></div>
    </Card>
  </>
}
export function UsersPage({ actor }: { actor: string }) {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash), [notice, setNotice] = useState<{ id: string; text: string } | null>(null)
  const route = useMemo(() => hash.split('?')[0].split('/'), [hash])
  useEffect(() => { document.getElementById('main-content')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }) }, [hash])
  function saved(user: ManagedUser) { setNotice({ id: user.id, text: route[2] === 'yeni' ? 'Hesap oluşturuldu.' : route[3] === 'parola' ? 'Parola sıfırlandı; önceki oturumlar kapatıldı.' : 'Hesap güncellendi.' }); window.location.hash = href(user.id) }
  if (route[2] === 'yeni') return <UserForm actor={actor} onSaved={saved} />
  if (route[2]) return <UserRecord key={hash} id={route[2]} mode={route[3]} actor={actor} saved={saved} notice={notice?.id === route[2] ? notice.text : undefined} />
  return <UserList />
}
