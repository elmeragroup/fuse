/**
 * The cascade of a component set read from its capture, as the mapping reads it through
 * {@link BoxCascade}. Chromium matched the rules and the capture resolved each element's winning
 * declarations, so each layer here applies its element's winners in cascade order over what its
 * parent passes down. The rest is the recipe cascade's: the layers, their computed styles, the reads
 * through {@link LayerStyle} and the coverage rows of what no layer read.
 *
 * - The page's elements and the component's own elements around the root stand around it, as the
 *   recipe cascade's page and ancestors do. They pass their inherited declarations down and the kit
 *   draws none of the rest. A page element's synced variables stay out, so a `var()` of the root's
 *   keeps binding the variable as the recipe cascade's page leaves it.
 * - A part is the element below its box with the part's `data-slot`, or, for a part without one, the
 *   element at the part's place: the element-ordinal path from the nearest element with a `data-slot`,
 *   such as `field/1/0`. The elements between a box and its part pass down what they inherit.
 * - An instance part's inner root is the element below its box with the inner root's `data-slot`.
 *   The classes the composite passes it are the ones it carries beyond those the inner set's own
 *   capture shows on its root in the same inner cell, and the composite owns their rows.
 * - A declaration's row names the layer of the element whose class set it: the box itself, or the
 *   box above whose child selector reached it, and that element's origin owns the row.
 */

import { KitUnmappable } from "../components/build-errors.ts";
import { CellLedger, inheritance, inheritsProperty, LayerStyle } from "../components/cascade.ts";
import type {
  Applied,
  BoxCascade,
  CellScope,
  ChildSpacing,
  InPlace,
  InstanceScope,
  Layer,
  PartElement,
  Recorder,
} from "../components/cascade.ts";
import { variantKey } from "../components/component-spec.ts";
import type {
  BuildContext,
  Cell,
  ComponentDefinition,
  IconSlot,
  OuterDeclaration,
} from "../components/component-spec.ts";
import { CascadeLogs, routed } from "../components/coverage-log.ts";
import type { Origin } from "../components/coverage-log.ts";
import type { NumberSpec } from "../components/kit-spec.ts";
import type { StateTable } from "../components/state-table.ts";
import type { CapturedCell, CapturedDeclaration, CapturedElement, SetCapture } from "./capture-format.ts";

/** Why the kit draws none of a page element's own declarations. */
const PAGE_UNDRAWN = "the page around the component, which the kit draws no layer for";

/** Why the kit draws none of an element of the component's markup around the root. */
const AROUND_UNDRAWN =
  "an element of the component's markup around the root, which the kit draws no layer for";

/** Why the kit draws none of an element between a box and its part. */
const BETWEEN_UNDRAWN = "an element between a box and its part, which the kit draws no layer for";

/**
 * The names the capture gives a rule that selects through no class and the page or the reset sets
 * on every element, whose unread rows drop as the recipe cascade's base layer's do.
 */
const BASE_NAMES = ["fuse.css base layer", "tailwind preflight", "user agent"] as const;

/**
 * The state table of a capture-backed cell. The capture holds what each cell's variants did, so no
 * read of a variant's meaning happens, and one is a defect.
 */
const NO_STATE_TABLE: StateTable = (variant) => {
  throw new Error(
    `the capture-backed cascade read the meaning of ${variant}, which the capture already holds`
  );
};

/**
 * An element on the path from `<html>` to a box: its layer's name, the origin that owns the rows of
 * the classes it carries, and the classes on it a composite passes, whose rows the composite owns.
 */
type Placed = {
  readonly element: CapturedElement;
  readonly name: string;
  readonly origin: Origin;
  readonly passed?: { readonly classes: ReadonlySet<string>; readonly origin: Origin };
};

/** What every box of a cell reads. */
type CellRead = {
  readonly declarations: readonly CapturedDeclaration[];
  readonly context: BuildContext;
  /** The kept capture of another set, which names the classes its own root carries. */
  readonly captureOf: (key: string) => SetCapture | undefined;
  /** Each element the mapping drew, with the name of its layer, which the set's unused classes read. */
  readonly drawn: Map<CapturedElement, string>;
  /**
   * The inner roots of instance parts, each with the classes the composite passes it. The inner sets
   * account for the rest of their classes, and for the elements below them.
   */
  readonly inner: Map<CapturedElement, ReadonlySet<string>>;
};

/**
 * Whether a declaration resets its longhands to their initial values from a style sheet every page
 * applies to every element, Tailwind's preflight, Fuse's base layer or the browser's own, as the
 * base layer's `margin: 0` does. A reset sets nothing a component draws, so the cascade leaves it out,
 * as the recipe cascade never modelled them, and a box reads such a longhand as unset.
 */
