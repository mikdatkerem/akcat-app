import { Badge, Card, EmptyState } from '../components/ui'
import { PageHeader } from './PageHeader'
import { modulePages } from './modulePages'

export function ModulePage({ page }: { page: keyof typeof modulePages }) {
  const content = modulePages[page]
  return (
    <>
      <PageHeader title={content.title} description={content.description} />
      <Card title={content.section} description={content.sectionDescription} accessory={<Badge>Hazırlanıyor</Badge>} className="module-workspace">
        <EmptyState title={content.emptyTitle} description={content.emptyDescription} icon={content.icon} />
      </Card>
    </>
  )
}
