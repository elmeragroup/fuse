/**
 * The CSS cascade of a component set, cell by cell, as a browser runs it in one cascade layer.
 * Each box of a cell, the root or a part, cascades its own classes over what it inherits, and a
 * part's style attribute over its classes. Each icon cascades its own classes and the
 * child-selector classes that reach it over what its box passes down.
 * The Figma mapping reads each layer's computed style through a {@link LayerStyle}.
 *
 * Every declaration in a computed style names its provenance: the layer it applies to, and the
 * part and class that set it. A read records that provenance with what the mapping made of it.
 * Once the whole cell is mapped, {@link CellCascade.settle} gives every declaration no layer
 * read its row in the coverage table, so coverage does not depend on the order the mapping
 * visits the layers in.
 */
import { splitClassName } from "./class-name";
import type { BuildContext, Cell, IconSlot, InlineDeclaration, OuterDeclaration } from "./component-spec";
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
  ["animation", "Figma components do not animate"],
  // `shrink-0` keeps an element at its size, as Figma keeps every fixed or hugging child.
  ["flex-shrink", "Figma's auto layout does not shrink a fixed or hugging child"],
  ["outline-style", "Figma has no outline, and focus draws the ring"],
  // The plugin typings expose a text layer's `openTypeFeatures` as read-only, with no setter.
  ["font-variant-numeric", "the plugin API can read a text layer's OpenType features but not set them"],
]);

/**
 * The properties a child inherits from its parent, as CSS passes them down. Custom properties
 * inherit too, unless their `@property` says `inherits: false`. `white-space` and `text-align`
 * inherit, so a `truncate` on a box keeps the label of a part below it on one line, while the
 * `overflow` and `text-overflow` it also sets stay on the box.
 */
const INHERITED_PROPERTIES = new Set([
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "white-space",
  "text-align",
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

/** How the coverage table names a declaration of an element's `style` attribute, in place of a class. */
const INLINE_STYLE = "inline style";

/** The rank of a style attribute's declarations, above every class (CSS Cascade 4 §6.2). */
const INLINE_RANK = 1;

/** One class or rule a layer applies, with what orders it in the cascade. */
type Applied = {
  readonly part: string;
  readonly className: string;
  /**
   * -2 for the host page and the root's ancestors, -1 for the base layer, 0 for every recipe class,
   * and 1 for the element's `style` attribute.
   */
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
  /**
   * Whether the layer stands for the elements around the root, the page and its nearer ancestors,
   * which the kit draws no layer for and whose computed values the root inherits.
   */
  readonly around: boolean;
};

/** The layers of one cell and what read their declarations. */
class CellLedger {
  readonly scope: CellScope;
  readonly #layers: Layer[] = [];

  constructor(scope: CellScope) {
    this.scope = scope;
  }

  /**
   * Add a layer whose computed style is `applied` over `inherited`, below `parent`. `kind` says
   * whether the kit draws the layer, or it stands for the elements around the root.
   */
  add(
    inherited: ComputedStyle,
    applied: readonly Applied[],
    parent: Layer | undefined,
    kind: "drawn" | "around" = "drawn"
  ): Layer {
    const id = this.#layers.length;
    const { context } = this.scope;
    const layer: Layer = {
      id,
      style: computeStyle(id, inherited, applied, (property) => parentValue(parent, context, property)),
      read: new Set(),
      marks: new Map(),
      children: [],
      around: kind === "around",
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
          ...(layer.marks.get(property) ?? this.#unread(property, entry, layer)),
        });
      }
    };
    visit(0);
  }

  /** What became of a declaration no layer read, on the layer that sets it. */
  #unread(property: string, entry: StyleEntry, layer: Layer): CoverageNote {
    if (layer.around && this.#overriddenBelow(layer, property)) {
      return { outcome: "dropped", detail: "the root sets its own, so it does not inherit this" };
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
    // A custom property draws nothing and the layer's own reads count already, so an unread one only
    // passes its value down. With no part or icon below, nothing takes it, as the field box's shell
    // corners pass a corner to parts an Input does not have. A synced variable stays unmapped, since
    // substitution keeps it as its `var()` and never reads a local override, which the browser paints.
    if (
      property.startsWith("--") &&
      layer.children.length === 0 &&
      !this.scope.context.variables.owns(property)
    ) {
      return {
        outcome: "dropped",
        detail: "a custom property passes its value down, and the box holds no part or icon to take it",
      };
    }
    return { outcome: "unmapped", detail: "the builder maps no Figma field from it" };
  }

  /** Whether the root below the layer around it sets the property itself, over what it inherits. */
  #overriddenBelow(around: Layer, property: string): boolean {
    return around.children.some((id) => {
      const source = this.#layers[id]?.style.get(property)?.source.layer;
      return source !== undefined && source !== around.id;
    });
  }
}

/** The cascade of one cell. */
export class CellCascade {
  readonly #ledger: CellLedger;

  constructor(scope: CellScope) {
    this.#ledger = new CellLedger(scope);
  }

