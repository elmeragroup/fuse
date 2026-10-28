import { tooltipShellClass } from "../../styles/inner-corner/tooltip";
import { tv } from "../../styles/tv";
import { overlayPopupMotionClass } from "../overlay/overlay-classes";

/**
 * The module-private recipe for the Tooltip popup and its arrow. It is not exported from
 * `@elmeragroup/fuse/tooltip`, and the workspace-only recipe catalog re-exports it for the Figma
 * component sync.
 *
 * - `popup` takes the shared motion set but neither the composed popup surface nor the timing
 *   rung: it inverts the fill and flies frameless, and `ring-0` could not subtract the surface's
 *   `ring-foreground/10`, since width and colour are separate tailwind-merge conflict groups.
 *   Untimed is deliberate. The Tooltip shell rounds and pads it; it is at most 320px wide.
 * - `arrow` is a 10px square in the popup's fill, turned 45° and pulled half out of the popup's
 *   edge on its side. Base UI writes its offset along that edge inline.
 */
export const tooltipVariants = tv({
  slots: {
    popup: [
      overlayPopupMotionClass,
      tooltipShellClass,
      "max-w-xs text-xs inline-flex w-fit items-center gap-1.5 bg-foreground text-pretty text-background",
    ],
    arrow:
      "size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5",
  },
});
