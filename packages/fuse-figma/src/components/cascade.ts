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
import type {
  AncestorDefinition,
  BuildContext,
  Cell,
  IconSlot,
  InlineDeclaration,
  OuterDeclaration,
} from "./component-spec";
import type { CoverageOutcome, CoverageRow } from "./coverage";
import { normalizeCss, splitTopLevel, substituteVars } from "./css-values";
import { compareSpecificity } from "./specificity";
import type { Specificity } from "./specificity";
import { readVariants } from "./state-table";
import type { PartTarget, StateTable } from "./state-table";

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
 * inherit too, unless their `@property` says `inherits: false`. `white-space` and `text-align`
 * inherit, so a `truncate` on a box keeps the label of a part below it on one line, while the
 * `overflow` and `text-overflow` it also sets stay on the box. `text-wrap` sets `text-wrap-mode`
 * and `text-wrap-style`, which inherit (CSS Text 4 §6.1), so a part's label wraps as Empty's
 * `text-balance` on the root says.
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
  "text-wrap",
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
type Applied = {
  readonly part: string;
  readonly className: string;
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
type PartRule = {
  readonly target: PartTarget;
  readonly applied: Applied;
};

/**
 * The recipe classes of one box that hold in a cell: its own, the ones that reach icons, and the ones
 * that reach its child parts.
 */
type BoxClasses = {
  readonly applied: readonly Applied[];
  readonly childRules: readonly ChildRule[];
  readonly partRules: readonly PartRule[];
};

/**
 * Each class that styles a child part, by part and class, with the parts it names, its
 * declarations, and whether such a part took it in some cell so far.
 */
type PartRuleLog = Map<
  string,
  {
    readonly part: string;
    readonly className: string;
    readonly target: PartTarget;
    readonly taken: boolean;
    readonly declarations: Applied["declarations"];
  }
>;

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
  readonly #partRules: PartRuleLog = new Map();

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
      partRules: this.#partRules,
    });
  }

  /**
   * Record the classes whose variants never held in one cell together, such as
   * `aria-invalid:focus-visible:` on a set that draws invalid and focus as two values of its
   * state axis, or whose one variant never held in a cell that gives the class, as Calendar's day
   * cell gives `hover:bg-transparent` only while disabled, and as unmapped the classes that style a
   * child part no part of the definition took, since they style nothing the set draws. Call it
   * after every cell.
   */
  finish(): void {
    for (const { part, className, target, taken, declarations } of this.#partRules.values()) {
      if (taken) {
        continue;
      }
      for (const declaration of declarations) {
        this.#record({
          part,
          className,
          property: declaration.property,
          value: declaration.value,
          outcome: "unmapped",
          detail:
            target.kind === "slot"
              ? `the definition draws no part with \`data-slot=${target.slot}\` below ${part}`
              : `the definition draws no \`<${target.tag}>\` part below ${part}`,
        });
      }
    }
    for (const { part, className, held, variants, declarations } of this.#conditions.values()) {
      if (held) {
        continue;
      }
      const named = variants.map((variant) => `\`${variant}\``);
      const detail =
        named.length === 1
          ? `no cell that gives the box this class shows ${named.join("")}`
          : `no cell of the matrix shows ${named.join(" and ")} at once`;
      for (const declaration of declarations) {
        this.#record({
          part,
          className,
          property: declaration.property,
          value: declaration.value,
          outcome: "dropped",
          detail,
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
  readonly partRules: PartRuleLog;
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

/** The layers of one cell and what read their declarations. */
class CellLedger {
  readonly scope: CellScope;
  readonly #layers: Layer[] = [];

  constructor(scope: CellScope) {
    this.scope = scope;
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

  constructor(scope: CellScope) {
    this.#ledger = new CellLedger(scope);
  }

  /**
   * Cascade the root over the host page's declarations and the elements around it. Without any, the
   * page's declarations apply on the root below its own classes. With them, the page and the host's
   * declarations compute a style of their own, the host's after the page's, since they sit nearer
   * the root. Each ancestor named by its classes then computes its own style over what it inherits
   * from the element outside it, outermost first, its classes cascading with the cell's states and
   * facts as the root's do. The root inherits the innermost computed values as a part inherits its
   * parent's. So an ancestor's `var()` resolves against the ancestor's custom properties, a nearer
   * ancestor's own declaration beats what it inherits from a farther one, the root's `currentcolor`
   * takes the inherited color, and every declaration of the root's own beats them. A child selector
   * of an ancestor reaches the root's icons as a descendant. An ancestor's `*:data-[slot=…]:` reaches
   * no part, so `SetCascade.finish` leaves it unmapped.
   *
   * @param classes - The root's class string for the cell.
   * @param part - The root's layer name, which the coverage table names.
   * @param around - The declarations the host sets around the root in the cell, the ancestors
   *   named by their classes, outermost first, and the declarations the browser's default style
   *   sheet gives the root's element, which apply on the root below everything else.
   * @returns The root's cascade.
   */
  root(
    classes: string,
    part: string,
    around: {
      readonly declarations: readonly OuterDeclaration[];
      readonly ancestors: readonly AncestorDefinition[];
      readonly defaults: readonly OuterDeclaration[];
    }
  ): BoxCascade {
    const { context } = this.#ledger.scope;
    const page = outerApplied(context.page, part, -2);
    const defaults = outerApplied(around.defaults, part, ELEMENT_DEFAULT_RANK);
    if (around.declarations.length === 0 && around.ancestors.length === 0) {
      // The page's declarations apply on the root as declarations the root inherits, each computed
      // on the page, so the root's own custom properties reach none of them, and the coverage table
      // keeps them under the root, as it lists what the root reads and what it overrides.
      const computedOutside = pageValue(context);
      return cascadeBox(this.#ledger, {
        classes,
        part,
        inherited: new Map(),
        outer: [...defaults, ...page.map((applied) => ({ ...applied, computedOutside }))],
        ancestorRules: [],
        ancestorPartRules: [],
        selected: [],
      });
    }
    // The sort in `computeStyle` is stable, so at one rank the host's declarations apply last.
    let outside = this.#ledger.add(
      new Map(),
      [...page, ...outerApplied(around.declarations, part, -2)],
      undefined,
      { undrawn: undefined }
    );
    const ancestorRules: ChildRule[] = [];
    for (const ancestor of around.ancestors) {
      const own = boxClasses(ancestor.classes, ancestor.slot, this.#ledger.scope);
      outside = this.#ledger.add(inheritance(outside, context), own.applied, outside, {
        undrawn: ancestor.undrawn,
      });
      ancestorRules.push(...own.childRules);
    }
    return cascadeBox(
      this.#ledger,
      {
        classes,
        part,
        inherited: inheritance(outside, context),
        outer: defaults,
        ancestorRules,
        ancestorPartRules: [],
        selected: [],
      },
      outside
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
    /** The tag rules of the boxes above, such as `[&_img]:`, which reach parts at any depth. */
    readonly ancestorPartRules: readonly PartRule[];
    /** The parent's classes that style this box as its child, which cascade with its own. */
    readonly selected: readonly Applied[];
  },
  parent?: Layer
): BoxCascade {
  const own = boxClasses(box.classes, box.part, ledger.scope);
  const base = outerApplied(ledger.scope.context.base, box.part, -1);
  const layer = ledger.add(box.inherited, [...box.outer, ...base, ...box.selected, ...own.applied], parent);
  return new BoxCascade(ledger, layer, {
    ancestorRules: box.ancestorRules,
    ownRules: own.childRules,
    partRules: own.partRules,
    ancestorPartRules: box.ancestorPartRules,
  });
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
  readonly #partRules: readonly PartRule[];
  readonly #ancestorPartRules: readonly PartRule[];

  /**
   * @param ledger - The cell's layers.
   * @param layer - The box's layer.
   * @param rules - The child selectors of the boxes above that reach this box's icons as
   *   descendants, this box's own, this box's classes that style its child parts, and the tag rules
   *   of the boxes above, which reach its parts as descendants.
   */
  constructor(
    ledger: CellLedger,
    layer: Layer,
    rules: {
      readonly ancestorRules: readonly ChildRule[];
      readonly ownRules: readonly ChildRule[];
      readonly partRules: readonly PartRule[];
      readonly ancestorPartRules: readonly PartRule[];
    }
  ) {
    this.style = new LayerStyle(ledger, layer);
    this.#ledger = ledger;
    this.#layer = layer;
    this.#ancestorRules = rules.ancestorRules;
    this.#ownRules = rules.ownRules;
    this.#partRules = rules.partRules;
    this.#ancestorPartRules = rules.ancestorPartRules;
  }

  /**
   * Cascade a part directly below this box, over what this box passes down. This box's
   * `*:data-[slot=…]:` classes that name the part's slot cascade with the part's own classes by
   * specificity, as CSS applies `:is(.… > *)[data-slot="…"]` to the box's children. Its classes such
   * as `[&_img]:` that name the part's tag do too, and so do those of the boxes above, since
   * `.… img` matches an `<img>` at any depth.
   *
   * @param classes - The part's class string for the cell.
   * @param part - The part's layer name.
   * @param element - The part's `data-slot`, or undefined for a part without one, and its tag where
   *   the definition names it.
   * @param outer - The declarations of the part's `style` attribute, which beat every class, and
   *   those the browser's default style sheet gives its element, which every class beats.
   * @returns The part's cascade.
   */
  part(
    classes: string,
    part: string,
    element: { readonly slot: string | undefined; readonly tag: string | undefined },
    outer: {
      readonly inline: readonly InlineDeclaration[];
      readonly defaults: readonly OuterDeclaration[];
    } = { inline: [], defaults: [] }
  ): BoxCascade {
    const tagged = (rule: PartRule) => rule.target.kind === "tag" && rule.target.tag === element.tag;
    const taken = [
      ...this.#ancestorPartRules.filter(tagged),
      ...this.#partRules.filter((rule) =>
        rule.target.kind === "slot" ? rule.target.slot === element.slot : tagged(rule)
      ),
    ];
    for (const rule of taken) {
      takePartRule(this.#ledger.scope.partRules, rule);
    }
    return cascadeBox(
      this.#ledger,
      {
        classes,
        part,
        inherited: inheritance(this.#layer, this.#ledger.scope.context),
        outer: [
          ...outerApplied(outer.defaults, part, ELEMENT_DEFAULT_RANK),
          ...outerApplied(
            outer.inline.map((declaration) => ({ className: INLINE_STYLE, ...declaration })),
            part,
            INLINE_RANK
          ),
        ],
        ancestorRules: [...this.#ancestorRules, ...this.#ownRules],
        ancestorPartRules: [
          ...this.#ancestorPartRules,
          ...this.#partRules.filter((rule) => rule.target.kind === "tag"),
        ],
        selected: taken.map((rule) => rule.applied),
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
   * @throws When one of the icon's own classes has a child selector or styles a child part, which
   *   the builder does not model inside an icon.
   */
  icon(slot: IconSlot): LayerStyle {
    const selected = [
      ...this.#ancestorRules.filter((rule) => rule.selects({ ...slot, direct: false })),
      ...this.#ownRules.filter((rule) => rule.selects(slot)),
    ];
    const own = boxClasses(slot.classes ?? "", slot.name, this.#ledger.scope);
    const [nested] = [...own.childRules, ...own.partRules];
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
   * precedence.
   */
  mark(property: string, outcome: CoverageOutcome, detail: string): void {
    const source = this.#layer.style.get(property)?.source.layer;
    if (source === undefined) {
      return;
    }
    const owner = source === this.#layer.id ? this.#layer : this.#ledger.around(source);
    owner?.marks.set(property, { outcome, detail });
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
      this.#ledger.noteRead(source, note);
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
  const value = substitute(parent, context, entry, read);
  if (value === undefined) {
    return undefined;
  }
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
 * icons it reaches, a class whose variants hold styles the box, and a class with a variant no
 * cell shows or the definition does not model lands in the coverage table.
 */
function boxClasses(classes: string, part: string, scope: CellScope): BoxClasses {
  const { meaningOf, cell, context, record, conditions } = scope;
  const applied: Applied[] = [];
  const childRules: ChildRule[] = [];
  const partRules: PartRule[] = [];
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
    const { selects, target, conditionVariants, holds, skipped } = readVariants(variants, meaningOf, cell);
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
    if (target !== undefined) {
      partRules.push({ target, applied: entry });
      logPartRule(scope.partRules, { part, className, target, declarations: rule.declarations });
    } else if (selects === undefined) {
      applied.push(entry);
    } else {
      childRules.push({ selects, applied: entry });
    }
  }
  return { applied, childRules, partRules };
}

/** Log a class that styles a child part, keeping whether a part took it in an earlier cell. */
function logPartRule(
  log: PartRuleLog,
  rule: { readonly part: string; readonly className: string; readonly target: PartTarget } & Pick<
    Applied,
    "declarations"
  >
): void {
  const key = JSON.stringify([rule.part, rule.className]);
  log.set(key, { ...rule, taken: log.get(key)?.taken === true });
}

/** Note that a child part took a class of its parent's. */
function takePartRule(log: PartRuleLog, rule: PartRule): void {
  const key = JSON.stringify([rule.applied.part, rule.applied.className]);
  const logged = log.get(key);
  if (logged !== undefined) {
    log.set(key, { ...logged, taken: true });
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
  for (const { part, className, declarations, computedOutside } of sorted) {
    for (const { property, value } of declarations) {
      for (const [longhand, longValue] of expandShorthand(property, value)) {
        const source = { layer, part, className, property: longhand, value: longValue };
        const entry: StyleEntry =
          computedOutside === undefined
            ? { value: longValue, source, consumed: [], computed: false }
            : { value: computedOutside(longValue), source, consumed: [], computed: true };
        style.set(
          longhand,
          inheritedKeyword(source, parentOf) ?? inheritedCurrentColor(source, inherited) ?? entry
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
    : { value: parent.value, source, consumed: [parent.source, ...parent.consumed], computed: true };
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
 * Split the padding and margin shorthands into their physical sides, as Figma pads a box and as a
 * part's margin draws, and name a logical inset or margin by its physical side, keeping every other
 * property. Each side then cascades with the physical one, so a style attribute's `margin: 0` resets
 * a class's `mt-1`. A side may be a `calc()` with spaces, as `px-2.5` compiles to
 * `calc(var(--spacing) * 2.5)`.
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
    // A left-to-right page puts the inline start on the left and its end on the right, and the block
    // start on top, where each cascades with the physical side (CSS Logical Properties 1 §4).
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
    default:
      return [[property, value]];
  }
}
