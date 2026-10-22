/**
 * Turn a recipe into a Figma component set. For every cell of the variant matrix the builder
 * calls the recipe, sorts each class by its variants into the cell's state or a child layer,
 * applies the compiled declarations in cascade order, and maps the result onto Figma fields.
 * Every declaration it reads lands in the coverage table with what became of it.
 */
import { splitClassName } from "./class-name";
import type { CoverageOutcome, CoverageRow } from "./coverage";
import {
  evaluateNumber,
  normalizeCss,
  readColor,
  readNumber,
  readShadows,
  splitTopLevel,
  substituteVars,
} from "./css-values";
import type { VariableIndex } from "./css-values";
import { walkLayers } from "./kit-spec";
import type {
  AxisSpec,
  ChildLayerSpec,
  ColorSpec,
  ComponentRootSpec,
  ComponentSetSpec,
  NumberSpec,
  IconLayerSpec,
  ShadowSpec,
  StringSpec,
  StrokeSpec,
  SwapPropertySpec,
  VariantSpec,
} from "./kit-spec";
import { compareSpecificity } from "./specificity";
import type { Specificity } from "./specificity";
import { makeStateTable } from "./state-table";
import type { StateTable } from "./state-table";
import type { CompiledUtilities } from "./utility-css";

/** One cell of a variant matrix: a value for each axis. */
export type Cell = Readonly<Record<string, string>>;

/**
 * An icon a part renders in a cell, described as the DOM holds it, so the recipe's child
 * selectors can find it the way the browser does.
 */
export type IconSlot = {
  readonly key: string;
  readonly name: string;
  /** The side of the label the icon sits on. */
  readonly side: "start" | "end";
  /**
   * Whether the `<svg>` is a child of the root, which `[&>svg]` selects. The spinner of a
   * pending Button sits in a span, so it is not.
   */
  readonly direct: boolean;
  /** The `data-icon` the icon, or the span around it, carries. */
  readonly dataIcon: "inline-start" | "inline-end" | undefined;
  /** The Fuse icon the layer shows, by its export name, such as `Plus`. */
  readonly icon: string;
  /** The INSTANCE_SWAP property that picks the icon, or undefined for a fixed icon. */
  readonly swapProperty: string | undefined;
};

/**
 * The swap properties of a set's icon slots.
 *
 * @param slots - The slots, in the order the set lists their properties.
 * @returns The swap property of each slot that has one, starting with the slot's icon.
 */
export function swapProperties(slots: readonly IconSlot[]): readonly SwapPropertySpec[] {
  return slots.flatMap((slot) =>
    slot.swapProperty === undefined ? [] : [{ name: slot.swapProperty, defaultIcon: slot.icon }]
  );
}

/**
 * The key of the icon component for a Fuse icon.
 *
 * @param name - The icon's export name, such as `ArrowRight`.
 * @returns The key, such as `icon/ArrowRight`.
 */
export function iconKey(name: string): string {
  return `icon/${name}`;
}

/**
 * What a set's root element is, which decides the attributes its disabled state holds.
 *
 * - `native-control`: a native `<button>`, disabled through its `disabled` attribute.
 * - `base-ui-span`: a Base UI `<span>`, such as a radio, which Base UI disables with
 *   `aria-disabled` and keeps focusable.
 */
export type RootKind = "native-control" | "base-ui-span";