function isReset(declaration: CapturedDeclaration, index: number, initial: ReadonlySet<number>): boolean {
  const reset =
    declaration.source === "preflight" || declaration.source === "user-agent" || declaration.layer === "base";
  return reset && initial.has(index);
}

/** The declarations of an element as the cascade applies them, in the capture's order. */
function appliedOf(
  read: CellRead,
  declarations: readonly number[],
  path: readonly Placed[],
  keep: (declaration: CapturedDeclaration) => boolean,
  initial: ReadonlySet<number> = new Set(path.at(-1)?.element.initial ?? [])
): Applied[] {
  return declarations.flatMap((index, order): Applied[] => {
    const declaration = read.declarations[index];
    if (declaration === undefined || !keep(declaration) || isReset(declaration, index, initial)) {
      return [];
    }
    const owner = path[path.length - 1 - declaration.owner] ?? path.at(-1);
    if (owner === undefined) {
      return [];
    }
    const origin =
      owner.passed?.classes.has(declaration.className) === true ? owner.passed.origin : owner.origin;
    return [
      {
        part: owner.name,
        className: declaration.className,
        origin,
        rank: 0,
        specificity: [0, 0, 0],
        order,
        declarations: [{ property: declaration.property, value: declaration.value }],
      },
    ];
  });
}

/** The name of an element the kit draws no layer for: its `data-slot`, or its tag. */
function undrawnName(element: CapturedElement): string {
  return element.attributes["data-slot"] ?? element.tag;
}

/**
 * The declarations of an `<input>`'s `::placeholder`, where it shows its placeholder: it has one and
 * no value. The kit draws the placeholder as the box's own text, so its text style applies on the box
 * after the box's own declarations, and the rest, such as its opacity, drops.
 */
function placeholderOf(read: CellRead, ledger: CellLedger, path: readonly Placed[]): Applied[] {
  const element = path.at(-1)?.element;
  const declarations = element?.pseudo.placeholder;
  if (
    element === undefined ||
    declarations === undefined ||
    element.attributes.placeholder === undefined ||
    (element.attributes.value ?? "") !== ""
  ) {
    return [];
  }
  const text = (property: string) => inheritsProperty(property, read.context);
  const applied = appliedOf(read, declarations, path, () => true, new Set());
  for (const {
    part,
    className,
    origin,
    declarations: [declaration],
  } of applied) {
    if (declaration !== undefined && !text(declaration.property)) {
      routed(
        ledger.scope.inPlace,
        origin
      )({
        part,
        className,
        property: declaration.property,
        value: declaration.value,
        outcome: "dropped",
        detail:
          "the kit draws the placeholder as the box's own text, which takes the placeholder's text style and not its box's",
      });
    }
  }
  return applied
    .filter(({ declarations: [declaration] }) => declaration !== undefined && text(declaration.property))
    .map((each) => ({ ...each, order: element.declarations.length + each.order }));
}

/** The cascade of every cell of a set, read from its capture. */
export class CaptureSetCascade {
  readonly #capture: SetCapture;
  readonly #definition: ComponentDefinition;
  readonly #context: BuildContext;
  readonly #origin: Origin;
  readonly #captureOf: (key: string) => SetCapture | undefined;
  readonly #logs = new CascadeLogs();
  /** The cells the build mapped, with the elements their mapping drew and the inner roots. */
  readonly #cells: { readonly cell: CapturedCell; readonly read: CellRead }[] = [];

