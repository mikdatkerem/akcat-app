import type { ReactNode } from 'react'

export type FieldProps = {
  label: string
  hint?: string
  error?: string
}

export function Field({ id, label, hint, error, required, children }: FieldProps & {
  id: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
      {children}
      {hint && <p className="ui-field__hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="ui-field__error" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  )
}