/** A component the builder can turn into a component set. */
export type ComponentDefinition = {
  readonly key: string;
  readonly name: string;
  /** The root part's `data-slot`, which names the root layer. */
  readonly slot: string;
  /**
   * What the root element is. A set whose `state` axis has `disabled` names it, and
   * `state-table.ts` refuses one that does not.
   */
  readonly rootKind?: RootKind;
  readonly axes: readonly AxisSpec[];
  readonly columnAxis: string;
  /** The recipe's class string for one cell. */
  readonly classesFor: (cell: Cell) => string;
  /**
   * The variants each of the component's own states renders, beyond the ones `state-table.ts`
   * gives every component, such as `{ pending: ["data-disabled", "aria-disabled"] }`.
   */
  readonly states: Readonly<Record<string, readonly string[]>>;
  /** Each variant only this component uses, and whether it holds in a cell. */
  readonly facts: ReadonlyMap<string, (cell: Cell) => boolean>;
  /**
   * The variants of states this component leaves out on top of the shared ones, such as a
   * group's corners. A class with one of them lands in the coverage table as dropped. A class
   * with a variant neither the table nor the definition knows is unmapped, so a new state in
   * the recipe fails the gate.
   */
  readonly omittedStates: ReadonlySet<string>;
  /**
   * The text layer and the set's text property, or undefined for a part that shows only its
   * icon.
   */
  readonly label:
    | {
        readonly key: string;
        readonly name: string;
        readonly characters: string;
        readonly textProperty: string;
        /** Whether a cell shows the label. A Kbd shows it in its text cell and not its icon cell. */
        readonly shownIn: (cell: Cell) => boolean;
      }
    | undefined;
  /** The icons a cell renders, in DOM order. A start icon sits before the label. */
  readonly iconsFor: (cell: Cell) => readonly IconSlot[];
  /** The INSTANCE_SWAP properties, each with the export name of the icon it starts with. */
  readonly swapProperties: readonly SwapPropertySpec[];
};

/**
 * A declaration a part gets from outside its recipe, where its recipe sets nothing: one the
 * host page sets on an ancestor and the part inherits, such as the text color of an outline
 * Button, or one a base-layer rule sets on the part itself.
 */
export type OuterDeclaration = {
  /** The host class or the stylesheet rule that sets it, for the coverage table. */
  readonly className: string;
  readonly property: string;
  readonly value: string;
};

/** What the builder needs besides the component. */
export type BuildContext = {
  readonly compiled: CompiledUtilities;
  readonly variables: VariableIndex;
  /** The inherited declarations of the host page, applied before every other declaration. */
  readonly page: readonly OuterDeclaration[];
  /**
   * The base-layer declarations every root gets, applied after the page's and before every
   * recipe class, since any utility beats the base layer. A root that does not read one drops it.
   */
  readonly base: readonly OuterDeclaration[];
};

/** A component set and the coverage of the recipe classes it read. */
export type BuiltComponent = {
  readonly componentSet: Omit<ComponentSetSpec, "page">;
  readonly coverage: readonly CoverageRow[];
  /** Each font style the text layers use. */
  readonly fontStyles: readonly string[];
};

/**
 * Properties Figma has no form for, or that describe behaviour a static component does not
 * show. They land in the coverage table as dropped.
 */
const NO_FIGMA_FORM = new Map([
  ["cursor", "a static frame has no pointer"],
  ["user-select", "a static frame has no selection"],
  ["-webkit-user-select", "a static frame has no selection"],
  ["pointer-events", "a static frame has no pointer"],
  ["transition-property", "Figma components do not animate"],
  ["transition-timing-function", "Figma components do not animate"],
  ["transition-duration", "Figma components do not animate"],
  ["flex-shrink", "the component lays out alone"],
  ["outline-style", "Figma has no outline, and focus draws the ring"],
  // The plugin typings expose a text layer's `openTypeFeatures` as read-only, with no setter.
  ["font-variant-numeric", "the plugin API can read a text layer's OpenType features but not set them"],
]);

/** The Figma style of each Roboto weight a recipe reaches. */
const FONT_STYLES = new Map([
  [400, "Regular"],
  [500, "Medium"],
  [600, "SemiBold"],
  [700, "Bold"],
]);

/**
 * Build the component set for every cell of the definition's matrix.
 *
 * @param definition - The component.
 * @param context - The compiled utilities and the synced variables.
 * @returns The component set, its coverage and the font styles its text uses.
 */
