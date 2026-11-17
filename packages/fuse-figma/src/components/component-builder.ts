/**
 * Turn a recipe into a Figma component set. For every cell of the variant matrix the builder
 * asks `cascade.ts` for the computed style of the root, each part and each icon, and
 * `box-mapping.ts` maps it onto Figma fields. Every declaration it reads lands in the coverage
 * table with what became of it. `component-spec.ts` holds the definition types this module reads.
 */

import { Result } from "effect";

import {
  anchoredPlacement,
  CaptureSetCascade,
  castsShadowOrClips,
  partsThatScaleIn,
} from "../capture/capture-cascade";
import type { OpenPlacement } from "../capture/capture-cascade";
import type { SetCapture } from "../capture/capture-format";
import { keptCapture } from "../capture/captures";
import { mapBox, NO_VALUES, partName } from "./box-mapping";
import type { MapScope } from "./box-mapping";
import { readBackdrop } from "./box-paint";
import { rootRoom } from "./box-sizing";
import { KitUnmappable } from "./build-errors";
import { SetCascade } from "./cascade";
import type { BoxCascade, LayerStyle } from "./cascade";
import { clippedShadows } from "./clipped-shadows";
import type { ClippedShadow } from "./clipped-shadows";
import { definitionClasses, matrixCells, previewWidthIn, variantKey } from "./component-spec";
import type {
  BuildContext,
  BuiltComponent,
  BoxDefinition,
  Cell,
  ComponentDefinition,
  LabelDefinition,
} from "./component-spec";
import type { CoverageRow } from "./coverage";
import { normalizeCss } from "./css-values";
import {
  allPartsOf,
  framePartsOf,
  instancePartsOf,
  instanceRootSlotOf,
  partsOf,
  renderedSlots,
} from "./definition-parts";
import { checkInstanceOrder, InstanceParts } from "./instance-parts";
import type { InnerSet } from "./instance-parts";
import { iconKey, walkLayers } from "./kit-spec";
import type {
  ComponentRootSpec,
  InstanceLayerSpec,
  ShadowSpec,
  TextPropertySpec,
  VariantSpec,
} from "./kit-spec";
import { booleanPropertiesOf, refusePresenceReads } from "./optional-parts";
import type { OptionalPart } from "./optional-parts";
import { partsThatScale, placeRoot } from "./placement";
import { PaintedInstances } from "./stacking";
import { makeStateTable } from "./state-table";

/**
 * What a set builds from: the definition the mapping walks, and the capture its cascade reads, or
 * undefined for the recipe cascade.
 */
export type SetSource = {
  readonly definition: ComponentDefinition;
  readonly capture: SetCapture | undefined;
  /** How an open composite places its cells' roots, as its manifest names it; undefined otherwise. */
  readonly open?: OpenPlacement;
};

/**
 * Build the component sets of a list of definitions in its order, each with the sets before it at
 * hand, so a set builds after the sets its instance parts show.
 *
 * @template Entry - What the list holds for each set, its definition among it.
 * @param entries - The definitions, each set after the sets it holds instances of.
 * @param context - The compiled utilities and the synced variables.
 * @param source - What builds an entry's set: its definition and the recipe cascade, or the
 *   definition its manifest gives and its capture. The recipe by default.
 * @returns Each entry with its built set, in the list's order.
 * @throws When an instance part shows a set the list puts later or lacks, or the instance parts form
 *   a cycle, as {@link checkInstanceOrder} says, or a set does not build.
 */
export function buildSetsInOrder<Entry extends { readonly definition: ComponentDefinition }>(
  entries: readonly Entry[],
  context: BuildContext,
  source: (entry: Entry) => SetSource = (entry) => ({ definition: entry.definition, capture: undefined })
): readonly (readonly [Entry, BuiltComponent])[] {
  checkInstanceOrder(entries.map(({ definition }) => definition));
  const built = new Map<string, InnerSet>();
  return entries.map((entry) => {
    const { definition, capture, open } = source(entry);
    const set = buildComponentSet(
      definition,
      context,
      built,
      capture === undefined ? undefined : { capture, open }
    );
    built.set(entry.definition.key, set.componentSet);
    return [entry, set] as const;
  });
}

