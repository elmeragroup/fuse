/**
 * The coverage ledger the capture build answers to, `oracles/coverage.json`: the rows the kit keeps
 * on purpose where its checks would otherwise fail. It names each `unmapped` row the kit accepts,
 * each row that reads a synced variable and stays unbound, each `unshown` row, a class whose state
 * no cell of a set's matrix shows, each captured declaration that reaches no row at all, and each
 * pair of an axis's values whose built variants no slice of the other axes tells apart. The oracle
 * test fails on a row, declaration or pair the ledger does not name, and on an entry that names
 * none, which a fixed row leaves behind.
 */

import { Result, Schema } from "effect";
import { isDeepStrictEqual } from "node:util";

import ledger from "../../oracles/coverage.json" with { type: "json" };
import type {
  ChildLayerSpec,
  ComponentRootSpec,
  FrameLayerSpec,
  InstanceLayerSpec,
} from "../components/kit-spec.ts";
import type { CellAccounting, InstancePlace } from "./capture-cascade.ts";
import type { CapturedCell, CapturedDeclaration, CapturedElement, SetCapture } from "./capture-format.ts";
import { placesOf } from "./capture-places.ts";
import { boxIdentity, keptDeclarations, rendersNothing, twinClaims } from "./instance-twin.ts";
import type { KeptDeclaration } from "./instance-twin.ts";

/** A row the ledger names, by its set, part, class and property, with why the kit keeps it. */
const KeptRowSchema = Schema.Struct({
  set: Schema.String,
  part: Schema.String,
  className: Schema.String,
  property: Schema.String,
  reason: Schema.String,
});

/** A row the ledger names. */
export type KeptRow = typeof KeptRowSchema.Type;

/** A pair of one axis's values the ledger keeps, in the axis's order, with why. */
const AxisPairSchema = Schema.Struct({
  set: Schema.String,
  axis: Schema.String,
  values: Schema.Tuple([Schema.String, Schema.String]),
  reason: Schema.String,
});

/** An `unshown` row, by its part and class, as a set's coverage lists it with an empty property. */
const UnshownSchema = Schema.Struct({ part: Schema.String, className: Schema.String });

const CoverageLedgerSchema = Schema.Struct({
  unmapped: Schema.Array(KeptRowSchema),
  unbound: Schema.Array(KeptRowSchema),
  /** Each set's `unshown` rows, by the set's key. */
  unshown: Schema.Record(Schema.String, Schema.Array(UnshownSchema)),
  /**
   * The declarations the capture records that no row accounts for, as {@link unaccountedDeclarations}
   * finds them, in groups that share a part, a reason and their places: each group lists its
   * declarations by class and the property the rule writes, and `at` every cell and element they
   * cover, as `button/state=rest 0/root/0`, or `0/root/0::before` for the element's pseudo-element,
   * so an exception for one state or one box excuses no other. {@link unreachedRows} expands them.
   */
  unreached: Schema.Array(
    Schema.Union([
      Schema.Struct({
        set: Schema.String,
        part: Schema.String,
        declarations: Schema.NonEmptyArray(
          Schema.Struct({ className: Schema.String, property: Schema.String })
        ),
        reason: Schema.String,
        at: Schema.Array(Schema.String),
      }),
      // A single declaration, the shape entries took before groups: branches written against it
      // keep reading after a rebase, and a later edit may group them.
      Schema.Struct({
        set: Schema.String,
        part: Schema.String,
        className: Schema.String,
        property: Schema.String,
        reason: Schema.String,
        at: Schema.Array(Schema.String),
      }),
    ])
  ),
  /**
   * Each pair of an axis's values that {@link alikeValues} finds built alike, its values in the
   * axis's order, with why the kit keeps both.
   */
  alike: Schema.Array(AxisPairSchema),
  /**
   * Each pair of an axis's values that {@link alikeValues} finds on no slice together, with why the
   * matrix never holds both beside the same values of the other axes.
   */
  apart: Schema.Array(AxisPairSchema),
});

/** The coverage ledger. */
export type CoverageLedger = typeof CoverageLedgerSchema.Type;

