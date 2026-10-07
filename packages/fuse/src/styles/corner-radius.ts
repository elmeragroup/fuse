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
// The field box declares its corner once, as `--field-corner`, the clamp `clamp(--radius -
// 1000 * step, --radius-field, --radius + 1000 * step)`. Its bounds meet at `--radius` at a
// 0px step, so internal fields keep reading `--radius` on the box itself and follow a
// `--radius` override on a plain wrapper. At a 2px step they lie 4000px apart, and the theme's
// `--radius-field` applies. The read of `--radius-field` falls back to `--radius` for a host
// that sets the step but not the role. The property is unregistered, so the box substitutes
// its own `var()` reads and the parts inside inherit the box's corner. The box publishes it
// less its inset as the inner corner of the parts inside (`inner-corner/field.ts`).
//
// Inner corners are concentric: an inner part rounds with its shell's outer corner less the
// inset, `max(0px, outer - inset)`, where the inset is the shell's padding plus border on the
// axis that reaches the corner. Outer corners keep their rung. An inner part rounds with the
// public `rounded-inner` utility in fuse.css, `var(--inner-corner, var(--radius))`, so outside
// a shell it rounds with `--radius`. The shells live in `inner-corner/`, one private module per
// component family, so a component bundles only its own. Each constant there pairs a part's
// rung or padding with the corner it publishes, read through `--theme()` so it resolves in the
// shell's own theme scope, and spells its values whole, because Tailwind generates a class only
// from its whole literal. A part rounds concentrically only inside a shell; a block directly in
// `Combobox.Content` rounds with `--radius`.
//
// Every shell boundary, a popup root or a padded part, states the whole corner state, so no
// value from an outer shell crosses it. It writes its post-padding corner to a private
// `--shell-inner`, or `initial` when the part does not publish a corner, and aliases the public
// `--inner-corner` to it. It also clears the private `--shell-corner` relay with
// `publishShellBoundary`, unless it is one of the parts that carry the relay:
//
// - a NavigationMenu popup, which sets `--shell-corner` to the corner its Content takes;
// - a NavigationMenu Content, which reads it and subtracts its own padding;
// - an inline NavigationMenu Viewport, which sets it from the inherited `--shell-inner` of the
//   Content around it, a value a ThemeScope reset leaves alone.
//
// Frame hands its corner on through its own private input instead (`inner-corner/frame.ts`):
// the root writes `--frame-corner` onto its direct panels and table containers, and every panel
// and container resets it at lower specificity, so only a Frame's direct child holds a value. A
// Frame panel is an ordinary boundary.
//
// No custom property depends on itself, directly or indirectly, on one element, so any depth
// subtracts each padding once. Where no shell is above a padded part, `--shell-corner` is
// undefined, its `--inner-corner` is invalid at computed-value time, and `rounded-inner` falls
// back to `--radius`. `--inner-corner` is unregistered and inherits as a computed length. Every
// element with theme attributes resets `--inner-corner` to `initial` with a zero-specificity
// rule in the utilities layer, so a part in a nested ThemeScope rounds with that scope's
// `--radius` instead of the outer shell's px value, and a shell class on the same element wins
// whatever layer order the host declares.

/**
 * The field box corner: Input, Textarea, the Select trigger, NumberField, InputGroup, the
 * Combobox chips box and the React Aria field group. It declares `--field-corner` for the parts
 * inside the box and rounds with it. External themes round it with `--radius-field`, and
 * internal themes with `--radius`.
 */
export const fieldCornerClass = cn(
  "rounded-(--field-corner) [--field-corner:clamp(var(--radius)-1000*var(--radius-step,0px),var(--radius-field,var(--radius)),var(--radius)+1000*var(--radius-step,0px))]"
);

/**
 * The corner of a compact button that sits in a toolbar, the xs Toggle. External themes round it with `rounded-md` capped at 10px, and
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
 * The public corner a shell publishes: its private post-padding corner, `--shell-inner`. Only
 * the parts that carry the `--shell-corner` relay compose it alone; every other shell boundary
 * composes {@link publishShellBoundary}. Each composes it beside a `--shell-inner` declaration,
 * and only there, so a ThemeScope reset of `--inner-corner` is never undone by an inherited
 * `--shell-inner`.
 */
export const publishInnerCorner = cn("[--inner-corner:var(--shell-inner)]");

/**
 * {@link publishInnerCorner} for an independent shell boundary: it also clears the private
 * `--shell-corner` relay, so no relay from an outer shell reaches a part inside it.
 */
export const publishShellBoundary = cn("[--shell-corner:initial]", publishInnerCorner);