export function buildComponentSet(definition: ComponentDefinition, context: BuildContext): BuiltComponent {
  const coverage = new Map<string, CoverageRow>();
  const fontStyles = new Set<string>();
  const record = (row: Omit<CoverageRow, "component">): void => {
    const full = { component: definition.name, ...row };
    coverage.set(
      JSON.stringify([full.className, full.property, full.value, full.outcome, full.detail]),
      full
    );
  };
  const meaningOf = makeStateTable(definition);
  const conditions: ConditionLog = new Map();
  const variants = matrixCells(definition.axes).map((cell): VariantSpec => {
    const styles = cascade(definition, meaningOf, cell, context, record, conditions);
    const root = mapRoot(definition, cell, styles, context, record);
    for (const layer of walkLayers(root)) {
      if (layer.kind === "text") {
        fontStyles.add(layer.fontStyle);
      }
    }
    return { key: variantKey(definition, cell), properties: cell, root };
  });
  // A class whose variants never hold in one cell together, such as `aria-invalid:focus-visible:`
  // on a set that draws invalid and focus as two values of its state axis, reaches no cell.
  for (const [className, { held, variants: classVariants, declarations }] of conditions) {
    if (held || classVariants.length < 2) {
      continue;
    }
    for (const declaration of declarations) {
      record({
        className,
        property: declaration.property,
        value: declaration.value,
        outcome: "dropped",
        detail: `no cell of the matrix shows ${classVariants.map((variant) => `\`${variant}\``).join(" and ")} at once`,
      });
    }
  }
  return {
    componentSet: {
      key: definition.key,
      name: definition.name,
      axes: definition.axes,
      columnAxis: definition.columnAxis,
      textProperties:
        definition.label === undefined
          ? []
          : [{ name: definition.label.textProperty, defaultValue: definition.label.characters }],
      swapProperties: definition.swapProperties.map((property) => ({
        name: property.name,
        defaultIcon: iconKey(property.defaultIcon),
      })),
      variants,
    },
    coverage: [...coverage.values()],
    fontStyles: [...fontStyles],
  };
}

/**
 * The key of one variant, such as `button/variant=default,size=sm,state=rest,icon=none`.
 *
 * @param definition - The component.
 * @param cell - The cell.
 * @returns The key.
 */
export function variantKey(definition: Pick<ComponentDefinition, "key" | "axes">, cell: Cell): string {
  return `${definition.key}/${definition.axes.map((axis) => `${axis.name}=${cell[axis.name] ?? ""}`).join(",")}`;
}

/** Every cell of the matrix, the first axis varying slowest. */
export function matrixCells(axes: readonly AxisSpec[]): readonly Cell[] {
  return axes.reduce<Cell[]>(
    (cells, axis) => cells.flatMap((cell) => axis.values.map((value) => ({ ...cell, [axis.name]: value }))),
    [{}]
  );
}

type StyleEntry = { readonly value: string; readonly className: string };

/** The cascaded declarations of the root, and of any icon the cell renders, by property. */
type CellStyles = {
  readonly root: ReadonlyMap<string, StyleEntry>;
  readonly iconStyle: (slot: IconSlot) => ReadonlyMap<string, StyleEntry>;
};

type Recorder = (row: Omit<CoverageRow, "component">) => void;

type Applied = {
  readonly className: string;
  /** -2 for the host page, -1 for the base layer, 0 for every recipe class. */
  readonly rank: number;
  readonly specificity: Specificity;
  /** The class's place in Tailwind's output, which breaks a specificity tie. */
  readonly order: number;
  readonly declarations: readonly { readonly property: string; readonly value: string }[];
};

/**
 * Each class with a condition variant, its condition variants, its declarations, and whether
 * they held together in some cell so far.
 */
type ConditionLog = Map<
  string,
  {
    readonly held: boolean;
    readonly variants: readonly string[];
    readonly declarations: Applied["declarations"];
  }
>;

/** A class that styles the icons its child selectors pick. */
type ChildRule = {
  readonly selects: (slot: IconSlot) => boolean;
  readonly applied: Applied;
};

/**
 * Apply a cell's classes in cascade order, as the browser applies rules in one cascade layer.
 * The page's inherited declarations come first and the base layer's next. Then the recipe
 * classes that hold in the cell apply by the specificity of each full class's compiled selector,
 * and Tailwind's output order breaks a tie. A variant does not always add specificity:
 * `aria-invalid:` adds an attribute, while fuse.css's `data-checked:` wraps its attribute in
 * `:where()` and adds nothing, so `aria-invalid:border-error` beats `data-checked:border-primary`
 * though Tailwind emits it first.
 */
function cascade(
  definition: ComponentDefinition,
  meaningOf: StateTable,
  cell: Cell,
  context: BuildContext,
  record: Recorder,
  conditions: ConditionLog
): CellStyles {
  const rootClasses: Applied[] = [];
  const childRules: ChildRule[] = [];
  for (const className of definition
    .classesFor(cell)
    .split(/\s+/)
    .filter((name) => name !== "")) {
    const { variants, utility } = splitClassName(className);
    const rule = context.compiled.rules.get(utility);
    if (rule === undefined) {
      record({
        className,
        property: "",
        value: "",
        outcome: utility.startsWith("group/") || utility === "group" ? "dropped" : "unmapped",
        detail: utility.startsWith("group") ? "a marker class with no CSS" : "Tailwind emits no rule for it",
      });
      continue;
    }
    let selects: ((slot: IconSlot) => boolean) | undefined;
    const conditionVariants: string[] = [];
    let holds = true;
    let skipped: { readonly variant: string; readonly omitted: boolean } | undefined;
    for (const variant of variants) {
      const meaning = meaningOf(variant);
      if (meaning.kind === "child") {
        const outer = selects;
        selects = outer === undefined ? meaning.selects : (slot) => outer(slot) && meaning.selects(slot);
        continue;
      }
      if (meaning.kind !== "condition") {
        skipped = { variant, omitted: meaning.kind === "omitted" };
        break;
      }
      conditionVariants.push(variant);
      holds &&= meaning.holds(cell);
    }
    const conditional = conditionVariants.length > 0;
    if (skipped !== undefined) {
      const { variant, omitted } = skipped;
      for (const declaration of rule.declarations) {
        record({
          className,
          property: declaration.property,
          value: declaration.value,
          outcome: omitted ? "dropped" : "unmapped",
          detail: omitted
            ? `no cell of the matrix shows \`${variant}\``
            : `the definition neither models nor omits \`${variant}\``,
        });
      }
      continue;
    }
    if (conditional) {
      conditions.set(className, {
        held: holds || conditions.get(className)?.held === true,
        variants: conditionVariants,
        declarations: rule.declarations,
      });
    }
    if (holds) {
      const placement = context.compiled.classes.get(className);
      if (placement === undefined) {
        record({
          className,
          property: "",
          value: "",
          outcome: "unmapped",
          detail: "Tailwind emits no rule for the class with its variants",
        });
        continue;
      }
      const applied = { className, rank: 0, ...placement, declarations: rule.declarations };
      if (selects === undefined) {
        rootClasses.push(applied);
      } else {
        childRules.push({ selects, applied });
      }
    }
  }
  const outer = (declarations: readonly OuterDeclaration[], rank: number): Applied[] =>
    declarations.map(({ className, property, value }) => ({
      className,
      rank,
      specificity: [0, 0, 0],
      order: 0,
      declarations: [{ property, value }],
    }));
  return {
    root: computeStyle([...outer(context.page, -2), ...outer(context.base, -1), ...rootClasses]),
    iconStyle: (slot) =>
      computeStyle(childRules.filter((rule) => rule.selects(slot)).map((rule) => rule.applied)),
  };
}

