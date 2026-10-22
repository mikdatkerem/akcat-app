import { useSyncExternalStore } from 'react'
import { reportQuery, type ReportFilter } from '../services/reports'
export type ReportMode = 'payments' | 'sales' | 'receivables' | 'employees'
export const reportPaths: Record<ReportMode, string> = { payments: 'tahsilatlar', sales: 'satislar', receivables: 'borclar', employees: 'calisanlar' }
export const reportLabels: Record<ReportMode, string> = { payments: 'Tahsilat Raporu', sales: 'Satış Raporu', receivables: 'Borç Raporu', employees: 'Çalışan Raporu' }
export function reportsHref(mode: ReportMode, filter: Partial<ReportFilter> = {}) { return '#/raporlar/' + reportPaths[mode] + '?' + reportQuery(filter) }
const subscribe = (listener: () => void) => { window.addEventListener('hashchange', listener); return () => window.removeEventListener('hashchange', listener) }
export function useReportLocation() { return useSyncExternalStore(subscribe, () => window.location.hash) }
export function parseReportLocation(hash: string) {
  const [path, query] = hash.split('?'), segment = path.replace(/\/$/, '').split('/')[2]
  const mode = (Object.keys(reportPaths) as ReportMode[]).find(key => reportPaths[key] === segment) ?? 'payments'
  const params = new URLSearchParams(query), period = params.get('period') ?? 'today', view = params.get('view') ?? 'sales', page = Number(params.get('page') ?? 1)
  const filter: ReportFilter = { period: period as ReportFilter['period'], view: view as ReportFilter['view'], page, pageSize: 20 }
  for (const field of ['from', 'to', 'q', 'created_by'] as const) if (params.get(field)) filter[field] = params.get(field)!
  const invalid = !['today', 'yesterday', 'last7', 'month', 'custom'].includes(period) || !['sales', 'cancelled', 'items', 'products'].includes(view)
    || !Number.isInteger(page) || page < 1 || page > 100000 || (filter.q?.length ?? 0) > 100
    || (filter.created_by && !/^[a-f0-9-]{36}$/i.test(filter.created_by))
    || (period === 'custom' ? !filter.from || !filter.to || filter.from > filter.to : !!filter.from || !!filter.to)
  return { mode, filter, invalid: !!invalid }
}
