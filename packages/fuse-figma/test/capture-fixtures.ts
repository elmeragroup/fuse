/**
 * Hand-built captures, and the component sets `buildSetsInOrder` builds from them, for the suites
 * that check one rule of the mapping at a time. A fixture names, per cell, the elements around the
 * root and the root's tree, and for each element the classes whose declarations it wins, as the
 * browser's cascade leaves them: Tailwind's compiled declarations of each class, in the order given,
 * each winning the longhands the capture's cascade (`resolveWinners`) gives it, so of two
 * declarations of one specificity the later wins. A declaration a parent's
 * child selector puts on an element, as `[&_svg]:size-4` sizes an icon, names its class with
 * `fromParent`. The build compiles every class the fixture uses, as the kit build compiles every class
 * a capture records, so a `var()` of Tailwind's theme resolves.
 */

import { CAPTURE_FORMAT, CAPTURE_VERSION } from "../src/capture/capture-format.ts";
import type {
  MeasuredFacts,
  CapturedDeclaration,
  CapturedElement,
  DeclarationSource,
  SetCapture,
} from "../src/capture/capture-format.ts";
import { manifestDefinition } from "../src/capture/manifest.ts";
import type {
  IconManifest,
  InstanceManifest,
  LabelManifest,
  PartManifest,
  SetManifest,
} from "../src/capture/manifest.ts";
import { UnknownLayer, resolveWinners } from "../src/capture/winners.ts";
import { buildSetsInOrder } from "../src/components/component-builder.ts";
import { variantKey } from "../src/components/component-spec.ts";
import type {
  BuildContext,
  BuiltComponent,
  Cell,
  ComponentDefinition,
} from "../src/components/component-spec.ts";
import type { CoverageRow } from "../src/components/coverage.ts";
import { makeVariableIndex } from "../src/components/css-values.ts";
import type { VariableIndex } from "../src/components/css-values.ts";
import type {
  BooleanPropertySpec,
  BoxSpec,
  FrameLayerSpec,
  TextLayerSpec,
  VariantSpec,
} from "../src/components/kit-spec.ts";
import { expandShorthand } from "../src/components/layer-style.ts";
import { bareUtility } from "./bare-utility.ts";
import { compileFixture } from "./utility-rules.ts";
import type { UtilityRules } from "./utility-rules.ts";

/** A declaration written out, for one no class compiles to, such as a `style` attribute's. */
export type Written = {
  readonly className: string;
  readonly property: string;
  readonly value: string;
  readonly source?: DeclarationSource;
  /** The rule's selector, where it is not the class's own, as `:where(.x > :not(:last-child))`. */
  readonly selector?: string;
  /**
   * The selector's specificity, as `[0, 0, 0]` for a `:where()` selector, where it is not a class
   * selector's `[0, 1, 0]`.
   */
  readonly specificity?: readonly [number, number, number];
};

/** An element of a fixture's cell. */
export type FixtureElement = {
  readonly tag?: string;
  readonly slot?: string;
  /** The element's `data-icon`, the side a wrapper around an icon marks, as a pending Button's spinner span. */
  readonly dataIcon?: string;
  readonly text?: string;
  /** How many element children precede the element's own text, as the capture records it. */
  readonly textIndex?: number;
  /** The element's text nodes between its element children, where `text` and `textIndex` lose some. */
  readonly texts?: readonly string[];
  /** The classes whose compiled declarations the element wins, in cascade order, space-separated. */
  readonly classes?: string;
  /** The classes of the parent whose child selector puts their declarations on this element. */
  readonly fromParent?: string;
  /** Classes the element carries that win no declaration, as a marker class such as `group`. */
  readonly carried?: string;
  /** Declarations written out, which win after the classes' own. */
  readonly written?: readonly Written[];
  /** Declarations written out that a parent's rule puts on this element, which win last. */
  readonly writtenFromParent?: readonly Written[];
  /**
   * The properties of the element's written declarations whose value the browser computes to the
   * property's initial value there, which the capture lists in `initial`, as a preflight
   * `color: inherit` under a parent that sets no color.
   */
  readonly initial?: readonly string[];
  /** What the capture measured of the element in the browser, as `ellipsisFits`. */
  readonly measured?: MeasuredFacts;
  /**
   * The declarations each pseudo-element of the element wins, by its name, such as `before`: the
   * bare utilities of its classes, as a `before:` variant applies them, and declarations written out.
   */
  readonly pseudo?: Readonly<
    Record<string, { readonly classes?: string; readonly written?: readonly Written[] }>
  >;
  readonly children?: readonly FixtureElement[];
};

