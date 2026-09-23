import { cn } from "./cn";

// The corners here leave the `rounded-*` scale in external themes and round with `--radius`
// in internal ones. Each class reads the element's own `--radius` and `--radius-step`, so it
// follows the enclosing theme scope and a `--radius` override on the theme element.
// `--radius-step` doubles as the variant switch. It is 0px in the internal variant and 2px
// in the external one, and the formulas support no other value. `--radius - 1000 * step`
// equals `--radius` at a 0px step and lies 2000px below it at a 2px step. A `max()` with it
// raises a cap to at least `--radius` internally and leaves the cap as written externally.
// Tailwind generates a class only from its whole literal, so each class spells its value.

/**
 * The corner of an xs button inside an InputGroup addon. External themes inset it 5px, or
 * 2.5 steps, inside the field's `--radius`, and internal themes inset it by 0.
 */
export const insetCornerClass = cn("rounded-[calc(var(--radius)-2.5*var(--radius-step))]");

/**
 * The {@link insetCornerClass} corner on an addon's `<kbd>` child. The radius browser matrix
 * measures the kbd and an xs addon button against the same expected corner.
 */
export const kbdInsetCornerClass = cn("[&>kbd]:rounded-[calc(var(--radius)-2.5*var(--radius-step))]");

/**
 * The corner of a compact button that sits in a field or a list, such as the xs Toggle, the
 * date picker trigger, the DatePicker preset items and the Combobox chip remove button.
 * External themes round it with `rounded-md` capped at 10px, and internal themes with
 * `--radius`.
 */
export const compactCornerClass = cn(
  "rounded-[min(--theme(--radius-md),max(10px,var(--radius)-1000*var(--radius-step)))]"
);

/**
 * The Checkbox corner. External themes round it with `rounded-md` capped at 4px, and
 * internal themes with `--radius`.
 */
export const checkboxCornerClass = cn(
  "rounded-[min(--theme(--radius-md),max(4px,var(--radius)-1000*var(--radius-step)))]"
);

/**
 * The corner of the phone country trigger and the standalone Calendar. External themes keep
 * the reference's 4px whatever the brand radius, and internal themes round it with
 * `--radius`. The clamp's bounds meet at `--radius` at a 0px step and lie 4000px apart at a
 * 2px step, where the preferred 4px applies.
 */
export const fixedCornerClass = cn(
  "rounded-[clamp(var(--radius)-1000*var(--radius-step),4px,var(--radius)+1000*var(--radius-step))]"
);
