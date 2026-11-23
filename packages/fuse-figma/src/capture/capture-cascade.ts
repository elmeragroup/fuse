/**
 * The cascade of a component set read from its capture, as the mapping reads it through
 * `BoxCascade`. Chromium matched the rules and the capture resolved each element's winning
 * declarations, so each layer applies its element's winners in cascade order over what its
 * parent passes down. `layer-style.ts` owns the rest: the cell's ledger of layers, their computed
 * styles, the reads through `LayerStyle`, and the coverage rows of what no layer read.
 *
 * This module starts each cell's cascade, says where each cell's instance parts hold their inner
 * roots, and records each class of the set's own markup that styled nothing in any cell. It also
 * reads two facts of a whole capture: whether some cell's root casts a shadow or clips, and which
 * parts scale. `capture-cell-cascade.ts` cascades a cell's root over the elements around it, and
 * `capture-box-cascade.ts` each box below it. `cell-read.ts` holds what every box of a cell reads
 * and the declarations each element applies. `part-elements.ts` finds the elements of a box's
 * parts, `pseudo-cascade.ts` cascades its pseudo-elements, and `measured-box.ts` reads what the
 * capture measured of it. `anchored-placement.ts` holds the anchored placement rule, and
 * `root-backdrop.ts` the background a root shows from the elements around it.
 */

import { KitUnmappable } from "../components/build-errors.ts";
import { variantKey } from "../components/component-spec.ts";
import type {
  BuildContext,
  Cell,
  ComponentDefinition,
  InstanceDefinition,
  PartDefinition,
} from "../components/component-spec.ts";
import type { Origin } from "../components/coverage-log.ts";
import { CellLedger } from "../components/layer-style.ts";
import type { CellScope, Recorder } from "../components/layer-style.ts";
import type { AnchorWidth } from "./anchored-placement.ts";
import { CaptureCellCascade } from "./capture-cell-cascade.ts";
import type { OpenPlacement } from "./capture-cell-cascade.ts";
import type { CapturedCell, CapturedElement, SetCapture } from "./capture-format.ts";
import { placesOf } from "./capture-places.ts";
import type { InstancePlace } from "./cell-accounting.ts";
import { undrawnName } from "./cell-read.ts";
import type { CellRead } from "./cell-read.ts";
import { rendersNothing } from "./instance-twin.ts";
import { elementsAtPlace, elementsWithSlot } from "./part-elements.ts";

/** The properties whose winning value can keep an element from rendering, as `rendersNothing` reads them. */
const HIDING = new Set(["display", "clip-path"]);

/**
 * A recorder that leaves out a `bound` or `literal` row whose declarations all sit at or below an
 * element of the set's capture that renders nothing. Check 8 skips such an element and everything
 * below it, so a set that instances this one lists those declarations where its own cell shows the
 * element, and this set's row would list them a second time. A row of `display` or `clip-path`, which
 * hide the element, stays, and so does a `dropped` or `unmapped` row: a pending Button's rows say
 * why it leaves out its hidden icon.
 */
function drawnShown(capture: SetCapture, record: Recorder): Recorder {
  const hidden = new Map(
    capture.cells.map((cell) => {
      const places = placesOf(cell);
      const found = new Set<string>();
      const below = (element: CapturedElement, inside: boolean): void => {
        const unseen = inside || rendersNothing(element, capture.declarations);
        if (unseen) {
          found.add(places.get(element) ?? "");
        }
        element.children.forEach((child) => {
          below(child, unseen);
        });
      };
      for (const { around, root } of cell.roots) {
        around.forEach((element) => {
          below(element, false);
        });
        below(root, false);
      }
      return [cell.key, found] as const;
    })
  );
  return (row) => {
    const at = row.at ?? [];
    const unseen =
      (row.outcome === "bound" || row.outcome === "literal") &&
      !HIDING.has(row.property) &&
      at.length > 0 &&
      at.every(({ cell, declaration }) => hidden.get(cell)?.has(declaration.split("#")[0] ?? "") === true);
    if (!unseen) {
      record(row);
    }
  };
}

