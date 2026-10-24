/**
 * What the Input and Textarea sets share, since both draw Fuse's field box (`fieldBox` in
 * `field-box.ts`) on a native control: a placeholder and a typed value in five states, 10 cells.
 *
 * - The box is 384px wide, the preview width its `w-full` takes, as the docs' widest field
 *   (`max-w-sm`) is.
 * - `content=placeholder` holds `placeholder:`, so the text paints `muted-foreground`. A typed value
 *   inherits the page's `foreground`, or the `error` an invalid Field root passes down through its
 *   `data-invalid:text-error`. Each set names the Field root by its recipe classes in the cells
 *   whose control sits in one, so the build cascades them around the control.
 * - Read-only fills with `muted` through `[&[readonly]:not(:disabled)]`, the `readonly` attribute
 *   the control renders for `readOnly`. Disabled dims to 50% on the `input/50` fill.
 * - Invalid draws the `error` border and ring of a control inside an invalid Field. The recipe's
 *   invalid focus ring needs invalid and focus at once, which no cell draws.
 * - A disabled control is natively disabled, and Base UI never marks it `aria-disabled`, so no cell
 *   shows the state face's `aria-disabled:` arm. `entry-floor:` raises the text to 16px for a coarse
 *   pointer or iOS WebKit, and the kit draws a desktop with a fine pointer.
 */
import { fieldVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { AncestorDefinition, Cell, ComponentDefinition } from "./component-spec";

/**
 * The width a Field gives what it holds, in the Figma preview and on the compare page: a field box's
 * `w-full` takes it, and Field's description, error and legend fill it as block boxes.
 */
export const FIELD_BOX_PREVIEW_WIDTH = 384;

/**
 * Whether a cell shows the placeholder, where the control holds a placeholder and no value.
 *
 * @param cell - The cell.
 * @returns True at `content=placeholder`.
 */
export function showsPlaceholder(cell: Cell): boolean {
  return cell.content === "placeholder";
}

/**
 * `Field.Root` around the control, at its default vertical orientation. Its `data-invalid:text-error`
 * holds where the cell is invalid, and the control inherits it, as preflight gives a form control
 * `color: inherit`. Select trigger names it around an invalid trigger too.
 */
export const FIELD_ROOT: AncestorDefinition = {
  slot: "field",
  classes: fieldVariants().root(),
  undrawn: "the Field lays out its label, control and messages, which the set does not draw",
};

/**
 * The Field root's `[&>.sr-only]:w-auto`, as a definition omits it: it widens a visually hidden child
 * of the Field, which no cell holds.
 */
export const FIELD_ROOT_SR_ONLY = [
  "[&>.sr-only]",
  "a visually hidden child of the Field, which no cell holds",
] as const;

/**
 * The variant of the Field root's stretch, `[&>…]:w-full`, which widens every child but a Checkbox or
 * a Switch to the Field's width. A definition whose root sits in a Field omits it with its own
 * reason.
 */
export const FIELD_ROOT_STRETCH = "[&>:where(:not([data-slot=checkbox],[data-slot=switch]))]";

/**
 * The matrix, states, facts and omissions of a field box set. A definition spreads it and adds its
 * key, slot, classes, label and the cells a Field root holds it in, and any omission of its own. The
 * Field root's child selectors reach the control, which the omissions name: `[&>.sr-only]` widens a
 * visually hidden child, which no cell holds, and the stretch of every other child gives the control
 * the width its own `w-full` already takes.
 */
export const FIELD_BOX_SET: Pick<
  ComponentDefinition,
  | "rootKind"
  | "previewWidth"
  | "axes"
  | "columnAxis"
  | "states"
  | "facts"
  | "omittedStates"
  | "omittedCompositions"
  | "iconsFor"
  | "swapProperties"
> = {
  rootKind: "native-control",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  axes: [
    { name: "content", values: ["placeholder", "value"] },
    { name: "state", values: ["rest", "focus", "disabled", "readonly", "invalid"] },
  ],
  columnAxis: "state",
  states: { readonly: ["[&[readonly]:not(:disabled)]"] },
  facts: new Map([["placeholder", showsPlaceholder]]),
  omittedStates: new Set(["aria-disabled", "entry-floor"]),
  omittedCompositions: new Map([
    FIELD_ROOT_SR_ONLY,
    [
      FIELD_ROOT_STRETCH,
      "the Field stretches the control to its width, which the control's own `w-full` already takes",
    ],
  ]),
  iconsFor: () => [],
  swapProperties: [],
};