/** One cell of a fixture: the cell, the elements around the root, outermost first, and the root. */
export type FixtureCell = {
  readonly cell: Cell;
  readonly around?: readonly FixtureElement[];
  readonly root: FixtureElement;
};

/** What a fixture build reads besides its cells. */
export type FixtureOptions = {
  /** Classes compiled beside the fixture's own, such as `ring-2`, which registers its custom properties. */
  readonly registered?: readonly string[];
  /** The synced variables a value can bind. */
  readonly variables?: VariableIndex;
  /** The sets the fixture's instance parts show, each after the sets it shows, built before it. */
  readonly inner?: readonly FixtureSet[];
};

/** A hand-built set: its manifest and each cell of the manifest's matrix. */
export type FixtureSet = {
  readonly manifest: SetManifest;
  readonly cells: readonly FixtureCell[];
};

/** A fixture's built set, with its first variant. */
export type BuiltFixture = BuiltComponent & { readonly variant: VariantSpec | undefined };

/** Each class an element list names, once. */
function classesIn(elements: readonly FixtureElement[]): readonly string[] {
  return elements.flatMap((element) => [
    ...words(element.classes),
    ...words(element.fromParent),
    ...Object.values(element.pseudo ?? {}).flatMap((own) => words(own.classes)),
    ...classesIn(element.children ?? []),
  ]);
}

/** The space-separated words of a class string. */
function words(classes: string | undefined): readonly string[] {
  return (classes ?? "").split(/\s+/).filter((word) => word !== "");
}

/**
 * The declarations a class compiles to: its own rule's, or, for a class with a variant, its bare
 * utility's, which the browser applies where the variant holds.
 */
function compiledOf(rules: UtilityRules, className: string): readonly Written[] {
  const declarations = rules.get(className) ?? rules.get(bareUtility(className));
  if (declarations === undefined) {
    throw new Error(`Tailwind compiles no rule for ${className}`);
  }
  return declarations.map(({ property, value }) => ({ className, property, value }));
}

/**
 * Build a set from a manifest and its hand-built cells, as the kit builds one from its kept capture,
 * through the kit's own build of a list of sets, after the sets its instance parts show.
 *
 * @param manifest - The set's manifest.
 * @param cells - Each cell of the manifest's matrix.
 * @param options - Extra classes to compile, the synced variables and the sets its instances show.
 * @returns The built set and its first variant.
 */
export async function buildCaptured(
  manifest: SetManifest,
  cells: readonly FixtureCell[],
  options: FixtureOptions = {}
): Promise<BuiltFixture> {
  const sets = [...(options.inner ?? []), { manifest, cells }];
  const classes = sets.flatMap((set) =>
    set.cells.flatMap(({ around = [], root }) => classesIn([...around, root]))
  );
  const { compiled, rules } = await compileFixture(classes, options.registered);
  const context: BuildContext = { compiled, variables: options.variables ?? makeVariableIndex([]) };
  const built = buildSetsInOrder(
    sets.map((set) => {
      const definition = manifestDefinition(set.manifest);
      return { definition, capture: captureOf(set, definition, rules) };
    }),
    context
  ).at(-1);
  if (built === undefined) {
    throw new Error("the build returned no set");
  }
  return { ...built, variant: built.componentSet.variants[0] };
}

