/**
 * What the Input and Textarea sets share, since both draw Fuse's field box (`fieldBox` in
 * `field-box.ts`) on a native control: a placeholder and a typed value in five states, 10 cells.
 *
 * - The box is 384px wide, the preview width its `w-full` takes, as the docs' widest field
 *   (`max-w-sm`) is.
 * - `content=placeholder` holds `placeholder:`, so the text paints `muted-foreground`. A typed value
 *   inherits the page's `foreground`, or the `error` an invalid Field root passes down through its
 *   `data-invalid:text-error`.
 * - Read-only fills with `muted` through `[&[readonly]:not(:disabled)]`, the `readonly` attribute
 *   the control renders for `readOnly`. Disabled dims to 50% on the `input/50` fill.
 * - Invalid draws the `error` border and ring of a control inside an invalid Field. The recipe's
 *   invalid focus ring needs invalid and focus at once, which no cell draws.
 * - A disabled control is natively disabled, and Base UI never marks it `aria-disabled`, so no cell
 *   shows the state face's `aria-disabled:` arm. `entry-floor:` raises the text to 16px for a coarse
 *   pointer or iOS WebKit, and the kit draws a desktop with a fine pointer.
 */
import type { Cell, ComponentDefinition, OuterDeclaration } from "./component-spec";

/** The width a field box's `w-full` takes, in the Figma preview and on the compare page. */
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
 * The text color an invalid Field root sets, `data-invalid:text-error` in `field-variants.ts`, which
 * the control inherits, as preflight gives a form control `color: inherit`.
 */
const INVALID_FIELD: readonly OuterDeclaration[] = [
  { className: "Field.Root data-invalid:text-error", property: "color", value: "var(--error)" },
];

/**
 * The matrix, states, facts and omissions of a field box set. A definition spreads it and adds its
 * key, slot, classes and label, and any omission of its own.
 */
export const FIELD_BOX_SET: Pick<
  ComponentDefinition,
  | "rootKind"
  | "previewWidth"
  | "axes"
  | "columnAxis"
  | "inheritedFor"
  | "states"
  | "facts"
  | "omittedStates"
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
  inheritedFor: (cell) => (cell.state === "invalid" ? INVALID_FIELD : []),
  states: { readonly: ["[&[readonly]:not(:disabled)]"] },
  facts: new Map([["placeholder", showsPlaceholder]]),
  omittedStates: new Set(["aria-disabled", "entry-floor"]),
  iconsFor: () => [],
  swapProperties: [],
};