function computeStyle(applied: readonly Applied[]): ReadonlyMap<string, StyleEntry> {
  const style = new Map<string, StyleEntry>();
  const sorted = applied.toSorted(
    (left, right) =>
      left.rank - right.rank ||
      compareSpecificity(left.specificity, right.specificity) ||
      left.order - right.order
  );
  for (const { className, declarations } of sorted) {
    for (const { property, value } of declarations) {
      for (const [longhand, longValue] of expandShorthand(property, value)) {
        style.set(longhand, { value: longValue, className });
      }
    }
  }
  return style;
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

/**
 * Reads one layer's cascaded style. Each read substitutes Tailwind's own variables, records
 * the coverage of the property and of every custom property it read, and marks them used.
 */
class StyleReader {
  readonly #style: ReadonlyMap<string, StyleEntry>;
  readonly #context: BuildContext;
  readonly #record: Recorder;
  readonly #used = new Set<string>();

  constructor(style: ReadonlyMap<string, StyleEntry>, context: BuildContext, record: Recorder) {
    this.#style = style;
    this.#context = context;
    this.#record = record;
  }

  has(property: string): boolean {
    return this.#style.has(property);
  }

  /** The cascaded value before substitution. */
  raw(property: string): string | undefined {
    return this.#style.get(property)?.value;
  }

  /** Record a property as used with an outcome, without reading through it. */
  mark(property: string, outcome: CoverageOutcome, detail: string): void {
    const entry = this.#style.get(property);
    if (entry !== undefined) {
      this.#used.add(property);
      this.#record({ className: entry.className, property, value: entry.value, outcome, detail });
    }
  }

  /**
   * Record a property the layer needs and its cascade leaves unset, as unmapped, under the
   * class that set the property needing it.
   */
  missing(property: string, neededBy: string, detail: string): void {
    const entry = this.#style.get(neededBy);
    if (entry !== undefined && !this.#style.has(property)) {
      this.#record({ className: entry.className, property, value: "", outcome: "unmapped", detail });
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
    const entry = this.#style.get(property);
    if (entry === undefined) {
      return undefined;
    }
    this.#used.add(property);
    const read = new Set<string>();
    const resolved = substituteVars(
      entry.value,
      (name) =>
        this.#style.get(name)?.value ??
        this.#context.compiled.themeValues.get(name) ??
        this.#context.compiled.propertyInitials.get(name),
      this.#context.variables.owns,
      read
    );
    const mapped = resolved === undefined ? undefined : map(resolved);
    const { outcome, detail } =
      mapped === undefined
        ? { outcome: "unmapped" as const, detail: `no Figma field reads ${resolved ?? entry.value}` }
        : describe(mapped);
    this.#record({ className: entry.className, property, value: entry.value, outcome, detail });
    for (const name of read) {
      const custom = this.#style.get(name);
      if (custom !== undefined) {
        this.#used.add(name);
        this.#record({ className: custom.className, property: name, value: custom.value, outcome, detail });
      }
    }
    return mapped;
  }

  /** Record every property no read used, as dropped when Figma has no form for it. */
  finish(): void {
    for (const [property, entry] of this.#style) {
      if (this.#used.has(property)) {
        continue;
      }
      const reason = NO_FIGMA_FORM.get(property);
      if (this.#context.base.some((declaration) => declaration.className === entry.className)) {
        this.#record({
          className: entry.className,
          property,
          value: entry.value,
          outcome: "dropped",
          detail: "the base layer sets it on every part, and this part does not read it",
        });
      } else if (reason !== undefined) {
        this.#record({
          className: entry.className,
          property,
          value: entry.value,
          outcome: "dropped",
          detail: reason,
        });
      } else if (property.startsWith("--tw-")) {
        this.#record({
          className: entry.className,
          property,
          value: entry.value,
          outcome: "dropped",
          detail: "Tailwind's bookkeeping, which no mapped property reads",
        });
      } else {
        this.#record({
          className: entry.className,
          property,
          value: entry.value,
          outcome: "unmapped",
          detail: "the builder maps no Figma field from it",
        });
      }
    }
  }
}