/** `oracles/coverage.json` does not parse as the ledger. */
export class LedgerUnreadable extends Error {
  readonly _tag = "LedgerUnreadable" as const;
}

/**
 * Parse a coverage ledger.
 *
 * @param value - The ledger's JSON value.
 * @returns The ledger, or `LedgerUnreadable`.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- JSON boundary: the ledger's parsed value has no type yet, which the schema parses here
export function decodeLedger(value: unknown): Result.Result<CoverageLedger, LedgerUnreadable> {
  return Result.mapError(
    Schema.decodeUnknownResult(CoverageLedgerSchema)(value),
    (error) => new LedgerUnreadable(error.message)
  );
}

/**
 * The kept `oracles/coverage.json`.
 *
 * @returns The ledger, or `LedgerUnreadable` for a file the schema rejects.
 */
export function keptLedger(): Result.Result<CoverageLedger, LedgerUnreadable> {
  return decodeLedger(ledger);
}

/** A declaration the ledger keeps unreached, by its set, part, class and property, at every place it covers. */
export type UnreachedRow = KeptRow & { readonly at: readonly string[] };

/**
 * The ledger's `unreached` entries, one row for each declaration a group lists and one for each
 * single-declaration entry.
 *
 * @param kept - The ledger.
 * @returns The rows, each with its group's part, reason and places.
 */
export function unreachedRows(kept: CoverageLedger): readonly UnreachedRow[] {
  return kept.unreached.flatMap((entry) =>
    "declarations" in entry
      ? entry.declarations.map(({ className, property }) => ({
          set: entry.set,
          part: entry.part,
          reason: entry.reason,
          at: entry.at,
          className,
          property,
        }))
      : [entry]
  );
}

/**
 * The custom properties a row's value reads that are synced variables, by name, as
 * `var(--surface-pad-sm)` reads `--surface-pad-sm`.
 *
 * @param value - The row's value.
 * @param synced - The synced variables' custom properties.
 * @returns The names, in the order the value reads them.
 */
