import { useId, type ComponentProps } from 'react'
import { Field, type FieldProps } from './Field'

export function Select({ id, label, hint, error, required, className = '', children,
  'aria-describedby': describedBy, ...props }: ComponentProps<'select'> & FieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const description = [describedBy, hint && `${fieldId}-hint`, error && `${fieldId}-error`].filter(Boolean).join(' ')

  return (
    <Field id={fieldId} label={label} hint={hint} error={error} required={required}>
      <select {...props} id={fieldId} required={required} className={`ui-control ${className}`}
        aria-invalid={error ? true : props['aria-invalid']} aria-describedby={description || undefined}>
        {children}
      </select>
    </Field>
  )
}
