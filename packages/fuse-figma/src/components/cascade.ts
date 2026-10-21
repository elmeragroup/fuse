/**
 * The CSS cascade of a component set, cell by cell, as a browser runs it in one cascade layer.
 * Each box of a cell, the root or a part, cascades its own classes over what it inherits, and
 * each icon cascades the child-selector classes that reach it over what its box passes down.
 * The Figma mapping reads each layer's computed style through a {@link LayerStyle}.
 *
 * Every declaration in a computed style names its provenance: the layer it applies to, and the
 * part and class that set it. A read records that provenance with what the mapping made of it.
 * Once the whole cell is mapped, {@link CellCascade.settle} gives every declaration no layer
 * read its row in the coverage table, so coverage does not depend on the order the mapping
 * visits the layers in.
 */
import { splitClassName } from "./class-name";
import type { BuildContext, Cell, IconSlot, OuterDeclaration } from "./component-spec";
import type { CoverageOutcome, CoverageRow } from "./coverage";
import { normalizeCss, splitTopLevel, substituteVars } from "./css-values";
import { compareSpecificity } from "./specificity";
import type { Specificity } from "./specificity";
import type { StateTable, VariantMeaning } from "./state-table";

/** What a read became, for the coverage table. */
export type CoverageNote = Pick<CoverageRow, "outcome" | "detail">;

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
  ["transition-property", "Figma components do not animate"],
  ["transition-timing-function", "Figma components do not animate"],
  ["transition-duration", "Figma components do not animate"],
  // `shrink-0` keeps an element at its size, as Figma keeps every fixed or hugging child.
  ["flex-shrink", "Figma's auto layout does not shrink a fixed or hugging child"],
  ["outline-style", "Figma has no outline, and focus draws the ring"],
  // The plugin typings expose a text layer's `openTypeFeatures` as read-only, with no setter.
  ["font-variant-numeric", "the plugin API can read a text layer's OpenType features but not set them"],
]);

/**
 * The properties a child inherits from its parent, as CSS passes them down. Custom properties
 * inherit too, unless their `@property` says `inherits: false`.
 */
