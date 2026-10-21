export function LoadingState({ label = 'Veriler yükleniyor…' }: { label?: string }) {
  return (
    <div className="ui-loading-state" role="status" aria-live="polite">
      <p>{label}</p>
      <div aria-hidden="true" className="ui-skeleton"><span /><span /><span /></div>
    </div>
  )
}
