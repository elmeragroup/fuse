/**
 * Module-private recipe. Not exported from the public entry —
 * there is no proven recipe-borrowing use. Status fill/text use the `error`
 * tokens.
 *
 * One `tone` axis, four arms. The `mode` × `level` resolution lives in
 * `METER_TONE_TABLE`, so this recipe holds colors only.
 */
import { tv } from "tailwind-variants";

export const meterVariants = tv({
  base: "",
  slots: {
    root: "flex flex-col gap-1",
    labelContainer: "flex justify-between gap-2",
    labelValue: "text-sm",
    icon: "inline-block size-4 align-text-bottom",
    bar: "relative h-1.5 w-full rounded-full bg-muted outline outline-1 -outline-offset-1 outline-transparent",
    barFill: "absolute top-0 left-0 h-full rounded-full transition-all forced-colors:bg-[Highlight]",
  },
  variants: {
    tone: {
      success: {
        barFill: "bg-success",
        labelValue: "text-success",
      },
      warning: {
        barFill: "bg-warning",
        labelValue: "text-warning-foreground",
      },
      error: {
        barFill: "bg-error",
        labelValue: "text-error",
      },
      neutral: {
        barFill: "bg-primary",
        labelValue: "text-foreground",
      },
    },
  },
  defaultVariants: {
    tone: "success",
  },
});
