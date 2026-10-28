/**
 * The cells `figma:compare` knows how to render: a kit variant key parsed into the definition
 * it belongs to and a value for each of its axes. A key such as
 * `button/variant=ghost,size=sm,state=hover,icon=end` names the component set, then each
 * variant property. `variantKey` in `component-spec.ts` writes these keys, and this module reads
 * them back against the kit's definitions. A key leaves out an axis the set added later at its first
 * value, which the parser fills back in. The parser accepts only the axes and values a
 * definition declares, so a new axis in a snapshot shows up as an unsupported cell, not as a
 * cell rendered without it.
 *
 * A definition with an interactive axis names it `state`, with `rest` among its values. The page
 * forces the pointer and keyboard states from that axis and compares them with the cell at rest.
 * A cell of a set with no `state` axis, such as Badge, gets nothing forced.
 */

import { Result } from "effect";

import type { Cell, ComponentDefinition } from "../components/component-spec.ts";

/** A variant key the harness cannot render. */
class UnsupportedVariant extends Error {
  readonly _tag = "UnsupportedVariant" as const;
  /** The key as the snapshot holds it. */
  readonly variant: string;

  /**
   * @param variant - The key as the snapshot holds it.
   * @param reason - Why the harness cannot render it.
   */
  constructor(variant: string, reason: string) {
    super(`${variant}: ${reason}`);
    this.variant = variant;
  }
}

/**
 * Split a variant key into its component set and its properties, or `UnsupportedVariant` when
 * the key does not have the `<set>/<name>=<value>,…` shape or names a property twice.
 */
function parseVariantProperties(
  key: string
): Result.Result<
  { readonly set: string; readonly properties: ReadonlyMap<string, string> },
  UnsupportedVariant
> {
  const slash = key.indexOf("/");
  if (slash <= 0) {
    return Result.fail(new UnsupportedVariant(key, "the key has no component set before a slash"));
  }
  const properties = new Map<string, string>();
  for (const pair of key.slice(slash + 1).split(",")) {
    const equals = pair.indexOf("=");
    if (equals <= 0) {
      return Result.fail(new UnsupportedVariant(key, `the property ${pair} is not a name=value pair`));
    }
    const name = pair.slice(0, equals);
    if (properties.has(name)) {
      return Result.fail(new UnsupportedVariant(key, `the key names ${name} twice`));
    }
    properties.set(name, pair.slice(equals + 1));
  }
  return Result.succeed({ set: key.slice(0, slash), properties });
}

/**
 * A parsed variant key.
 *
 * @template Definition - The definition type the parser searched.
 */
export type ParsedCell<Definition> = {
  /** The definition whose key the variant key's set names. */
  readonly definition: Definition;
  /** A value for each of the definition's axes, each one the axis declares. */
  readonly cell: Cell;
};

/**
 * Parse a kit variant key into the definition it belongs to and the cell it names.
 *
 * @template Definition - The definition type, which needs at least a key and axes.
 * @param key - A variant key from the snapshot.
 * @param definitions - The definitions the harness renders, such as the kit registry's.
 * @returns The definition and the cell, or `UnsupportedVariant` for a set no definition has, an
 *   axis the definition lacks or misses, or a value its axis does not declare.
 */
export function parseCell<Definition extends Pick<ComponentDefinition, "key" | "axes" | "addedAxes">>(
  key: string,
  definitions: readonly Definition[]
): Result.Result<ParsedCell<Definition>, UnsupportedVariant> {
  return Result.gen(function* () {
    const { set, properties } = yield* parseVariantProperties(key);
    const definition = definitions.find((candidate) => candidate.key === set);
    if (definition === undefined) {
      return yield* Result.fail(new UnsupportedVariant(key, `the harness renders no component set ${set}`));
    }
    const known = new Set(definition.axes.map((axis) => axis.name));
    const extra = [...properties.keys()].filter((name) => !known.has(name));
    if (extra.length > 0) {
      return yield* Result.fail(
        new UnsupportedVariant(key, `the harness cannot render the axis ${extra.join(", ")}`)
      );
    }
    const cell: Record<string, string> = {};
    for (const axis of definition.axes) {
      // `variantKey` leaves an axis the set added later out of the key at its first value.
      const value =
        properties.get(axis.name) ??
        (definition.addedAxes?.has(axis.name) === true ? axis.values[0] : undefined);
      if (value === undefined) {
        return yield* Result.fail(new UnsupportedVariant(key, `the key has no ${axis.name}`));
      }
      if (!axis.values.includes(value)) {
        return yield* Result.fail(
          new UnsupportedVariant(key, `the harness cannot render ${axis.name}=${value}`)
        );
      }
      cell[axis.name] = value;
    }
    return { definition, cell };
  });
}

