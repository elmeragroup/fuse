/**
 * The computed style of each layer of a cell, as a browser cascades it, and what read it. A layer is
 * one element of the cell, drawn or around the root, whose declarations apply over what it inherits
 * from the layer above it. The Figma mapping reads each layer's computed style through a
 * {@link LayerStyle}.
 *
 * Every declaration in a computed style names its provenance: the layer it applies to, the part and
 * class that set it, and the origin that owns its rows. A read records that provenance with what the
 * mapping made of it, and the spec fields the read fills. Who owns a row and where it goes live in
 * `coverage-log.ts`. Once the whole cell is mapped,
 * {@link CellLedger.settle} gives every declaration no layer read its row in the coverage table, so
 * coverage does not depend on the order the mapping visits the layers in.
 */
import type { BuildContext, Cell } from "./component-spec";
import type { CapturedAt, CoverageOutcome, CoverageRow, RecordedRow } from "./coverage";
import { routed } from "./coverage-log";
import type { Origin } from "./coverage-log";
import { normalizeCss, splitTopLevel, substituteVars } from "./css-values";
import type { ComponentRootSpec, FrameLayerSpec, IconLayerSpec, TextLayerSpec } from "./kit-spec";
/** What a read became, for the coverage table. */
export type CoverageNote = Pick<CoverageRow, "outcome" | "detail">;

/** Adds one row to the coverage table of the set. */
export type Recorder = (row: RecordedRow) => void;

/** The captured declarations a row of a source accounts for: the one it came from, or none for a synthetic one. */
function atOf(source: Provenance): Pick<RecordedRow, "at"> {
  return { at: source.at === undefined ? [] : [source.at] };
}

/**
 * Why `box-decoration-break` drops: `box-decoration-clone` gives each line of a wrapped inline box
 * its own edges and ring, as on a wrapped Link (CSS Fragmentation 3 §5.4).
 */
