/**
 * The CSS cascade of a component set, cell by cell, as a browser runs it in one cascade layer.
 * Each box of a cell, the root or a part, cascades its own classes over what it inherits, and a
 * part's style attribute over its classes. Each icon cascades its own classes and the
 * child-selector classes that reach it over what its box passes down.
 * The Figma mapping reads each layer's computed style through a {@link LayerStyle}.
 *
 * Every declaration in a computed style names its provenance: the layer it applies to, the part and
 * class that set it, and the origin that owns its rows. A read records that provenance with what the
 * mapping made of it, and the spec fields the read fills. Who owns a row, the logs each owner keeps
 * across the cells and where a row goes live in `coverage-log.ts`. Once the whole cell is mapped,
 * {@link CellCascade.settle} gives every declaration no layer read its row in the coverage table, so
 * coverage does not depend on the order the mapping visits the layers in.
 *
 * An instance part's inner root cascades in the same cell, below its parent box, in a scope of its
 * own ({@link BoxCascade.instance}): its classes read the inner definition's state table and cell,
 * and the inner component owns them, while the composite owns the classes the outer component passes
 * and those of its own boxes that reach the root. The rows of the composite's declarations these
 * layers read, inherited ones too, and the fields their reads fill, go to the instance part, as
 * `instance-parts.ts` says.
 */
import { KitUnmappable } from "./build-errors";
import { splitClassName } from "./class-name";
import type {
  AncestorDefinition,
  BuildContext,
  Cell,
  IconSlot,
  InlineDeclaration,
  OuterDeclaration,
} from "./component-spec";
import type { CoverageOutcome, CoverageRow } from "./coverage";
import { CascadeLogs, routed } from "./coverage-log";
import type { LoggedRule, Origin } from "./coverage-log";
import { normalizeCss, splitTopLevel, substituteVars } from "./css-values";
import type { ComponentRootSpec, FrameLayerSpec, IconLayerSpec, NumberSpec, TextLayerSpec } from "./kit-spec";
import { compareSpecificity } from "./specificity";
import type { Specificity } from "./specificity";
import { readVariants, withPartFacts } from "./state-table";
import type { PartTarget, StateTable } from "./state-table";

/** What a read became, for the coverage table. */
export type CoverageNote = Pick<CoverageRow, "outcome" | "detail">;

/**
 * Reads the declarations of one class that styles every child of a box but the last as the box's
 * item spacing, with what becomes of each declaration, or undefined where the class draws no item
 * spacing.
 */
export type ChildSpacing = (
  declarations: readonly { readonly property: string; readonly value: string }[]
) => { readonly itemSpacing: NumberSpec; readonly notes: ReadonlyMap<string, CoverageNote> } | undefined;

/** Adds one row to the coverage table of the set. */
export type Recorder = (row: Omit<CoverageRow, "component">) => void;

/**
 * Properties Figma has no form for, or that describe behaviour a static component does not
 * show. A declaration of one that no layer reads lands in the coverage table as dropped.
 */
const NO_FIGMA_FORM = new Map([
  ["cursor", "a static frame has no pointer"],
  ["user-select", "a static frame has no selection"],
  ["-webkit-user-select", "a static frame has no selection"],
  ["pointer-events", "a static frame has no pointer"],
  // `scroll-my-1` keeps a Select group 4px from the popup's edge when it scrolls into view.
  ["scroll-margin-block", "a static frame does not scroll, so nothing scrolls the box into view"],
  // `scroll-py-1` keeps a Combobox row 4px from its list's edge when it scrolls into view.
  ["scroll-padding-block", "a static frame does not scroll, so nothing scrolls into its view"],
  ["overscroll-behavior", "a static frame does not scroll, so no scroll chains past it"],
  // `no-scrollbar` hides a scrolling list's scrollbar.
  ["scrollbar-width", "a Figma frame that clips draws no scrollbar"],
  ["-ms-overflow-style", "a Figma frame that clips draws no scrollbar"],
  ["transition-property", "Figma components do not animate"],
  ["transition-timing-function", "Figma components do not animate"],
  ["transition-duration", "Figma components do not animate"],
  ["animation", "Figma components do not animate"],
  // Base UI writes `animation-name: none` on an open Accordion panel.
  ["animation-name", "Figma components do not animate"],
  // `shrink-0` keeps an element at its size, as Figma keeps every fixed or hugging child.
  ["flex-shrink", "Figma's auto layout does not shrink a fixed or hugging child"],
  ["outline-style", "Figma has no outline, and focus draws the ring"],
  // `forced-color-adjust-none` keeps an element's own colors in a forced-colors mode.
  [
    "forced-color-adjust",
    "the kit draws the normal colors, not the system colors a forced-colors mode paints",
  ],
  // The plugin typings expose a text layer's `openTypeFeatures` as read-only, with no setter.
  ["font-variant-numeric", "the plugin API can read a text layer's OpenType features but not set them"],
]);

/**
 * The properties a child inherits from its parent, as CSS passes them down. Custom properties
 * inherit too, unless their `@property` says `inherits: false`. `white-space` and `text-wrap` are
 * shorthands, which `expandShorthand` splits: `white-space-collapse`, `text-wrap-mode` and
 * `text-wrap-style` inherit (CSS Text 4 §3.1 and §6.1), so a `truncate` on a box keeps the label of a
 * part below it on one line, while the `overflow` and `text-overflow` it also sets stay on the box,
 * and a part's label wraps as Empty's `text-balance` on the root says. `text-align` inherits too, and
 * `overflow-wrap` (CSS Text 3 §5.5), so each label below the box that sets it decides whether it
 * breaks a word there.
 */
const INHERITED_PROPERTIES = new Set([
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "white-space-collapse",
  "text-wrap-mode",
  "text-wrap-style",
  "text-align",
  "overflow-wrap",
]);

/**
 * Split a class string into its classes.
 *
 * @param classes - A recipe's class string.
 * @returns Each class, without empty entries.
 */
export function splitClasses(classes: string): readonly string[] {
  return classes.split(/\s+/).filter((name) => name !== "");
}

/** A declaration as its coverage row names it: the part and class that set it, and the property and value. */
export type Declaration = Pick<CoverageRow, "part" | "className" | "property" | "value">;

/**
 * A spec field a read fills: the field of the layer at a key path from the root, which for an inner
 * root built in place is that root. `layers` stands for the layers a box holds, which a read that
 * leaves out an icon changes, and `instance` for an instance layer as a whole, whose inner root a
 * read below it fills.
 */
export type FeedTarget = {
  readonly path: readonly string[];
  readonly field: SpecField;
};

/**
 * Every spec field a read of a declaration fills, which an instance part built in place uses to tell
 * which of its fields the declaration sets. One declaration can fill several: `place-content` both
 * alignments, and a column's `align-items` the sizing of each layer the column stretches. Empty for
 * a read that fills none.
 */
export type Feed = readonly FeedTarget[];

/** A field of a spec layer a read can fill. */
export type SpecField =
  | keyof ComponentRootSpec
  | keyof FrameLayerSpec
  | keyof TextLayerSpec
  | keyof IconLayerSpec
  | "layers"
  | "instance"
  /** The frame a composite draws around an instance part for its margins, which the composite owns. */
  | "around";

/**
 * An instance part's inner root built in place, as the cascade routes to it: the origin of the inner
 * component's own declarations, where the row of a composite's declaration on an in-place layer waits
 * for the instance's diff, and where the field each read of a declaration fills goes.
 */
export type InPlace = {
  readonly inner: Origin;
  readonly composite: (row: Omit<CoverageRow, "component">, origin: Origin) => void;
  readonly fed: (declaration: Declaration, feed: Feed) => void;
  /**
   * Move each field the reads filled to where the mapping draws it instead. `move` gives a feed's new
   * targets, the feed itself where the mapping leaves it, or several where one layer's field becomes
   * a field of each of several layers.
   */
  readonly relocate: (move: (feed: FeedTarget) => readonly FeedTarget[]) => void;
};

/**
 * Where a declaration comes from: the layer it applies to, the part and class that set it, and the
 * origin that owns its rows.
 */
type Provenance = Declaration & {
  /** The id of the layer whose own cascade holds the declaration. */
  readonly layer: number;
  readonly origin: Origin;
};

/**
 * A declaration in a layer's computed style. A computed entry's value was resolved where it was
 * declared: an inherited value, an `inherit`, a `currentcolor`, and a declaration of the page the
 * root inherits, each as the element outside computed it. Its `var()`s are synced variables that
 * element left as references, which the layer's own custom properties do not reach (CSS Custom
 * Properties 1 §2). Its value is undefined where a `var()` with no value and no fallback left it
 * guaranteed-invalid (§3), which a read leaves unmapped. A declaration of the layer's own is
 * resolved where the layer reads it.
 */