export function syncedReads(value: string, synced: ReadonlySet<string>): readonly string[] {
  return [...value.matchAll(/var\(\s*(--[\w-]+)/g)].flatMap(([, name]) =>
    name !== undefined && synced.has(name) ? [name] : []
  );
}

/** A captured declaration that no build accounts for. */
export type Unreached = {
  /** The element's `data-slot`, or its tag where it carries none. */
  readonly part: string;
  /**
   * The cell and the element's place in it, as `button/state=rest 0/root/0`, with the pseudo-element
   * the declaration styles, as `0/root/0::before`.
   */
  readonly at: string;
  readonly className: string;
  readonly property: string;
  readonly value: string;
};

/** A set's kept capture and what its build accounted for in each cell. */
export type AccountedSet = {
  readonly capture: SetCapture;
  readonly accounting: ReadonlyMap<string, Pick<CellAccounting, "accounted" | "instances">>;
};

/**
 * The declarations the check covers on an element that renders something, box by box: those the
 * set's own build keeps there, as {@link keptDeclarations} lists them, but none from the browser's own
 * style sheet, which is no author's.
 */
function checkedDeclarations(
  element: CapturedElement,
  declarations: readonly CapturedDeclaration[]
): readonly KeptDeclaration[] {
  return keptDeclarations(element, declarations).filter(
    ({ declaration }) => declaration.source !== "user-agent"
  );
}

/** The element at a place in a cell, as `0/root/1/0` names it, or undefined. */
function elementAt(cell: CapturedCell, place: string): CapturedElement | undefined {
  const [root, kind, ...steps] = place.split("/");
  const start = cell.roots[Number(root)];
  if (start === undefined || kind !== "root") {
    return undefined;
  }
  return steps.reduce<CapturedElement | undefined>(
    (element, step) => element?.children[Number(step)],
    start.root
  );
}

/**
 * The place of the element whose class a declaration's rule selects through, `owner` steps above the
 * element at `place`, as `0/root/0` for a declaration two steps below it at `0/root/0/0/1`.
 */
function supplierOf(place: string, owner: number): string {
  const steps = place.split("/");
  return steps.slice(0, Math.max(2, steps.length - owner)).join("/");
}

/** Whether the element at `place` is the one at `root` or below it. */
function holds(root: string, place: string): boolean {
  return place === root || place.startsWith(`${root}/`);
}

/**
 * What the inner set an instance part shows claims at each element at or below the part's inner root
 * in a composite's cell, as {@link twinClaims} finds it for the capture build, so check 8 lets an
 * inner set account for exactly the declarations the build gives its rows.
 */
function instanceClaims(
  cell: CapturedCell,
  composite: readonly CapturedDeclaration[],
  instance: InstancePlace,
  setOf: (key: string) => AccountedSet | undefined
): ReadonlyMap<CapturedElement, ReadonlySet<string>> {
  const inner = setOf(instance.set)?.capture;
  const root = elementAt(cell, instance.place);
  const own = inner?.cells.find(({ key }) => key === instance.cell)?.roots[0]?.root;
  return inner === undefined || root === undefined || own === undefined
    ? new Map()
    : twinClaims(root, own, { inner: inner.declarations, composite });
}

/**
 * The author declarations a set's capture records that the set's build puts into no layer and no
 * inner set owns, which no coverage row then accounts for. Each captured element is checked by its
 * own identity, its cell and place, so a class another element carries does not stand in for it.
 * A declaration at or below an instance part's inner root that the inner set claims there, as the
 * capture build reads the claim, is that set's, which its own check accounts for, where the instance
 * part's markup holds the element whose class supplied the declaration. One no such inner set claims
 * is the composite's. The browser's
 * own style sheet is no author's and is left out, and so is a reset to the initial value. An element
 * that renders nothing visible, and every element below it, is left out too, and so is a
 * pseudo-element whose `display` is `none`: no frame can show what it styles.
 *
 * @param key - The set's key.
 * @param setOf - Each built set's capture and accounting, by key.
 * @returns Each unaccounted declaration once per cell, element and declaration, a pseudo-element's
 *   at its element's place and the pseudo-element's name, as `0/root/1::before`.
 */
export function unaccountedDeclarations(
  key: string,
  setOf: (key: string) => AccountedSet | undefined
): readonly Unreached[] {
  const set = setOf(key);
  if (set === undefined) {
    return [];
  }
  const { capture } = set;
  const found = new Map<string, Unreached>();
  for (const cell of capture.cells) {
    const accounting = set.accounting.get(cell.key);
    const claims = (accounting?.instances ?? []).map((instance) => ({
      root: instance.place,
      claimed: instanceClaims(cell, capture.declarations, instance, setOf),
    }));
    const places = placesOf(cell);
    const visit = (element: CapturedElement, below: boolean): void => {
      if (rendersNothing(element, capture.declarations)) {
        return;
      }
      const place = places.get(element) ?? "";
      // A pseudo-element's declarations are its own box's, so its place names it.
      for (const { box, index, declaration } of checkedDeclarations(element, capture.declarations)) {
        if (
          accounting?.accounted.has(`${place}#${String(index)}`) === true ||
          // Only an instance part whose markup holds the element that supplied the class claims it,
          // the parts the build's ownership walk visits. A set an outer instance shows can pass the
          // declaration to the instance inside it, as Input group passes its button's classes.
          claims.some(
            ({ root, claimed }) =>
              holds(root, supplierOf(place, declaration.owner)) &&
              claimed.get(element)?.has(boxIdentity(box, declaration)) === true
          )
        ) {
          continue;
        }
        const part = element.attributes["data-slot"] ?? element.tag;
        const at = `${cell.key} ${place}${box}`;
        found.set(`${cell.key} ${place}#${String(index)}`, {
          part,
          at,
          className: declaration.className,
          property: declaration.property,
          value: declaration.value,
        });
      }
      if (below) {
        element.children.forEach((child) => {
          visit(child, true);
        });
      }
    };
    for (const { around, root } of cell.roots) {
      // The elements around a root hold it, so only their own declarations count.
      around.forEach((element) => {
        visit(element, false);
      });
      visit(root, true);
    }
  }
  return [...found.values()];
}

/** A built layer whose instances hold what their variant draws in place of the variant's key. */
export type DrawnLayer =
  | Exclude<ChildLayerSpec, FrameLayerSpec | InstanceLayerSpec>
  | (Omit<FrameLayerSpec, "children"> & { readonly children: readonly DrawnLayer[] })
  | (Omit<InstanceLayerSpec, "variant"> & { readonly draws: DrawnRoot });

/** A built root whose instances hold what their variant draws, as `drawnRoot` gives it. */
export type DrawnRoot = Omit<ComponentRootSpec, "children"> & { readonly children: readonly DrawnLayer[] };

/**
 * A built root with each instance's variant key replaced by what that variant draws, so two roots
 * whose instances show different variants that draw the same compare equal. The instance keeps its
 * properties and overrides, which draw on top of the variant.
 *
 * @param root - The built root.
 * @param rootOf - The root of each variant the kit builds, by key.
 * @returns The root, each instance holding its variant's drawing in place of the variant's key.
 * @throws When an instance shows a variant the kit does not build.
 */
export function drawnRoot(
  root: ComponentRootSpec,
  rootOf: ReadonlyMap<string, ComponentRootSpec>
): DrawnRoot {
  const drawn = (layer: ChildLayerSpec): DrawnLayer => {
    if (layer.kind === "instance") {
      const inner = rootOf.get(layer.variant);
      if (inner === undefined) {
        throw new Error(`the kit builds no variant ${layer.variant}`);
      }
      const { variant: _variant, ...instance } = layer;
      return { ...instance, draws: drawnRoot(inner, rootOf) };
    }
    return layer.kind === "frame" ? { ...layer, children: layer.children.map(drawn) } : layer;
  };
  return { ...root, children: root.children.map(drawn) };
}

/**
 * A pair of one axis's values, in the axis's order, that no slice of the other axes tells apart:
 * `Alike` where every slice that holds both builds the same root at each, `Apart` where no slice
 * holds both.
 */
export type AxisPair = {
  readonly _tag: "Alike" | "Apart";
  readonly axis: string;
  readonly values: readonly [string, string];
};

/**
 * Each pair of an axis's values whose built variants no slice of the other axes tells apart. A
 * slice is one set of values of the other axes. The pair is `Alike` where every slice that holds a
 * variant at each value builds the same root at both, as a value the renderer never reads builds as
 * another value of its axis, and `Apart` where no slice holds both, which `impossible` cells can
 * leave, so nothing shows how the two differ.
 *
 * @param set - The built set: its axes, each with its values in order, and its variants, each by
 *   its axis values and its root.
 * @returns Each such pair, by axis and in the axis's order.
 */
export function alikeValues(set: {
  readonly axes: readonly { readonly name: string; readonly values: readonly string[] }[];
  readonly variants: readonly {
    readonly properties: Readonly<Record<string, string>>;
    readonly root: object;
  }[];
}): readonly AxisPair[] {
  return set.axes.flatMap(({ name, values }) => {
    // The roots by the slice of the other axes they sit on, then by this axis's value.
    const others = set.axes.filter((axis) => axis.name !== name);
    const slices = new Map<string, Map<string, object>>();
    for (const { properties, root } of set.variants) {
      const value = properties[name];
      if (value !== undefined) {
        const slice = JSON.stringify(others.map((axis) => properties[axis.name] ?? null));
        slices.set(slice, (slices.get(slice) ?? new Map<string, object>()).set(value, root));
      }
    }
    return values.flatMap((first, at) =>
      values.slice(at + 1).flatMap((second): readonly AxisPair[] => {
        // `isDeepStrictEqual` reads each object's fields in any order and each array in its order,
        // so the order the build writes a layer's fields in cannot tell two roots apart, and the
        // order of its layers can.
        const shared = [...slices.values()].flatMap((byValue) => {
          const one = byValue.get(first);
          const other = byValue.get(second);
          return one === undefined || other === undefined ? [] : [isDeepStrictEqual(one, other)];
        });
        if (shared.length === 0) {
          return [{ _tag: "Apart", axis: name, values: [first, second] }];
        }
        return shared.every(Boolean) ? [{ _tag: "Alike", axis: name, values: [first, second] }] : [];
      })
    );
  });
}
