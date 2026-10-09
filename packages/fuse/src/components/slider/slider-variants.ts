import { cn } from "../../styles/cn";
import { labelTypeClass } from "../../styles/label-type";
import { dataStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import { withinFocusRingClass } from "../../styles/utils";

/**
 * The Slider parts, one slot each, with the orientation as the one axis.
 *
 * The root stacks the label row over the control with FieldFrame's content slot, and the
 * label row is FieldFrame's own, so the label sits 4px from the control as in every field.
 * A vertical slider's frame takes its parent's height, and the root and control grow into
 * what the label row leaves, so the control's bottom edge meets the parent's.
 * The control box takes the md control height on its cross axis, so a slider lines up with
 * the NumberField or Button beside it at both densities. The track, indicator and thumb are
 * pixel-fixed: a 4px track and a 16px thumb. The thumb sets its own box sizing and px sizes,
 * so a host without preflight or with a root font under 16px still paints it at 16px, and its
 * `::after` is a 24px square centred on it, the target floor in px as `control-size.ts` floors
 * the xs box with `max(var(--control-h-xs),24px)`. The md control height always clears it.
 *
 * The thumb is the whole control a person operates, so it carries the data-target state face:
 * Base UI writes `data-disabled` and `data-invalid` on it. The track and indicator are parts:
 * a disabled indicator drops to the muted foreground instead of dimming a second time.
 * The thumb also hosts the within-target focus ring for the range input Base UI nests in it.
 */
export const sliderVariants = tv({
  slots: {
    frame: "",
    root: "",
    value: cn("text-muted-foreground tabular-nums", labelTypeClass),
    control: "relative flex touch-none items-center select-none data-disabled:cursor-not-allowed",
    track: "relative grow overflow-hidden rounded-full bg-muted",
    indicator: "rounded-full bg-primary data-disabled:bg-muted-foreground",
    thumb: cn(
      "shadow-xs box-border block size-[16px] shrink-0 rounded-full border-2 border-primary bg-background transition-[box-shadow] after:absolute after:top-1/2 after:left-1/2 after:size-[24px] after:-translate-1/2 after:content-['']",
      withinFocusRingClass,
      dataStateFaceClass
    ),
  },
  variants: {
    orientation: {
      horizontal: {
        control: "h-(--control-h-md) w-full",
        track: "h-1 w-full",
        indicator: "h-full",
      },
      vertical: {
        frame: "h-full",
        root: "min-h-0 grow",
        control: "min-h-40 w-(--control-h-md) grow flex-col justify-center",
        track: "h-full w-1",
        indicator: "w-full",
      },
    },
  },
  defaultVariants: {
    orientation: "horizontal",
  },
});