/** What a read became, for the coverage table. */
type CoverageNote = Pick<CoverageRow, "outcome" | "detail">;

function describeNumber(spec: NumberSpec): CoverageNote {
  return spec.kind === "variable"
    ? { outcome: "bound", detail: `${spec.variable.collection} / ${spec.variable.name}` }
    : { outcome: "literal", detail: `${spec.value}px` };
}

function describeColor(spec: ColorSpec): CoverageNote {
  if (spec.kind === "variable") {
    return { outcome: "bound", detail: `${spec.variable.collection} / ${spec.variable.name}` };
  }
  const { r, g, b, a } = spec.color;
  return {
    outcome: "literal",
    detail: `rgba(${[r, g, b].map((channel) => Math.round(channel * 255)).join(", ")}, ${a})`,
  };
}

/** A background that paints nothing, which the root writes as no fill. */
const NO_FILL = "no fill";

/**
 * Read a background as the root's fill. A literal color at alpha 0, such as `transparent`,
 * paints nothing in CSS, so it becomes no fill, as an unset background does. The plugin then
 * gives a root that casts a spread shadow its clear fill, which Figma counts and an alpha-0
 * fill it does not.
 */
function readFill(value: string, index: VariableIndex): ColorSpec | typeof NO_FILL | undefined {
  const color = readColor(value, index);
  return color?.kind === "literal" && color.color.a === 0 ? NO_FILL : color;
}

