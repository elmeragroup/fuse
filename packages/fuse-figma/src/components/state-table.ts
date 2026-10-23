/**
 * What each Tailwind variant in a recipe means for a cell of the matrix. Most of that meaning is
 * fixed by `fuse.css` and Tailwind, not by the component, so this table holds it once: the state
 * variants each value of a `state` axis renders, the icon edge, the child selectors that reach
 * the icons, the `*:` that reaches a child part, the breakpoints the kit draws at, and the states
 * and children no standalone component shows. A definition adds only what is its own: the
 * attributes its own states render, facts for its own variants, and its own omissions.
 * {@link readVariants} reads a class's variants through the table for one cell.
 */
import type { CoverageNote } from "./cascade";
import type { Cell, ComponentDefinition, IconSlot, RootKind } from "./component-spec";
import { axisValues } from "./kit-spec";

/**
 * How the builder reads one variant of a class.
 *
 * - `condition`: the class applies in the cells where the variant holds.
 * - `child`: the class styles the icons the selector reaches.
 * - `children`: the class styles the box's children, as `*:` does, and the variant after it names
 *   which ones.
 * - `element`: the class styles the box's child parts that are elements of one tag, as `[&_img]:`
 *   styles the `<img>` a consumer puts in Item's media.
 * - `label-element`: the class styles the box's last child where it is an element of one tag, as
 *   `[&>span:last-child]:` styles the `<span>` a Sidebar row holds its label in.
 * - `specificity`: the variant tests nothing of the cell and only changes the class's specificity,
 *   which its compiled placement already carries, as `[:where(&)]:` lowers it to (0,0,0).
 * - `omitted`: no cell shows the state, so the class is dropped.
 * - `omitted-for`: the class styles a pseudo-element the kit draws no layer for, the component
 *   inside a composition the kit does not draw, or the component under a media condition the kit
 *   does not draw, so it is dropped with the definition's reason.
 * - `unmodelled`: the definition neither models nor omits the variant, so the class is unmapped.
 */
export type VariantMeaning =
  | { readonly kind: "condition"; readonly holds: (cell: Cell) => boolean }
  | { readonly kind: "child"; readonly selects: (slot: IconSlot) => boolean }
  | { readonly kind: "children" }
  | { readonly kind: "element"; readonly tag: string }
  | { readonly kind: "label-element"; readonly tag: string }
  | { readonly kind: "specificity" }
  | { readonly kind: "omitted" }
  | { readonly kind: "omitted-for"; readonly reason: string }
  | { readonly kind: "unmodelled" };

/** The meaning of each variant for one definition. */
export type StateTable = (variant: string) => VariantMeaning;

/**
 * The variants each value of a `state` axis renders, apart from `disabled`. fuse.css gates
 * `enabled-hover:` on an enabled control, and `hover:` has no gate. tailwindcss-react-aria-components
 * compiles `hover:` to `:hover`, or to `[data-hovered]` on an element marked `data-rac`, which React
 * Aria stamps while the pointer is over it. A cell holds one state, so none is hovered and disabled.
 */
const SHARED_STATES = new Map([
  ["hover", ["enabled-hover", "hover"]],
  ["focus", ["focus-visible"]],
  // Base UI marks a control inside an invalid Field `aria-invalid="true"` and `data-invalid`.
  ["invalid", ["aria-invalid", "data-invalid"]],
]);

/** The variants the `disabled` state renders, by what the root element is. */
const DISABLED_BY_ROOT = {
  // A native disabled control matches `:disabled`, and Base UI also marks it `data-disabled`.
  "native-control": ["disabled", "data-disabled"],
  // A span never matches `:disabled`. Base UI keeps a disabled span focusable and stamps
  // `aria-disabled="true"` and `data-disabled` on it.
  "base-ui-span": ["aria-disabled", "data-disabled"],
  // Base UI maps the Field's state onto its label, description and error as data attributes,
  // `data-disabled` among them.
  "base-ui-field-part": ["data-disabled"],
  // Nothing stamps a plain element, so only a group variant that reads the element around it holds.
  "plain-element": [],
  // React Aria stamps `aria-disabled="true"` and `data-disabled` on a disabled element, which is no
  // native control, so it never matches `:disabled`.
  "react-aria-element": ["aria-disabled", "data-disabled"],
} as const satisfies Record<RootKind, readonly string[]>;