/** The physical sides of a border on a horizontal, left-to-right page. */
const BORDER_SIDES = ["top", "right", "bottom", "left"] as const;

/** The physical sides each logical border side or axis names on that page (CSS Logical Properties 1 §4). */
const LOGICAL_BORDER_SIDES = new Map<string, readonly string[]>([
  ["block", ["top", "bottom"]],
  ["inline", ["left", "right"]],
  ["block-start", ["top"]],
  ["block-end", ["bottom"]],
  ["inline-start", ["left"]],
  ["inline-end", ["right"]],
]);

/** The longhands of a side's border, besides `border-image`'s. */
const BORDER_PARTS = ["width", "style", "color"] as const;

/** The longhands `border` resets to their initial values besides its sides' (CSS Backgrounds 3 §3.5). */
const BORDER_IMAGE = ["source", "slice", "width", "outset", "repeat"].map((part) => `border-image-${part}`);

/**
 * The physical longhands a border property sets, as Chromium lists them and the capture records them
 * (CSS Backgrounds 3 §3, CSS Logical Properties 1 §4): `border-color` sets each side's color, and
 * `border-inline-start-color` the left side's. Undefined for a property no border shorthand or side
 * names, a radius included.
 */
function borderLonghands(property: string): readonly string[] | undefined {
  const match =
    /^border(?:-(top|right|bottom|left|(?:block|inline)(?:-(?:start|end))?))?(?:-(width|style|color))?$/.exec(
      property
    );
  if (match === null) {
    return undefined;
  }
  const [, named, part] = match;
  const sides = named === undefined ? BORDER_SIDES : (LOGICAL_BORDER_SIDES.get(named) ?? [named]);
  const parts = part === undefined ? BORDER_PARTS : [part];
  const longhands = sides.flatMap((side) => parts.map((each) => `border-${side}-${each}`));
  return property === "border" ? [...longhands, ...BORDER_IMAGE] : longhands;
}

/**
 * The longhands `flex` sets, as Chromium lists them and the capture records them (CSS Flexbox 1
 * §7.2), so a later `grow-0` takes `flex-grow` from a `flex-auto` before it.
 */
const FLEX_LONGHANDS = ["flex-grow", "flex-shrink", "flex-basis"] as const;

/**
 * The longhands `gap` sets, as Chromium lists them and the capture records them (CSS Box Alignment 3
 * §8.3), so a later `gap-x-4` takes `column-gap` from a `gap-2` before it.
 */
const GAP_LONGHANDS = ["row-gap", "column-gap"] as const;