function describeFill(fill: ColorSpec | typeof NO_FILL): CoverageNote {
  return fill === NO_FILL
    ? { outcome: "literal", detail: "no fill, since a transparent background paints nothing" }
    : describeColor(fill);
}

const ZERO: NumberSpec = { kind: "literal", value: 0 };

function literalLayout(expected: readonly string[], detail: string) {
  return {
    map: (value: string) => (expected.includes(normalizeCss(value)) ? value : undefined),
    describe: () => ({ outcome: "literal" as const, detail }),
  };
}

function mapRoot(
  definition: ComponentDefinition,
  cell: Cell,
  styles: CellStyles,
  context: BuildContext,
  record: Recorder
): ComponentRootSpec {
  const root = new StyleReader(styles.root, context, record);
  const number = (property: string): NumberSpec | undefined =>
    root.read(property, (value) => readNumber(value, context.variables), describeNumber);
  const color = (property: string): ColorSpec | undefined =>
    root.read(property, (value) => readColor(value, context.variables), describeColor);

  for (const [property, layout] of [
    ["display", literalLayout(["inline-flex", "flex"], "a horizontal auto layout")],
    ["align-items", literalLayout(["center"], "centered on the counter axis")],
    ["justify-content", literalLayout(["center"], "centered on the primary axis")],
    ["box-sizing", literalLayout(["border-box"], "strokes count in the auto layout")],
    ["white-space", literalLayout(["nowrap"], "the label hugs its width")],
  ] as const) {
    root.read(property, layout.map, layout.describe);
  }

  const stroke = readStroke(root, context);
  const shadows = readShadowStack(root, context);
  const opacity = root.read("opacity", evaluateNumber, (value) => ({
    outcome: "literal",
    detail: `opacity ${value}`,
  }));
  const textColor = color("color");
  const fill = root.read("background-color", (value) => readFill(value, context.variables), describeFill);

  const start: ChildLayerSpec[] = [];
  const end: ChildLayerSpec[] = [];
  for (const slot of definition.iconsFor(cell)) {
    const icon = mapIcon(definition, cell, slot, styles.iconStyle(slot), context, record, textColor);
    if (icon !== undefined) {
      (slot.side === "start" ? start : end).push(icon);
    }
  }
  const children: ChildLayerSpec[] = [...start];
  const label = definition.label?.shownIn(cell) === true ? definition.label : undefined;
  if (label === undefined) {
    for (const property of TEXT_PROPERTIES) {
      root.mark(property, "dropped", "the cell shows no text");
    }
  } else {
    children.push(mapLabel(definition, label, cell, root, context, textColor));
  }
  children.push(...end);

  const spec: ComponentRootSpec = {
    name: definition.slot,
    width: number("width"),
    height: number("height"),
    minWidth: number("min-width"),
    paddingTop: number("padding-top") ?? ZERO,
    paddingRight: number("padding-right") ?? ZERO,
    paddingBottom: number("padding-bottom") ?? ZERO,
    paddingLeft: number("padding-left") ?? ZERO,
    itemSpacing: number("gap") ?? ZERO,
    // The layout reads above accept only centered content, so the root says so.
    primaryAlign: "CENTER",
    counterAlign: "CENTER",
    cornerRadius: number("border-radius") ?? ZERO,
    fill: fill === NO_FILL ? undefined : fill,
    stroke,
    shadows,
    opacity: opacity ?? 1,
    children,
  };
  root.finish();
  return spec;
}

