import { useId, type ComponentProps, type ReactNode } from 'react'

type CardProps = Omit<ComponentProps<'section'>, 'title'> & {
  title: string
  description?: string
  accessory?: ReactNode
}

export function Card({ title, description, accessory, children, className = '', ...props }: CardProps) {
  const headingId = useId()
  return (
    <section {...props} className={`ui-card ${className}`} aria-labelledby={headingId}>
      <header className="ui-card__header">
        <div><h2 id={headingId}>{title}</h2>{description && <p>{description}</p>}</div>
        {accessory}
      </header>
      {children}
    </section>
  )
}