type StyleEntry = {
  readonly source: Provenance;
  /**
   * The custom property declarations an inherited value read where its ancestor computed it,
   * which a read of the value reads too.
   */
  readonly consumed: readonly Provenance[];
} & (
  | {
      /** The value as the layer's own declaration sets it. */
      readonly value: string;
      readonly computed: false;
    }
  | {
      /** The value as the element that declared it computed it, or undefined where it is invalid. */
      readonly value: string | undefined;
      readonly computed: true;
    }
);

type ComputedStyle = ReadonlyMap<string, StyleEntry>;

/** How the coverage table names a declaration of an element's `style` attribute, in place of a class. */
const INLINE_STYLE = "inline style";

/** The rank of a style attribute's declarations, above every class (CSS Cascade 4 §6.2). */
const INLINE_RANK = 1;

/** The rank of the browser's default style sheet, below the host page and every class (CSS Cascade 4 §6.2). */
const ELEMENT_DEFAULT_RANK = -3;

/** One class or rule a layer applies, with what orders it in the cascade. */
export type Applied = {
  readonly part: string;
  readonly className: string;
  /** Who owns the rows of its declarations. */
  readonly origin: Origin;
  /**
   * -3 for the browser's default style sheet, -2 for the host page and the root's ancestors, -1 for
   * the base layer, 0 for every recipe class, and 1 for the element's `style` attribute.
   */
  readonly rank: number;
  readonly specificity: Specificity;
  /** The class's place in Tailwind's output, which breaks a specificity tie. */
  readonly order: number;
  readonly declarations: readonly { readonly property: string; readonly value: string }[];
  /**
   * How an element outside computes the declarations' values, for declarations the element inherits
   * from it rather than sets, as the root inherits the page's. Undefined for the element's own.
   */
  readonly computedOutside?: (value: string) => string | undefined;
};

/** A class that styles the icons its child selectors pick. */
type ChildRule = {
  readonly selects: (slot: IconSlot) => boolean;
  readonly applied: Applied;
};

/**
 * A class that styles the box's child parts with one `data-slot`, as `*:data-[slot=x]:` does, or
 * of one tag, as `[&_img]:` does.
 */
export type PartRule = {
  readonly target: PartTarget;
  readonly applied: Applied;
  /** The entry that logs the class, which a part that takes the rule marks. */
  readonly logged: LoggedRule;
};

/** A class that styles every element below its box, as `**:` does. */
type DescendantRule = {
  readonly applied: Applied;
  /** The entry that logs the class, which an element that takes the rule marks. */
  readonly logged: LoggedRule;
};

/**
 * A class that styles every child of its box but the last, as `space-y-4` does through
 * `:where(.space-y-4 > :not(:last-child))`, with where its rows go.
 */
type ExceptLastRule = {
  readonly part: string;
  readonly className: string;
  readonly declarations: readonly { readonly property: string; readonly value: string }[];
  readonly record: Recorder;
};

/**
 * The recipe classes of one box that hold in a cell: its own, the ones that reach icons, the ones
 * that reach its child parts, the ones that reach every element below it, as `**:` does, and the ones
 * that reach every child but the last.
 */
type BoxClasses = {
  readonly applied: readonly Applied[];
  readonly childRules: readonly ChildRule[];
  readonly partRules: readonly PartRule[];
  readonly descendantRules: readonly DescendantRule[];
  readonly exceptLastRules: readonly ExceptLastRule[];
};

/**
 * The cascade a box below another runs in where it is another definition's root built in place, as
 * an instance part's inner component is: the inner definition's state table and cell, which its own
 * classes read, the logs those classes keep across the outer set's cells, where the rows of its
 * layers go, and the origin and logs of the classes the outer component passes it.
 */
export type InstanceScope = {
  readonly meaningOf: StateTable;
  readonly cell: Cell;
  readonly logs: CascadeLogs;
  readonly inPlace: InPlace;
  readonly passed: { readonly origin: Origin; readonly logs: CascadeLogs };
};

/** The cascade of every cell of one component set. */
export class SetCascade {
  readonly #meaningOf: StateTable;
  readonly #context: BuildContext;
  readonly #origin: Origin;
  readonly #logs = new CascadeLogs();

  /**
   * @param meaningOf - The definition's state table.
   * @param context - The compiled utilities, the synced variables, and the page and base
   *   declarations.
   * @param record - Adds a row to the set's coverage table.
   */
  constructor(meaningOf: StateTable, context: BuildContext, record: Recorder) {
    this.#meaningOf = meaningOf;
    this.#context = context;
    this.#origin = { record };
  }

  /**
   * Start the cascade of one cell.
   *
   * @param cell - The cell.
   * @returns The cell's cascade, which the caller settles once it has mapped every layer.
   */
  cell(cell: Cell): CellCascade {
    return new CellCascade({
      meaningOf: this.#meaningOf,
      cell,
      context: this.#context,
      origin: this.#origin,
      record: this.#origin.record,
      logs: this.#logs,
      inPlace: undefined,
    });
  }

  /**
   * Record what the classes of the set's own boxes leave once every cell has cascaded, as
   * {@link CascadeLogs.finish} says.
   */
  finish(): void {
    this.#logs.finish(this.#origin.record);
  }
}

/**
 * What the boxes of a cell cascade with: the state table and cell their classes read, the origin that
 * owns their classes, where a row that names no layer goes, and the logs of that origin, which those
 * classes keep. An instance part's inner root and the layers below it cascade in a scope of their
 * own, whose `inPlace` takes the rows and fields of what they read.
 */
export type CellScope = {
  readonly meaningOf: StateTable;
  readonly cell: Cell;
  readonly context: BuildContext;
  readonly origin: Origin;
  readonly record: Recorder;
  readonly logs: CascadeLogs;
  readonly inPlace: InPlace | undefined;
};

/** A layer of the cell: its computed style, what read it, and the layers below it. */
type Layer = {
  readonly id: number;
  /**
   * The instance part built in place whose layers hold this one, which takes the rows of the
   * composite's declarations on it, undefined for a layer of the set's own boxes.
   */
  readonly inPlace: InPlace | undefined;
  readonly style: ComputedStyle;
  /** The own declarations some layer of the cell read, by property. */
  readonly read: Set<string>;
  /** What became of an own declaration the mapping used without reading through it. */
  readonly marks: Map<string, CoverageNote>;
  readonly children: number[];
  /**
   * Whether the layer stands for an element around the root, the page or a nearer ancestor, which
   * the kit draws no layer for and whose computed values the root inherits.
   */
  readonly around: boolean;
  /**
   * For an ancestor named by its classes, why the kit draws none of its own declarations that do
   * not inherit. Undefined for a drawn layer and for the page.
   */
  readonly undrawn: string | undefined;
};

/** What a layer around the root stands for: the page, or an ancestor and its reason. */
type AroundLayer = { readonly undrawn: string | undefined };

/**
 * The layers of one cell and what read their declarations. Ledgers of one cell share its layers, each
 * with the scope it cascades its boxes in.
 */
class CellLedger {
  readonly scope: CellScope;
  readonly #layers: Layer[];

  constructor(scope: CellScope, layers: Layer[] = []) {
    this.scope = scope;
    this.#layers = layers;
  }