/**
 * Map one icon. A slot whose cascaded style is `display: none` is left out, as the pending
 * Button leaves out its own leading icon while its spinner takes the place.
 *
 * @returns The icon layer, or undefined for an icon the cell hides.
 */
function mapIcon(
  definition: ComponentDefinition,
  cell: Cell,
  slot: IconSlot,
  style: ReadonlyMap<string, StyleEntry>,
  context: BuildContext,
  record: Recorder,
  color: ColorSpec | undefined
): IconLayerSpec | undefined {
  const reader = new StyleReader(style, context, record);
  const hidden = reader.read(
    "display",
    (value) => (normalizeCss(value) === "none" ? true : undefined),
    () => ({ outcome: "literal", detail: "the icon is left out" })
  );
  if (hidden === true) {
    for (const property of ["width", "height"]) {
      reader.mark(property, "dropped", "the icon is left out");
    }
    reader.finish();
    return undefined;
  }
  const width = reader.read("width", (value) => readNumber(value, context.variables), describeNumber);
  const height = reader.read("height", (value) => readNumber(value, context.variables), describeNumber);
  reader.finish();
  if (width === undefined || color === undefined || JSON.stringify(width) !== JSON.stringify(height)) {
    throw new Error(`${variantKey(definition, cell)}: the ${slot.name} needs a square size and a text color`);
  }
  return {
    kind: "icon",
    key: slot.key,
    name: slot.name,
    icon: iconKey(slot.icon),
    swapProperty: slot.swapProperty,
    size: width,
    color,
  };
}

/** The `box-shadow` every Tailwind shadow and ring utility writes, one layer per custom property. */
const TAILWIND_SHADOW_LAYERS = [
  "--tw-inset-shadow",
  "--tw-inset-ring-shadow",
  "--tw-ring-offset-shadow",
  "--tw-ring-shadow",
  "--tw-shadow",
] as const;

const TAILWIND_SHADOW_STACK = TAILWIND_SHADOW_LAYERS.map((layer) => `var(${layer})`).join(",");

/**
 * Read the drop shadows. Tailwind composes `box-shadow` from one custom property per layer,
 * so the builder reads each layer a class set on its own. A layer that does not map, such
 * as a shadow whose blur is a formula over a variable, leaves the other layers in place.
 */
function readShadowStack(root: StyleReader, context: BuildContext): readonly ShadowSpec[] {
  const raw = root.raw("box-shadow");
  if (raw === undefined) {
    return [];
  }
  const describe = (mapped: readonly ShadowSpec[]) => ({
    outcome: mapped.some((shadow) => shadow.color.kind === "variable")
      ? ("bound" as const)
      : ("literal" as const),
    detail: mapped.length === 0 ? "no visible shadow" : `${mapped.length} drop shadow(s)`,
  });
  if (normalizeCss(raw) !== TAILWIND_SHADOW_STACK) {
    return root.read("box-shadow", (value) => readShadows(value, context.variables), describe) ?? [];
  }
  root.mark("box-shadow", "literal", "Tailwind's shadow stack, read layer by layer");
  return TAILWIND_SHADOW_LAYERS.flatMap((layer) =>
    root.has(layer)
      ? (root.read(layer, (value) => readShadows(value, context.variables), describe) ?? [])
      : []
  );
}