/**
 * The variants the `invalid` state renders, by what the root element is. An invalid Field stamps
 * `aria-invalid` and `data-invalid` on its control, and `data-invalid` alone on its label,
 * description and error. React Aria stamps `aria-invalid` and `data-invalid` on an invalid element,
 * and tailwindcss-react-aria-components compiles `invalid:` to `[data-invalid]` on an element marked
 * `data-rac`. A set with no root kind takes the shared entry, the control's.
 */
const INVALID_BY_ROOT = {
  "native-control": ["aria-invalid", "data-invalid"],
  "base-ui-span": ["aria-invalid", "data-invalid"],
  "base-ui-field-part": ["data-invalid"],
  "plain-element": [],
  "react-aria-element": ["aria-invalid", "data-invalid", "invalid"],
} as const satisfies Record<RootKind, readonly string[]>;

/** `has-data-[icon=…]:` holds while some icon of the cell, or the span around it, carries the `data-icon`. */
const ICON_EDGES = new Map<string, NonNullable<IconSlot["dataIcon"]>>([
  ["has-data-[icon=inline-start]", "inline-start"],
  ["has-data-[icon=inline-end]", "inline-end"],
]);

/** The icons each child selector reaches. */
const CHILD_SELECTORS = new Map<string, (slot: IconSlot) => boolean>([
  ["[&_svg]", () => true],
  // `[class*='size-']` matches a class attribute that holds `size-` anywhere in it.
  ["[&_svg:not([class*='size-'])]", (slot) => !(slot.classes ?? "").includes("size-")],
  ["[&>svg]", (slot) => slot.direct],
  ["[&>svg:not([data-icon=inline-end])]", (slot) => slot.direct && slot.dataIcon !== "inline-end"],
]);

/** Tailwind's variant for an element's children, which compiles `*:x` to `:is(.… > *)`. */
const CHILDREN = "*";

/**
 * The child selectors that reach a part by its element's tag, as `[&_img]:` compiles to `.… img`.
 * The selector matches an `<img>` at any depth, so the class reaches each `<img>` part below the box,
 * through the parts between, as a child selector reaches an icon below them.
 */
const ELEMENT_SELECTORS = new Map([["[&_img]", "img"]]);

/**
 * The child selectors that reach the element a box holds its label in, by that element's tag:
 * `[&>span:last-child]:` compiles to `.… > span:last-child`, which styles the `<span>` a Sidebar
 * row holds its text in, where the text ends the row.
 */
const LABEL_ELEMENT_SELECTORS = new Map([["[&>span:last-child]", "span"]]);

/**
 * The variants that select the box itself and only change the class's specificity: `[:where(&)]:`
 * compiles a class to `:where(.class)`, which weighs nothing (Selectors 4 §17), as a Sidebar row's
 * shell corner does, so a consumer's corner wins.
 */
const SPECIFICITY_ONLY = new Set(["[:where(&)]"]);

/** The states and children a component set leaves out, whatever the component. */
const SHARED_OMISSIONS = new Set([
  // A press lasts only as long as the pointer is down.
  "enabled-active",
  // Invalid belongs to a control inside a form field. A set whose `state` axis has `invalid`
  // holds both in that state instead.
  "aria-invalid",
  "data-invalid",
  // Expanded belongs to the trigger of an open menu or popup.
  "aria-expanded",
  // A link inside a box's text, as a description underlines one. The kit draws the text alone.
  "[&>a]",
  "[&>a:hover]",
]);

/**
 * The breakpoints the kit draws at. Tailwind's `sm:` and `md:` hold from 40rem and 48rem, 640px and
 * 768px, which a desktop window reaches, so every cell draws a class's desktop arm. The compare
 * page's viewport is 2400px wide, so the browser draws the same arm. A wider breakpoint and a
 * `max-*` range stay unmodelled until a set needs one.
 */
const DESKTOP_BREAKPOINTS = new Set(["sm", "md"]);

/** The variants whose meaning is fixed here, which a definition's own states cannot render. */
const FIXED_VARIANTS = new Set([
  ...ICON_EDGES.keys(),
  ...CHILD_SELECTORS.keys(),
  ...ELEMENT_SELECTORS.keys(),
  ...LABEL_ELEMENT_SELECTORS.keys(),
  ...SPECIFICITY_ONLY,
  ...SHARED_OMISSIONS,
  ...DESKTOP_BREAKPOINTS,
]);

/**
 * Build the state table of one definition. A shared state entry is modelled only when the
 * definition's `state` axis has the value that renders it, so a set without a focus value
 * leaves `focus-visible:` unmapped instead of holding it in no cell.
 *
 * @param definition - The component.
 * @returns The meaning of each variant.
 * @throws When the definition has a disabled state and names no root kind, or gives a variant
 *   a second meaning: a fact for a shared variant, an omission of a fixed variant or of a shared
 *   state's variant where the state axis shows that state, a state that renders a fixed one, or
 *   one variant declared twice.
 */
