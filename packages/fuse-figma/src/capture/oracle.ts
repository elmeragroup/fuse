/**
 * The coverage ledger the capture build answers to, `oracles/coverage.json`: the rows the kit keeps
 * on purpose where its checks would otherwise fail. It names each `unmapped` row the kit accepts,
 * each row that reads a synced variable and stays unbound, each `unshown` row, a class whose state
 * no cell of a set's matrix shows, and each captured declaration that reaches no row at all. The
 * oracle test fails on a row or declaration the ledger does not name, and on an entry that names
 * none, which a fixed row leaves behind.
 */

import { Result, Schema } from "effect";

import ledger from "../../oracles/coverage.json" with { type: "json" };
import { isReset, placesOf } from "./capture-cascade.ts";
import type { CellAccounting, InstancePlace } from "./capture-cascade.ts";
import type { CapturedCell, CapturedDeclaration, CapturedElement, SetCapture } from "./capture-format.ts";

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

/** An `unshown` row, by its part and class, as a set's coverage lists it with an empty property. */
const UnshownSchema = Schema.Struct({ part: Schema.String, className: Schema.String });

const CoverageLedgerSchema = Schema.Struct({
  unmapped: Schema.Array(KeptRowSchema),
  unbound: Schema.Array(KeptRowSchema),
  /** Each set's `unshown` rows, by the set's key. */
  unshown: Schema.Record(Schema.String, Schema.Array(UnshownSchema)),
  /**
   * Each declaration the capture records that no row accounts for, as {@link unaccountedDeclarations}
   * finds it, with why the kit keeps it so: its property is the one the rule writes, and `at` lists
   * every cell and element it covers, as `button/state=rest 0/root/0`, or `0/root/0::before` for the
   * element's pseudo-element, so an exception for one state or one box excuses no other.
   */
  unreached: Schema.Array(Schema.Struct({ ...KeptRowSchema.fields, at: Schema.Array(Schema.String) })),
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
  readonly accounting: ReadonlyMap<string, CellAccounting>;
};

/**
 * Whether an element's own winning declarations keep it and everything below it from rendering
 * anything visible: `display: none`, which generates no box for it or its descendants (CSS Display 3
 * §2.5), or a `clip-path: inset()` whose opposite insets meet on an element that generates a box,
 * which clips the box and its descendants to no area (CSS Masking 1 §6.1), as `sr-only` and Base UI's
 * visually hidden inputs clip theirs with `inset(50%)`. A `display: contents` element generates no
 * box, so its clip clips nothing and its children paint.
 */
function rendersNothing(element: CapturedElement, declarations: readonly CapturedDeclaration[]): boolean {
  const won = (longhand: string): string | undefined =>
    element.declarations
      .map((index) => declarations[index])
      .findLast((declaration) => declaration?.longhands.includes(longhand) === true)?.value;
  const display = won("display")?.trim();
  if (display === "none") {
    return true;
  }
  const inset = /^inset\(([^)]*)\)$/.exec(won("clip-path")?.trim() ?? "");
  if (display === "contents" || inset === null) {
    return false;
  }
  const percents = (inset[1] ?? "")
    .trim()
    .split(/\s+/)
    .map((each) => (each === "0" ? "0" : /^(-?[\d.]+)%$/.exec(each)?.[1]));
  if (percents.some((each) => each === undefined)) {
    return false;
  }
  const [top = 0, right = top, bottom = top, left = right] = percents.map(Number);
  return top + bottom >= 100 || left + right >= 100;
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
 * The child of an inner element that stands for a composite's child: the one with the same
 * `data-slot`, or the same tag where the child carries none, at the same ordinal among the siblings
 * that match, since a composite can leave out a part the inner sample shows before it, as a menu row
 * without an icon holds its shortcut first.
 */
function matchingChild(
  composite: CapturedElement,
  child: CapturedElement,
  inner: CapturedElement
): CapturedElement | undefined {
  const slot = child.attributes["data-slot"];
  const like = (each: CapturedElement): boolean =>
    slot === undefined
      ? each.attributes["data-slot"] === undefined && each.tag === child.tag
      : each.attributes["data-slot"] === slot;
  const ordinal = composite.children.filter(like).indexOf(child);
  return inner.children.filter(like)[ordinal];
}

/**
 * Whether the inner set an instance part shows owns a declaration of the composite's capture: its
 * own capture holds the same declaration, by class, property, value and source, at the element of
 * the inner cell that stands for the composite's, step by step below the inner root, as
 * {@link matchingChild} pairs them, and the inner set's own walk checks it there: no element on the
 * way renders nothing, and the inner declaration is neither the browser's own nor a reset. The inner
 * declaration styles the same box: the element's own for the element's, the same pseudo-element's
 * for a pseudo-element's. That set accounts for it in its own capture; anything else stays the
 * composite's to account for.
 */
function ownedByInner(
  declaration: CapturedDeclaration,
  cell: CapturedCell,
  place: string,
  box: string,
  instance: InstancePlace,
  setOf: (key: string) => AccountedSet | undefined
): boolean {
  const inner = setOf(instance.set)?.capture;
  if (inner === undefined) {
    return false;
  }
  // The inner set's walk skips an element that renders nothing, and everything below it, so it
  // checks nothing there that could stand for a visible element of the composite's.
  const shown = (each: CapturedElement | undefined): each is CapturedElement =>
    each !== undefined && !rendersNothing(each, inner.declarations);
  let composite = elementAt(cell, instance.place);
  let target = inner.cells.find(({ key }) => key === instance.cell)?.roots[0]?.root;
  if (!shown(target)) {
    return false;
  }
  for (const step of place
    .slice(instance.place.length)
    .split("/")
    .filter((each) => each !== "")) {
    const child = composite?.children[Number(step)];
    const next: CapturedElement | undefined =
      composite === undefined || child === undefined ? undefined : matchingChild(composite, child, target);
    if (!shown(next)) {
      return false;
    }
    composite = child;
    target = next;
  }
  const boxed = box === "" ? target.declarations : (target.pseudo[box.slice(2)] ?? []);
  return boxed.some((index) => {
    const own = inner.declarations[index];
    return (
      own !== undefined &&
      own.source !== "user-agent" &&
      !isReset(own, index, target.initial) &&
      own.className === declaration.className &&
      own.property === declaration.property &&
      own.value === declaration.value &&
      own.source === declaration.source
    );
  });
}

/**
 * The author declarations a set's capture records that the set's build puts into no layer and no
 * inner set owns, which no coverage row then accounts for. Each captured element is checked by its
 * own identity, its cell and place, so a class another element carries does not stand in for it.
 * A declaration below an instance part's inner root that the inner set's own capture holds at the
 * same place is that set's, which its own check accounts for, whichever of the instances around the
 * element shows it; one no inner set holds there is the composite's, which passes it. The browser's own style sheet is no author's and is left out, and so is a reset to
 * the initial value. An element that renders nothing visible, and every element below it, is left
 * out too: no frame can show what it styles.
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
    const instances = (accounting?.instances ?? []).toSorted((a, b) => b.place.length - a.place.length);
    const places = placesOf(cell);
    const visit = (element: CapturedElement, below: boolean): void => {
      if (rendersNothing(element, capture.declarations)) {
        return;
      }
      const place = places.get(element) ?? "";
      // Each instance part around the element, innermost first: a set an outer instance shows can
      // pass the declaration to the instance inside it, as Input group passes its button's classes.
      const holders = instances.filter((each) => place === each.place || place.startsWith(`${each.place}/`));
      // A pseudo-element's declarations are its own box's, so its place names it.
      const boxes = [
        ["", element.declarations] as const,
        ...Object.entries(element.pseudo).map(([pseudo, indexes]) => [`::${pseudo}`, indexes] as const),
      ];
      for (const [box, index] of boxes.flatMap(([box, indexes]) =>
        indexes.map((each) => [box, each] as const)
      )) {
        const declaration = capture.declarations[index];
        if (
          declaration === undefined ||
          declaration.source === "user-agent" ||
          isReset(declaration, index, element.initial) ||
          accounting?.accounted.has(`${place}#${String(index)}`) === true ||
          holders.some((holder) => ownedByInner(declaration, cell, place, box, holder, setOf))
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