/**
 * What a set's capture-backed cascade reads beside its capture. A component set names the hooks its
 * cells need. A capture whose cells measure one plain root each, as the text style samples', leaves
 * them out: it records no coverage, holds no instance or anchor, and places nothing.
 */
export type CaptureSetSource = {
  readonly capture: SetCapture;
  /** The key and axes whose variant keys name the cells. */
  readonly definition: Pick<ComponentDefinition, "key" | "axes" | "addedAxes">;
  /** The synced variables and the compiled theme values the reads substitute. */
  readonly context: BuildContext;
  /** Adds a row to the set's coverage table. By default the cascade records no rows. */
  readonly record?: Recorder;
  /** The kept capture of another set, which an instance part's inner set reads. By default none. */
  readonly captureOf?: (key: string) => SetCapture | undefined;
  /** How the set places its cells' elements, undefined for a set whose cells measure one root. */
  readonly open?: OpenPlacement | undefined;
  /** The width that stands for `--anchor-width` in a cell, as {@link AnchorWidth} says. By default `unresolved`. */
  readonly anchorWidth?: (cell: Cell) => AnchorWidth;
  /**
   * The root `data-slot` of each set whose manifest holds this set as an instance part, as
   * {@link instancingSlots} reads them, such as Select popup's `select-content` around Select item.
   * By default none.
   */
  readonly instancedIn?: ReadonlySet<string>;
};

/** A source with every hook its cascade reads, the defaults filled in. */
type FullSource = Required<Omit<CaptureSetSource, "open">> & Pick<CaptureSetSource, "open">;

/** A source with the hooks it leaves out set to their defaults. */
function withDefaults(source: CaptureSetSource): FullSource {
  return {
    record: () => undefined,
    captureOf: () => undefined,
    anchorWidth: () => ({ _tag: "unresolved" }),
    instancedIn: new Set(),
    ...source,
  };
}

/** An element's own winning declarations, then its pseudo-elements'. */
function declarationsOf(element: CapturedElement): readonly number[] {
  return [...element.declarations, ...Object.values(element.pseudo).flat()];
}

/**
 * The variants and utilities of a transition's frames, which style an element only while it enters
 * or leaves, or move it, and which a still frame of the kit never shows. A class that matched no
 * captured element drops when one of these explains it, and is unshown otherwise. Each entry is
 * a variant or utility the class carries, then why the kit draws none of it.
 */
const TRANSIENT_VARIANTS: readonly (readonly [RegExp, string])[] = [
  [
    /(^|:)data-(starting|ending)-style:/,
    "Base UI sets `data-starting-style` and `data-ending-style` only while the element enters or leaves",
  ],
  [/(^|:)starting:/, "`@starting-style` styles the element only for the frame it first renders"],
  [/(^|:)motion-(safe|reduce):/, "the variant styles the element's motion, which a still frame never shows"],
  [
    /(^|:)(animate|transition|duration|ease|delay|fade|zoom|spin|slide)(-|$)/,
    "a motion utility, which a still frame never shows",
  ],
];

/** Why a class that matched no captured element is a transition's frame, or undefined. */
function transientVariant(className: string): string | undefined {
  return [...TRANSIENT_VARIANTS, ...UNDRAWN_CHROME].find(([pattern]) => pattern.test(className))?.[1];
}

/**
 * Classes that style the browser's own chrome, which no Figma frame draws, so a rule of theirs that
 * matched no captured element drops rather than stands for a state: Base UI's
 * `base-ui-disable-scrollbar` and Tailwind's `no-scrollbar` hide a scrolling list's scrollbar, which
 * the page renders through `::-webkit-scrollbar` only while the list overflows.
 */
const UNDRAWN_CHROME: readonly (readonly [RegExp, string])[] = [
  [
    /(^|[:-])(no-scrollbar|disable-scrollbar)$/,
    "the class hides a scrolling list's scrollbar, which a static frame does not draw",
  ],
];

