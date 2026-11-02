import { ActionMenu, Icon } from '../components/ui'
import type { useProductOrder } from './useProductOrder'
export function ProductOrderHandle({ id, name, order }: { id: string; name: string; order: ReturnType<typeof useProductOrder> }) {
  return <ActionMenu label={`${name} sırasını değiştir; sürükleyin veya taşıma seçeneklerini açın`} disabled={order.locked}
    triggerClassName="product-order-handle" triggerContent={<Icon name="reorder" />}
    triggerProps={{
      onPointerDown: e => order.start(id, e), onPointerMove: order.move, onPointerUp: order.end, onPointerCancel: order.cancel,
      onClick: e => { if (order.suppressClick() && e.detail !== 0) e.preventDefault() },
      onKeyDown: e => { if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); order.step(id, e.key === 'ArrowUp' ? 'up' : 'down') } },
    }}>
    <button type="button" role="menuitem" tabIndex={-1} onClick={() => order.step(id, 'up')}>↑ Yukarı taşı</button>
    <button type="button" role="menuitem" tabIndex={-1} onClick={() => order.step(id, 'down')}>↓ Aşağı taşı</button>
  </ActionMenu>
}
