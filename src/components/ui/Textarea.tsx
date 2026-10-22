import { useId, type ComponentProps } from 'react'
import { Field, type FieldProps } from './Field'

export function Textarea({ id, label, hint, error, required, className = '', 'aria-describedby': describedBy, ...props }:
  ComponentProps<'textarea'> & FieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const description = [describedBy, hint && `${fieldId}-hint`, error && `${fieldId}-error`].filter(Boolean).join(' ')
  return <Field id={fieldId} label={label} hint={hint} error={error} required={required}>
    <textarea {...props} id={fieldId} required={required} className={`ui-control ${className}`}
      aria-invalid={error ? true : props['aria-invalid']} aria-describedby={description || undefined} />
  </Field>
}