/** The cascade of every cell of a set, read from its capture. */
export class CaptureSetCascade {
  readonly #source: FullSource;
  readonly #context: BuildContext;
  readonly #origin: Origin;
  /** The cells the build mapped, with the elements their mapping drew and the inner roots. */
  readonly #cells: { readonly cell: CapturedCell; readonly read: CellRead }[] = [];

  /** @param source - The set's capture and what its cascade reads beside it. */
  constructor(source: CaptureSetSource) {
    this.#source = withDefaults(source);
    this.#context = source.context;
    this.#origin = { record: drawnShown(source.capture, this.#source.record) };
  }

  /**
   * Start the cascade of one cell.
   *
   * @param cell - The cell.
   * @returns The cell's cascade.
   * @throws `KitUnmappable` where the capture lacks the cell, which a run of `figma:capture` adds.
   */
  cell(cell: Cell): CaptureCellCascade {
    const { capture, definition } = this.#source;
    const key = variantKey(definition, cell);
    const captured = capture.cells.find((each) => each.key === key);
    if (captured === undefined) {
      throw new KitUnmappable({
        message: `captures/${capture.set}.json has no cell ${key}; run figma:capture`,
      });
    }
    const scope: CellScope = {
      cell,
      context: this.#context,
      origin: this.#origin,
      record: this.#origin.record,
      inPlace: undefined,
    };
    const read: CellRead = {
      declarations: [...capture.declarations],
      declarationCount: capture.declarations.length,
      context: this.#context,
      captureOf: this.#source.captureOf,
      drawn: new Map(),
      inner: new Map(),
      innerOwn: new Map(),
      claims: new Map(),
      replaced: new Map(),
      rootOf: new Map(
        captured.roots.flatMap(({ around, root }) => around.map((each) => [each, root] as const))
      ),
      anchorWidth: this.#source.anchorWidth(cell),
      instancedIn: this.#source.instancedIn,
      places: placesOf(captured),
      cell: captured.key,
      instances: [],
    };
    this.#cells.push({ cell: captured, read });
    return new CaptureCellCascade(read, new CellLedger(scope), capture.page, captured, this.#source.open);
  }

  /**
   * Where each cell's instance parts hold their inner roots, by the cell's key.
   *
   * @returns Each cascaded cell's instance places, as `CellAccounting` in `cell-accounting.ts` names them.
   */
  instancePlaces(): ReadonlyMap<string, readonly InstancePlace[]> {
    return new Map(this.#cells.map(({ cell, read }) => [cell.key, read.instances]));
  }

  /**
   * Record each class of the set's own markup that styled nothing in any cell, as dropped: a class whose variant no cell shows, such as
   * a label's `has-[>[data-slot=field]]:` arm, or a marker class such as `group/field`. The classes
   * of an instance part's inner root and the elements below it are the inner set's.
   */
  finish(): void {
    const carried = new Map<string, Set<string>>();
    const used = new Set<string>();
    // A class some rule styles, and whether a rule written for it matched in some cell.
    const styled = new Set<string>();
    const matched = new Set<string>();
    for (const { cell, read } of this.#cells) {
      const nameOf = (element: CapturedElement) => read.drawn.get(element) ?? undrawnName(element);
      const visit = (element: CapturedElement, path: readonly CapturedElement[]): void => {
        const passed = read.inner.get(element);
        const name = nameOf(element);
        const classes = carried.get(name) ?? new Set();
        const unmatched = new Set(element.unmatched);
        for (const className of element.classes.filter((each) => passed?.has(each) ?? true)) {
          classes.add(className);
          const key = JSON.stringify([name, className]);
          (unmatched.has(className) ? styled : matched).add(key);
        }
        carried.set(name, classes);
        const here = [...path, element];
        for (const index of declarationsOf(element)) {
          const declaration = this.#source.capture.declarations[index];
          const owner = declaration === undefined ? undefined : here[here.length - 1 - declaration.owner];
          if (declaration !== undefined && owner !== undefined) {
            used.add(JSON.stringify([nameOf(owner), declaration.className]));
          }
        }
        if (passed !== undefined) {
          return;
        }
        for (const child of element.children) {
          visit(child, here);
        }
      };
      const visited = new Set<CapturedElement>();
      for (const { around, root } of cell.roots) {
        around.forEach((element, index) => {
          visit(element, around.slice(0, index));
        });
        // The cascade drew a placement rule's copy of the root, which holds a modal popup too.
        const drawn = read.replaced.get(root) ?? root;
        if (!visited.has(root)) {
          visit(drawn, around);
        }
        drawn.children.forEach((child) => visited.add(child));
      }
    }
    for (const [part, classes] of carried) {
      for (const className of classes) {
        const key = JSON.stringify([part, className]);
        if (used.has(key)) {
          continue;
        }
        const transient = styled.has(key) && !matched.has(key) ? transientVariant(className) : undefined;
        this.#origin.record({
          part,
          className,
          property: "",
          value: "",
          ...(!styled.has(key) || matched.has(key)
            ? {
                outcome: "dropped",
                detail: "no rule of the class wins a declaration on an element of any captured cell",
              }
            : transient === undefined
              ? {
                  outcome: "unshown",
                  detail:
                    "the class styles a state no captured cell shows: no rule written for it matched an element of any cell",
                }
              : { outcome: "dropped", detail: transient }),
        });
      }
    }
  }
}