  /**
   * Cascade the root over the host page's declarations and its ancestors'. Without ancestors, the
   * page's declarations apply on the root below its own classes. With them, the page and the
   * ancestors compute a style of their own, the ancestors' declarations after the page's, since
   * they sit nearer the root, and the root inherits its computed values as a part inherits its
   * parent's. So an ancestor's `var()` resolves against the ancestor's custom properties, the
   * root's `currentcolor` takes the inherited color, and every declaration of the root's own beats
   * them.
   *
   * @param classes - The root's class string for the cell.
   * @param part - The root's layer name, which the coverage table names.
   * @param ancestors - The declarations the elements between the page and the root set in the cell.
   * @returns The root's cascade.
   */
  root(classes: string, part: string, ancestors: readonly OuterDeclaration[]): BoxCascade {
    const { context } = this.#ledger.scope;
    const page = outerApplied(context.page, part, -2);
    if (ancestors.length === 0) {
      return cascadeBox(this.#ledger, {
        classes,
        part,
        inherited: new Map(),
        outer: page,
        ancestorRules: [],
      });
    }
    // The sort in `computeStyle` is stable, so at one rank the ancestors' declarations apply last.
    const around = this.#ledger.add(
      new Map(),
      [...page, ...outerApplied(ancestors, part, -2)],
      undefined,
      "around"
    );
    return cascadeBox(
      this.#ledger,
      { classes, part, inherited: inheritance(around, context), outer: [], ancestorRules: [] },
      around
    );
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
   * @param inline - The declarations of the part's `style` attribute, which beat every class.
   * @returns The part's cascade.
   */
  part(classes: string, part: string, inline: readonly InlineDeclaration[] = []): BoxCascade {
    return cascadeBox(
      this.#ledger,
      {
        classes,
        part,
        inherited: inheritance(this.#layer, this.#ledger.scope.context),
        outer: outerApplied(
          inline.map((declaration) => ({ className: INLINE_STYLE, ...declaration })),
          part,
          INLINE_RANK
        ),
        ancestorRules: [...this.#ancestorRules, ...this.#ownRules],
      },
      this.#layer
    );
  }

  /**
   * Cascade an icon this box lists, over what this box passes down. A child selector on this
   * box reaches the icon as the selector says. One on a box above reaches it as a descendant,
   * never as a direct child. The icon's own classes cascade with them by specificity, so a box's
   * `[&_svg]:size-4` (0,1,1) beats the icon's own `size-6` (0,1,0), as in CSS.
   *
   * @param slot - The icon.
   * @returns The icon's computed style.
   * @throws When one of the icon's own classes has a child selector, which the builder does not
   *   model inside an icon.
   */
  icon(slot: IconSlot): LayerStyle {
    const selected = [
      ...this.#ancestorRules.filter((rule) => rule.selects({ ...slot, direct: false })),
      ...this.#ownRules.filter((rule) => rule.selects(slot)),
    ];
    const own = boxClasses(slot.classes ?? "", slot.name, this.#ledger.scope);
    const [nested] = own.childRules;
    if (nested !== undefined) {
      throw new Error(`the ${slot.name}'s own class ${nested.applied.className} selects inside the icon`);
    }
    const layer = this.#ledger.add(
      inheritance(this.#layer, this.#ledger.scope.context),
      [...selected.map((rule) => rule.applied), ...own.applied],
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

/**
 * A parent's computed value of a property, inherited or not, with the parent's custom properties
 * substituted, as a child's `inherit` takes it.
 *
 * @returns The value under the parent's declaration, or undefined where the parent sets none.
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
  const read = new Set<string>();
  const value = substitute(parent, context, entry.value, read);
  if (value === undefined) {
    return undefined;
  }
  const [, ...consumed] = sourcesOf(parent, entry, read);
  return { value, source: entry.source, consumed };
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
    case "omitted-for":
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
 * full class's compiled selector, with Tailwind's output order breaking a tie, and the element's
 * `style` attribute last. A variant does not always add specificity: `aria-invalid:` adds an
 * attribute, while fuse.css's `data-checked:` wraps its attribute in `:where()` and adds nothing, so
 * `aria-invalid:border-error` beats `data-checked:border-primary` though Tailwind emits it first.
 *
 * @param parentOf - The parent's computed value of a property, which an `inherit` takes.
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
  for (const { part, className, declarations } of sorted) {
    for (const { property, value } of declarations) {
      for (const [longhand, longValue] of expandShorthand(property, value)) {
        const source = { layer, part, className, property: longhand, value: longValue };
        style.set(
          longhand,
          inheritedKeyword(source, parentOf) ??
            inheritedCurrentColor(source, inherited) ?? { value: longValue, source, consumed: [] }
        );
      }
    }
  }
  return style;
}

/**
 * `inherit` computes to the parent's value of the property, inherited or not (CSS Cascade 4 §7.3),
 * as a meter fill's `height: inherit` takes its bar's height. The entry keeps the declaration as its
 * source and reads the parent's declaration, so the declaration lands in the coverage table with
 * what it resolved to.
 *
 * @returns The parent's value under the declaration, or undefined for any other value or where the
 *   parent sets no value of the property.
 */
function inheritedKeyword(
  source: Provenance,
  parentOf: (property: string) => StyleEntry | undefined
): StyleEntry | undefined {
  const parent = normalizeCss(source.value) === "inherit" ? parentOf(source.property) : undefined;
  return parent === undefined
    ? undefined
    : { value: parent.value, source, consumed: [parent.source, ...parent.consumed] };
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
 * Split the padding shorthands into the sides Figma pads, and name a logical inset by its physical
 * side, keeping every other property. A side may be a `calc()` with spaces, as `px-2.5` compiles to
 * `calc(var(--spacing) * 2.5)`.
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
    // A left-to-right page puts the inline start on the left and its end on the right, where each
    // cascades with the physical side (CSS Logical Properties 1 §4).
    case "inset-inline-start":
      return [["left", value]];
    case "inset-inline-end":
      return [["right", value]];
    default:
      return [[property, value]];
  }
}