/**
 * Build the component set for every cell of the definition's matrix.
 *
 * @param definition - The component.
 * @param context - The compiled utilities and the synced variables.
 * @param inner - The sets built before this one, by key, which its instance parts show.
 * @param capture - The set's capture, which the set's cascade reads in place of the definition's
 *   classes, or undefined for the recipe cascade.
 * @returns The component set, its coverage and the font styles its text uses.
 * @throws When an instance part shows a set `inner` lacks, or a cell does not build.
 */
export function buildComponentSet(
  definition: ComponentDefinition,
  context: BuildContext,
  inner: ReadonlyMap<string, InnerSet> = new Map(),
  captured?: { readonly capture: SetCapture; readonly open: OpenPlacement | undefined }
): BuiltComponent {
  const coverage = new Map<string, CoverageRow>();
  const fontStyles = new Set<string>();
  const record = (row: Omit<CoverageRow, "component">): void => {
    const full = { component: definition.name, ...row };
    coverage.set(
      JSON.stringify([full.part, full.className, full.property, full.value, full.outcome, full.detail]),
      full
    );
  };
  const cells = matrixCells(definition.axes);
  const optional = optionalParts(definition, cells, undefined);
  const booleans = booleanPropertiesOf(definition.name, optional);
  // The inner sets list their own optional parts' properties, but a class of this set can read them.
  const presence = [...optional, ...innerOptionalParts(definition, cells, [], new Set([definition]))];
  if (presence.length > 0) {
    refusePresenceReads(
      definition.name,
      presence,
      new Set(definitionClasses(definition)),
      context.compiled.rulesByClass
    );
  }
  const cascade = setCascade(definition, context, record, captured, inner);
  // A capture-backed root clips only where some cell's root casts a shadow, whose spread Figma draws
  // only from a clipping frame, or CSS clips it; else its layers' rings show past its edge, as in the
  // browser.
  const unclippedRoot = captured !== undefined && !castsShadowOrClips(captured.capture);
  const instances = new InstanceParts(context, inner, record);
  // A capture-backed set names no classes, so its capture says which parts win a `scale`.
  const scaling =
    captured === undefined
      ? partsThatScale(partsOf(definition), cells, context.compiled)
      : partsThatScaleIn(captured.capture, definition.parts ?? []);
  const variants = cells.map((cell): VariantSpec => {
    const cellCascade = cascade.cell(cell);
    const plain: MapScope = {
      variant: variantKey(definition, cell),
      cell,
      context,
      scaling,
      instances,
      values: NO_VALUES,
      painted: new PaintedInstances(),
      translates: new WeakMap(),
    };
    const scope: MapScope =
      definition.viewport === undefined ? plain : { ...plain, viewport: definition.viewport };
    const rootCascade = cellCascade.root(definition, cell);
    // A root clips its content, because Figma draws a drop shadow's spread only from a frame
    // that clips, and a focus ring is a spread shadow. The first run on a real file stored the
    // ring's 2px spread as 0 on a root that did not clip. Clipping costs a root nothing, since
    // every child sits inside its padding, except a child's shadow at the root's edge, which a
    // root that paints nothing leaves unclipped through `rootOverflow`.
    const room = rootRoom(
      {
        width: previewWidthIn(definition, cell),
        height: definition.previewHeight ?? rootCascade.heightBasis,
      },
      rootCascade.style,
      context.variables,
      definition.viewport
    );
    const box = mapBox(definition, rootCascade, scope, room);
    const behind = box.fill === undefined ? cellCascade.backdrop() : undefined;
    const backdrop = behind && readBackdrop(behind, rootCascade.style, context.variables);
    const mapped = backdrop === undefined ? box : { ...box, fill: backdrop };
    if (definition.rootOverflow === "visible" && mapped.shadows.length > 0) {
      throw new KitUnmappable({
        message: `${definition.name}: a root that leaves its layers unclipped must cast no shadow, and ${variantKey(definition, cell)} casts one`,
      });
    }
    const unclipped = definition.rootOverflow === "visible" || unclippedRoot;
    const root: ComponentRootSpec = {
      name: definition.slot,
      ...mapped,
      clips: !unclipped,
    };
    placeRoot(rootCascade.style, room, context.variables, root.children, definition.viewport);
    if (root.clips && !clipsInCss(rootCascade.style)) {
      const shadowsOf = (layer: InstanceLayerSpec): readonly ShadowSpec[] =>
        rootEffects(layer) ??
        inner.get(layer.componentSet)?.variants.find((variant) => variant.key === layer.variant)?.root
          .shadows ??
        [];
      for (const clipped of clippedShadows(root, shadowsOf, context.variables, context.modes ?? [])) {
        record({
          part: clipped.part,
          className: "",
          property: "effects",
          value: `${clipped.reach}px`,
          outcome: "dropped",
          detail: clippedDetail(variantKey(definition, cell), clipped),
        });
      }
    }
    cellCascade.settle();
    instances.settle();
    for (const layer of walkLayers(root)) {
      if (layer.kind === "text") {
        fontStyles.add(layer.fontStyle);
      }
    }
    return { key: variantKey(definition, cell), properties: cell, root };
  });
  cascade.finish();
  instances.finish();
  const componentSet: BuiltComponent["componentSet"] = {
    key: definition.key,
    name: definition.name,
    axes: definition.axes,
    columnAxis: definition.columnAxis,
    textProperties: textProperties(definition),
    swapProperties: definition.swapProperties.map((property) => ({
      name: property.name,
      defaultIcon: iconKey(property.defaultIcon),
    })),
    variants,
  };
  return {
    // A set without an optional part leaves the field out, so a set built before it keeps its spec.
    componentSet: booleans.length === 0 ? componentSet : { ...componentSet, booleanProperties: booleans },
    coverage: [...coverage.values()],
    fontStyles: [...fontStyles],
  };
}

