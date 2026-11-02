import { ActionMenu, Icon } from '../components/ui'
import { DeleteRecordAction } from '../components/DeleteRecordAction'
import { deleteUser, type ManagedUser } from '../services/users'

export function UserActions({ user, actor, onDeleted }: { user: ManagedUser; actor: string; onDeleted: () => void }) {
  const path = '#/calisanlar/' + encodeURIComponent(user.id)
  const own = user.id === actor
  return <DeleteRecordAction recordName={user.username} title="Hesap kalıcı olarak silinsin mi?"
    description="Yalnızca geçmiş finansal veya bağlı denetim kaydı bulunmayan hesaplar silinebilir. Tüm mevcut oturumları geçersiz olur. Bu işlem geri alınamaz."
    disabledReason={own ? 'Kendi hesabınızı silemezsiniz.' : undefined} remove={key => deleteUser(user.id, key)} onDeleted={onDeleted}
    renderTrigger={(open, disabled) => <ActionMenu label={`${user.username} hesap işlemleri`} triggerClassName="user-more">
      <a role="menuitem" tabIndex={-1} href={path}>Hesabı Görüntüle</a>
      <a role="menuitem" tabIndex={-1} href={path + '/duzenle'}>Düzenle</a>
      <button role="menuitem" tabIndex={-1} type="button" className="ui-action-menu__danger" disabled={disabled} onClick={open}><Icon name="trash" width="18" height="18" />Sil</button>
      {own && <p className="ui-action-menu__hint">Kendi hesabınızı silemezsiniz.</p>}
    </ActionMenu>} />
}