/** The capture of a hand-built set, with the declarations each element wins from its classes. */
function captureOf(
  { manifest, cells }: FixtureSet,
  definition: ComponentDefinition,
  rules: UtilityRules
): SetCapture {
  const declarations: CapturedDeclaration[] = [];
  const winners = (
    won: readonly (Written & { readonly source: DeclarationSource; readonly owner: number })[]
  ): readonly number[] => {
    // Each longhand goes to the declaration the capture's own cascade ranks highest, each a rule of
    // its own in the order given.
    const ranked = resolveWinners(
      won.map((declaration) => ({
        declaration,
        source: declaration.source,
        layer: declaration.source === "inline" ? "" : "utilities",
        selector: declaration.selector ?? `.${declaration.className}`,
        specificity: declaration.specificity ?? [0, 1, 0],
        properties: [
          {
            name: declaration.property,
            value: declaration.value,
            important: false,
            longhands: declaration.property.startsWith("--")
              ? [declaration.property]
              : declaration.property === "flex"
                ? FLEX_LONGHANDS
                : declaration.property === "gap"
                  ? GAP_LONGHANDS
                  : (borderLonghands(declaration.property) ??
                    expandShorthand(declaration.property, declaration.value).map(([longhand]) => longhand)),
          },
        ],
      }))
    );
    if (ranked instanceof UnknownLayer) {
      throw ranked;
    }
    const indexes = ranked.flatMap(({ rule: { declaration }, longhands }) => {
      const { className, property, value, owner, source, selector } = declaration;
      return [
        declarations.push({
          property,
          value,
          important: false,
          longhands,
          source,
          layer: source === "inline" ? "" : "utilities",
          selector: selector ?? (source === "inline" ? "" : `.${className}`),
          className,
          owner,
        }) - 1,
      ];
    });
    return indexes;
  };
  const element = (fixture: FixtureElement): CapturedElement => {
    const indexes = winners([
      ...words(fixture.classes).flatMap((className) =>
        compiledOf(rules, className).map((each) => ({ ...each, source: "fuse" as const, owner: 0 }))
      ),
      ...words(fixture.fromParent).flatMap((className) =>
        compiledOf(rules, className).map((each) => ({ ...each, source: "fuse" as const, owner: 1 }))
      ),
      ...(fixture.written ?? []).map((each) => ({ ...each, source: each.source ?? "fuse", owner: 0 })),
      ...(fixture.writtenFromParent ?? []).map((each) => ({
        ...each,
        source: each.source ?? "fuse",
        owner: 1,
      })),
    ]);
    const pseudo = Object.fromEntries(
      Object.entries(fixture.pseudo ?? {}).map(([name, own]) => [
        name,
        winners([
          ...words(own.classes).flatMap((className) =>
            compiledOf(rules, className).map((each) => ({ ...each, source: "fuse" as const, owner: 0 }))
          ),
          ...(own.written ?? []).map((each) => ({ ...each, source: each.source ?? "fuse", owner: 0 })),
        ]),
      ])
    );
    const attributes: Record<string, string> = {};
    if (fixture.slot !== undefined) {
      attributes["data-slot"] = fixture.slot;
    }
    if (fixture.dataIcon !== undefined) {
      attributes["data-icon"] = fixture.dataIcon;
    }
    const captured: CapturedElement = {
      tag: fixture.tag ?? "div",
      attributes,
      classes: [...words(fixture.classes), ...words(fixture.carried)],
      text: fixture.text ?? "",
      declarations: indexes,
      initial: indexes.filter(
        (index) => fixture.initial?.includes(declarations[index]?.property ?? "") === true
      ),
      pseudo,
      variables: {},
      unmatched: [],
      children: (fixture.children ?? []).map(element),
    };
    const indexed =
      fixture.textIndex === undefined ? captured : { ...captured, textIndex: fixture.textIndex };
    const ordered = fixture.texts === undefined ? indexed : { ...indexed, texts: fixture.texts };
    return fixture.measured === undefined ? ordered : { ...ordered, measured: fixture.measured };
  };
  return {
    format: CAPTURE_FORMAT,
    version: CAPTURE_VERSION,
    set: manifest.key,
    environment: { chromium: "", theme: "", locale: "" },
    page: [],
    declarations,
    cells: cells.map(({ cell, around = [], root }) => ({
      key: variantKey(definition, cell),
      cell,
      roots: [{ around: around.map(element), root: element(root) }],
    })),
  };
}

/**
 * The `chip` manifest: a one-axis set whose root carries the `chip` slot, with the fields a case
 * gives it.
 *
 * @param fields - Manifest fields to set, such as `parts` or `label`.
 * @returns The manifest.
 */
export function chip(fields: Partial<SetManifest> = {}): SetManifest {
  return {
    key: "chip",
    name: "Chip",
    api: { page: "chip", parts: ["Chip"] },
    slot: "chip",
    axes: [{ name: "state", values: ["rest"] }],
    columnAxis: "state",
    label: undefined,
    iconsFor: () => [],
    swapProperties: [],
    ...fields,
  };
}

/** The fields a case sets on a part, beside the `chip-dot` slot and key it takes by default. */
export type PartFields = {
  readonly key?: string;
  readonly slot?: string;
  readonly label?: LabelManifest;
  readonly iconsFor?: (cell: Cell) => readonly IconManifest[];
  readonly optional?: BooleanPropertySpec;
  readonly parts?: readonly (PartManifest | InstanceManifest)[];
};