const INHERITED_PROPERTIES = new Set([
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
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

/** Where a declaration comes from: the layer it applies to, and the part and class that set it. */
type Provenance = {
  /** The id of the layer whose own cascade holds the declaration. */
  readonly layer: number;
  readonly part: string;
  readonly className: string;
  readonly property: string;
  /** The value as the class or rule sets it. */
  readonly value: string;
};

/** A declaration in a layer's computed style. */
type StyleEntry = {
  /** The value the layer reads: as set, or as its parent computed it when inherited. */
  readonly value: string;
  readonly source: Provenance;
  /**
   * The custom property declarations an inherited value read where its ancestor computed it,
   * which a read of the value reads too.
   */
  readonly consumed: readonly Provenance[];
};

type ComputedStyle = ReadonlyMap<string, StyleEntry>;

/** One class or rule a layer applies, with what orders it in the cascade. */
type Applied = {
  readonly part: string;
  readonly className: string;
  /** -2 for the host page, -1 for the base layer, 0 for every recipe class. */
  readonly rank: number;
  readonly specificity: Specificity;
  /** The class's place in Tailwind's output, which breaks a specificity tie. */
  readonly order: number;
  readonly declarations: readonly { readonly property: string; readonly value: string }[];
};

/** A class that styles the icons its child selectors pick. */
type ChildRule = {
  readonly selects: (slot: IconSlot) => boolean;
  readonly applied: Applied;
};

/** The recipe classes of one box that hold in a cell: its own, and the ones that reach icons. */
type BoxClasses = {
  readonly applied: readonly Applied[];
  readonly childRules: readonly ChildRule[];
};

/**
 * Each class with a condition variant, by part and class, with its condition variants, its
 * declarations, and whether they held together in some cell so far.
 */
type ConditionLog = Map<
  string,
  {
    readonly part: string;
    readonly className: string;
    readonly held: boolean;
    readonly variants: readonly string[];
    readonly declarations: Applied["declarations"];
  }
>;

/** The cascade of every cell of one component set. */
export class SetCascade {
  readonly #meaningOf: StateTable;
  readonly #context: BuildContext;
  readonly #record: Recorder;
  readonly #conditions: ConditionLog = new Map();

  /**
   * @param meaningOf - The definition's state table.
   * @param context - The compiled utilities, the synced variables, and the page and base
   *   declarations.
   * @param record - Adds a row to the set's coverage table.
   */
  constructor(meaningOf: StateTable, context: BuildContext, record: Recorder) {
    this.#meaningOf = meaningOf;
    this.#context = context;
    this.#record = record;
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
      record: this.#record,
      conditions: this.#conditions,
    });
  }

  /**
   * Record the classes whose variants never held in one cell together, such as
   * `aria-invalid:focus-visible:` on a set that draws invalid and focus as two values of its
   * state axis. Call it after every cell.
   */
  finish(): void {
    for (const { part, className, held, variants, declarations } of this.#conditions.values()) {
      if (held || variants.length < 2) {
        continue;
      }
      for (const declaration of declarations) {
        this.#record({
          part,
          className,
          property: declaration.property,
          value: declaration.value,
          outcome: "dropped",
          detail: `no cell of the matrix shows ${variants.map((variant) => `\`${variant}\``).join(" and ")} at once`,
        });
      }
    }
  }
}

type CellScope = {
  readonly meaningOf: StateTable;
  readonly cell: Cell;
  readonly context: BuildContext;
  readonly record: Recorder;
  readonly conditions: ConditionLog;
};

/** A layer of the cell: its computed style, what read it, and the layers below it. */
type Layer = {
  readonly id: number;
  readonly style: ComputedStyle;
  /** The own declarations some layer of the cell read, by property. */
  readonly read: Set<string>;
  /** What became of an own declaration the mapping used without reading through it. */
  readonly marks: Map<string, CoverageNote>;
  readonly children: number[];
};

/** The layers of one cell and what read their declarations. */
class CellLedger {
  readonly scope: CellScope;
  readonly #layers: Layer[] = [];

  constructor(scope: CellScope) {
    this.scope = scope;
  }

  /** Add a layer whose computed style is `applied` over `inherited`, below `parent`. */
  add(inherited: ComputedStyle, applied: readonly Applied[], parent: Layer | undefined): Layer {
    const id = this.#layers.length;
    const layer: Layer = {
      id,
      style: computeStyle(id, inherited, applied),
      read: new Set(),
      marks: new Map(),
      children: [],
    };
    this.#layers.push(layer);
    parent?.children.push(id);
    return layer;
  }

  /** Record a read of a declaration, under the part and class that set it. */
  noteRead(source: Provenance, note: CoverageNote): void {
    this.#layers[source.layer]?.read.add(source.property);
    this.scope.record({
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
        this.scope.record({
          part: entry.source.part,
          className: entry.source.className,
          property,
          value: entry.source.value,
          ...(layer.marks.get(property) ?? this.#unread(property, entry)),
        });
      }
    };
    visit(0);
  }

  /** What became of a declaration no layer read. */
  #unread(property: string, entry: StyleEntry): CoverageNote {
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
    return property.startsWith("--tw-")
      ? { outcome: "dropped", detail: "Tailwind's bookkeeping, which no mapped property reads" }
      : { outcome: "unmapped", detail: "the builder maps no Figma field from it" };
  }
}

/** The cascade of one cell. */
export class CellCascade {
  readonly #ledger: CellLedger;

  constructor(scope: CellScope) {
    this.#ledger = new CellLedger(scope);
  }

  /**
   * Cascade the root over the host page's declarations.
   *
   * @param classes - The root's class string for the cell.
   * @param part - The root's layer name, which the coverage table names.
   * @returns The root's cascade.
   */
  root(classes: string, part: string): BoxCascade {
    const page = outerApplied(this.#ledger.scope.context.page, part, -2);
    return cascadeBox(this.#ledger, { classes, part, inherited: new Map(), outer: page, ancestorRules: [] });
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

function cascadeBox(
  ledger: CellLedger,
  box: {
    readonly classes: string;
    readonly part: string;
    readonly inherited: ComputedStyle;
    readonly outer: readonly Applied[];
    readonly ancestorRules: readonly ChildRule[];
  },
  parent?: Layer
): BoxCascade {
  const own = boxClasses(box.classes, box.part, ledger.scope);
  const base = outerApplied(ledger.scope.context.base, box.part, -1);
  const layer = ledger.add(box.inherited, [...box.outer, ...base, ...own.applied], parent);
  return new BoxCascade(ledger, layer, box.ancestorRules, own.childRules);
}

/**
 * The cascade of one box, the root or a part: its own style, and the cascades of the parts and
 * icons below it.
 */
export class BoxCascade {
  /** The box's computed style. */
  readonly style: LayerStyle;
  readonly #ledger: CellLedger;
  readonly #layer: Layer;
  readonly #ancestorRules: readonly ChildRule[];
  readonly #ownRules: readonly ChildRule[];

  constructor(
    ledger: CellLedger,
    layer: Layer,
    ancestorRules: readonly ChildRule[],
    ownRules: readonly ChildRule[]
  ) {
    this.style = new LayerStyle(ledger, layer);
    this.#ledger = ledger;
    this.#layer = layer;
    this.#ancestorRules = ancestorRules;
    this.#ownRules = ownRules;
  }

  /**
   * Cascade a part directly below this box, over what this box passes down.
   *
   * @param classes - The part's class string for the cell.
   * @param part - The part's layer name.
   * @returns The part's cascade.
   */
  part(classes: string, part: string): BoxCascade {
    return cascadeBox(
      this.#ledger,
      {
        classes,
        part,
        inherited: inheritance(this.#layer, this.#ledger.scope.context),
        outer: [],
        ancestorRules: [...this.#ancestorRules, ...this.#ownRules],
      },
      this.#layer
    );
  }

  /**
   * Cascade an icon this box lists, over what this box passes down. A child selector on this
   * box reaches the icon as the selector says. One on a box above reaches it as a descendant,
   * never as a direct child.
   *
   * @param slot - The icon.
   * @returns The icon's computed style.
   */
  icon(slot: IconSlot): LayerStyle {
    const selected = [
      ...this.#ancestorRules.filter((rule) => rule.selects({ ...slot, direct: false })),
      ...this.#ownRules.filter((rule) => rule.selects(slot)),
    ];
    const layer = this.#ledger.add(
      inheritance(this.#layer, this.#ledger.scope.context),
      selected.map((rule) => rule.applied),
      this.#layer
    );
    return new LayerStyle(this.#ledger, layer);
  }
}

/**
 * Reads one layer's computed style. Each read substitutes Tailwind's own variables and records
 * every declaration it read, the custom properties among them, under the part and class that set
 * each one.
 */
export class LayerStyle {
  readonly #ledger: CellLedger;
  readonly #layer: Layer;

  constructor(ledger: CellLedger, layer: Layer) {
    this.#ledger = ledger;
    this.#layer = layer;
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
   * The computed value with Tailwind's variables substituted, without recording a read, for a
   * mapping that decides from several properties whether to read any of them.
   */
  resolved(property: string): string | undefined {
    const entry = this.#layer.style.get(property);
    return entry === undefined
      ? undefined
      : substitute(this.#layer, this.#ledger.scope.context, entry.value, new Set());
  }

  /**
   * Note what became of a declaration the layer sets itself, used without reading through it.
   * A read of the declaration anywhere in the cell takes precedence.
   */
  mark(property: string, outcome: CoverageOutcome, detail: string): void {
    const entry = this.#layer.style.get(property);
    if (entry !== undefined && entry.source.layer === this.#layer.id) {
      this.#layer.marks.set(property, { outcome, detail });
    }
  }

  /**
   * Record a property the layer needs and its cascade leaves unset, as unmapped, under the
   * class that set the property needing it.
   */
  missing(property: string, neededBy: string, detail: string): void {
    const entry = this.#layer.style.get(neededBy);
    if (entry !== undefined && !this.#layer.style.has(property)) {
      this.#ledger.scope.record({
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
   * @returns The mapped value, or undefined when the property is unset or does not map.
   */
  read<T>(
    property: string,
    map: (value: string) => T | undefined,
    describe: (mapped: T) => CoverageNote
  ): T | undefined {
    const entry = this.#layer.style.get(property);
    if (entry === undefined) {
      return undefined;
    }
    const read = new Set<string>();
    const resolved = substitute(this.#layer, this.#ledger.scope.context, entry.value, read);
    const mapped = resolved === undefined ? undefined : map(resolved);
    const note =
      mapped === undefined
        ? { outcome: "unmapped" as const, detail: `no Figma field reads ${resolved ?? entry.value}` }
        : describe(mapped);
    for (const source of sourcesOf(this.#layer, entry, read)) {
      this.#ledger.noteRead(source, note);
    }
    return mapped;
  }
}

/**
 * The declarations a child of a layer inherits, as CSS passes them down: the computed value of
 * each inherited property, with the layer's custom properties substituted, so a child that sets
 * one of them anew does not change what it inherited.
 */
function inheritance(layer: Layer, context: BuildContext): ComputedStyle {
  const passed = new Map<string, StyleEntry>();
  for (const [property, entry] of layer.style) {
    const inherits = property.startsWith("--")
      ? context.compiled.registeredProperties.get(property)?.inherits !== false
      : INHERITED_PROPERTIES.has(property);
    const read = new Set<string>();
    const value = inherits ? substitute(layer, context, entry.value, read) : undefined;
    if (value !== undefined) {
      const [, ...consumed] = sourcesOf(layer, entry, read);
      passed.set(property, { value, source: entry.source, consumed });
    }
  }
  return passed;
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
 * Substitute Tailwind's custom properties in a value: the layer's own, then the theme's, then
 * the registered initial value. Synced variables stay `var()` references.
 */
function substitute(
  layer: Layer,
  context: BuildContext,
  value: string,
  read: Set<string>
): string | undefined {
  return substituteVars(
    value,
    (name) =>
      layer.style.get(name)?.value ??
      context.compiled.themeValues.get(name) ??
      context.compiled.registeredProperties.get(name)?.initialValue,
    context.variables.owns,
    read
  );
}

/**
 * Sort a box's classes for one cell by their variants. A class with a child selector styles the
 * icons it reaches, a class whose variants hold styles the box, and a class with a variant no
 * cell shows or the definition does not model lands in the coverage table.
 */
function boxClasses(classes: string, part: string, scope: CellScope): BoxClasses {
  const { meaningOf, cell, context, record, conditions } = scope;
  const applied: Applied[] = [];
  const childRules: ChildRule[] = [];
  for (const className of splitClasses(classes)) {
    const { variants, utility } = splitClassName(className);
    const rule = context.compiled.rules.get(utility);
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
    let selects: ((slot: IconSlot) => boolean) | undefined;
    const conditionVariants: string[] = [];
    let holds = true;
    let skipped: CoverageNote | undefined;
    for (const variant of variants) {
      const meaning = meaningOf(variant);
      if (meaning.kind === "child") {
        const outer = selects;
        selects = outer === undefined ? meaning.selects : (slot) => outer(slot) && meaning.selects(slot);
        continue;
      }
      if (meaning.kind !== "condition") {
        skipped = skippedNote(variant, meaning);
        break;
      }
      conditionVariants.push(variant);
      holds &&= meaning.holds(cell);
    }
    if (skipped !== undefined) {
      for (const declaration of rule.declarations) {
        record({ part, className, property: declaration.property, value: declaration.value, ...skipped });
      }
      continue;
    }
    if (conditionVariants.length > 0) {
      const key = JSON.stringify([part, className]);
      conditions.set(key, {
        part,
        className,
        held: holds || conditions.get(key)?.held === true,
        variants: conditionVariants,
        declarations: rule.declarations,
      });
    }
    if (!holds) {
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
    const entry = { part, className, rank: 0, ...placement, declarations: rule.declarations };
    if (selects === undefined) {
      applied.push(entry);
    } else {
      childRules.push({ selects, applied: entry });
    }
  }
  return { applied, childRules };
}

/** What becomes of a class whose variant applies it in no cell the kit draws. */
function skippedNote(
  variant: string,
  meaning: Exclude<VariantMeaning, { readonly kind: "condition" | "child" }>
): CoverageNote {
  switch (meaning.kind) {
    case "omitted":
      return { outcome: "dropped", detail: `no cell of the matrix shows \`${variant}\`` };
    case "omitted-element":
      return { outcome: "dropped", detail: meaning.reason };
    case "unmodelled":
      return { outcome: "unmapped", detail: `the definition neither models nor omits \`${variant}\`` };
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
function outerApplied(declarations: readonly OuterDeclaration[], part: string, rank: number): Applied[] {
  return declarations.map(({ className, property, value }) => ({
    part,
    className,
    rank,
    specificity: [0, 0, 0],
    order: 0,
    declarations: [{ property, value }],
  }));
}

/**
 * Apply declarations over what a layer inherits, in cascade order: the host page's first, the
 * base layer's next, then the recipe classes that hold in the cell by the specificity of each
 * full class's compiled selector, with Tailwind's output order breaking a tie. A variant does not
 * always add specificity: `aria-invalid:` adds an attribute, while fuse.css's `data-checked:`
 * wraps its attribute in `:where()` and adds nothing, so `aria-invalid:border-error` beats
 * `data-checked:border-primary` though Tailwind emits it first.
 */
function computeStyle(layer: number, inherited: ComputedStyle, applied: readonly Applied[]): ComputedStyle {
  const style = new Map(inherited);
  const sorted = applied.toSorted(
    (left, right) =>
      left.rank - right.rank ||
      compareSpecificity(left.specificity, right.specificity) ||
      left.order - right.order
  );
  for (const { part, className, declarations } of sorted) {
    for (const { property, value } of declarations) {
      for (const [longhand, longValue] of expandShorthand(property, value)) {
        const source = { layer, part, className, property: longhand, value: longValue };
        style.set(
          longhand,
          inheritedCurrentColor(source, inherited) ?? { value: longValue, source, consumed: [] }
        );
      }
    }
  }
  return style;
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
  return { value: parent.value, source, consumed: [parent.source, ...parent.consumed] };
}

/**
 * Split the padding shorthands into the sides Figma pads, keeping every other property. A side
 * may be a `calc()` with spaces, as `px-2.5` compiles to `calc(var(--spacing) * 2.5)`.
 */
function expandShorthand(property: string, value: string): readonly (readonly [string, string])[] {
  const parts = splitTopLevel(normalizeCss(value), " ");
  switch (property) {
    case "padding": {
      const [top = value, right = top, bottom = top, left = right] = parts;
      return [
        ["padding-top", top],
        ["padding-right", right],
        ["padding-bottom", bottom],
        ["padding-left", left],
      ];
    }
    case "padding-inline": {
      const [left = value, right = left] = parts;
      return [
        ["padding-left", left],
        ["padding-right", right],
      ];
    }
    case "padding-block": {
      const [top = value, bottom = top] = parts;
      return [
        ["padding-top", top],
        ["padding-bottom", bottom],
      ];
    }
    default:
      return [[property, value]];
  }
}
