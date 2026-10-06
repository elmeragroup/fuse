import { cn } from "./cn";

// The corners here leave the `rounded-*` scale in external themes and round with `--radius`
// in internal ones. Each class reads the element's own `--radius` and `--radius-step`, so it
// follows the enclosing theme scope and a `--radius` override on the theme element.
// `--radius-step` doubles as the variant switch. It is 0px in the internal variant and 2px
// in the external one, and the formulas support no other value. `--radius - 1000 * step`
// equals `--radius` at a 0px step and lies 2000px below it at a 2px step. A `max()` with it
// raises a cap to at least `--radius` internally and leaves the cap as written externally.
// Each read of the step falls back to 0px, as the rungs in fuse.css do, so a host without
// themes.css rounds these corners with its own `--radius` instead of losing them.
// Tailwind generates a class only from its whole literal, so each class spells its value.
//
// The field corner is the clamp `clamp(--radius - 1000 * step, --radius-field, --radius +
// 1000 * step)`. Its bounds meet at `--radius` at a 0px step, so internal fields keep reading
// `--radius` on the element itself and follow a `--radius` override on a plain wrapper. At a
// 2px step they lie 4000px apart, and the theme's `--radius-field` applies. The read of
// `--radius-field` falls back to `--radius` for a host that sets the step but not the role.
// Every corner inside a field box is capped at the field corner, so nothing inside the box
// rounds more than the box.

/**
 * The field box corner: Input, Textarea, the Select trigger, NumberField, InputGroup, the
 * Combobox chips box and the React Aria field group. Buttons that sit flush in the box, the
 * `sm` InputGroup addon buttons, the SearchField clear button and the date picker trigger,
 * round with it too. External themes round it with `--radius-field`, and internal themes with
 * `--radius`.
 */
export const fieldCornerClass = cn(
  "rounded-[clamp(var(--radius)-1000*var(--radius-step,0px),var(--radius-field,var(--radius)),var(--radius)+1000*var(--radius-step,0px))]"
);

/**
 * The corner of an xs button inside an InputGroup addon. External themes inset it 5px, or
 * 2.5 steps, inside `--radius`, capped at the {@link fieldCornerClass} corner, and internal
 * themes round it with `--radius`.
 */
export const insetCornerClass = cn(
  "rounded-[min(var(--radius)-2.5*var(--radius-step,0px),clamp(var(--radius)-1000*var(--radius-step,0px),var(--radius-field,var(--radius)),var(--radius)+1000*var(--radius-step,0px)))]"
);

/**
 * The {@link insetCornerClass} corner on an addon's `<kbd>` child. The radius browser matrix
 * measures the kbd and an xs addon button against the same expected corner.
 */
export const kbdInsetCornerClass = cn(
  "[&>kbd]:rounded-[min(var(--radius)-2.5*var(--radius-step,0px),clamp(var(--radius)-1000*var(--radius-step,0px),var(--radius-field,var(--radius)),var(--radius)+1000*var(--radius-step,0px)))]"
);

/**
 * The corner of a Combobox chip and its remove button. External themes round it with
 * `rounded-sm` capped at the {@link fieldCornerClass} corner, and internal themes with
 * `--radius`.
 */
export const chipCornerClass = cn(
  "rounded-[min(--theme(--radius-sm),clamp(var(--radius)-1000*var(--radius-step,0px),var(--radius-field,var(--radius)),var(--radius)+1000*var(--radius-step,0px)))]"
);

/**
 * The corner of a compact button that sits in a list or a toolbar, the xs Toggle and the
 * DatePicker preset items. External themes round it with `rounded-md` capped at 10px, and
 * internal themes with `--radius`.
 */
export const compactCornerClass = cn(
  "rounded-[min(--theme(--radius-md),max(10px,var(--radius)-1000*var(--radius-step,0px)))]"
);

/**
 * The Checkbox corner. External themes round it with `rounded-md` capped at 4px, and
 * internal themes with `--radius`.
 */
export const checkboxCornerClass = cn(
  "rounded-[min(--theme(--radius-md),max(4px,var(--radius)-1000*var(--radius-step,0px)))]"
);

/**
 * The corner of the standalone Calendar. External themes keep the reference's 4px whatever
 * the brand radius, and internal themes round it with `--radius`. The clamp's bounds meet at
 * `--radius` at a 0px step and lie 4000px apart at a 2px step, where the preferred 4px
 * applies.
 */
export const fixedCornerClass = cn(
  "rounded-[clamp(var(--radius)-1000*var(--radius-step,0px),4px,var(--radius)+1000*var(--radius-step,0px))]"
);

/**
 * The corner of the phone country trigger, which sits in the field box: the
 * {@link fixedCornerClass} corner capped at the {@link fieldCornerClass} corner.
 */
export const fieldFixedCornerClass = cn(
  "rounded-[min(clamp(var(--radius)-1000*var(--radius-step,0px),4px,var(--radius)+1000*var(--radius-step,0px)),clamp(var(--radius)-1000*var(--radius-step,0px),var(--radius-field,var(--radius)),var(--radius)+1000*var(--radius-step,0px)))]"
);
