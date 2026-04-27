import { cn } from '@/lib/utils'

export type OverrideFlagState = 'inherited' | 'overridden' | 'locked'

export interface OverrideFlagProps {
  state: OverrideFlagState
  masterValue?: string | number | null
  masterValueFormatted?: string
}

function tooltipFor(
  state: OverrideFlagState,
  masterValueFormatted: string | undefined,
): string {
  if (state === 'inherited') return 'Inherited from master. Edit to override.'
  if (state === 'locked') return 'Locked. Edit on the master product.'
  if (masterValueFormatted) {
    return `Overridden — clear field to revert to master (${masterValueFormatted}).`
  }
  return 'Overridden. No master value.'
}

export function OverrideFlag({
  state,
  masterValue,
  masterValueFormatted,
}: OverrideFlagProps) {
  const formatted =
    masterValueFormatted ??
    (masterValue != null && masterValue !== '' ? String(masterValue) : undefined)
  const label = tooltipFor(state, formatted)
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        state === 'inherited' && 'bg-green-500',
        state === 'overridden' && 'bg-orange-500',
        state === 'locked' && 'bg-red-500',
      )}
      title={label}
      aria-label={label}
    />
  )
}