/**
 * A CSS border becomes an inside stroke. A border with no style or a style other than solid
 * stays unmapped, and so does one with no color, which would otherwise draw no stroke and leave
 * no row.
 */
function readStroke(root: StyleReader, context: BuildContext): StrokeSpec | undefined {
  if (!root.has("border-width")) {
    return undefined;
  }
  root.missing(
    "border-color",
    "border-width",
    "no class or base rule colors the border, so the stroke is left out"
  );
  const style = root.read(
    "border-style",
    (value) => (normalizeCss(value) === "solid" ? value : undefined),
    () => ({ outcome: "literal", detail: "a solid stroke" })
  );
  const weight = root.read("border-width", (value) => readNumber(value, context.variables), describeNumber);
  const color = root.read("border-color", (value) => readColor(value, context.variables), describeColor);
  return style === undefined || weight === undefined || color === undefined ? undefined : { color, weight };
}

/** The text properties a label reads, which a part without a label drops. */
const TEXT_PROPERTIES = [
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "text-decoration-line",
  "text-underline-offset",
] as const;

function mapLabel(
  definition: ComponentDefinition,
  label: NonNullable<ComponentDefinition["label"]>,
  cell: Cell,
  root: StyleReader,
  context: BuildContext,
  color: ColorSpec | undefined
): ChildLayerSpec {
  const fontSize = root.read("font-size", (value) => readNumber(value, context.variables), describeNumber);
  const lineHeight = root.read(
    "line-height",
    (value) => {
      const bound = context.variables.lookup(value);
      if (bound !== undefined) {
        return { kind: "variable" as const, variable: bound };
      }
      const number = evaluateNumber(value);
      if (number === undefined) {
        return undefined;
      }
      // A unitless line height multiplies the font size, which must then be a literal.
      if (/px|rem|%/.test(value)) {
        return { kind: "literal" as const, value: number };
      }
      return fontSize?.kind === "literal"
        ? { kind: "literal" as const, value: number * fontSize.value }
        : undefined;
    },
    describeNumber
  );
  const fontFamily = root.read(
    "font-family",
    (value): StringSpec | undefined => {
      const bound = context.variables.lookup(value);
      return bound === undefined ? undefined : { kind: "variable", variable: bound };
    },
    (spec) => ({
      outcome: "bound",
      detail: spec.kind === "variable" ? `${spec.variable.collection} / ${spec.variable.name}` : spec.value,
    })
  );
  const weight = root.read(
    "font-weight",
    (value) => {
      const number = evaluateNumber(value);
      return number === undefined ? undefined : FONT_STYLES.get(number);
    },
    (style) => ({ outcome: "literal", detail: `font style ${style}` })
  );
  const underlined = root.read(
    "text-decoration-line",
    (value) => {
      const line = normalizeCss(value);
      return line === "underline" ? true : line === "none" ? false : undefined;
    },
    (drawn) => ({ outcome: "literal", detail: drawn ? "an underline" : "no decoration" })
  );
  let underline: { readonly offset: number | undefined } | undefined;
  if (underlined === true) {
    underline = {
      offset: root.read("text-underline-offset", evaluateNumber, (offset) => ({
        outcome: "literal",
        detail: `an underline offset of ${offset}px`,
      })),
    };
  } else {
    root.mark("text-underline-offset", "dropped", "the cell draws no underline");
  }
  if (fontFamily === undefined || fontSize === undefined || lineHeight === undefined || color === undefined) {
    throw new Error(
      `${variantKey(definition, cell)}: the label needs a font family, size, line height and color`
    );
  }
  return {
    kind: "text",
    key: label.key,
    name: label.name,
    characters: label.characters,
    textProperty: label.textProperty,
    fontFamily,
    fontStyle: weight ?? "Regular",
    fontSize,
    lineHeight,
    color,
    underline,
  };
}