/** The cascade of one cell, as the builder drives it, from the recipe or from the capture. */
type CellEngine = {
  readonly root: (definition: ComponentDefinition, cell: Cell) => BoxCascade;
  readonly backdrop: () => LayerStyle | undefined;
  readonly settle: () => void;
};

/** The cascade of a set's cells, as the builder drives it, and what records its logs once they cascaded. */
type SetEngine = { readonly cell: (cell: Cell) => CellEngine; readonly finish: () => void };

/** The cascade of a set's cells, from the definition's classes or from the set's capture. */
function setCascade(
  definition: ComponentDefinition,
  context: BuildContext,
  record: (row: Omit<CoverageRow, "component">) => void,
  source: { readonly capture: SetCapture; readonly open: OpenPlacement | undefined } | undefined,
  inner: ReadonlyMap<string, InnerSet>
): SetEngine {
  if (source !== undefined) {
    const { capture, open } = source;
    const captured = new CaptureSetCascade({
      capture,
      definition,
      context,
      record,
      captureOf: (key) => {
        const kept = keptCapture(key);
        return kept === undefined || Result.isFailure(kept) ? undefined : kept.success;
      },
      open,
      anchorWidth: (cell) =>
        open?._tag === "anchored"
          ? anchorWidth(definition, capture, cell, inner)
          : // A popup set alone has no anchor of its own: its sample's anchor fills the host it renders in.
            sampleAnchorWidth(definition, cell),
    });
    return {
      cell: (cell) => {
        const cascade = captured.cell(cell);
        return {
          root: (root) => cascade.root(root.slot),
          backdrop: () => cascade.backdrop(),
          settle: () => {
            cascade.settle();
          },
        };
      },
      finish: () => {
        captured.finish();
      },
    };
  }
  const recipe = new SetCascade(makeStateTable(definition), context, record);
  return {
    cell: (cell) => {
      const cascade = recipe.cell(cell);
      return {
        root: (root, shown) =>
          cascade.root(root.classesFor(shown), root.slot, {
            declarations: root.inheritedFor?.(shown) ?? [],
            ancestors: root.ancestorsFor?.(shown) ?? [],
            defaults: root.elementDefaults ?? [],
            inline: root.styleFor?.(shown) ?? [],
          }),
        backdrop: () => cascade.backdrop(),
        settle: () => {
          cascade.settle();
        },
      };
    },
    finish: () => {
      recipe.finish();
    },
  };
}

/** The shadows an instance overrides on its root, or undefined where it draws its variant's own. */
function rootEffects(layer: InstanceLayerSpec): readonly ShadowSpec[] | undefined {
  for (const override of layer.overrides ?? []) {
    if (override.field === "effects" && override.path.length === 0) {
      return override.shadows;
    }
  }
  return undefined;
}

/** The `overflow` values that clip a box's content in CSS (CSS Overflow 3 §3). */
const CSS_CLIPS: ReadonlySet<string> = new Set(["hidden", "clip", "auto", "scroll"]);

