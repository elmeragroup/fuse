/**
 * Module-private recipe (meter.md §4). Not exported from the public entry —
 * there is no proven recipe-borrowing use. Status fill/text use the `error`
 * tokens (meter.md §8.3).
 */
import { tv } from "tailwind-variants";

import { METER_CONSTANTS } from "./meter-constants";

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
    mode: {
      [METER_CONSTANTS.MODES.DEFAULT]: {},
      [METER_CONSTANTS.MODES.INVERTED]: {},
      [METER_CONSTANTS.MODES.SUCCESS_ONLY_WHEN_FULL]: {},
      [METER_CONSTANTS.MODES.NEUTRAL]: {},
    },
    level: {
      [METER_CONSTANTS.LEVELS.LOW]: {
        barFill: "bg-success",
        labelValue: "text-success",
      },
      [METER_CONSTANTS.LEVELS.MEDIUM]: {
        barFill: "bg-warning",
        labelValue: "text-warning-foreground",
      },
      [METER_CONSTANTS.LEVELS.FULL]: {
        barFill: "bg-error",
        labelValue: "text-error",
      },
      [METER_CONSTANTS.LEVELS.EXCEEDED_MAX_VALUE]: {
        barFill: "bg-error",
        labelValue: "text-error",
      },
    },
  },
  compoundVariants: [
    {
      mode: METER_CONSTANTS.MODES.SUCCESS_ONLY_WHEN_FULL,
      level: METER_CONSTANTS.LEVELS.LOW,
      class: {
        barFill: "bg-error",
        labelValue: "text-error",
      },
    },
    {
      mode: METER_CONSTANTS.MODES.SUCCESS_ONLY_WHEN_FULL,
      level: METER_CONSTANTS.LEVELS.MEDIUM,
      class: {
        barFill: "bg-error",
        labelValue: "text-error",
      },
    },
    {
      mode: METER_CONSTANTS.MODES.SUCCESS_ONLY_WHEN_FULL,
      level: METER_CONSTANTS.LEVELS.FULL,
      class: {
        barFill: "bg-success",
        labelValue: "text-success",
      },
    },
    {
      mode: METER_CONSTANTS.MODES.INVERTED,
      level: METER_CONSTANTS.LEVELS.LOW,
      class: {
        barFill: "bg-error",
        labelValue: "text-error",
      },
    },
    {
      mode: METER_CONSTANTS.MODES.INVERTED,
      level: METER_CONSTANTS.LEVELS.MEDIUM,
      class: {
        barFill: "bg-warning",
        labelValue: "text-warning-foreground",
      },
    },
    {
      mode: METER_CONSTANTS.MODES.INVERTED,
      level: METER_CONSTANTS.LEVELS.FULL,
      class: {
        barFill: "bg-success",
        labelValue: "text-success",
      },
    },
    {
      mode: METER_CONSTANTS.MODES.NEUTRAL,
      level: [
        METER_CONSTANTS.LEVELS.LOW,
        METER_CONSTANTS.LEVELS.MEDIUM,
        METER_CONSTANTS.LEVELS.FULL,
        METER_CONSTANTS.LEVELS.EXCEEDED_MAX_VALUE,
      ],
      class: {
        barFill: "bg-primary",
        labelValue: "text-foreground",
      },
    },
  ],
  defaultVariants: {
    mode: METER_CONSTANTS.MODES.DEFAULT,
    level: METER_CONSTANTS.LEVELS.LOW,
  },
});
