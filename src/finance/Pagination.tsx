import { Button } from '../components/ui'
import type { PageInfo } from '../services/finance'
export function Pagination({ page, label, onPage, disabled = false }: { page: PageInfo; label: string; onPage: (page: number) => void; disabled?: boolean }) {
  return <nav className="finance-pagination" aria-label={label}><p role="status">{page.total} kayıt{page.totalPages > 0 ? ` · Sayfa ${page.page} / ${page.totalPages}` : ''}</p><div>
    <Button variant="secondary" disabled={disabled || page.page <= 1} onClick={() => onPage(page.page - 1)}>Önceki</Button>
    <Button variant="secondary" disabled={disabled || page.page >= page.totalPages} onClick={() => onPage(page.page + 1)}>Sonraki</Button>
  </div></nav>
}
