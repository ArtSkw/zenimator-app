import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"

function Popover(props: PopoverPrimitive.Root.Props) {
  // No `data-slot` here: Root renders no DOM node, so the attribute lands
  // nowhere and only muddies the canonical shape from the Base UI docs.
  return <PopoverPrimitive.Root {...props} />
}

function PopoverTrigger(props: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  sideOffset = 6,
  align = "end",
  side = "bottom",
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, "sideOffset" | "align" | "side">) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner sideOffset={sideOffset} align={align} side={side} className="z-50">
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          // `transition-none` is load-bearing, not tidying. `duration-100` sets
          // a transition DURATION and nothing sets a transition PROPERTY, so
          // CSS's initial `transition-property: all` applied and every property
          // that changed on close — four border colours here — started its own
          // transition. Base UI holds the popup mounted until every entry in
          // `getAnimations()` settles, so those strays raced the exit keyframes
          // and, when they lost, stranded a fully opaque popup in the DOM
          // forever: a ghost picker that no click could dismiss and that let a
          // second one open beside it. Measured at 3-in-4 closes on Brave 151,
          // 1-in-4 on Chromium 149 — the same race, different odds, which is
          // why it read as a browser bug. The keyframes still animate; only the
          // blanket property transition is gone.
          className={cn(
            "relative isolate z-50 origin-(--transform-origin) rounded-lg bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none transition-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
