import { cn } from "../../styles/cn";
import { controlLabel } from "../../styles/control-size";
import { fieldBoxChromeClass } from "../../styles/field-box";
import { dataStateFaceClass, nativeStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";

/**
 * The module-private recipe for `Select.Trigger` and the value and caret it holds. It is not
 * exported from `@elmeragroup/fuse/select`, and the workspace-only recipe catalog re-exports it
 * for the Figma component sync.
 *
 * - `trigger` paints the field box chrome with the shared focus ring. The trigger is a native
 *   `<button>` that Base UI also marks `data-disabled` and `data-invalid`, so it takes the native
 *   and the data state faces. Its `size` axis takes the md control size's label at `"default"` and
 *   the sm one at `"sm"`. The trigger has never mapped icon children onto the icon edge, so its
 *   label omits that part. Its row hugs the value and the caret and spaces them to its ends on one
 *   line, mutes the text while `data-placeholder` marks the placeholder, lays out the value, and
 *   sizes an `<svg>` without a size class to 16px.
 * - `value` grows to fill the row and sets its text at the left.
 * - `caret` draws CaretDown at 16px in the muted color, and turns it half a turn while the trigger
 *   carries `data-popup-open`.
 */
export const selectTriggerVariants = tv({
  slots: {
    trigger: cn(selfFocusRingClass, fieldBoxChromeClass, nativeStateFaceClass, dataStateFaceClass),
    value: "flex flex-1 text-left",
    caret:
      "ease-in-out pointer-events-none size-4 text-muted-foreground transition-transform duration-200 group-data-[popup-open]/select-trigger:rotate-180",
  },
  variants: {
    size: {
      sm: { trigger: controlLabel("sm", { iconEdge: "omit" }) },
      default: { trigger: controlLabel("md", { iconEdge: "omit" }) },
    },
  },
  // The row, at every size, after the size's label, the order the trigger's classes have always
  // rendered in.
  compoundSlots: [
    {
      slots: ["trigger"],
      class:
        // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; ring comes from the shared adapter
        "group/select-trigger flex w-fit items-center justify-between whitespace-nowrap outline-none select-none data-placeholder:text-muted-foreground *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    },
  ],
  defaultVariants: {
    size: "default",
  },
});
