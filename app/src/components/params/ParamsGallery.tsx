import * as React from 'react'

import {
  ColorField, GradientField, NumberField, PropertyRow, SelectField,
  SizeField, TextField, ToggleField,
  type ColorSwatchGroup, type GradientValue, type Rgba, type SizeValue,
} from '.'

/**
 * DEV-ONLY review surface (open `#params`). Every parameter field in every
 * state, side by side, so the restyle pass is judged against the ZEN shell
 * rather than in isolation. Not reachable from the product UI and not part of
 * any production path.
 */

const ARTWORK: ColorSwatchGroup = {
  label: 'From your artwork',
  colors: ['#1A1A1A', '#22C55E', '#EF4444', '#E5E5E5', '#3B82F6'],
}
const BRAND: ColorSwatchGroup = {
  label: 'ZEN brand',
  colors: ['#000000', '#FFFFFF', '#6B7280', '#111827'],
}
const SWATCHES = [ARTWORK, BRAND]

const AUTHORED = {
  text: 'Payment confirmed',
  size: [320, 96] as SizeValue,
  duration: 2.4,
  scale: 100,
  color: [0.133, 0.773, 0.369, 1] as Rgba,
  accent: [0.102, 0.102, 0.102, 0.6] as Rgba,
  gradient: {
    type: 'linear',
    angle: 90,
    stops: [
      { color: '#22C55E', opacity: 100, position: '0%' },
      { color: '#3B82F6', opacity: 100, position: '100%' },
    ],
  } as GradientValue,
  ratio: 'contain',
  loop: true,
}

function Surface({ token, label, note }: { token: string; label: string; note: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`size-8 shrink-0 rounded-md ring-1 ring-foreground/10 ${token}`} />
      <div className="min-w-0">
        <p className="font-mono text-[11px] text-foreground">{label}</p>
        <p className="text-[11px] leading-tight text-muted-foreground">{note}</p>
      </div>
    </div>
  )
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <header>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export function ParamsGallery() {
  const [v, setV] = React.useState(AUTHORED)
  const [linked, setLinked] = React.useState(true)
  const set = <K extends keyof typeof AUTHORED>(k: K) => (next: (typeof AUTHORED)[K]) =>
    setV((s) => ({ ...s, [k]: next }))

  return (
    <div className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-lg font-semibold">Parameter controls</h1>
          <p className="text-sm text-muted-foreground">
            Dev-only gallery (<code className="font-mono text-xs">#params</code>). Every field, every
            state. Move a value and its origin tick appears; the reset arrow puts it back.
          </p>
        </header>

        <Panel
          title="Surface ladder"
          note="A control carries its own fill so it reads as actionable against a flat panel. Light steps DOWN from the panel, dark steps UP — the same move Figma, Framer and Mesh FX make. One step, affordances only; decorative containers keep the single surface tone."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Surface token="bg-background" label="--background" note="The shell behind everything" />
            <Surface token="bg-card" label="--card" note="Panels and cards" />
            <Surface token="bg-control" label="--control" note="Every interactive control" />
            <Surface token="bg-control-hover" label="--control-hover" note="Pointer over a control" />
          </div>
        </Panel>

        <div className="grid gap-5 md:grid-cols-2">
          <Panel title="Content" note="Text, numbers and sizes — the everyday edits.">
            <TextField
              label="Headline" id="g-text"
              description="Try a locale string; the scene re-lays out around it."
              value={v.text} authored={AUTHORED.text} onValueChange={set('text')}
            />
            <NumberField
              label="Duration" id="g-dur" suffix="s" precision={1} step={0.1}
              min={0.2} max={12} slider
              value={v.duration} authored={AUTHORED.duration} onValueChange={set('duration')}
            />
            <NumberField
              label="Scale" id="g-scale" suffix="%" min={10} max={400}
              description="Drag the number to scrub, click it to type. Shift for fine, Alt for coarse."
              value={v.scale} authored={AUTHORED.scale} onValueChange={set('scale')}
            />
            <SizeField
              label="Bubble size" id="g-size"
              value={v.size} authored={AUTHORED.size} onValueChange={set('size')}
              linked={linked} onLinkedChange={setLinked}
            />
          </Panel>

          <Panel title="Colour" note="The accuracy law: a colour field never stands in for a gradient.">
            <ColorField
              label="Check accent" id="g-color" swatches={SWATCHES}
              value={v.color} authored={AUTHORED.color} onValueChange={set('color')}
            />
            <ColorField
              label="Shadow tint" id="g-accent" swatches={SWATCHES}
              description="Carries alpha — the swatch shows it over a checkerboard."
              value={v.accent} authored={AUTHORED.accent} onValueChange={set('accent')}
            />
            <GradientField
              label="Ribbon gradient" id="g-grad" swatches={SWATCHES}
              description="Linear and radial only — Lottie cannot express conic or diamond."
              value={v.gradient} authored={AUTHORED.gradient} onValueChange={set('gradient')}
            />
          </Panel>

          <Panel title="Choices" note="Named levels and on/off — matched components, not sliders.">
            <SelectField
              label="Fit" id="g-fit"
              value={v.ratio} authored={AUTHORED.ratio} onValueChange={set('ratio')}
              options={[
                { label: 'Contain', value: 'contain' },
                { label: 'Cover', value: 'cover' },
                { label: 'Fill', value: 'fill' },
              ]}
            />
            <ToggleField
              label="Loop" id="g-loop"
              description="Off leaves the scene on its final pose."
              value={v.loop} authored={AUTHORED.loop} onValueChange={set('loop')}
            />
          </Panel>

          <Panel title="Edge cases" note="States a real panel has to survive.">
            <PropertyRow label="Read-only" description="Authored by the studio; a slider here would fight the build script.">
              <p className="font-mono text-xs text-muted-foreground">seam-locked · 144f</p>
            </PropertyRow>
            <TextField label="Empty" value="" authored="" onValueChange={() => {}} placeholder="Nothing authored yet" />
            <NumberField label="At its limit" value={400} authored={100} min={10} max={400} suffix="%" slider onValueChange={() => {}} />
            <ColorField label="Pure white on white" value={[1, 1, 1, 1]} authored={[1, 1, 1, 1]} onValueChange={() => {}} swatches={SWATCHES} />
          </Panel>
        </div>

        <pre className="overflow-x-auto rounded-lg border border-border bg-card p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
{JSON.stringify(v, null, 2)}
        </pre>
      </div>
    </div>
  )
}
