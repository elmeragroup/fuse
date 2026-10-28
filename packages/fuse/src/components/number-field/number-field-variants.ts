import { cn } from "../../styles/cn";
import { controlMdInsetTypeClass } from "../../styles/control-size-md";
import { numberFieldGroupClass } from "../../styles/field-box";
import { withinStateFaceControlClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import { withinFocusRingControlClass } from "../../styles/utils";

/**
 * The module-private recipe for NumberField's control. It is not exported from
 * `@elmeragroup/fuse/number-field`, and the workspace-only recipe catalog re-exports it for the
 * Figma component sync.
 *
 * - `group` is the field box around the input, the denomination and the steppers. `isMuted`
 *   gives it the muted fill of a disabled or read-only field.
 * - `input` fills the group's height and the width the denomination and steppers leave.
 * - `denomination` is the muted unit suffix between the input and the steppers.
 * - `steppers` is the full-height row that holds the two steppers.
 * - `stepper` is one stepper. It is a part of the control, not a whole control: the group's
 *   within-target state face dims the disabled field once, steppers included. A stepper disabled
 *   on its own at a bound keeps the part look, a muted fill and glyph with the `not-allowed`
 *   cursor, and its hover fill sits behind the `enabled-hover:` gate. Each stepper is a
 *   full-height column `--control-h-xs` wide, floored at 24px for a host root below 16px, so its
 *   target meets the 24px floor at both densities (stacked steppers cannot fit two 24px targets
 *   in the dense control height).
 */
export const numberFieldVariants = tv({
  slots: {
    group: numberFieldGroupClass,
    input: cn(
      "box-border h-full w-full min-w-0 flex-1 border-0 bg-transparent py-0 tabular-nums",
      controlMdInsetTypeClass,
      withinFocusRingControlClass,
      withinStateFaceControlClass
    ),
    // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- moved as-is from number-field.tsx, where the rule did not reach it; a control metric would change the look
    denomination: "text-sm px-2 py-1 text-muted-foreground",
    steppers: "flex h-full",
    stepper:
      "box-border flex h-full w-[max(var(--control-h-xs),24px)] shrink-0 cursor-default items-center justify-center border-0 border-s border-input bg-background p-0 text-foreground transition-colors disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground enabled-hover:bg-muted",
  },
  variants: {
    isMuted: {
      true: { group: "bg-muted" },
    },
  },
  defaultVariants: {
    isMuted: false,
  },
});
