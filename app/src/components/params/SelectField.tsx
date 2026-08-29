import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PropertyRow } from './PropertyRow'
import type { ValueChange } from './types'

export type SelectOption = { label: string; value: string }

export type SelectFieldProps = {
  label: string
  description?: string
  value: string
  authored: string
  options: SelectOption[]
  onValueChange: ValueChange<string>
  id?: string
}

export function SelectField({
  label, description, value, authored, options, onValueChange, id,
}: SelectFieldProps) {
  return (
    <PropertyRow
      label={label}
      description={description}
      modified={value !== authored}
      onReset={() => onValueChange(authored, { history: 'record' })}
      htmlFor={id}
    >
      <Select
        value={value}
        onValueChange={(next) => onValueChange(String(next), { history: 'record' })}
      >
        <SelectTrigger id={id} size="sm" className="w-full">
          {/* Base UI renders the raw VALUE unless told otherwise; our options
              are the source of truth for the label, so resolve from them. A
              select showing `0` instead of "As animated" is the failure this
              guards against. */}
          <SelectValue>
            {(v: unknown) =>
              options.find((o) => o.value === String(v))?.label ?? (v == null ? '' : String(v))
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </PropertyRow>
  )
}