/**
 * Whether a box clips its content down in CSS, through `overflow` or `overflow-y`, as Tailwind
 * compiles `overflow-hidden` to the shorthand. A `visible` axis beside one that clips computes to
 * `auto` (CSS Overflow 3 §3), so either one clipping clips both.
 */
function clipsInCss(style: LayerStyle): boolean {
  return ["overflow", "overflow-x", "overflow-y"].some((property) =>
    normalizeCss(style.resolved(property) ?? "")
      .split(" ")
      .some((value) => CSS_CLIPS.has(value))
  );
}

/** Why a coverage row lists a shadow that reaches past a variant's root, which the root's clip cuts. */
function clippedDetail(variant: string, { reach, edges, modes }: ClippedShadow): string {
  const where = modes === undefined ? "" : ` at ${modes.join(" and ")}`;
  return `in ${variant} the shadow reaches ${reach}px past the root's ${edges}${where}, which CSS paints, since the root does not clip, while the root of every Figma variant clips so it can draw its own ring (PR2)`;
}

/**
 * The TEXT properties a set's labels name, each once, in the order the boxes first name them. One
 * property holds one default, so two labels that name it must start with the same characters.
 *
 * @throws When two labels name one property with different characters, naming both labels.
 */
function textProperties(definition: ComponentDefinition): readonly TextPropertySpec[] {
  const named = new Map<string, { readonly defaultValue: string; readonly label: string }>();
  for (const { box, label } of labelsOf(definition, definition.slot)) {
    if (label.textProperty === undefined) {
      continue;
    }
    const where = `${box} / ${label.name}`;
    const first = named.get(label.textProperty);
    if (first === undefined) {
      named.set(label.textProperty, { defaultValue: label.characters, label: where });
    } else if (first.defaultValue !== label.characters) {
      throw new KitUnmappable({
        message: `${definition.name}: the labels ${first.label} and ${where} both set the ${label.textProperty} property, one starting as "${first.defaultValue}" and one as "${label.characters}". A TEXT property holds one default, so give them one text or a property each.`,
      });
    }
  }
  return [...named].map(([name, { defaultValue }]) => ({ name, defaultValue }));
}

/**
 * A definition's optional parts, depth first, each with every `data-slot` that hiding it hides, as the
 * markup renders them in the cells given: its own and those of the elements inside it, through the
 * instances it holds, whose inner roots and parts the DOM holds too.
 *
 * @param definition - The definition.
 * @param cells - Its cells, or the inner cells an instance of it shows.
 * @param inside - The instance that holds the definition's root, for an inner set's parts.
 * @returns The parts.
 */
function optionalParts(
  definition: ComponentDefinition,
  cells: readonly Cell[],
  inside: OptionalPart["inside"]
): readonly OptionalPart[] {
  const parts = allPartsOf(definition).flatMap((part): OptionalPart[] =>
    part.optional === undefined
      ? []
      : [
          {
            name: "kind" in part ? part.of.slot : partName(part),
            property: part.optional,
            slots: renderedSlots(part, cells),
            elements: [],
            inside,
          },
        ]
  );
  // An icon is an `<svg>` with no slot, listed once by its key however many cells show it.
  const icons = new Map(
    [definition, ...partsOf(definition)].flatMap((box) =>
      cells.flatMap((cell) => box.iconsFor(cell).map((slot) => [slot.key, slot] as const))
    )
  );
  return [
    ...parts,
    ...[...icons.values()].flatMap((slot): OptionalPart[] =>
      slot.optional === undefined
        ? []
        : [{ name: slot.name, property: slot.optional, slots: [], elements: ["svg"], inside }]
    ),
  ];
}

/**
 * The optional parts of the inner sets a box's instance parts show, in the inner cells each instance
 * shows, through the instances those sets hold in turn. A definition the walk is already inside adds
 * nothing again.
 *
 * @param box - The definition whose instance parts the walk starts at.
 * @param cells - The cells of the definition, or the inner cells an instance of it shows.
 * @param path - The keys of the instance parts from the set down to the box.
 * @param inside - The definitions the walk is inside.
 * @returns The parts, each with the instance that holds it and its set.
 */
