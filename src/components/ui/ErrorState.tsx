import { Button } from './Button'
import { Icon } from './Icon'

export function ErrorState({ title = 'Veriler yüklenemedi', description, onRetry }: {
  title?: string
  description: string
  onRetry?: () => void
}) {
  return (
    <div className="ui-error-state" role="alert">
      <Icon name="alert" />
      <div><h3>{title}</h3><p>{description}</p>
        {onRetry && <Button variant="secondary" onClick={onRetry}><Icon name="refresh" />Tekrar dene</Button>}
      </div>
    </div>
  )
}
