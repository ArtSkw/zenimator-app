import { ArrowRight, Waves, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCategoryStore } from '@/store/categoryStore'
import { useGenerateStore } from '@/store/generateStore'
import type { AnimationCategory } from '@/engine/scene/types'
import type { ComponentType } from 'react'

/** Tile ids = the two SVG categories plus the prompt-based generate lane. */
type TileId = AnimationCategory | 'generate'

type TileDef = {
  id: TileId
  title: string
  description: string
  Icon: ComponentType<{ size?: number; className?: string }>
}

const TILES: TileDef[] = [
  {
    id: 'entrance',
    title: 'Entrance',
    description: 'One-shot arrival — fade, slide, scale, pop.',
    Icon: ArrowRight,
  },
  {
    id: 'ambient',
    title: 'Ambient loop',
    description: 'Subtle continuous motion — breathing, floating.',
    Icon: Waves,
  },
  {
    id: 'generate',
    title: 'Generate',
    description: 'Describe an animation — optionally ground it with an SVG.',
    Icon: Wand2,
  },
]

export function CategorySelector() {
  const { category, setCategory } = useCategoryStore()
  const { active: generateActive, setActive } = useGenerateStore()

  const isSelected = (id: TileId) =>
    id === 'generate' ? generateActive : !generateActive && category === id

  const pick = (id: TileId) => {
    if (id === 'generate') {
      setActive(true)
    } else {
      setActive(false)
      setCategory(id)
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          Animation category
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TILES.map((tile) => {
          const selected = isSelected(tile.id)
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => pick(tile.id)}
              aria-pressed={selected}
              className={cn(
                'group flex flex-col items-start gap-2 p-4 rounded-xl border text-left',
                'transition-all duration-200 ease-out active:scale-[0.97]',
                'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                selected
                  ? 'border-foreground bg-background shadow-sm'
                  : 'border-border hover:border-foreground/50 hover:bg-muted/30',
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center size-8 rounded-lg',
                  'transition-[colors,transform] duration-200 ease-out',
                  selected ? 'bg-foreground text-background scale-105' : 'bg-muted text-foreground',
                )}
              >
                <tile.Icon size={15} />
              </div>

              <div className="space-y-0.5 w-full">
                <span className="block text-sm font-semibold">{tile.title}</span>
                <p className="text-xs leading-snug text-muted-foreground">
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
