import { cn } from "../../styles/cn";
import { checkboxCornerClass } from "../../styles/corner-radius";
import { dataStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";

/**
 * Runtime-free recipe for Checkbox's box and its indicator. Not exported from
 * `@elmeragroup/fuse/checkbox`; the workspace-only recipe catalog re-exports it for the Figma
 * component sync.
 *
 * - `root` is the box. It carries the `peer` marker for a sibling's `peer-*` styles, the native
 *   outline reset and a hit area of 12px beside and 8px above and below the 16px box, drawn by
 *   its `after:` pseudo-element.
 * - `indicator` holds the `Check` or `Minus` glyph, centered at 14px in the box's text color.
 */
export const checkboxVariants = tv({
  slots: {
    root: cn(
      // The root is a <span>, which never matches `:disabled`, so the state face keys off
      // Base UI's `data-disabled` and `data-invalid` attributes, plus a consumer's
      // `aria-invalid`. A checked invalid box keeps its primary border beside the ring.
      // The unchecked edge is the box's only boundary, so it takes `muted-foreground`, held to
      // 3:1 on every surface; light `input` is the field border and measures under 1.7:1.
      // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; ring comes from the shared adapter
      "peer shadow-xs ease-out relative flex size-4 max-w-4 shrink-0 items-center justify-center border border-muted-foreground bg-card transition-[color,background-color,border-color,box-shadow] duration-150 outline-none after:absolute after:-inset-x-3 after:-inset-y-2 after:content-[''] data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground",
      checkboxCornerClass,
      selfFocusRingClass,
      dataStateFaceClass,
      "aria-invalid:aria-checked:border-primary data-invalid:aria-checked:border-primary"
    ),
    indicator: "grid place-content-center text-current transition-none [&>svg]:size-3.5",
  },
});
