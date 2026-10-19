/**
 * Button for the proof of concept: three variants, two sizes, four states and an optional
 * start icon, 48 cells in one component set.
 *
 * - `default` fills with a bound color, `outline` draws a border whose width is a variable
 *   and casts a shadow whose blur is a formula over it, and `destructive` mixes `--error` at
 *   10% and 20% opacity.
 * - `default` and `sm` read two different rows of the `Fuse density` control metrics.
 * - The states map Fuse's state variants onto one `state` axis. Hover comes from
 *   `enabled-hover:`, focus from `focus-visible:` and disabled from the three disabled faces.
 * - A start icon moves the left padding through `has-data-[icon=inline-start]:`.
 */
import { buttonVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition } from "./component-spec";

type ButtonVariant = "default" | "outline" | "destructive";
type ButtonSize = "default" | "sm";

const VARIANTS: readonly ButtonVariant[] = ["default", "outline", "destructive"];
const SIZES: readonly ButtonSize[] = ["default", "sm"];

function isVariant(value: string | undefined): value is ButtonVariant {
  return VARIANTS.some((variant) => variant === value);
}

function isSize(value: string | undefined): value is ButtonSize {
  return SIZES.some((size) => size === value);
}

const inState = (state: string) => (cell: Cell) => cell.state === state;

export const BUTTON: ComponentDefinition = {
  key: "button",
  name: "Button",
  slot: "button",
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "size", values: SIZES },
    { name: "state", values: ["rest", "hover", "focus", "disabled"] },
    { name: "icon", values: ["none", "start"] },
  ],
  columnAxis: "state",
  classesFor: (cell) => {
    const { variant, size } = cell;
    if (!isVariant(variant) || !isSize(size)) {
      throw new Error(`Button has no variant ${variant ?? ""} or size ${size ?? ""}`);
    }
    return buttonVariants({ variant, size });
  },
  conditions: new Map([
    ["enabled-hover", inState("hover")],
    ["focus-visible", inState("focus")],
    ["disabled", inState("disabled")],
    ["data-disabled", inState("disabled")],
    ["aria-disabled", inState("disabled")],
    ["has-data-[icon=inline-start]", (cell) => cell.icon === "start"],
  ]),
  childSelectors: new Map([
    ["[&_svg]", "icon"],
    ["[&_svg:not([class*='size-'])]", "icon"],
  ]),
  label: { key: "label", name: "label", characters: "Button", textProperty: "Label" },
  iconFor: (cell) => (cell.icon === "start" ? { key: "icon", name: "icon" } : undefined),
};
