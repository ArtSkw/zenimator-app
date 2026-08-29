import { Switch } from '@/components/ui/switch'
import { PropertyRow } from './PropertyRow'
import type { ValueChange } from './types'

export type ToggleFieldProps = {
  label: string
  description?: string
  value: boolean
  authored: boolean
  onValueChange: ValueChange<boolean>
  id?: string
}

export function ToggleField({
  label, description, value, authored, onValueChange, id,
}: ToggleFieldProps) {
  return (
    <PropertyRow
      label={label}
      description={description}
      modified={value !== authored}
      onReset={() => onValueChange(authored, { history: 'record' })}
      htmlFor={id}
      layout="row"
    >
      <Switch
        id={id}
        checked={value}
        onCheckedChange={(next) => onValueChange(Boolean(next), { history: 'record' })}
      />
    </PropertyRow>
  )
}