export function makeStateTable(
  definition: Pick<
    ComponentDefinition,
    | "name"
    | "rootKind"
    | "axes"
    | "states"
    | "facts"
    | "omittedStates"
    | "omittedPseudoElements"
    | "omittedCompositions"
    | "omittedMedia"
    | "iconsFor"
  >
): StateTable {
  const stateValues = axisValues(definition, "state");
  const sharedStates = new Map<string, readonly string[]>(SHARED_STATES);
  if (definition.rootKind !== undefined) {
    sharedStates.set("disabled", DISABLED_BY_ROOT[definition.rootKind]);
    sharedStates.set("invalid", INVALID_BY_ROOT[definition.rootKind]);
  } else if (stateValues.includes("disabled")) {
    throw new Error(`${definition.name} has a disabled state and names no root kind`);
  }
  const omittedElements = definition.omittedPseudoElements ?? new Map<string, string>();
  const omittedCompositions = definition.omittedCompositions ?? new Map<string, string>();
  const omittedMedia = definition.omittedMedia ?? new Map<string, string>();
  // Every variant this table gives the definition a meaning.
  const sharedVariants = new Set([...FIXED_VARIANTS, ...[...sharedStates.values()].flat()]);
  // The variants of the shared states the definition's state axis shows. A set without a state may
  // omit its variants, as a `<div>` row that takes no focus omits `focus-visible`.
  const shownVariants = new Set([
    ...FIXED_VARIANTS,
    ...stateValues.flatMap((state) => sharedStates.get(state) ?? []),
  ]);

  const sources = [
    // A state may add to a shared state entry, as a pending Button renders `data-disabled`.
    { variants: new Set(Object.values(definition.states).flat()), shared: FIXED_VARIANTS },
    { variants: new Set(definition.facts.keys()), shared: sharedVariants },
    { variants: definition.omittedStates, shared: shownVariants },
    { variants: new Set(omittedElements.keys()), shared: sharedVariants },
    { variants: new Set(omittedCompositions.keys()), shared: sharedVariants },
    { variants: new Set(omittedMedia.keys()), shared: sharedVariants },
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
  for (const state of stateValues) {
    for (const variant of [...(sharedStates.get(state) ?? []), ...(definition.states[state] ?? [])]) {
      statesRendering.set(variant, (statesRendering.get(variant) ?? new Set()).add(state));
    }
  }

  return (variant) => {
    const selects = CHILD_SELECTORS.get(variant);
    if (selects !== undefined) {
      return { kind: "child", selects };
    }
    const tag = ELEMENT_SELECTORS.get(variant);
    if (tag !== undefined) {
      return { kind: "element", tag };
    }
    const labelTag = LABEL_ELEMENT_SELECTORS.get(variant);
    if (labelTag !== undefined) {
      return { kind: "label-element", tag: labelTag };
    }
    if (SPECIFICITY_ONLY.has(variant)) {
      return { kind: "specificity" };
    }
    const states = statesRendering.get(variant);
    if (states !== undefined) {
      return { kind: "condition", holds: (cell) => states.has(cell.state ?? "") };
    }
    if (DESKTOP_BREAKPOINTS.has(variant)) {
      return { kind: "condition", holds: () => true };
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
    const reason =
      omittedElements.get(variant) ?? omittedCompositions.get(variant) ?? omittedMedia.get(variant);
    if (reason !== undefined) {
      return { kind: "omitted-for", reason };
    }
    if (SHARED_OMISSIONS.has(variant) || definition.omittedStates.has(variant)) {
      return { kind: "omitted" };
    }
    // `*:` styles the box's children, which a definition that draws them reaches by their slot. One
    // that omits `*`, as Label omits the Field card it can wrap, draws none of them.
    return variant === CHILDREN ? { kind: "children" } : { kind: "unmodelled" };
  };
}

/**
 * The children a class styles: the parts that carry a `data-slot`, the parts that are elements of a
 * tag, or the element of a tag that holds the box's label as its last child.
 */
export type PartTarget =
  | { readonly kind: "slot"; readonly slot: string }
  | { readonly kind: "tag"; readonly tag: string }
  | { readonly kind: "label"; readonly tag: string };

/** What a class's variants say about it in one cell. */
export type VariantReading = {
  /** The icons its child selectors reach, or undefined for a class on the box itself. */
  readonly selects: ((slot: IconSlot) => boolean) | undefined;
  /** The child parts it styles, or undefined for a class on the box itself. */
  readonly target: PartTarget | undefined;
  readonly conditionVariants: readonly string[];
  /** Whether every condition variant holds in the cell. */
  readonly holds: boolean;
  /** What becomes of a class that applies in no cell the kit draws, or undefined for one that may. */
  readonly skipped: CoverageNote | undefined;
};

/** `*:` before anything but a part's slot. */
const BARE_CHILDREN: CoverageNote = {
  outcome: "unmapped",
  detail: "the builder reads `*:` only before a `data-[slot=…]:` that names one part",
};

/** A variant after `*:data-[slot=…]:`, which tests the child's own state. */
const PAST_CHILD_SLOT: CoverageNote = {
  outcome: "unmapped",
  detail:
    "the builder reads `*:data-[slot=…]:` only as a class's last variants, and models no state of the child",
};

/** A variant after an element selector such as `[&_img]:`, or one inside an icon's selector. */
const PAST_CHILD_ELEMENT: CoverageNote = {
  outcome: "unmapped",
  detail:
    "the builder reads a selector such as `[&_img]:` only as a class's last variant on the box itself, and models no state of the element",
};

/**
 * Read a class's variants, outermost first. A condition holds or not in the cell, a child selector
 * narrows the icons the class reaches, `*:` followed by `data-[slot=x]:` makes the class style the
 * box's child parts whose `data-slot` is `x`, and an element selector such as `[&_img]:` makes it
 * style the box's child parts of that tag. Any other variant skips the class.
 *
 * @param variants - The class's variants, outermost first.
 * @param meaningOf - The definition's state table.
 * @param cell - The cell.
 * @returns The icons or child parts the class reaches, its condition variants and whether they
 *   hold, or what becomes of a class that applies in no cell the kit draws.
 */
export function readVariants(variants: readonly string[], meaningOf: StateTable, cell: Cell): VariantReading {
  let selects: VariantReading["selects"];
  let target: PartTarget | undefined;
  const conditionVariants: string[] = [];
  let holds = true;
  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index] ?? "";
    const meaning = meaningOf(variant);
    const skip = (skipped: CoverageNote): VariantReading => ({
      selects,
      target,
      conditionVariants,
      holds,
      skipped,
    });
    if (target !== undefined) {
      return skip(target.kind === "slot" ? PAST_CHILD_SLOT : PAST_CHILD_ELEMENT);
    }
    if (meaning.kind === "child") {
      const outer = selects;
      selects = outer === undefined ? meaning.selects : (icon) => outer(icon) && meaning.selects(icon);
      continue;
    }
    if (meaning.kind === "children") {
      const slot = slotOfVariant(variants[index + 1]);
      if (slot === undefined || selects !== undefined) {
        return skip(BARE_CHILDREN);
      }
      target = { kind: "slot", slot };
      index += 1;
      continue;
    }
    if (meaning.kind === "element") {
      if (selects !== undefined) {
        return skip(PAST_CHILD_ELEMENT);
      }
      target = { kind: "tag", tag: meaning.tag };
      continue;
    }
    if (meaning.kind === "label-element") {
      if (selects !== undefined) {
        return skip(PAST_CHILD_ELEMENT);
      }
      target = { kind: "label", tag: meaning.tag };
      continue;
    }
    if (meaning.kind === "specificity") {
      continue;
    }
    if (meaning.kind !== "condition") {
      return skip(skippedNote(variant, meaning));
    }
    conditionVariants.push(variant);
    holds &&= meaning.holds(cell);
  }
  return { selects, target, conditionVariants, holds, skipped: undefined };
}

/** The `data-slot` a `data-[slot=x]` variant tests for, or undefined for any other variant. */
function slotOfVariant(variant: string | undefined): string | undefined {
  return /^data-\[slot=([\w-]+)\]$/.exec(variant ?? "")?.[1];
}

/** What becomes of a class whose variant applies it in no cell the kit draws. */
function skippedNote(
  variant: string,
  meaning: Exclude<
    VariantMeaning,
    { readonly kind: "condition" | "child" | "children" | "element" | "label-element" | "specificity" }
  >
): CoverageNote {
  switch (meaning.kind) {
    case "omitted":
      return { outcome: "dropped", detail: `no cell of the matrix shows \`${variant}\`` };
    case "omitted-for":
      return { outcome: "dropped", detail: meaning.reason };
    case "unmodelled":
      return { outcome: "unmapped", detail: `the definition neither models nor omits \`${variant}\`` };
  }
}
