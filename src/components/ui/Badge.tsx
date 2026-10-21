import type { ComponentProps } from 'react'
import { Icon, type IconName } from './Icon'

const statusIcons: Record<BadgeTone, IconName> = {
  neutral: 'info', info: 'info', success: 'check', warning: 'alert', danger: 'alert',
}
type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export function Badge({ tone = 'neutral', className = '', children, ...props }:
  ComponentProps<'span'> & { tone?: BadgeTone }) {
  return (
    <span {...props} className={`ui-badge ui-badge--${tone} ${className}`}>
      <Icon name={statusIcons[tone]} width="14" height="14" />{children}
    </span>
  )
}