  /**
   * @param capture - The set's capture.
   * @param definition - The definition the manifest gives, whose variant keys name the cells.
   * @param context - The synced variables and the compiled theme values the reads substitute.
   * @param record - Adds a row to the set's coverage table.
   * @param captureOf - The kept capture of another set, which an instance part's inner set reads.
   */
  constructor(
    capture: SetCapture,
    definition: ComponentDefinition,
    context: BuildContext,
    record: Recorder,
    captureOf: (key: string) => SetCapture | undefined
  ) {
    this.#capture = capture;
    this.#definition = definition;
    this.#context = {
      ...context,
      base: [...context.base, ...BASE_NAMES.map((className) => ({ className, property: "", value: "" }))],
    };
    this.#origin = { record };
    this.#captureOf = captureOf;
  }

  /**
   * Start the cascade of one cell.
   *
   * @param cell - The cell.
   * @returns The cell's cascade.
   * @throws `KitUnmappable` where the capture lacks the cell, which a run of `figma:capture` adds.
   */
  cell(cell: Cell): CaptureCellCascade {
    const key = variantKey(this.#definition, cell);
    const captured = this.#capture.cells.find((each) => each.key === key);
    if (captured === undefined) {
      throw new KitUnmappable({
        message: `captures/${this.#capture.set}.json has no cell ${key}; run figma:capture`,
      });
    }
    const scope: CellScope = {
      meaningOf: NO_STATE_TABLE,
      cell,
      context: this.#context,
      origin: this.#origin,
      record: this.#origin.record,
      logs: this.#logs,
      inPlace: undefined,
    };
    const read: CellRead = {
      declarations: this.#capture.declarations,
      context: this.#context,
      captureOf: this.#captureOf,
      drawn: new Map(),
      inner: new Map(),
    };
    this.#cells.push({ cell: captured, read });
    return new CaptureCellCascade(read, new CellLedger(scope), this.#capture.page, captured);
  }

  /**
   * Record what the set's logs hold once every cell has cascaded, and each class of the set's own
   * markup that styled nothing in any cell, as dropped: a class whose variant no cell shows, such as
   * a label's `has-[>[data-slot=field]]:` arm, or a marker class such as `group/field`. The classes
   * of an instance part's inner root and the elements below it are the inner set's.
   */
  finish(): void {
    this.#logs.finish(this.#origin.record);
    const carried = new Map<string, Set<string>>();
    const used = new Set<string>();
    for (const { cell, read } of this.#cells) {
      const nameOf = (element: CapturedElement) => read.drawn.get(element) ?? undrawnName(element);
      const visit = (element: CapturedElement, path: readonly CapturedElement[]): void => {
        const passed = read.inner.get(element);
        const name = nameOf(element);
        const classes = carried.get(name) ?? new Set();
        element.classes
          .filter((className) => passed?.has(className) ?? true)
          .forEach((className) => classes.add(className));
        carried.set(name, classes);
        const here = [...path, element];
        for (const index of [...element.declarations, ...Object.values(element.pseudo).flat()]) {
          const declaration = this.#capture.declarations[index];
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
      cell.around.forEach((element, index) => {
        visit(element, cell.around.slice(0, index));
      });
      visit(cell.root, cell.around);
    }
    for (const [part, classes] of carried) {
      for (const className of classes) {
        if (!used.has(JSON.stringify([part, className]))) {
          this.#origin.record({
            part,
            className,
            property: "",
            value: "",
            outcome: "dropped",
            detail: "no rule of the class wins a declaration on an element of any captured cell",
          });
        }
      }
    }
  }
}

/** The cascade of one cell, read from its capture. */
export class CaptureCellCascade {
  readonly #read: CellRead;
  readonly #ledger: CellLedger;
  readonly #page: readonly CapturedElement[];
  readonly #cell: CapturedCell;

  constructor(read: CellRead, ledger: CellLedger, page: readonly CapturedElement[], cell: CapturedCell) {
    this.#read = read;
    this.#ledger = ledger;
    this.#page = page;
    this.#cell = cell;
  }

  /**
   * Cascade the root over the page and the component's elements around it.
   *
   * @param part - The root's layer name.
   * @returns The root's cascade.
   */
  root(part: string): BoxCascade {
    const { context } = this.#read;
    const { origin } = this.#ledger.scope;
    let parent: Layer | undefined;
    const path: Placed[] = [];
    const around = [
      ...this.#page.map((element) => ({ element, undrawn: PAGE_UNDRAWN, page: true })),
      ...this.#cell.around.map((element) => ({ element, undrawn: AROUND_UNDRAWN, page: false })),
    ];
    for (const { element, undrawn, page } of around) {
      path.push({ element, name: undrawnName(element), origin });
      const applied = appliedOf(
        this.#read,
        element.declarations,
        path,
        // A page element passes down what inherits, and none of the synced variables, which stay `var()`s.
        ({ property }) => inheritsProperty(property, context) && !(page && context.variables.owns(property))
      );
      parent = this.#ledger.add(
        parent === undefined ? new Map() : inheritance(parent, context),
        applied,
        parent,
        {
          undrawn,
        }
      );
    }
    return new CaptureBoxCascade(
      this.#read,
      this.#ledger,
      [...path, { element: this.#cell.root, name: part, origin }],
      parent,
      []
    );
  }

  /**
   * The capture names no ancestor that paints behind the root.
   *
   * @returns Undefined.
   */
  backdrop(): LayerStyle | undefined {
    return undefined;
  }

  /** Give every declaration no layer read its row, as the recipe cascade's cell does. */
  settle(): void {
    this.#ledger.settle();
  }
}

/**
 * The elements from below a box down to the element at a place, an element-ordinal path such as
 * `field/1/0` from the nearest element above with that `data-slot`.
 */
function elementsAtPlace(path: readonly Placed[], place: string): readonly CapturedElement[] | undefined {
  const [slot, ...steps] = place.split("/");
  const from = path.findLast((placed) => placed.element.attributes["data-slot"] === slot)?.element;
  if (from === undefined) {
    return undefined;
  }
  const below: CapturedElement[] = [];
  let at = from;
  for (const step of steps) {
    const child = at.children[Number(step)];
    if (child === undefined) {
      return undefined;
    }
    below.push(child);
    at = child;
  }
  const box = path.at(-1)?.element;
  const boxAt = box === undefined ? -1 : below.indexOf(box);
  return boxAt >= 0 ? below.slice(boxAt + 1) : below;
}

/**
 * The elements from below a box down to the first one with a `data-slot` that no earlier part of the
 * box claimed, breadth first, through elements without one, or undefined where none sits below. The
 * box's parts claim their elements in DOM order, so a popup's rows each find their own.
 */
function elementsWithSlot(
  box: CapturedElement,
  slot: string,
  claimed: ReadonlySet<CapturedElement>
): readonly CapturedElement[] | undefined {
  const direct = box.children.find((child) => child.attributes["data-slot"] === slot && !claimed.has(child));
  if (direct !== undefined) {
    return [direct];
  }
  for (const child of box.children) {
    if (child.attributes["data-slot"] !== undefined) {
      continue;
    }
    const below = elementsWithSlot(child, slot, claimed);
    if (below !== undefined) {
      return [child, ...below];
    }
  }
  return undefined;
}

/**
 * The classes a composite passes an inner root: those the root carries in the composite's capture
 * beyond the ones the inner set's own capture shows on its root in the same inner cell.
 */
function passedClasses(
  read: CellRead,
  root: CapturedElement,
  set: string,
  cell: Cell,
  part: string
): ReadonlySet<string> {
  const own = read
    .captureOf(set)
    ?.cells.find((each) => Object.entries(cell).every(([axis, value]) => each.cell[axis] === value))?.root;
  if (own === undefined) {
    throw new KitUnmappable({
      message: `the instance part ${part} shows ${set}, whose kept capture lacks the cell ${JSON.stringify(cell)}, so the build cannot tell the classes the composite passes`,
    });
  }
  const ownClasses = new Set(own.classes);
  return new Set(root.classes.filter((className) => !ownClasses.has(className)));
}

/** The cascade of one box, read from its element in the capture. */
class CaptureBoxCascade implements BoxCascade {
  readonly style: LayerStyle;
  readonly path: readonly string[];
  readonly #read: CellRead;
  readonly #ledger: CellLedger;
  readonly #placed: readonly Placed[];
  readonly #layer: Layer;

  /**
   * @param read - The cell's declarations.
   * @param ledger - The ledger of the scope the box cascades in.
   * @param placed - The elements from `<html>` down to the box's, with their layer names.
   * @param parent - The layer of the element above the box.
   * @param path - The keys of the layers from the root down to the box's.
   */
  constructor(
    read: CellRead,
    ledger: CellLedger,
    placed: readonly Placed[],
    parent: Layer | undefined,
    path: readonly string[]
  ) {
    this.#read = read;
    this.#ledger = ledger;
    this.#placed = placed;
    const own = placed.at(-1);
    if (own !== undefined) {
      read.drawn.set(own.element, own.name);
    }
    this.#layer = ledger.add(
      parent === undefined ? new Map() : inheritance(parent, read.context),
      [
        ...appliedOf(read, own?.element.declarations ?? [], placed, () => true),
        ...placeholderOf(read, ledger, placed),
      ],
      parent
    );
    this.style = new LayerStyle(ledger, this.#layer, path);
    this.path = path;
  }

  spaceChildren(_children: number | undefined, _spacing?: ChildSpacing): NumberSpec | undefined {
    return undefined;
  }

  inPlace(): InPlace | undefined {
    return this.#ledger.scope.inPlace;
  }

  part(_classes: string, part: string, element: PartElement): BoxCascade {
    const box = this.#placed.at(-1)?.element;
    const found =
      box === undefined
        ? undefined
        : element.slot !== undefined
          ? elementsWithSlot(box, element.slot, this.#claimed)
          : element.place === undefined
            ? undefined
            : elementsAtPlace(this.#placed, element.place);
    if (found === undefined || found.length === 0) {
      throw new KitUnmappable({
        message: `the capture holds no element for the part ${part} below ${this.#placed.at(-1)?.name ?? "the root"}, ${element.slot === undefined ? `at the place ${element.place ?? "the manifest leaves unnamed"}` : `with data-slot ${element.slot}`}`,
      });
    }
    return this.#below(found, part, this.#ledger, [...this.path, element.key], undefined);
  }

  instance(
    _classes: { readonly own: string; readonly passed: string },
    part: string,
    element: { readonly slot: string | undefined; readonly tag: string | undefined; readonly set?: string },
    _defaults: readonly OuterDeclaration[],
    scope: InstanceScope
  ): BoxCascade {
    const box = this.#placed.at(-1)?.element;
    const found =
      box === undefined || element.slot === undefined
        ? undefined
        : elementsWithSlot(box, element.slot, this.#claimed);
    const root = found?.at(-1);
    if (found === undefined || root === undefined || element.set === undefined) {
      throw new KitUnmappable({
        message: `the capture holds no inner root ${element.slot ?? "without a data-slot"} for the instance part ${part}`,
      });
    }
    const passed = passedClasses(this.#read, root, element.set, scope.cell, part);
    this.#read.inner.set(root, passed);
    const inner: CellScope = {
      meaningOf: scope.meaningOf,
      cell: scope.cell,
      context: this.#ledger.scope.context,
      origin: scope.inPlace.inner,
      record: scope.inPlace.inner.record,
      logs: scope.logs,
      inPlace: scope.inPlace,
    };
    return this.#below(found, part, this.#ledger.withScope(inner), [], {
      classes: passed,
      origin: scope.passed.origin,
    });
  }

  /** Cascade the elements down to a part's, the last of `elements`, below this box. */
  #below(
    elements: readonly CapturedElement[],
    part: string,
    ledger: CellLedger,
    path: readonly string[],
    passed: Placed["passed"]
  ): BoxCascade {
    const { context } = this.#read;
    const { origin } = this.#ledger.scope;
    let parent = this.#layer;
    const placed = [...this.#placed];
    for (const between of elements.slice(0, -1)) {
      placed.push({ element: between, name: undrawnName(between), origin });
      parent = this.#ledger.add(
        inheritance(parent, context),
        appliedOf(this.#read, between.declarations, placed, ({ property }) =>
          inheritsProperty(property, context)
        ),
        parent,
        { undrawn: BETWEEN_UNDRAWN }
      );
    }
    const target = elements.at(-1);
    if (target !== undefined) {
      this.#claimed.add(target);
      const own: Placed = { element: target, name: part, origin: ledger.scope.origin };
      placed.push(passed === undefined ? own : { ...own, passed });
    }
    return new CaptureBoxCascade(this.#read, ledger, placed, parent, path);
  }

  labelElement(): LayerStyle | undefined {
    return undefined;
  }

  icon(slot: IconSlot): LayerStyle {
    this.#icons ??= iconPaths(this.#placed.at(-1)?.element);
    // An icon is an `<svg>` the box holds itself, or one inside a wrapper, as a pending Button's
    // spinner sits in a span, and it marks its side with `data-icon` where the slot names one.
    const at = this.#icons.findIndex(
      (path) =>
        (slot.direct ? path.length === 1 : path.length > 1) &&
        path[0]?.attributes["data-icon"] === slot.dataIcon
    );
    const [found] = at < 0 ? [] : this.#icons.splice(at, 1);
    if (found === undefined) {
      throw new KitUnmappable({
        message: `the capture holds no <svg> for the icon ${slot.name} of ${this.#placed.at(-1)?.name ?? "the root"}`,
      });
    }
    return this.#below(found, slot.name, this.#ledger, [...this.path, slot.key], undefined).style;
  }

  /** The elements the box's parts, instance parts and icons claimed so far. */
  readonly #claimed = new Set<CapturedElement>();

  /** The box's icons not read yet, each as the elements from below the box down to its `<svg>`. */
  #icons: CapturedElement[][] | undefined;
}

/**
 * The icons of a box in DOM order, each as the elements from below the box down to its `<svg>`. The
 * walk enters an element without a `data-slot`, and one that marks an icon's side with `data-icon`,
 * as the span around a pending Button's spinner does, but no other part.
 */
function iconPaths(box: CapturedElement | undefined): CapturedElement[][] {
  const found: CapturedElement[][] = [];
  const visit = (element: CapturedElement, path: readonly CapturedElement[]): void => {
    for (const child of element.children) {
      const here = [...path, child];
      if (child.tag === "svg") {
        found.push(here);
      } else if (child.attributes["data-slot"] === undefined || child.attributes["data-icon"] !== undefined) {
        visit(child, here);
      }
    }
  };
  if (box !== undefined) {
    visit(box, []);
  }
  return found;
}
