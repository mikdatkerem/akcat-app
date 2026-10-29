import type { ReactNode } from 'react'

export function HelpDisclosure({ title, children }: { title: string; children: ReactNode }) {
  return <details className="ui-help">
    <summary>{title}</summary>
    <div className="ui-help__content">{children}</div>
  </details>
}