const ONE_LINE = "a kit cell sets its text on one line, so the box has no line fragments";

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
  // `fill` paints SVG shapes (SVG 2 §13.2), as a Tooltip arrow's `fill-foreground` would paint the
  // `<svg>` Base UI's arrow holds where a consumer renders one; the kit's arrow is a `<div>`.
  ["fill", "`fill` paints only an SVG shape, and no layer that reads it here draws one"],
  // `isolate` starts a stacking context (CSS Compositing 1 §3.3), as the overlay scrim's does.
  ["isolation", "a stacking context orders the box's own layers, which Figma draws in layer order already"],
  ["box-decoration-break", ONE_LINE],
  ["-webkit-box-decoration-break", ONE_LINE],
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
 * breaks a word there. A list's `list-style-type`, `list-style-image` and `list-style-position` inherit
 * (CSS Lists 3 §3), so an item reads the marker its list sets.
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
  "list-style",
  "list-style-type",
  "list-style-image",
  "list-style-position",
]);

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
  readonly composite: (row: RecordedRow, origin: Origin) => void;
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
export type Provenance = Declaration & {
  /** The id of the layer whose own cascade holds the declaration. */
  readonly layer: number;
  readonly origin: Origin;
  /** The captured declaration it came from, which its row accounts for; undefined for a synthetic one. */
  readonly at: CapturedAt | undefined;
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
export type StyleEntry = {
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

/** A layer's computed style, by property. */
export type ComputedStyle = ReadonlyMap<string, StyleEntry>;

/**
 * The names the capture gives a rule that selects through no class and that the page or the reset
 * sets on every element. A part that does not read such a declaration drops its row.
 */
const BASE_NAMES: ReadonlySet<string> = new Set(["fuse.css base layer", "tailwind preflight", "user agent"]);

/** One class or rule a layer applies, with what orders it in the cascade. */
export type Applied = {
  readonly part: string;
  readonly className: string;
  /** Who owns the rows of its declarations. */
  readonly origin: Origin;
  /**
   * Where it applies among a layer's declarations: -3 for the initial `<html>` font size no rule
   * declares, 0 for the winners the capture records, which Chromium's cascade already ordered, and 1
   * for a placement rule's synthetic declarations, which stand above them.
   */
  readonly rank: number;
  /** Its place among the declarations of its rank, the order the capture lists an element's winners in. */
  readonly order: number;
  /** The captured declaration it applies, whose row accounts for it; undefined for a synthetic one. */
  readonly at: CapturedAt | undefined;
  readonly declarations: readonly { readonly property: string; readonly value: string }[];
  /**
   * How an element outside computes the declarations' values, for declarations the element inherits
   * from it rather than sets, as the root inherits the page's. Undefined for the element's own.
   */
  readonly computedOutside?: (value: string) => string | undefined;
};

/**
 * What the boxes of a cell cascade with: the cell, the origin that owns their declarations, and where
 * a row that names no layer goes. An instance part's inner root and the layers below it cascade in a
 * scope of their own, whose `inPlace` takes the rows and fields of what they read.
 */
export type CellScope = {
  readonly cell: Cell;
  readonly context: BuildContext;
  readonly origin: Origin;
  readonly record: Recorder;
  readonly inPlace: InPlace | undefined;
};

/** A layer of the cell: its computed style, what read it, and the layers below it. */
export type Layer = {
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
export type AroundLayer = { readonly undrawn: string | undefined };

/**
 * The layers of one cell and what read their declarations. Ledgers of one cell share its layers, each
 * with the scope it cascades its boxes in.
 */
export class CellLedger {
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
      ...atOf(source),
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
          ...atOf(entry.source),
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
    if (BASE_NAMES.has(entry.source.className)) {
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

  /** The longhands the layer sets itself, as its cascade split them, in its order. */
  ownProperties(): readonly string[] {
    return [...this.#layer.style].flatMap(([property, entry]) =>
      entry.source.layer === this.#layer.id ? [property] : []
    );
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
        ...atOf(entry.source),
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
export function inheritsProperty(property: string, context: BuildContext): boolean {
  return property.startsWith("--")
    ? context.compiled.registeredProperties.get(property)?.inherits !== false
    : INHERITED_PROPERTIES.has(property);
}

/**
 * The declarations a child of a layer inherits, as CSS passes them down: the computed value of
 * each inherited property, with the layer's custom properties substituted, so a child that sets
 * one of them anew does not change what it inherited.
 */
export function inheritance(layer: Layer, context: BuildContext): ComputedStyle {
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
 * Apply declarations over what a layer inherits, by rank, then in order within a rank: the initial
 * `<html>` font size no rule declares, then the winners the capture records, which Chromium's
 * cascade already chose, one per longhand, in the order the capture lists them, then a placement
 * rule's synthetic declarations, which stand above them. Nothing here compares selectors. An
 * important declaration still applies after the normal ones of its layer (CSS Cascade 4 §6.1), in
 * the same order among themselves.
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
  const sorted = applied.toSorted((left, right) => left.rank - right.rank || left.order - right.order);
  const declared = sorted.flatMap(({ part, className, origin, declarations, computedOutside, at }) =>
    declarations.map(({ property, value }) => ({
      part,
      className,
      origin,
      property,
      computedOutside,
      at,
      ...importance(value),
    }))
  );
  const ordered = [
    ...declared.filter(({ important }) => !important),
    ...declared.filter(({ important }) => important),
  ];
  const entries = ordered.flatMap(({ part, className, origin, property, value, computedOutside, at }) =>
    expandShorthand(property, value).map(([longhand, longValue]) => {
      const source: Provenance = {
        layer,
        part,
        className,
        origin,
        property: longhand,
        value: longValue,
        at,
      };
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
 * since neither the docs page nor Tailwind's preflight sets a weight on `<html>` or `<body>`, and
 * `letter-spacing` is `normal` (CSS Text 3 §8.2), which preflight's `letter-spacing: inherit` on an
 * `<input>` takes.
 */
const INITIAL_VALUES = new Map([
  ["font-weight", "400"],
  ["letter-spacing", "normal"],
]);

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
 * parent's text color. CSS keywords match ASCII case-insensitively, and the shipped CSS a capture
 * reads writes `currentColor`. The entry keeps the class as its source and reads the inherited color's
 * declarations, so the class lands in the coverage table with what it resolved to.
 *
 * @returns The inherited color under the class, or undefined for any other declaration or when
 *   nothing passes a color down.
 */
function inheritedCurrentColor(source: Provenance, inherited: ComputedStyle): StyleEntry | undefined {
  const parent = inherited.get("color");
  if (
    source.property !== "color" ||
    normalizeCss(source.value).toLowerCase() !== "currentcolor" ||
    parent === undefined
  ) {
    return undefined;
  }
  return { value: parent.value, source, consumed: [parent.source, ...parent.consumed], computed: true };
}

/** The CSS-wide keywords, which a shorthand passes to each of its longhands (CSS Cascade 4 §7.3). */
const CSS_WIDE_KEYWORDS: ReadonlySet<string> = new Set([
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
]);

/**
 * `list-style` as its longhands, each part it leaves out at its initial value: `disc`, `outside` and
 * `none` (CSS Lists 3 §3.4). A `none` sets whichever of the type and the image the shorthand leaves
 * out, so `list-style: none` sets both, as Tailwind preflight writes it on every list. A CSS-wide
 * keyword sets every longhand to itself, so `list-style: inherit` takes the parent's type, image
 * and position alike.
 */
function listStyleLonghands(parts: readonly string[]): readonly (readonly [string, string])[] {
  const [only] = parts;
  if (parts.length === 1 && only !== undefined && CSS_WIDE_KEYWORDS.has(only.toLowerCase())) {
    return [
      ["list-style-type", only],
      ["list-style-position", only],
      ["list-style-image", only],
    ];
  }
  let type: string | undefined;
  let position: string | undefined;
  let image: string | undefined;
  const named = parts.filter((part) => part.toLowerCase() !== "none");
  for (const part of named) {
    const lower = part.toLowerCase();
    if (lower === "inside" || lower === "outside") {
      position = lower;
    } else if (/^(?:url|[a-z-]*gradient|image-set)\(/.test(lower)) {
      image = part;
    } else {
      type = part;
    }
  }
  if (named.length < parts.length) {
    image ??= "none";
    type ??= "none";
  }
  return [
    ["list-style-type", type ?? "disc"],
    ["list-style-position", position ?? "outside"],
    ["list-style-image", image ?? "none"],
  ];
}

/**
 * Split the padding, margin and inset shorthands into their physical sides, as Figma pads a box and
 * as a part's margin draws, and name a logical inset or margin by its physical side, keeping every other
 * property. Each side then cascades with the physical one, so a style attribute's `margin: 0` resets
 * a class's `mt-1`. A side may be a `calc()` with spaces, as `px-2.5` compiles to
 * `calc(var(--spacing) * 2.5)`. `white-space` and `text-wrap` split into their longhands, as
 * {@link wrappingLonghands} says.
 */
export function expandShorthand(property: string, value: string): readonly (readonly [string, string])[] {
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
    case "list-style":
      return listStyleLonghands(parts);
    case "white-space":
    case "text-wrap":
      return wrappingLonghands(property, value);
    default:
      return [[property, value]];
  }
}
