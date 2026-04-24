import { ArrowRight, Waves, PersonStanding } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCategoryStore, isCategoryAvailable } from '@/store/categoryStore'
import type { AnimationCategory } from '@/engine/scene/types'
import type { ComponentType } from 'react'

type TileDef = {
  id: AnimationCategory
  title: string
  description: string
  Icon: ComponentType<{ size?: number; className?: string }>
}

const TILES: TileDef[] = [
  {
    id: 'entrance',
    title: 'Entrance',
    description: 'One-shot arrival - fade, slide, scale, pop.',
    Icon: ArrowRight,
  },
  {
    id: 'ambient',
    title: 'Ambient loop',
    description: 'Subtle continuous motion - breathing, floating.',
    Icon: Waves,
  },
  {
    id: 'rigged',
    title: 'Rigged motion',
    description: 'Character animation - walk cycles, waves.',
    Icon: PersonStanding,
  },
]

export function CategorySelector() {
  const { category, setCategory } = useCategoryStore()

  return (
    <div className="w-full max-w-xl mx-auto mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          Animation category
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TILES.map((tile) => {
          const available = isCategoryAvailable(tile.id)
          const selected = category === tile.id
          return (
            <button
              key={tile.id}
              type="button"
              disabled={!available}
              onClick={() => available && setCategory(tile.id)}
              aria-pressed={selected}
              className={cn(
                'group relative flex flex-col items-start gap-2 p-4 pr-5 rounded-xl border text-left transition-all',
                'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                available && selected && 'border-foreground bg-background shadow-sm',
                available && !selected && 'border-border hover:border-foreground/50 hover:bg-muted/30',
                !available && 'border-border bg-muted/20 cursor-not-allowed',
              )}
            >
              {!available && (
                <span className="absolute top-3 right-3 text-[9px] font-mono tracking-wide text-muted-foreground border border-border rounded-full px-1.5 py-[1px] whitespace-nowrap leading-none">
                  Coming soon
                </span>
              )}

              <div
                className={cn(
                  'flex items-center justify-center size-8 rounded-lg',
                  available && selected && 'bg-foreground text-background',
                  available && !selected && 'bg-muted text-foreground',
                  !available && 'bg-muted text-muted-foreground',
                )}
              >
                <tile.Icon size={15} />
              </div>

              <div className="space-y-0.5 w-full">
                <span
                  className={cn(
                    'block text-sm font-semibold',
                    !available && 'text-muted-foreground',
                  )}
                >
                  {tile.title}
                </span>
                <p
                  className={cn(
                    'text-xs leading-snug',
                    available ? 'text-muted-foreground' : 'text-muted-foreground/70',
                  )}
                >
                  {tile.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
