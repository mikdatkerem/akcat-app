import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export function EmptyState({ title, description, icon = 'info', action }: {
  title: string
  description: string
  icon?: IconName
  action?: ReactNode
}) {
  return (
    <div className="ui-empty-state">
      <span className="ui-empty-state__icon"><Icon name={icon} width="28" height="28" /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="ui-empty-state__action">{action}</div>}
    </div>
  )
}