/** A pseudo class the page forces on a cell's measured element, or the part of it that takes its states. */
export type ForcedPseudoClass = "hover" | "focus" | "focus-visible";

/** The `state` values the page forces. Every other state is one the markup draws itself. */
const FORCED = new Map<string, readonly ForcedPseudoClass[]>([
  ["hover", ["hover"]],
  ["focus", ["focus", "focus-visible"]],
]);

/**
 * How a set's markup shows its highlighted row. Base UI focuses a highlighted Select or Menu item,
 * which Fuse styles with `focus:`, and marks a highlighted Combobox or Command item
 * `data-highlighted`, which Fuse styles with `data-highlighted:`.
 */
export type Highlight = "focus" | "data-highlighted";

/**
 * The pseudo classes the page forces for a cell: `:hover` for hover, and `:focus` with
 * `:focus-visible` for focus, as a pointer over the element or a keyboard user on it would. A
 * highlighted row takes `:focus` alone where its set highlights by focus, as Base UI moves focus
 * along a list without a keyboard focus ring.
 *
 * @param cell - A parsed cell.
 * @param highlight - How the cell's set shows a highlighted row, undefined for a set with none.
 * @returns The pseudo classes its `state` calls for, none for a state the markup itself draws
 *   or a cell with no `state` axis.
 */
export function forcedPseudoClasses(cell: Cell, highlight?: Highlight): readonly ForcedPseudoClass[] {
  if (cell.state === "highlighted") {
    return highlight === "focus" ? ["focus"] : [];
  }
  return FORCED.get(cell.state ?? "") ?? [];
}

/**
 * The attribute the page writes for a highlighted row whose set marks it, as Base UI marks the
 * highlighted Combobox or Command item.
 *
 * @param cell - A parsed cell.
 * @param highlight - How the cell's set shows a highlighted row, undefined for a set with none.
 * @returns `data-highlighted` for a highlighted cell of a set that marks it, and nothing otherwise.
 */
export function highlightAttributes(
  cell: Cell,
  highlight: Highlight | undefined
): Readonly<Record<string, string>> {
  return cell.state === "highlighted" && highlight === "data-highlighted" ? { "data-highlighted": "" } : {};
}

/** The real interaction the page tries for a cell whose forced state changed nothing. */
export type FallbackInteraction = "hover" | "focus" | "none";

/**
 * The real interaction the page tries when forcing a cell's state changed nothing: a hover for a
 * hover cell and a focus for a focus cell. A highlighted row gets none, since a real focus on a
 * menu item adds the keyboard focus ring its highlight does not show, and a real hover highlights
 * only once a page hydrates its list.
 *
 * @param cell - A parsed cell.
 * @returns The interaction, or `none` for a cell whose state no real hover or focus alone draws.
 */
export function fallbackInteraction(cell: Cell): FallbackInteraction {
  return cell.state === "hover" || cell.state === "focus" ? cell.state : "none";
}

/**
 * The same cell at rest: the reference the page compares a forced cell's styles against, to
 * tell whether forcing the pseudo class reached Fuse's `enabled-hover:` and `focus-visible:`
 * rules.
 *
 * @param cell - A parsed cell.
 * @returns The cell with its state set to rest.
 */
export function restingTwin(cell: Cell): Cell {
  return { ...cell, state: "rest" };
}
