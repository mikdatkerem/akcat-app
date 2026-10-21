import { useId, type ComponentProps, type ReactNode } from 'react'
import { Field, type FieldProps } from './Field'

export function Input({ id, label, hint, error, required, className = '', endAdornment,
  'aria-describedby': describedBy, ...props }: ComponentProps<'input'> & FieldProps & { endAdornment?: ReactNode }) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const description = [describedBy, hint && `${fieldId}-hint`, error && `${fieldId}-error`].filter(Boolean).join(' ')

  const input = <input {...props} id={fieldId} required={required} className={`ui-control ${className}`}
    aria-invalid={error ? true : props['aria-invalid']} aria-describedby={description || undefined} />

  return (
    <Field id={fieldId} label={label} hint={hint} error={error} required={required}>
      {endAdornment ? <div className="ui-control-wrap">{input}<div className="ui-control-adornment">{endAdornment}</div></div> : input}
    </Field>
  )
}