  /**
   * A ledger of the same cell's layers that cascades its boxes in another scope.
   *
   * @param scope - The scope.
   * @returns The ledger.
   */
  withScope(scope: CellScope): CellLedger {
    return new CellLedger(scope, this.#layers);
  }

  /**
   * Where the row of a declaration goes: its origin's, unless an instance part built in place holds
   * the layer that reads it and the inner component does not own it, which leaves the row of a
   * composite's declaration read in place to wait for the instance's diff. That holds for a
   * declaration of an outer box that an in-place layer inherits too, as a custom property the outer
   * root sets reaches a `var()` of the inner root's: the instance draws what it changes, so the
   * instance's diff settles its row, and its origin still owns the row.
   *
   * @param source - The declaration.
   * @param reader - The layer that reads it, or the layer that declares it where no layer read it.
   * @returns The recorder of its row.
   */
  recordFor(source: Provenance, reader: Layer): Recorder {
    return routed(reader.inPlace, source.origin);
  }

  /**
   * Add a layer whose computed style is `applied` over `inherited`, below `parent`. `around` says
   * the layer stands for an element around the root, which the kit does not draw.
   */
  add(
    inherited: ComputedStyle,
    applied: readonly Applied[],
    parent: Layer | undefined,
    around?: AroundLayer
  ): Layer {
    const id = this.#layers.length;
    const { context } = this.scope;
    const layer: Layer = {
      id,
      inPlace: this.scope.inPlace,
      style: computeStyle(id, inherited, applied, (property) => parentValue(parent, context, property)),
      read: new Set(),
      marks: new Map(),
      children: [],
      around: around !== undefined,
      undrawn: around?.undrawn,
    };
    this.#layers.push(layer);
    parent?.children.push(id);
    return layer;
  }

  /**
   * The layer that stands for the elements around the root, by its id.
   *
   * @param id - A layer's id.
   * @returns The layer, or undefined where the id names a drawn layer.
   */
  around(id: number): Layer | undefined {
    const layer = this.#layers[id];
    return layer?.around === true ? layer : undefined;
  }

  /**
   * Any layer of the cell, drawn or around the root, by its id.
   *
   * @param id - A layer's id.
   * @returns The layer, or undefined for an id the cell has not given out.
   */
  layer(id: number): Layer | undefined {
    return this.#layers[id];
  }

  /**
   * Record a read of a declaration, under the part and class that set it, where {@link recordFor}
   * says, and the fields the read fills, where an instance part built in place holds the reading
   * layer.
   */
  noteRead(source: Provenance, note: CoverageNote, feed: Feed, reader: Layer): void {
    this.#layers[source.layer]?.read.add(source.property);
    reader.inPlace?.fed(source, feed);
    this.recordFor(
      source,
      reader
    )({
      part: source.part,
      className: source.className,
      property: source.property,
      value: source.value,
      ...note,
    });
  }

  /**
   * Give every declaration no layer read its row. Every read has happened by now, so the order,
   * each layer after the layers below it, places rows in the table and decides no outcome.
   */
  settle(): void {
    const visit = (id: number): void => {
      const layer = this.#layers[id];
      if (layer === undefined) {
        return;
      }
      layer.children.forEach(visit);
      for (const [property, entry] of layer.style) {
        if (entry.source.layer !== id || layer.read.has(property)) {
          continue;
        }
        this.recordFor(
          entry.source,
          layer
        )({
          part: entry.source.part,
          className: entry.source.className,
          property,
          value: entry.source.value,
          ...(layer.marks.get(property) ?? this.#unread(property, entry, layer)),
        });
      }
    };
    visit(0);
  }

  /** What became of a declaration no layer read, on the layer that sets it. */
  #unread(property: string, entry: StyleEntry, layer: Layer): CoverageNote {
    const inherits = inheritsProperty(property, this.scope.context);
    const overrider = layer.around && inherits ? this.#overrider(layer, property) : undefined;
    if (overrider !== undefined) {
      return {
        outcome: "dropped",
        detail:
          overrider === "root"
            ? "the root sets its own, so it does not inherit this"
            : `the ${overrider} around the root sets its own, so the root does not inherit this`,
      };
    }
    if (layer.undrawn !== undefined && !inherits) {
      return { outcome: "dropped", detail: layer.undrawn };
    }
    if (this.scope.context.base.some((declaration) => declaration.className === entry.source.className)) {
      return {
        outcome: "dropped",
        detail: "the base layer sets it on every part, and this part does not read it",
      };
    }
    const reason = NO_FIGMA_FORM.get(property);
    if (reason !== undefined) {
      return { outcome: "dropped", detail: reason };
    }
    if (property.startsWith("--tw-")) {
      return { outcome: "dropped", detail: "Tailwind's bookkeeping, which no mapped property reads" };
    }
    // A custom property draws nothing, and a read of it on the layer or below it counts on this
    // declaration, so an unread one only passes its value down to layers that never take it. With no
    // part or icon below, nothing could, as the field box's shell corners pass a corner to parts an
    // Input does not have. Below Select's trigger, its value and caret read none of them. A local
    // value of a synced variable is read wherever a declaration of the box or of a layer inside it
    // resolves through it, so an unread one paints nowhere, whatever a layer outside the box reads,
    // as an Alert's `--ring` reaches only a focus ring the set omits.
    if (property.startsWith("--")) {
      return {
        outcome: "dropped",
        detail: this.scope.context.variables.owns(property)
          ? `the box overrides the synced \`${property.slice(2)}\`, which no layer at or below it reads`
          : layer.children.length === 0
            ? "a custom property passes its value down, and the box holds no part or icon to take it"
            : "a custom property passes its value down, and no part or icon below reads it",
      };
    }
    return { outcome: "unmapped", detail: "the builder maps no Figma field from it" };
  }

  /**
   * The element below a layer around the root that sets the property itself over what it
   * inherits: `root` for the root, the slot of a nearer ancestor, or undefined where the value
   * reaches the root unchanged or no element below takes it.
   */
  #overrider(around: Layer, property: string): string | undefined {
    for (const id of around.children) {
      const child = this.#layers[id];
      const source = child?.style.get(property)?.source;
      if (child === undefined || source === undefined) {
        continue;
      }
      if (source.layer !== around.id) {
        return child.around ? source.part : "root";
      }
      const deeper = child.around ? this.#overrider(child, property) : undefined;
      if (deeper !== undefined) {
        return deeper;
      }
    }
    return undefined;
  }
}

/** The cascade of one cell. */
export class CellCascade {
  readonly #ledger: CellLedger;
  #backdrop: LayerStyle | undefined;

  constructor(scope: CellScope) {
    this.#ledger = new CellLedger(scope);
  }

  /**
   * Cascade the root over the host page's declarations and the elements around it. The page's
   * declarations resolve among themselves first, as the page's own cascade does, so the root sees one
   * value per property. With no host declaration or ancestor around the root, the page's values apply
   * on the root below its own classes. With either, the page and the host's declarations compute a
   * style of their own, the host's after the page's, since they sit nearer the root. Each ancestor named by its classes then computes its own style over what it inherits
   * from the element outside it, outermost first, its classes cascading with the cell's states and
   * facts as the root's do. The root inherits the innermost computed values as a part inherits its
   * parent's. So an ancestor's `var()` resolves against the ancestor's custom properties, a nearer
   * ancestor's own declaration beats what it inherits from a farther one, the root's `currentcolor`
   * takes the inherited color, and every declaration of the root's own beats them. A child selector
   * of an ancestor reaches the root's icons as a descendant. An ancestor's `*:data-[slot=…]:` reaches
   * no part, so `SetCascade.finish` leaves it unmapped. An ancestor's class that spaces its children,
   * as `space-y-4` does, drops with the ancestor's reason. An ancestor's `**:` reaches the ancestors
   * inside it, the root, and every part and icon below the root, each cascading it with its own
   * classes.
   *
   * @param classes - The root's class string for the cell.
   * @param part - The root's layer name, which the coverage table names.
   * @param around - The declarations the host sets around the root in the cell, the ancestors
   *   named by their classes, outermost first, the declarations the browser's default style sheet
   *   gives the root's element, which apply on the root below everything else, and the root's own
   *   `style` attribute, which applies above every class.
   * @returns The root's cascade.
   */
  root(
    classes: string,
    part: string,
    around: {
      readonly declarations: readonly OuterDeclaration[];
      readonly ancestors: readonly AncestorDefinition[];
      readonly defaults: readonly OuterDeclaration[];
      readonly inline: readonly InlineDeclaration[];
    }
  ): BoxCascade {
    const { context, origin } = this.#ledger.scope;
    const page = outerApplied(cascadeOwn(context.page), part, -2, origin);
    // The root's own style attribute applies on it as a part's does, above every class.
    const defaults = [
      ...outerApplied(around.defaults, part, ELEMENT_DEFAULT_RANK, origin),
      ...outerApplied(
        around.inline.map((declaration) => ({ className: INLINE_STYLE, ...declaration })),
        part,
        INLINE_RANK,
        origin
      ),
    ];
    if (around.declarations.length === 0 && around.ancestors.length === 0) {
      // The page's declarations apply on the root as declarations the root inherits, each computed
      // on the page, so the root's own custom properties reach none of them, and the coverage table
      // keeps them under the root, as it lists what the root reads and what it overrides.
      const computedOutside = pageValue(context);
      return cascadeBox(
        this.#ledger,
        {
          classes,
          passed: undefined,
          composite: undefined,
          part,
          inherited: new Map(),
          outer: [...defaults, ...page.map((applied) => ({ ...applied, computedOutside }))],
          ancestorRules: [],
          ancestorPartRules: [],
          ancestorDescendants: [],
          selected: [],
        },
        { parent: undefined, path: [] }
      );
    }
    // The sort in `computeStyle` is stable, so at one rank the host's declarations apply last.
    let outside = this.#ledger.add(
      new Map(),
      [...page, ...outerApplied(around.declarations, part, -2, origin)],
      undefined,
      { undrawn: undefined }
    );
    const ancestorRules: ChildRule[] = [];
    const descendants: DescendantRule[] = [];
    for (const ancestor of around.ancestors) {
      const own = boxClasses(ancestor.classes, ancestor.slot, this.#ledger.scope);
      takeAll(descendants);
      outside = this.#ledger.add(
        inheritance(outside, context),
        [...appliedOf(descendants), ...own.applied],
        outside,
        { undrawn: ancestor.undrawn }
      );
      if (ancestor.backdrop === true) {
        if (this.#backdrop !== undefined) {
          throw new KitUnmappable({
            message: `${part}: a cell names two ancestors that paint behind the root`,
          });
        }
        // Its reads fill the root's fields, so the style takes the root's path.
        this.#backdrop = new LayerStyle(this.#ledger, outside, []);
      }
      ancestorRules.push(...own.childRules);
      descendants.push(...own.descendantRules);
      // The ancestor's children sit outside what the set draws, as its other own declarations do.
      for (const { part: holder, className, declarations, record } of own.exceptLastRules) {
        for (const { property, value } of declarations) {
          record({ part: holder, className, property, value, outcome: "dropped", detail: ancestor.undrawn });
        }
      }
    }
    takeAll(descendants);
    return cascadeBox(
      this.#ledger,
      {
        classes,
        passed: undefined,
        composite: undefined,
        part,
        inherited: inheritance(outside, context),
        outer: defaults,
        ancestorRules,
        ancestorPartRules: [],
        ancestorDescendants: descendants,
        selected: appliedOf(descendants),
      },
      { parent: outside, path: [] }
    );
  }

  /**
   * The style of the ancestor that paints behind the root, which `root` cascaded, or undefined where
   * the cell names none.
   *
   * @returns The ancestor's style.
   */
  backdrop(): LayerStyle | undefined {
    return this.#backdrop;
  }

  /**
   * Give every declaration no layer read its row in the coverage table: the mapping's mark
   * where it marked one, or dropped with its reason, or unmapped. Call it once the whole cell
   * is mapped.
   */
  settle(): void {
    this.#ledger.settle();
  }
}

