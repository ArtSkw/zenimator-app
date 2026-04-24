import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { ControlRow } from './ControlRow'
import { EasingCurve } from './EasingCurve'
import type { EasingKey } from '@/engine/scene/types'

const EASINGS: EasingKey[] = [
  'linear',
  'easeIn',
  'easeOut',
  'easeInOut',
  'spring-gentle',
  'spring-bouncy',
  'spring-stiff',
]

type Props = {
  value: EasingKey
  onChange: (easing: EasingKey) => void
}

export function EasingPicker({ value, onChange }: Props) {
  return (
    <ControlRow label="Easing">
      <Select value={value} onValueChange={(v) => onChange(v as EasingKey)}>
        <SelectTrigger className="w-full h-9 font-mono text-xs">
          <div className="flex items-center gap-2 flex-1 overflow-hidden">
            <EasingCurve easing={value} />
            <span className="truncate">{value}</span>
          </div>
        </SelectTrigger>
        <SelectContent>
          {EASINGS.map((e) => (
            <SelectItem key={e} value={e} className="font-mono text-xs">
              <EasingCurve easing={e} />
              <span>{e}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ControlRow>
  )
}