function innerOptionalParts(
  box: ComponentDefinition,
  cells: readonly Cell[],
  path: readonly string[],
  inside: ReadonlySet<ComponentDefinition>
): readonly OptionalPart[] {
  return instancePartsOf(box).flatMap((part) => {
    const { of } = part;
    if (inside.has(of)) {
      return [];
    }
    const shown = cells.filter((cell) => part.shownIn(cell)).map((cell) => part.cell(cell));
    const keys = [...path, part.key];
    return [
      ...optionalParts(of, shown, { instance: keys.join(" / "), set: of.name }),
      ...innerOptionalParts(of, shown, keys, new Set([...inside, of])),
    ];
  });
}

/**
 * The label of a box and of every frame part below it, depth first, with the layer name of its box.
 * An instance part's labels belong to its inner set.
 */
function labelsOf(
  box: BoxDefinition,
  name: string
): readonly { readonly box: string; readonly label: LabelDefinition }[] {
  return [
    ...(box.label === undefined ? [] : [{ box: name, label: box.label }]),
    ...framePartsOf(box).flatMap((part) => labelsOf(part, partName(part))),
  ];
}

/**
 * The width that stands for Base UI's `--anchor-width` in an anchored composite's cell: the anchor's
 * width as the build maps it, for any anchor. An anchor that fills the composite across, as the
 * placement rule stretches a block-level one, is as wide as the composite's host. An anchor whose
 * own set fixes its width is that width. An anchor that hugs its text, as a Select trigger does,
 * has a width only its text sets, which the spec does not hold, so this is undefined and the cascade
 * draws the popup at its own `min-width`. Base UI makes the popup `max(anchor, minimum)`, so that
 * holds for an anchor narrower than the minimum only; the popup's width never follows its rows, as
 * the perturbation probe measures.
 */
function anchorWidth(
  definition: ComponentDefinition,
  capture: SetCapture,
  cell: Cell,
  inner: ReadonlyMap<string, InnerSet>
): string | undefined {
  const captured = capture.cells.find((each) => each.key === variantKey(definition, cell));
  if (captured === undefined) {
    return undefined;
  }
  const placement = anchoredPlacement(captured, 0, capture.declarations);
  const host = previewWidthIn(definition, cell);
  if (placement.anchorFills) {
    return host === undefined ? undefined : `${String(host)}px`;
  }
  const slot = placement.anchor.root.attributes["data-slot"];
  for (const part of definition.parts ?? []) {
    if (!("kind" in part) || !part.shownIn(cell)) {
      continue;
    }
    const innerCell = part.cell(cell);
    if (instanceRootSlotOf(part, innerCell) !== slot) {
      continue;
    }
    const variant = inner
      .get(part.of.key)
      ?.variants.find((each) => each.key === variantKey(part.of, innerCell));
    const width = variant?.root.sizing.horizontal;
    return width?.kind === "fixed" && width.length.kind === "literal"
      ? `${String(width.length.value)}px`
      : undefined;
  }
  return undefined;
}

/**
 * The width of a popup set's sample anchor, which fills the host the sample renders in, where the
 * set names the host's width; undefined otherwise, for an anchor that hugs its text, as a Select
 * trigger does, which the cascade draws as {@link anchorWidth} says.
 */
function sampleAnchorWidth(definition: ComponentDefinition, cell: Cell): string | undefined {
  const width = previewWidthIn(definition, cell);
  return width === undefined ? undefined : `${String(width)}px`;
}

/**
 * An anchored composite's definition with its instance parts in the order its placement rule draws
 * them: the popup first on the `top` and `left` sides, the anchor first otherwise, as
 * {@link anchoredPlacement} orders the roots its first cell measures.
 *
 * @param definition - The composite's definition, as its manifest gives it.
 * @param capture - Its capture.
 * @returns The definition with its parts in drawn order.
 */
export function inPlacementOrder(definition: ComponentDefinition, capture: SetCapture): ComponentDefinition {
  const [first] = capture.cells;
  const parts = definition.parts ?? [];
  if (first === undefined) {
    return definition;
  }
  const slots = anchoredPlacement(first, 0, capture.declarations).roots.map(
    ({ root }) => root.attributes["data-slot"]
  );
  const [cell] = matrixCells(definition.axes);
  const rank = (part: (typeof parts)[number]): number =>
    "kind" in part && cell !== undefined ? slots.indexOf(instanceRootSlotOf(part, part.cell(cell))) : -1;
  return { ...definition, parts: parts.toSorted((left, right) => rank(left) - rank(right)) };
}