/**
 * Cascade one box over what it inherits: the outer declarations, the base layer, the classes of the
 * boxes above that select it, and its own classes, and beside them the classes the outer component
 * passes an inner root built in place, which cascade with the root's own in the scope they own.
 */
function cascadeBox(
  ledger: CellLedger,
  box: {
    readonly classes: string;
    /** The classes the outer component passes an inner root built in place, and their scope. */
    readonly passed: { readonly classes: string; readonly scope: CellScope } | undefined;
    /** The scope of the composite that holds the box in place, as {@link BoxCascade} keeps it. */
    readonly composite: CellScope | undefined;
    readonly part: string;
    readonly inherited: ComputedStyle;
    readonly outer: readonly Applied[];
    readonly ancestorRules: readonly ChildRule[];
    /** The tag rules of the boxes above, such as `[&_img]:`, which reach parts at any depth. */
    readonly ancestorPartRules: readonly PartRule[];
    /** The `**:` classes of the boxes above, which reach every element below them. */
    readonly ancestorDescendants: readonly DescendantRule[];
    /**
     * The classes of the boxes above that style this box, its parent's that name it as a child and
     * the `**:` classes above it, which cascade with its own.
     */
    readonly selected: readonly Applied[];
  },
  at: { readonly parent: Layer | undefined; readonly path: readonly string[] }
): BoxCascade {
  const mine = boxClasses(box.classes, box.part, ledger.scope);
  const passed =
    box.passed === undefined ? undefined : boxClasses(box.passed.classes, box.part, box.passed.scope);
  const own: BoxClasses =
    passed === undefined
      ? mine
      : {
          applied: [...mine.applied, ...passed.applied],
          childRules: [...mine.childRules, ...passed.childRules],
          partRules: [...mine.partRules, ...passed.partRules],
          descendantRules: [...mine.descendantRules, ...passed.descendantRules],
          exceptLastRules: [...mine.exceptLastRules, ...passed.exceptLastRules],
        };
  const base = outerApplied(ledger.scope.context.base, box.part, -1, ledger.scope.origin);
  const layer = ledger.add(
    box.inherited,
    [...box.outer, ...base, ...box.selected, ...own.applied],
    at.parent
  );
  return new BoxCascade(ledger, layer, at.path, {
    ancestorRules: box.ancestorRules,
    ownRules: own.childRules,
    partRules: own.partRules,
    ancestorPartRules: box.ancestorPartRules,
    descendants: [...box.ancestorDescendants, ...own.descendantRules],
    exceptLast: own.exceptLastRules,
    composite: box.composite,
  });
}

/**
 * The cascade of one box, the root or a part: its own style, and the cascades of the parts and
 * icons below it.
 */
export class BoxCascade {
  /** The box's computed style. */
  readonly style: LayerStyle;
  /**
   * The keys of the layers from the root down to the box's, the root of an instance part built in
   * place counting as a root, which the fields its reads fill name.
   */
  readonly path: readonly string[];
  readonly #ledger: CellLedger;
  readonly #layer: Layer;
  readonly #ancestorRules: readonly ChildRule[];
  readonly #ownRules: readonly ChildRule[];
  readonly #partRules: readonly PartRule[];
  readonly #ancestorPartRules: readonly PartRule[];
  readonly #descendants: readonly DescendantRule[];
  readonly #exceptLast: readonly ExceptLastRule[];
  /**
   * The scope of the composite whose instance part holds this box in place, which the classes it gives
   * an icon below cascade in, undefined for a box of the set's own.
   */
  readonly #composite: CellScope | undefined;

  /**
   * @param ledger - The cell's layers.
   * @param layer - The box's layer.
   * @param path - The keys of the layers from the root down to the box's.
   * @param rules - The child selectors of the boxes above that reach this box's icons as
   *   descendants, this box's own, this box's classes that style its child parts, the tag rules of
   *   the boxes above, which reach its parts as descendants, the `**:` classes of this box and the
   *   boxes above, which reach every element below it, and this box's classes that style every child
   *   but the last.
   */
  constructor(
    ledger: CellLedger,
    layer: Layer,
    path: readonly string[],
    rules: {
      readonly ancestorRules: readonly ChildRule[];
      readonly ownRules: readonly ChildRule[];
      readonly partRules: readonly PartRule[];
      readonly ancestorPartRules: readonly PartRule[];
      readonly descendants: readonly DescendantRule[];
      readonly exceptLast: readonly ExceptLastRule[];
      readonly composite: CellScope | undefined;
    }
  ) {
    this.style = new LayerStyle(ledger, layer, path);
    this.path = path;
    this.#ledger = ledger;
    this.#layer = layer;
    this.#ancestorRules = rules.ancestorRules;
    this.#ownRules = rules.ownRules;
    this.#partRules = rules.partRules;
    this.#ancestorPartRules = rules.ancestorPartRules;
    this.#descendants = rules.descendants;
    this.#exceptLast = rules.exceptLast;
    this.#composite = rules.composite;
  }

  /**
   * Give the classes of this box that style every child but the last, as `space-y-4` does, their
   * rows once the mapping knows how many element children the box's markup holds in the cell:
   * dropped for a box that holds one or none, since `:not(:last-child)` then matches no child, and
   * unmapped for more, since the kit draws no margin between a box's children, unless the one such
   * class reads as the box's item spacing through `spacing`. Unmapped where the count is unknown.
   *
   * @param children - The element children the box's markup holds in the cell, drawn or not, or
   *   undefined where the definition does not count them.
   * @param spacing - Reads a class as the item spacing, where the box draws every element child as
   *   a layer in its flow, or undefined where it cannot.
   * @returns The item spacing the class draws, or undefined.
   */
  spaceChildren(children: number | undefined, spacing?: ChildSpacing): NumberSpec | undefined {
    const [only, ...others] = this.#exceptLast;
    const spaced =
      children !== undefined && children > 1 && only !== undefined && others.length === 0
        ? spacing?.(only.declarations)
        : undefined;
    const note = childSpacingNote(children);
    for (const { part, className, declarations, record } of this.#exceptLast) {
      for (const { property, value } of declarations) {
        record({ part, className, property, value, ...(spaced?.notes.get(property) ?? note) });
      }
    }
    return spaced?.itemSpacing;
  }

  /**
   * The instance part built in place whose layers hold this box, undefined for a box of the set's own.
   *
   * @returns The in-place build.
   */
  inPlace(): InPlace | undefined {
    return this.#ledger.scope.inPlace;
  }

