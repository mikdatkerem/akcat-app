import type { ComponentProps } from 'react'

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  loading?: boolean
  loadingText?: string
}

export function Button({ variant = 'primary', loading = false, loadingText = 'İşleniyor…',
  disabled, type = 'button', className = '', children, ...props }: ButtonProps) {
  return (
    <button {...props} type={type} className={`ui-button ui-button--${variant} ${className}`}
      disabled={disabled || loading} aria-busy={loading || undefined}>
      {loading && <span className="ui-spinner" aria-hidden="true" />}
      {loading ? loadingText : children}
    </button>
  )
}
