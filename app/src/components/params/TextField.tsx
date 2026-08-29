import * as React from 'react'

import { Input } from '@/components/ui/input'
import { PropertyRow } from './PropertyRow'
import type { ValueChange } from './types'

export type TextFieldProps = {
  label: string
  description?: string
  value: string
  authored: string
  onValueChange: ValueChange<string>
  placeholder?: string
  id?: string
}

export function TextField({
  label, description, value, authored, onValueChange, placeholder, id,
}: TextFieldProps) {
  // Uncontrolled while focused so typing never fights a re-render from the
  // player; committed on blur or Enter, the same contract the old slot editor
  // used and that scene authors already expect.
  const [draft, setDraft] = React.useState(value)
  // Adjusted DURING RENDER rather than in an effect: an effect would paint the
  // stale draft first and then re-render, which is the cascading-render smell.
  const [lastExternal, setLastExternal] = React.useState(value)
  if (value !== lastExternal) {
    setLastExternal(value)
    setDraft(value)
  }

  const commit = () => { if (draft !== value) onValueChange(draft, { history: 'record' }) }

  return (
    <PropertyRow
      label={label}
      description={description}
      modified={value !== authored}
      onReset={() => onValueChange(authored, { history: 'record' })}
      htmlFor={id}
    >
      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        className="font-mono text-xs"
      />
    </PropertyRow>
  )
}