  /**
   * Cascade a part directly below this box, over what this box passes down. This box's
   * `*:data-[slot=…]:` classes that name the part's slot cascade with the part's own classes by
   * specificity, as CSS applies `:is(.… > *)[data-slot="…"]` to the box's children. Its classes such
   * as `[&_img]:` that name the part's tag do too, and so do those of the boxes above, since
   * `.… img` matches an `<img>` at any depth. So do the `**:` classes of this box and the boxes
   * above, since `:is(.… *)` matches every element below.
   *
   * @param classes - The part's class string for the cell.
   * @param part - The part's layer name.
   * @param element - The part's key, its `data-slot`, or undefined for a part without one, and its
   *   tag where the definition names it.
   * @param outer - The declarations of the part's `style` attribute, which beat every class, and
   *   those the browser's default style sheet gives its element, which every class beats.
   * @returns The part's cascade.
   * @param facts - The variants only the part's own element carries, which its classes read over the
   *   set's table, as {@link withPartFacts} says. Undefined for none.
   */
  part(
    classes: string,
    part: string,
    element: {
      readonly key: string;
      readonly slot: string | undefined;
      readonly tag: string | undefined;
    },
    outer: {
      readonly inline: readonly InlineDeclaration[];
      readonly defaults: readonly OuterDeclaration[];
    } = { inline: [], defaults: [] },
    facts?: ReadonlyMap<string, (cell: Cell) => boolean>
  ): BoxCascade {
    const { scope } = this.#ledger;
    const ledger =
      facts === undefined
        ? this.#ledger
        : this.#ledger.withScope({ ...scope, meaningOf: withPartFacts(scope.meaningOf, facts, part) });
    return this.#below({ classes, passed: undefined }, part, element, outer, ledger, [
      ...this.path,
      element.key,
    ]);
  }

  /**
   * Cascade another definition's root directly below this box, as an instance part renders the inner
   * component there. It takes what this box and the boxes above pass to a part, as {@link part} says.
   * Its own classes, and those of the layers below it, read the inner definition's state table and
   * cell, and the inner component owns them. The classes the outer component passes cascade with its
   * own, read the same table and cell, and are the passed origin's. Its layers' rows and the fields
   * their reads fill go where `scope.inPlace` says, and its path starts again at the inner root.
   *
   * @param classes - The inner root's classes for the inner cell, and the outer component's
   *   `className`, each as it survives their merge.
   * @param part - The inner root's layer name.
   * @param element - The inner root's `data-slot` and tag.
   * @param defaults - The declarations the browser's default style sheet gives its element.
   * @param scope - The inner definition's state table and cell, its logs, the in-place build and the
   *   origin of the passed classes.
   * @returns The inner root's cascade.
   */
  instance(
    classes: { readonly own: string; readonly passed: string },
    part: string,
    element: { readonly slot: string | undefined; readonly tag: string | undefined },
    defaults: readonly OuterDeclaration[],
    scope: InstanceScope
  ): BoxCascade {
    const inner: CellScope = {
      meaningOf: scope.meaningOf,
      cell: scope.cell,
      context: this.#ledger.scope.context,
      origin: scope.inPlace.inner,
      record: scope.inPlace.inner.record,
      logs: scope.logs,
      inPlace: scope.inPlace,
    };
    const passed: CellScope = {
      ...inner,
      origin: scope.passed.origin,
      logs: scope.passed.logs,
      record: (row) => {
        scope.inPlace.composite(row, scope.passed.origin);
      },
    };
    return this.#below(
      { classes: classes.own, passed: { classes: classes.passed, scope: passed } },
      part,
      element,
      { inline: [], defaults },
      this.#ledger.withScope(inner),
      []
    );
  }

  /** Cascade a box directly below this one, in the scope `ledger` cascades its boxes in. */
  #below(
    classes: { readonly classes: string; readonly passed: { classes: string; scope: CellScope } | undefined },
    part: string,
    element: { readonly slot: string | undefined; readonly tag: string | undefined },
    outer: {
      readonly inline: readonly InlineDeclaration[];
      readonly defaults: readonly OuterDeclaration[];
    },
    ledger: CellLedger,
    path: readonly string[]
  ): BoxCascade {
    const tagged = (rule: PartRule) => rule.target.kind === "tag" && rule.target.tag === element.tag;
    const taken = [
      ...this.#ancestorPartRules.filter(tagged),
      ...this.#partRules.filter((rule) =>
        rule.target.kind === "slot"
          ? rule.target.slot === element.slot
          : rule.target.kind === "child-tag"
            ? rule.target.tag === element.tag
            : rule.target.kind === "every-child" || tagged(rule)
      ),
    ];
    takeAll(taken);
    takeAll(this.#descendants);
    const { origin } = ledger.scope;
    return cascadeBox(
      ledger,
      {
        ...classes,
        composite: classes.passed?.scope ?? this.#composite,
        part,
        inherited: inheritance(this.#layer, this.#ledger.scope.context),
        outer: [
          ...outerApplied(outer.defaults, part, ELEMENT_DEFAULT_RANK, origin),
          ...outerApplied(
            outer.inline.map((declaration) => ({ className: INLINE_STYLE, ...declaration })),
            part,
            INLINE_RANK,
            origin
          ),
        ],
        ancestorRules: [...this.#ancestorRules, ...this.#ownRules],
        ancestorPartRules: [
          ...this.#ancestorPartRules,
          ...this.#partRules.filter((rule) => rule.target.kind === "tag"),
        ],
        ancestorDescendants: this.#descendants,
        selected: [...appliedOf(taken), ...appliedOf(this.#descendants)],
      },
      { parent: this.#layer, path }
    );
  }

  /**
   * Cascade the element this box holds its label in, over what this box passes down, where a class
   * of this box reaches it, as `[&>span:last-child]:truncate` reaches the `<span>` a Sidebar row
   * holds its text in. The kit draws no layer for the element, whose label the box draws as its own
   * text, so the element's path is the text layer's. A `**:` class of this box or a box above
   * reaches the element too, and stays unmapped, since the element's own layout decides whether the
   * label reads its style.
   *
   * @param element - The tag of the element that holds the label, whether the label is the box's
   *   last child in the cell, and the label's key.
   * @returns The element's style, or undefined where no class of this box reaches it, so the label
   *   reads this box's style.
   */
  labelElement(element: {
    readonly tag: string;
    readonly last: boolean;
    readonly key: string;
  }): LayerStyle | undefined {
    takeAll(this.#descendants);
    for (const { part, className, origin, declarations } of appliedOf(this.#descendants)) {
      for (const { property, value } of declarations) {
        routed(
          this.#ledger.scope.inPlace,
          origin
        )({
          part,
          className,
          property,
          value,
          outcome: "unmapped",
          detail:
            "the class reaches the element the box holds its label in, which the kit draws no layer for",
        });
      }
    }
    const taken = this.#partRules.filter(
      (rule) => element.last && rule.target.kind === "label" && rule.target.tag === element.tag
    );
    if (taken.length === 0) {
      return undefined;
    }
    takeAll(taken);
    const layer = this.#ledger.add(
      inheritance(this.#layer, this.#ledger.scope.context),
      appliedOf(taken),
      this.#layer
    );
    return new LayerStyle(this.#ledger, layer, [...this.path, element.key]);
  }

  /**
   * Cascade an icon this box lists, over what this box passes down. A child selector on this
   * box reaches the icon as the selector says. One on a box above reaches it as a descendant,
   * never as a direct child. A `**:` class of this box or a box above reaches it as an element below
   * them. The icon's own classes cascade with them by specificity, so a box's `[&_svg]:size-4`
   * (0,1,1) beats the icon's own `size-6` (0,1,0), as in CSS.
   *
   * @param slot - The icon.
   * @param given - The classes the composite that holds this box in place gives the icon, as
   *   Combobox gives its caret's CaretDown `caret()`, which cascade after the icon's own in the
   *   composite's scope, so their rows are the composite's. Undefined for none.
   * @returns The icon's computed style.
   * @throws When one of the icon's own classes, or one the composite gives it, has a child selector or styles a child part or the
   *   elements below the icon, which the builder does not model inside an icon.
   */
  icon(slot: IconSlot, given?: string): LayerStyle {
    // The element carries both its own classes and those given, which a selector such as
    // `:not([class*='size-'])` reads.
    const element = given === undefined ? slot : { ...slot, classes: `${slot.classes ?? ""} ${given}` };
    const selected = [
      ...this.#ancestorRules.filter((rule) => rule.selects({ ...element, direct: false })),
      ...this.#ownRules.filter((rule) => rule.selects(element)),
    ];
    const own = boxClasses(slot.classes ?? "", slot.name, this.#ledger.scope);
    // The classes a composite gives the icon are the composite's, so they cascade in its scope.
    const passed =
      given === undefined ? undefined : boxClasses(given, slot.name, this.#composite ?? this.#ledger.scope);
    const [nested] = [own, ...(passed === undefined ? [] : [passed])].flatMap((classes) => [
      ...appliedOf([...classes.childRules, ...classes.partRules, ...classes.descendantRules]),
      ...classes.exceptLastRules,
    ]);
    if (nested !== undefined) {
      throw new KitUnmappable({
        message: `the ${slot.name}'s own class ${nested.className} selects inside the icon`,
      });
    }
    takeAll(this.#descendants);
    const layer = this.#ledger.add(
      inheritance(this.#layer, this.#ledger.scope.context),
      [...appliedOf(selected), ...appliedOf(this.#descendants), ...own.applied, ...(passed?.applied ?? [])],
      this.#layer
    );
    return new LayerStyle(this.#ledger, layer, [...this.path, slot.key]);
  }
}

/** What a class that styles every child but the last makes of a box that holds `children`. */
function childSpacingNote(children: number | undefined): CoverageNote {
  if (children === undefined) {
    return {
      outcome: "unmapped",
      detail:
        "the definition does not count the element children the box's markup holds, so the build cannot tell which is the last",
    };
  }
  return children <= 1
    ? {
        outcome: "dropped",
        detail: `\`:not(:last-child)\` styles every child but the last, and the box holds ${children === 0 ? "none" : "one"}, so the class styles nothing the set draws`,
      }
    : { outcome: "unmapped", detail: "the kit draws no margin between a box's children" };
}

/**
 * Reads one layer's computed style. Each read substitutes Tailwind's own variables and records
 * every declaration it read, the custom properties among them, under the part and class that set
 * each one.
 */
export class LayerStyle {
  /**
   * The keys of the layers from the root down to the spec layer this style draws, which the fields
   * its reads fill name.
   */
  readonly path: readonly string[];
  readonly #ledger: CellLedger;
  readonly #layer: Layer;

  constructor(ledger: CellLedger, layer: Layer, path: readonly string[]) {
    this.path = path;
    this.#ledger = ledger;
    this.#layer = layer;
  }

  /**
   * The one field a read fills on the spec layer this style draws, or on another layer at `path`. A
   * read that fills several joins their feeds.
   *
   * @param field - The spec field.
   * @param path - The keys of the layer the read fills, this style's own by default.
   * @returns The feed.
   */
  feed(field: SpecField, path: readonly string[] = this.path): Feed {
    return [{ path, field }];
  }

  /**
   * Move the fields the reads of the cell filled at or below this style's layer into a layer the
   * mapping puts in its place, as a scaled part's dot and a part's box inside its margins hold what
   * the part drew, keeping those of `keep` on the layer itself.
   *
   * @param into - The key of the layer that takes them.
   * @param keep - The fields that stay.
   */
  relocateFeeds(into: string, keep: ReadonlySet<SpecField>): void {
    const { path } = this;
    this.moveFeeds((feed) =>
      path.every((key, index) => feed.path[index] === key) &&
      (feed.path.length > path.length || !keep.has(feed.field))
        ? [{ ...feed, path: [...path, into, ...feed.path.slice(path.length)] }]
        : [feed]
    );
  }

  /**
   * Move the fields the reads of the cell filled to where the mapping draws them instead, as the
   * layers of a column move into the section frames around them.
   *
   * @param move - A feed's new targets: the feed itself where nothing moves it, or several.
   */
  moveFeeds(move: (feed: FeedTarget) => readonly FeedTarget[]): void {
    this.#layer.inPlace?.relocate(move);
  }

  /** Whether the computed style sets the property. */
  has(property: string): boolean {
    return this.#layer.style.has(property);
  }

  /** The computed value before substitution. */
  raw(property: string): string | undefined {
    return this.#layer.style.get(property)?.value;
  }

  /**
   * Whether the layer itself sets the property to `inherit`, which computes to its parent's value,
   * so the value follows the parent's.
   */
  inherits(property: string): boolean {
    const entry = this.#layer.style.get(property);
    return (
      entry !== undefined &&
      entry.source.layer === this.#layer.id &&
      normalizeCss(entry.source.value) === "inherit"
    );
  }

  /**
   * The computed value with Tailwind's variables substituted, without recording a read, for a
   * mapping that decides from several properties whether to read any of them.
   */
  resolved(property: string): string | undefined {
    const entry = this.#layer.style.get(property);
    return entry === undefined
      ? undefined
      : substitute(this.#layer, this.#ledger.scope.context, entry, new Set());
  }

  /**
   * The computed value of `other` on the element that declared `property`, with Tailwind's variables
   * substituted, without recording a read. CSS computes a relative length where it is declared, so
   * an inherited `em` letter spacing is a share of the declaring element's font size, which this
   * names.
   *
   * @param property - The property whose declaring element to read.
   * @param other - The property to read there.
   * @returns The value, or undefined where nothing sets `property` or that element has no `other`.
   */
  resolvedWhereDeclared(property: string, other: string): string | undefined {
    const source = this.#layer.style.get(property)?.source.layer;
    const declaring = source === undefined ? undefined : this.#ledger.layer(source);
    const entry = declaring?.style.get(other);
    return declaring === undefined || entry === undefined
      ? undefined
      : substitute(declaring, this.#ledger.scope.context, entry, new Set());
  }

  /**
   * Note what became of a declaration the layer sets itself, or inherits from the elements around
   * the root, used without reading through it. The kit draws no layer for those elements, so the
   * layers below them note what they pass down, as a root that shows no text drops the type its
   * list sets. A drawn parent notes its own. A read of the declaration anywhere in the cell takes
   * precedence. `feed` names the spec fields the declaration fills that way.
   */
  mark(property: string, outcome: CoverageOutcome, detail: string, feed: Feed): void {
    const source = this.#layer.style.get(property)?.source;
    if (source === undefined) {
      return;
    }
    const owner = source.layer === this.#layer.id ? this.#layer : this.#ledger.around(source.layer);
    owner?.marks.set(property, { outcome, detail });
    this.#layer.inPlace?.fed(source, feed);
  }

  /**
   * Note every declaration the layer sets itself as dropped, for a layer the kit draws nowhere in
   * the cell, as an empty list draws nothing. A read of one elsewhere in the cell takes precedence.
   *
   * @param detail - Why the layer draws nowhere.
   */
  dropOwn(detail: string): void {
    for (const [property, entry] of this.#layer.style) {
      if (entry.source.layer === this.#layer.id) {
        this.#layer.marks.set(property, { outcome: "dropped", detail });
      }
    }
  }

  /**
   * Record a property the layer needs and its cascade leaves unset, as unmapped, under the
   * class that set the property needing it.
   */
  missing(property: string, neededBy: string, detail: string): void {
    const entry = this.#layer.style.get(neededBy);
    if (entry !== undefined && !this.#layer.style.has(property)) {
      this.#ledger.recordFor(
        entry.source,
        this.#layer
      )({
        part: entry.source.part,
        className: entry.source.className,
        property,
        value: "",
        outcome: "unmapped",
        detail,
      });
    }
  }

  /**
   * Read a property through a mapping.
   *
   * @param property - The property.
   * @param map - Maps the value onto a Figma field, or returns undefined where none reads it.
   * @param describe - What the mapped value became, for the coverage table.
   * @param feed - The spec fields the mapped value fills, which an instance part built in place uses
   *   to tell which of its fields a declaration sets.
   * @returns The mapped value, or undefined when the property is unset or does not map.
   */
  read<T>(
    property: string,
    map: (value: string) => T | undefined,
    describe: (mapped: T) => CoverageNote,
    feed: Feed
  ): T | undefined {
    const entry = this.#layer.style.get(property);
    if (entry === undefined) {
      return undefined;
    }
    const read = new Set<string>();
    const resolved = substitute(this.#layer, this.#ledger.scope.context, entry, read);
    const mapped = resolved === undefined ? undefined : map(resolved);
    const note =
      mapped === undefined
        ? {
            outcome: "unmapped" as const,
            detail: `no Figma field reads ${resolved ?? entry.value ?? "an invalid value"}`,
          }
        : describe(mapped);
    for (const source of sourcesOf(this.#layer, entry, read)) {
      this.#ledger.noteRead(source, note, feed, this.#layer);
    }
    return mapped;
  }
}

/**
 * Whether a child inherits a property: one of the inherited properties the build reads, or a custom
 * property whose `@property` does not say `inherits: false`.
 */
function inheritsProperty(property: string, context: BuildContext): boolean {
  return property.startsWith("--")
    ? context.compiled.registeredProperties.get(property)?.inherits !== false
    : INHERITED_PROPERTIES.has(property);
}

/**
 * The declarations a child of a layer inherits, as CSS passes them down: the computed value of
 * each inherited property, with the layer's custom properties substituted, so a child that sets
 * one of them anew does not change what it inherited.
 */
function inheritance(layer: Layer, context: BuildContext): ComputedStyle {
  const passed = new Map<string, StyleEntry>();
  for (const [property, entry] of layer.style) {
    if (!inheritsProperty(property, context)) {
      continue;
    }
    // A value that fails to resolve passes down as guaranteed-invalid, with what it read.
    const read = new Set<string>();
    const value = substitute(layer, context, entry, read);
    const [, ...consumed] = sourcesOf(layer, entry, read);
    passed.set(property, { value, source: entry.source, consumed, computed: true });
  }
  return passed;
}

/**
 * How the page computes a declaration's value: against the page's own custom properties, then the
 * theme's, then the registered initial value, with a synced variable the page does not set left as
 * its `var()`. The page sets no custom property the kit's build declares, so the read goes unrecorded.
 *
 * @returns The page's computed value, or undefined where a reference has no value and no fallback.
 */
function pageValue(context: BuildContext): (value: string) => string | undefined {
  const own = new Map(
    context.page.flatMap(({ property, value }) =>
      property.startsWith("--") ? [[property, value] as const] : []
    )
  );
  return (value) =>
    substituteVars(
      value,
      (name) => {
        const declared =
          own.get(name) ??
          context.compiled.themeValues.get(name) ??
          context.compiled.registeredProperties.get(name)?.initialValue;
        return declared === undefined ? undefined : { value: declared, computed: false };
      },
      (name) => context.variables.owns(name) && !own.has(name),
      new Set()
    );
}

/**
 * A parent's computed value of a property, inherited or not, with the parent's custom properties
 * substituted, as a child's `inherit` takes it. A value whose substitution fails is the
 * guaranteed-invalid value, undefined, under the parent's declaration.
 *
 * @returns The value under the parent's declaration, or undefined where the parent has no entry for
 *   the property.
 */
function parentValue(
  parent: Layer | undefined,
  context: BuildContext,
  property: string
): StyleEntry | undefined {
  const entry = parent?.style.get(property);
  if (parent === undefined || entry === undefined) {
    return undefined;
  }
  // A value that fails to resolve stays guaranteed-invalid, with what it read, as `inheritance()`
  // passes it down, so an `inherit` of it reads as invalid rather than as nothing set.
  const read = new Set<string>();
  const value = substitute(parent, context, entry, read);
  const [, ...consumed] = sourcesOf(parent, entry, read);
  return { value, source: entry.source, consumed, computed: true };
}

/** The provenance of a declaration, then of every declaration its value read. */
function sourcesOf(layer: Layer, entry: StyleEntry, read: ReadonlySet<string>): readonly Provenance[] {
  return [
    entry.source,
    ...entry.consumed,
    ...[...read].flatMap((name) => {
      const custom = layer.style.get(name);
      return custom === undefined ? [] : [custom.source, ...custom.consumed];
    }),
  ];
}

/**
 * Resolve one of a layer's entries where CSS resolves it (CSS Custom Properties 1 §2 and §3). A
 * computed entry was resolved where it was declared, so it reads as it is. A declaration of the
 * layer's own reads the custom properties the layer sets or inherits, then the theme's, then the
 * registered initial value. A synced variable the layer neither sets nor inherits stays a `var()`
 * reference, which binds it. One it sets or inherits resolves to that value, which the browser paints
 * in its place, as an Accordion item's `--ring` reaches the focus ring of the trigger inside it.
 */
function substitute(
  layer: Layer,
  context: BuildContext,
  entry: StyleEntry,
  read: Set<string>
): string | undefined {
  if (entry.computed) {
    return entry.value;
  }
  return substituteVars(
    entry.value,
    (name) => {
      const custom = layer.style.get(name);
      if (custom !== undefined) {
        return custom.computed
          ? { value: custom.value, computed: true }
          : { value: custom.value, computed: false };
      }
      const outside =
        context.compiled.themeValues.get(name) ??
        context.compiled.registeredProperties.get(name)?.initialValue;
      return outside === undefined ? undefined : { value: outside, computed: false };
    },
    (name) => context.variables.owns(name) && !layer.style.has(name),
    read
  );
}

/**
 * Sort a box's classes for one cell by their variants. A class with a child selector styles the
 * icons it reaches, a `**:` class every element below the box, a class whose variants hold styles
 * the box, a class whose rule styles every child but the last waits for the mapping to count the
 * box's children, and a class with a variant no cell shows or the definition does not model lands
 * in the coverage table.
 */
function boxClasses(classes: string, part: string, scope: CellScope): BoxClasses {
  const { meaningOf, cell, context, record, logs } = scope;
  const applied: Applied[] = [];
  const childRules: ChildRule[] = [];
  const partRules: PartRule[] = [];
  const descendantRules: DescendantRule[] = [];
  const exceptLastRules: ExceptLastRule[] = [];
  for (const className of splitClasses(classes)) {
    const { variants, utility } = splitClassName(className);
    const exceptLast = context.compiled.exceptLastChildRules.get(utility);
    const rule = context.compiled.rules.get(utility) ?? exceptLast;
    if (rule === undefined) {
      const marker = isMarker(utility);
      record({
        part,
        className,
        property: "",
        value: "",
        outcome: marker ? "dropped" : "unmapped",
        detail: marker ? "a marker class with no CSS" : "Tailwind emits no rule for it",
      });
      continue;
    }
    const { selects, target, descendants, conditionVariants, holds, skipped } = readVariants(
      variants,
      meaningOf,
      cell
    );
    if (skipped !== undefined) {
      for (const declaration of rule.declarations) {
        record({ part, className, property: declaration.property, value: declaration.value, ...skipped });
      }
      continue;
    }
    if (conditionVariants.length > 0) {
      logs.condition(
        { part, className, declarations: rule.declarations, variants: conditionVariants },
        holds
      );
    }
    if (!holds) {
      continue;
    }
    if (rule === exceptLast) {
      // The box's children take the rule, and only the mapping knows how many it holds. A variant
      // that moves the rule onto other elements spaces children the kit does not model.
      const moved = selects !== undefined || target !== undefined || descendants;
      if (moved) {
        for (const declaration of rule.declarations) {
          record({
            part,
            className,
            property: declaration.property,
            value: declaration.value,
            outcome: "unmapped",
            detail: "the class spaces the children of elements below the box, which the kit does not model",
          });
        }
      } else {
        exceptLastRules.push({ part, className, declarations: rule.declarations, record });
      }
      continue;
    }
    const placement = context.compiled.classes.get(className);
    if (placement === undefined) {
      record({
        part,
        className,
        property: "",
        value: "",
        outcome: "unmapped",
        detail: "Tailwind emits no rule for the class with its variants",
      });
      continue;
    }
    const entry = {
      part,
      className,
      origin: scope.origin,
      rank: 0,
      ...placement,
      declarations: rule.declarations,
    };
    if (target !== undefined) {
      const logged = logs.partRule({ part, className, target, declarations: rule.declarations });
      partRules.push({ target, applied: entry, logged });
    } else if (descendants) {
      const logged = logs.descendantRule({ part, className, declarations: rule.declarations });
      descendantRules.push({ applied: entry, logged });
    } else if (selects === undefined) {
      applied.push(entry);
    } else {
      childRules.push({ selects, applied: entry });
    }
  }
  return { applied, childRules, partRules, descendantRules, exceptLastRules };
}

/** The classes of rules, in their order. */
function appliedOf(rules: readonly { readonly applied: Applied }[]): Applied[] {
  return rules.map((rule) => rule.applied);
}

/** Note that an element took each rule, on the entry that logs its class. */
function takeAll(rules: readonly { readonly logged: LoggedRule }[]): void {
  for (const rule of rules) {
    rule.logged.take();
  }
}

/**
 * Whether a utility is one of Tailwind's markers, `group` or `peer`, bare or named, which emit no
 * CSS and only name the element a `group-*` or `peer-*` variant reads.
 */
function isMarker(utility: string): boolean {
  return /^(?:group|peer)(?:\/.+)?$/.test(utility);
}

/** Declarations from outside the recipe, set on `part` at `rank`. */
function outerApplied(
  declarations: readonly OuterDeclaration[],
  part: string,
  rank: number,
  origin: Origin
): Applied[] {
  return declarations.map(({ className, property, value }) => ({
    part,
    className,
    origin,
    rank,
    specificity: [0, 0, 0],
    order: 0,
    declarations: [{ property, value }],
  }));
}

/**
 * Apply declarations over what a layer inherits, in cascade order: the host page's first, the
 * base layer's next, then the recipe classes that hold in the cell by the specificity of each
 * full class's compiled selector, with Tailwind's output order breaking a tie, and the element's
 * `style` attribute last. A variant does not always add specificity: `aria-invalid:` adds an
 * attribute, while fuse.css's `data-checked:` wraps its attribute in `:where()` and adds nothing, so
 * `aria-invalid:border-error` beats `data-checked:border-primary` though Tailwind emits it first.
 * An important declaration, which Tailwind's `!` suffix marks, beats every normal one (CSS Cascade 4
 * §6.1), so the important ones apply after them all, in the same order among themselves.
 *
 * @param parentOf - The parent's computed value of a property, which an `inherit` takes. A root with
 *   no host around it has no parent layer, and the page's declarations it inherits, each computed on
 *   the page, stand for that value.
 */
function computeStyle(
  layer: number,
  inherited: ComputedStyle,
  applied: readonly Applied[],
  parentOf: (property: string) => StyleEntry | undefined
): ComputedStyle {
  const style = new Map(inherited);
  const sorted = applied.toSorted(
    (left, right) =>
      left.rank - right.rank ||
      compareSpecificity(left.specificity, right.specificity) ||
      left.order - right.order
  );
  const declared = sorted.flatMap(({ part, className, origin, declarations, computedOutside }) =>
    declarations.map(({ property, value }) => ({
      part,
      className,
      origin,
      property,
      computedOutside,
      ...importance(value),
    }))
  );
  const ordered = [
    ...declared.filter(({ important }) => !important),
    ...declared.filter(({ important }) => important),
  ];
  const entries = ordered.flatMap(({ part, className, origin, property, value, computedOutside }) =>
    expandShorthand(property, value).map(([longhand, longValue]) => {
      const source: Provenance = { layer, part, className, origin, property: longhand, value: longValue };
      const entry: StyleEntry =
        computedOutside === undefined
          ? { value: longValue, source, consumed: [], computed: false }
          : { value: computedOutside(longValue), source, consumed: [], computed: true };
      return { source, entry };
    })
  );
  const outside = new Map(
    entries.flatMap(({ source, entry }) => (entry.computed ? [[source.property, entry] as const] : []))
  );
  const parentOrOutside = (property: string) => parentOf(property) ?? outside.get(property);
  for (const { source, entry } of entries) {
    style.set(
      source.property,
      inheritedKeyword(source, parentOrOutside) ?? inheritedCurrentColor(source, inherited) ?? entry
    );
  }
  return style;
}

/**
 * The declarations an element outside the root applies among themselves, as its own cascade
 * resolves them before the root inherits (CSS Cascade 4 §6): for each property as declared, the
 * last important declaration, or else the last one, with its importance taken off, since the root
 * inherits a value and no importance. The winners keep the order they were declared in.
 *
 * @param declarations - The element's declarations, in the order it applies them.
 * @returns The one declaration that wins each property.
 */
function cascadeOwn(declarations: readonly OuterDeclaration[]): readonly OuterDeclaration[] {
  const winners = new Map<string, { readonly at: number; readonly important: boolean }>();
  declarations.forEach((declaration, at) => {
    const { important } = importance(declaration.value);
    if (important || winners.get(declaration.property)?.important !== true) {
      winners.set(declaration.property, { at, important });
    }
  });
  return declarations.flatMap((declaration, at) =>
    winners.get(declaration.property)?.at === at
      ? [{ ...declaration, value: importance(declaration.value).value }]
      : []
  );
}

/** A declaration's value marked `!important`, which Tailwind prints after the value. */
const IMPORTANT = /\s*!important$/;

/**
 * Split a declaration's value from its importance.
 *
 * @param value - The value as the compiled rule holds it, `!important` included where it says so.
 * @returns The value without the mark, and whether it carried one.
 */
function importance(value: string) {
  return { value: value.replace(IMPORTANT, ""), important: IMPORTANT.test(value) };
}

/**
 * `inherit` computes to the parent's value of the property, inherited or not (CSS Cascade 4 §7.3),
 * as a meter fill's `height: inherit` takes its bar's height. The entry keeps the declaration as its
 * source and reads the parent's declaration, so the declaration lands in the coverage table with
 * what it resolved to, or with the invalid value a failed substitution outside left, which a read
 * leaves unmapped. Only where nothing outside holds an entry for the property does it take the
 * property's initial value, where {@link INITIAL_VALUES} holds one.
 *
 * @returns The parent's value under the declaration, or undefined for any other value or where
 *   neither the parent nor the initial values give one.
 */
function inheritedKeyword(
  source: Provenance,
  parentOf: (property: string) => StyleEntry | undefined
): StyleEntry | undefined {
  if (normalizeCss(source.value) !== "inherit") {
    return undefined;
  }
  const parent = parentOf(source.property);
  if (parent !== undefined) {
    return { value: parent.value, source, consumed: [parent.source, ...parent.consumed], computed: true };
  }
  const initial = INITIAL_VALUES.get(source.property);
  return initial === undefined ? undefined : { value: initial, source, consumed: [], computed: true };
}

/**
 * The value an inherited property starts with on the document's root, which an `inherit` takes where
 * nothing outside the element sets the property: `font-weight` is `normal`, 400 (CSS Fonts 4 §2.2),
 * since neither the docs page nor Tailwind's preflight sets a weight on `<html>` or `<body>`.
 */
const INITIAL_VALUES = new Map([["font-weight", "400"]]);

/** The longhands `white-space`'s keywords set (CSS Text 4 §3): `white-space-collapse`, then `text-wrap-mode`. */
const WHITE_SPACE = new Map([
  ["normal", ["collapse", "wrap"]],
  ["nowrap", ["collapse", "nowrap"]],
  ["pre", ["preserve", "nowrap"]],
  ["pre-wrap", ["preserve", "wrap"]],
  ["pre-line", ["preserve-breaks", "wrap"]],
  ["break-spaces", ["break-spaces", "wrap"]],
]);

/** The values of `text-wrap-mode`, one of the two `text-wrap` sets in any order (CSS Text 4 §6.1). */
const WRAP_MODES = new Set(["wrap", "nowrap"]);

/** The values of `text-wrap-style`, the other one `text-wrap` sets (CSS Text 4 §6.1). */
const WRAP_STYLES = new Set(["auto", "balance", "stable", "pretty"]);

/**
 * The longhands `white-space` and `text-wrap` set, which share `text-wrap-mode`, so the declaration
 * that sets it wins as the cascade decides: the nearer element's, and on one element the later in
 * cascade order. `white-space` sets `white-space-collapse` and `text-wrap-mode` by its keyword, and
 * `text-wrap` sets `text-wrap-mode` and `text-wrap-style`, each one it leaves out at its initial value,
 * `wrap` and `auto`. A value neither reads, such as a `var()` or a global keyword, sets each longhand
 * to itself, which an `inherit` takes and a read leaves unmapped otherwise.
 */
function wrappingLonghands(
  property: "white-space" | "text-wrap",
  value: string
): readonly (readonly [string, string])[] {
  const written = normalizeCss(value);
  if (property === "white-space") {
    const [collapse = written, mode = written] = WHITE_SPACE.get(written) ?? [];
    return [
      ["white-space-collapse", collapse],
      ["text-wrap-mode", mode],
    ];
  }
  const words = written.split(" ");
  const mode = words.filter((word) => WRAP_MODES.has(word));
  const style = words.filter((word) => WRAP_STYLES.has(word));
  return mode.length + style.length === words.length && mode.length <= 1 && style.length <= 1
    ? [
        ["text-wrap-mode", mode[0] ?? "wrap"],
        ["text-wrap-style", style[0] ?? "auto"],
      ]
    : [
        ["text-wrap-mode", value],
        ["text-wrap-style", value],
      ];
}

/**
 * `color: currentcolor` computes to the color the element inherits, as `text-current` keeps its
 * parent's text color. The entry keeps the class as its source and reads the inherited color's
 * declarations, so the class lands in the coverage table with what it resolved to.
 *
 * @returns The inherited color under the class, or undefined for any other declaration or when
 *   nothing passes a color down.
 */
function inheritedCurrentColor(source: Provenance, inherited: ComputedStyle): StyleEntry | undefined {
  const parent = inherited.get("color");
  if (source.property !== "color" || normalizeCss(source.value) !== "currentcolor" || parent === undefined) {
    return undefined;
  }
  return { value: parent.value, source, consumed: [parent.source, ...parent.consumed], computed: true };
}

/**
 * Split the padding, margin and inset shorthands into their physical sides, as Figma pads a box and
 * as a part's margin draws, and name a logical inset or margin by its physical side, keeping every other
 * property. Each side then cascades with the physical one, so a style attribute's `margin: 0` resets
 * a class's `mt-1`. A side may be a `calc()` with spaces, as `px-2.5` compiles to
 * `calc(var(--spacing) * 2.5)`. `white-space` and `text-wrap` split into their longhands, as
 * {@link wrappingLonghands} says.
 */
function expandShorthand(property: string, value: string): readonly (readonly [string, string])[] {
  const parts = splitTopLevel(normalizeCss(value), " ");
  const box = property === "padding" || property.startsWith("padding-") ? "padding" : "margin";
  switch (property) {
    case "padding":
    case "margin": {
      const [top = value, right = top, bottom = top, left = right] = parts;
      return [
        [`${box}-top`, top],
        [`${box}-right`, right],
        [`${box}-bottom`, bottom],
        [`${box}-left`, left],
      ];
    }
    case "padding-inline":
    case "margin-inline": {
      const [left = value, right = left] = parts;
      return [
        [`${box}-left`, left],
        [`${box}-right`, right],
      ];
    }
    case "padding-block":
    case "margin-block": {
      const [top = value, bottom = top] = parts;
      return [
        [`${box}-top`, top],
        [`${box}-bottom`, bottom],
      ];
    }
    // `inset` sets the four offsets as `margin` sets the four margins (CSS Position 3 §3.1).
    case "inset": {
      const [top = value, right = top, bottom = top, left = right] = parts;
      return [
        ["top", top],
        ["right", right],
        ["bottom", bottom],
        ["left", left],
      ];
    }
    // A left-to-right page puts the inline start on the left and its end on the right, and the block
    // start on top, where each cascades with the physical side (CSS Logical Properties 1 §4), as the
    // Sidebar container's `inset-y-0` sets its top and bottom.
    case "inset-inline": {
      const [left = value, right = left] = parts;
      return [
        ["left", left],
        ["right", right],
      ];
    }
    case "inset-block": {
      const [top = value, bottom = top] = parts;
      return [
        ["top", top],
        ["bottom", bottom],
      ];
    }
    case "inset-inline-start":
      return [["left", value]];
    case "inset-inline-end":
      return [["right", value]];
    case "margin-inline-start":
      return [["margin-left", value]];
    case "margin-inline-end":
      return [["margin-right", value]];
    case "margin-block-start":
      return [["margin-top", value]];
    case "margin-block-end":
      return [["margin-bottom", value]];
    case "white-space":
    case "text-wrap":
      return wrappingLonghands(property, value);
    default:
      return [[property, value]];
  }
}