/**
 * Whether the root of some cell of a capture casts a shadow, a winning `box-shadow` other than
 * `none`, or clips its content, a winning `overflow` other than `visible`. An anchored or modal
 * composite's roots count as the cell's.
 *
 * @param capture - The capture.
 * @returns True where some cell's root does either.
 */
export function castsShadowOrClips(capture: SetCapture): boolean {
  return capture.cells.some(({ roots }) =>
    roots.some(({ root }) =>
      root.declarations.some((index) => {
        const declaration = capture.declarations[index];
        if (declaration === undefined) {
          return false;
        }
        const { longhands, value } = declaration;
        return (
          (longhands.includes("box-shadow") && value.trim() !== "none") ||
          (longhands.some((longhand) => longhand.startsWith("overflow")) && !/^visible$/.test(value.trim()))
        );
      })
    )
  );
}

/**
 * The parts of a definition whose element wins a `scale` in some cell of its capture, as Switch's
 * thumb does while off, found by slot or by place as the cascade finds them, each box's parts
 * claiming their elements in order. The build draws each as a slot around a dot in every cell, so
 * every cell has the same layer tree.
 *
 * @param capture - The set's capture.
 * @param parts - The definition's parts.
 * @returns The parts that scale.
 */
export function partsThatScaleIn(
  capture: SetCapture,
  parts: readonly (PartDefinition | InstanceDefinition)[]
): ReadonlySet<PartDefinition> {
  const found = new Set<PartDefinition>();
  const scales = (element: CapturedElement): boolean =>
    element.declarations.some((index) => capture.declarations[index]?.longhands.includes("scale") === true);
  const visit = (
    box: readonly { readonly element: CapturedElement }[],
    below: readonly (PartDefinition | InstanceDefinition)[]
  ): void => {
    const claimed = new Set<CapturedElement>();
    const element = box.at(-1)?.element;
    for (const part of below) {
      const slot = "kind" in part ? (part.slot ?? part.of.slot) : part.slot;
      const elements =
        element === undefined
          ? undefined
          : slot !== undefined
            ? elementsWithSlot(element, slot, claimed)
            : "kind" in part || part.place === undefined
              ? undefined
              : elementsAtPlace(box, part.place);
      const target = elements?.at(-1);
      if (target === undefined || elements === undefined) {
        continue;
      }
      claimed.add(target);
      if (!("kind" in part)) {
        if (scales(target)) {
          found.add(part);
        }
        visit([...box, ...elements.map((each) => ({ element: each }))], part.parts ?? []);
      }
    }
  };
  for (const { roots } of capture.cells) {
    for (const { root } of roots) {
      visit([{ element: root }], parts);
    }
  }
  return found;
}