/**
 * A part below the chip's root, the `chip-dot` unless the case names another, shown in every cell.
 *
 * @param fields - The part's key, slot, label, icons, BOOLEAN property and parts.
 * @returns The part.
 */
export function part(fields: PartFields = {}): PartManifest {
  const base: PartManifest = {
    key: fields.key ?? "dot",
    slot: fields.slot ?? "chip-dot",
    shownIn: () => true,
    label: fields.label,
    iconsFor: fields.iconsFor ?? (() => []),
  };
  const withOptional = fields.optional === undefined ? base : { ...base, optional: fields.optional };
  return fields.parts === undefined ? withOptional : { ...withOptional, parts: fields.parts };
}

/**
 * An instance part of a one-axis set, shown in every cell at the inner set's `rest` cell.
 *
 * @param key - The part's key.
 * @param of - The set it shows.
 * @returns The part.
 */
export function instanceOf(key: string, of: SetManifest): InstanceManifest {
  return { kind: "instance", key, of, cell: () => ({ state: "rest" }), shownIn: () => true };
}

/**
 * Build a chip whose root wins the given classes and holds the given elements.
 *
 * @param classes - The classes the root wins, space-separated.
 * @param children - The elements the root holds.
 * @param manifest - Manifest fields to set, such as `parts`.
 * @param options - The registered classes and synced variables the build reads.
 * @returns The built set, with its first variant.
 */
export function buildChip(
  classes: string,
  children: readonly FixtureElement[] = [],
  manifest: Partial<SetManifest> = {},
  options: FixtureOptions = {}
): Promise<BuiltFixture> {
  return buildCaptured(chip(manifest), rest({ slot: "chip", classes, children }), options);
}

/** The one cell of a `chip` with the default axis, whose root is the given element. */
export function rest(root: FixtureElement): readonly FixtureCell[] {
  return [{ cell: { state: "rest" }, root }];
}

/** A literal number field. */
export const literal = (value: number) => ({ kind: "literal", value }) as const;

/** An axis fixed at a length. */
export const fixed = <Length>(length: Length) => ({ kind: "fixed", length }) as const;

/** A box fixed at a width and a height. */
export const fixedSize = <Width, Height>(width: Width, height: Height) =>
  ({ horizontal: fixed(width), vertical: fixed(height) }) as const;

/** An axis that hugs the box's content. */
export const HUG = { kind: "hug" } as const;

/** An axis that fills the room its parent's auto layout gives the box. */
export const FILL = { kind: "fill" } as const;

/** No limit on either axis. */
export const UNLIMITED = {
  minWidth: undefined,
  maxWidth: undefined,
  minHeight: undefined,
  maxHeight: undefined,
} as const;

/**
 * The frame a box holds first, as a part's frame sits in its parent's box.
 *
 * @param box - A built root or frame.
 * @returns The box's first layer when it is a frame.
 */
export function frameOf(box: BoxSpec | undefined): FrameLayerSpec | undefined {
  const [first] = box?.children ?? [];
  return first?.kind === "frame" ? first : undefined;
}

/** The first text layer a box holds, at any depth. */
export function textOf(box: BoxSpec | undefined): TextLayerSpec | undefined {
  for (const child of box?.children ?? []) {
    const found = child.kind === "text" ? child : child.kind === "frame" ? textOf(child) : undefined;
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/** The fixtures' icon: `Plus`, a direct child of the box that lists it, with no `data-icon`. */
export const ICON: IconManifest = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "Plus",
  swapProperty: undefined,
};

/** The property, outcome and detail of each row a class has in the coverage table, by property. */
export function notesOf(coverage: readonly CoverageRow[], className: string) {
  return coverage
    .filter((row) => row.className === className)
    .map((row) => [row.property, row.outcome, row.detail])
    .toSorted(([left = ""], [right = ""]) => (left < right ? -1 : left > right ? 1 : 0));
}
