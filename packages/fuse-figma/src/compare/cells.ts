/**
 * The cells `figma:compare` knows how to render: a kit variant key parsed into the definition
 * it belongs to and a value for each of its axes. A key such as
 * `button/variant=ghost,size=sm,state=hover,icon=end` names the component set, then each
 * variant property. `variantKey` in `component-spec.ts` writes these keys, and this module reads
 * them back against the kit's definitions. The parser accepts only the axes and values a
 * definition declares, so a new axis in a snapshot shows up as an unsupported cell, not as a
 * cell rendered without it.
 *
 * Every definition names its interactive axis `state`, with `rest` among its values. The page
 * forces the pointer and keyboard states from that axis and compares them with the cell at rest.
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
export function parseCell<Definition extends Pick<ComponentDefinition, "key" | "axes">>(
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
      const value = properties.get(axis.name);
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

/** A pseudo class the page forces on a cell's measured element. */
export type ForcedPseudoClass = "hover" | "focus" | "focus-visible";

/** The `state` values the page forces. Every other state is one the markup draws itself. */
const FORCED = new Map<string, readonly ForcedPseudoClass[]>([
  ["hover", ["hover"]],
  ["focus", ["focus", "focus-visible"]],
]);

/**
 * The pseudo classes the page forces for a cell: `:hover` for hover, and `:focus` with
 * `:focus-visible` for focus, as a pointer over the element or a keyboard user on it would.
 *
 * @param cell - A parsed cell.
 * @returns The pseudo classes its `state` calls for, none for a state the markup itself draws
 *   or a cell with no `state` axis.
 */
export function forcedPseudoClasses(cell: Cell): readonly ForcedPseudoClass[] {
  return FORCED.get(cell.state ?? "") ?? [];
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
