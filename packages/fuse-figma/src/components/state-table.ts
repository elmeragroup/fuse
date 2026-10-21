/**
 * What each Tailwind variant in a recipe means for a cell of the matrix. Most of that meaning is
 * fixed by `fuse.css` and Tailwind, not by the component, so this table holds it once: the state
 * variants each value of a `state` axis renders, the icon edge, the child selectors that reach
 * the icons, and the states no standalone component shows. A definition adds only what is its
 * own: the attributes its own states render, facts for its own variants, and its own omissions.
 */
import type { Cell, ComponentDefinition, IconSlot } from "./component-spec";
import { axisValues } from "./kit-spec";

/**
 * How the builder reads one variant of a class.
 *
 * - `condition`: the class applies in the cells where the variant holds.
 * - `child`: the class styles the icons the selector reaches.
 * - `omitted`: no cell shows the state, so the class is dropped.
 * - `unmodelled`: the definition neither models nor omits the variant, so the class is unmapped.
 */
export type VariantMeaning =
  | { readonly kind: "condition"; readonly holds: (cell: Cell) => boolean }
  | { readonly kind: "child"; readonly selects: (slot: IconSlot) => boolean }
  | { readonly kind: "omitted" }
  | { readonly kind: "unmodelled" };

/** The meaning of each variant for one definition. */
export type StateTable = (variant: string) => VariantMeaning;

/**
 * The variants each value of a `state` axis renders. fuse.css gates `enabled-hover:` on an
 * enabled control, and a disabled control is a native disabled element, which Base UI also
 * marks `data-disabled`.
 */
const SHARED_STATES = new Map([
  ["hover", ["enabled-hover"]],
  ["focus", ["focus-visible"]],
  ["disabled", ["disabled", "data-disabled"]],
]);

/** `has-data-[icon=…]:` holds while some icon of the cell, or the span around it, carries the `data-icon`. */
const ICON_EDGES = new Map<string, NonNullable<IconSlot["dataIcon"]>>([
  ["has-data-[icon=inline-start]", "inline-start"],
  ["has-data-[icon=inline-end]", "inline-end"],
]);

/** The icons each child selector reaches. */
const CHILD_SELECTORS = new Map<string, (slot: IconSlot) => boolean>([
  ["[&_svg]", () => true],
  // No kit icon carries a `size-*` class, so the recipe's size reaches every one.
  ["[&_svg:not([class*='size-'])]", () => true],
  ["[&>svg:not([data-icon=inline-end])]", (slot) => slot.direct && slot.dataIcon !== "inline-end"],
]);

/** The states a component set leaves out, whatever the component. */
const SHARED_OMISSIONS = new Set([
  // A press lasts only as long as the pointer is down.
  "enabled-active",
  // Invalid belongs to a control inside a form field.
  "aria-invalid",
  "data-invalid",
  // Expanded belongs to the trigger of an open menu or popup.
  "aria-expanded",
]);

/** The variants whose meaning is fixed here, which a definition's own states cannot render. */
const FIXED_VARIANTS = new Set([...ICON_EDGES.keys(), ...CHILD_SELECTORS.keys(), ...SHARED_OMISSIONS]);

/** Every variant this table gives a meaning. */
const SHARED_VARIANTS = new Set([...FIXED_VARIANTS, ...[...SHARED_STATES.values()].flat()]);

/**
 * Build the state table of one definition. A shared state entry is modelled only when the
 * definition's `state` axis has the value that renders it, so a set without a focus value
 * leaves `focus-visible:` unmapped instead of holding it in no cell.
 *
 * @param definition - The component.
 * @returns The meaning of each variant.
 * @throws When the definition gives a variant a second meaning: a fact or an omission for a
 *   shared variant, a state that renders a fixed one, or one variant declared twice.
 */
export function makeStateTable(
  definition: Pick<ComponentDefinition, "name" | "axes" | "states" | "facts" | "omittedStates" | "iconsFor">
): StateTable {
  const sources = [
    // A state may add to a shared state entry, as a pending Button renders `data-disabled`.
    { variants: new Set(Object.values(definition.states).flat()), shared: FIXED_VARIANTS },
    { variants: new Set(definition.facts.keys()), shared: SHARED_VARIANTS },
    { variants: definition.omittedStates, shared: SHARED_VARIANTS },
  ];
  for (const source of sources) {
    for (const variant of source.variants) {
      if (
        source.shared.has(variant) ||
        sources.some((other) => other !== source && other.variants.has(variant))
      ) {
        throw new Error(`${definition.name} gives \`${variant}\` a second meaning`);
      }
    }
  }

  const statesRendering = new Map<string, Set<string>>();
  for (const state of axisValues(definition, "state")) {
    for (const variant of [...(SHARED_STATES.get(state) ?? []), ...(definition.states[state] ?? [])]) {
      statesRendering.set(variant, (statesRendering.get(variant) ?? new Set()).add(state));
    }
  }

  return (variant) => {
    const selects = CHILD_SELECTORS.get(variant);
    if (selects !== undefined) {
      return { kind: "child", selects };
    }
    const states = statesRendering.get(variant);
    if (states !== undefined) {
      return { kind: "condition", holds: (cell) => states.has(cell.state ?? "") };
    }
    const dataIcon = ICON_EDGES.get(variant);
    if (dataIcon !== undefined) {
      return {
        kind: "condition",
        holds: (cell) => definition.iconsFor(cell).some((slot) => slot.dataIcon === dataIcon),
      };
    }
    const fact = definition.facts.get(variant);
    if (fact !== undefined) {
      return { kind: "condition", holds: fact };
    }
    return SHARED_OMISSIONS.has(variant) || definition.omittedStates.has(variant)
      ? { kind: "omitted" }
      : { kind: "unmodelled" };
  };
}
