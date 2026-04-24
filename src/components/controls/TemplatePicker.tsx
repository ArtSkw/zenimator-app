import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ControlRow } from './ControlRow'
import { TEMPLATE_REGISTRY } from '@/engine/animations/templates'
import { templatesFor } from '@/engine/animations/templates'
import type {
  AnimationCategory,
  AnimationTemplateId,
} from '@/engine/scene/types'

type Props = {
  category: AnimationCategory
  value: AnimationTemplateId
  onChange: (templateId: AnimationTemplateId) => void
}

export function TemplatePicker({ category, value, onChange }: Props) {
  const ids = templatesFor(category)

  return (
    <ControlRow label="Template">
      <Select value={value} onValueChange={(v) => onChange(v as AnimationTemplateId)}>
        <SelectTrigger className="w-full h-9 font-mono text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="w-[var(--radix-select-trigger-width)]">
          {ids.map((id) => {
            const tpl = TEMPLATE_REGISTRY[id]
            return (
              <SelectItem key={id} value={id} className="font-mono text-xs">
                <div className="flex flex-col items-start">
                  <span>{id}</span>
                  {tpl?.description && (
                    <span className="text-[10px] text-muted-foreground font-sans whitespace-normal">
                      {tpl.description}
                    </span>
                  )}
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </ControlRow>
  )
}
