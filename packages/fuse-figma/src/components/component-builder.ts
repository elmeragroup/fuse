/**
 * Turn a set's capture into a Figma component set. For every cell of the variant matrix the builder
 * asks `capture/capture-cascade.ts` for the computed style of the root, each part and each icon, and
 * `box-mapping.ts` maps it onto Figma fields. Every declaration it reads lands in the coverage
 * table with what became of it. `component-spec.ts` holds the definition types this module reads.
 */

import {
  anchoredPlacement,
  anchorSpan,
  CaptureSetCascade,
  castsShadowOrClips,
  partsThatScaleIn,
} from "../capture/capture-cascade";
import type { AnchorWidth, OpenPlacement } from "../capture/capture-cascade";
import type { CapturedRoot, SetCapture } from "../capture/capture-format";
import { kitFamily } from "../kit-fonts";
import { mapBox, NO_VALUES } from "./box-mapping";
import type { MapScope } from "./box-mapping";
import { readBackdrop } from "./box-paint";
import { KitUnmappable } from "./build-errors";
import { clippedShadows } from "./clipped-shadows";
import type { ClippedShadow } from "./clipped-shadows";
import { possibleCells, previewWidthIn, variantKey } from "./component-spec";
import type {
  BuildContext,
  BuiltComponent,
  BoxDefinition,
  Cell,
  ComponentDefinition,
  LabelDefinition,
} from "./component-spec";
import type { CoverageRow, RecordedRow } from "./coverage";
import { framePartsOf, instanceRootSlotOf, instancingSlots } from "./definition-parts";
import { DrawnParts } from "./drawn-parts";
import type { DrawnPart } from "./drawn-parts";
import { checkInstanceOrder, InstanceParts } from "./instance-parts";
import type { InnerSet } from "./instance-parts";
import { iconKey, walkLayers } from "./kit-spec";
import type {
  ComponentRootSpec,
  FontSpec,
  InstanceLayerSpec,
  ShadowSpec,
  TextPropertySpec,
  VariantSpec,
} from "./kit-spec";
import { booleanPropertiesOf, optionalParts } from "./optional-parts";
import { partName, prepareParts } from "./part-preparation";
import { placeRoot } from "./placement";
import { clipsInCss, rootClips, wrapHanging } from "./root-clip";
import { rootRoom } from "./root-room";
import { PaintedInstances } from "./stacking";

/** What a set builds from: the definition the mapping walks, and the capture its cascade reads. */
export type SetSource = {
  readonly definition: ComponentDefinition;
  readonly capture: SetCapture;
  /** How an open composite places its cells' roots, as its manifest names it; undefined otherwise. */
  readonly open?: OpenPlacement;
};

/**
 * Build the component sets of a list of sources in its order, each with the sets before it at
 * hand, so a set builds after the sets its instance parts show. A set that holds another as an
 * instance reads the classes the composite passes from the inner set's capture in the list.
 *
 * It takes definitions, so it does not refuse an icon that declares a place it does not own, as
 * `manifestDefinition` does. Every definition the build maps comes from `manifestDefinition` in
 * `build-kit.ts`, so no production caller skips that check. Only tests hand it definitions of
 * their own.
 *
 * @param sources - Each set's definition and capture, each set after the sets it holds instances of.
 * @param context - The compiled utilities and the synced variables.
 * @returns Each built set, in the list's order.
 * @throws When an instance part shows a set the list puts later or lacks, or the instance parts form
 *   a cycle, as {@link checkInstanceOrder} says, or a set does not build.
 */
export function buildSetsInOrder(
  sources: readonly SetSource[],
  context: BuildContext
): readonly BuiltComponent[] {
  checkInstanceOrder(sources.map(({ definition }) => definition));
  const holders = instancingSlots(sources.map(({ definition }) => definition));
  const captures = new Map(sources.map(({ definition, capture }) => [definition.key, capture]));
  const built = new Map<string, InnerSet>();
  return sources.map(({ definition, capture, open }) => {
    const instancedIn = holders.get(definition.key) ?? new Set<string>();
    const { wrappedRoots, ...set } = buildComponentSet(definition, context, built, {
      capture,
      open,
      instancedIn,
      captureOf: (key) => captures.get(key),
    });
    built.set(definition.key, { ...set.componentSet, wrappedRoots });
    return set;
  });
}

/**
 * Build the component set for every cell of the definition's matrix the component can show.
 *
 * @param definition - The component.
 * @param context - The compiled utilities and the synced variables.
 * @param inner - The sets built before this one, by key, which its instance parts show.
 * @param captured - The set's capture, which its cascade reads, how an open composite places its
 *   cells' roots, the root slots of the sets that hold it as an instance, and the captures of the
 *   sets before it.
 * @returns The component set, its coverage and the font styles its text uses, and the keys of the
 *   variants whose root `wrapHanging` wrapped.
 * @throws When an instance part shows a set `inner` lacks, or a cell does not build.
 */
function buildComponentSet(
  definition: ComponentDefinition,
  context: BuildContext,
  inner: ReadonlyMap<string, InnerSet>,
  captured: CapturedSource
): BuiltComponent & { readonly wrappedRoots: ReadonlySet<string> } {
  const coverage = new Map<string, CoverageRow>();
  const fonts = new Map<string, FontSpec>();
  // Each captured declaration a recorded row accounts for, by cell; the table keeps none of them.
  const accounted = new Map<string, Set<string>>();
  const record = ({ at = [], ...row }: RecordedRow): void => {
    for (const { cell, declaration } of at) {
      accounted.set(cell, (accounted.get(cell) ?? new Set()).add(declaration));
    }
    const full = { component: definition.name, ...row };
    coverage.set(
      JSON.stringify([full.part, full.className, full.property, full.value, full.outcome, full.detail]),
      full
    );
  };
  const cells = possibleCells(definition);
  const optional = optionalParts(definition, cells, partName);
  const booleans = booleanPropertiesOf(definition.name, optional);
  const cascade = setCascade(definition, context, record, captured, inner);
  // Whether some cell's root casts a shadow or clips in CSS, which `rootClips` reads.
  const setClips = castsShadowOrClips(captured.capture);
  const instances = new InstanceParts(context, inner, captured.captureOf, record);
  // The capture says which parts win a `scale`.
  const scaling = partsThatScaleIn(captured.capture, definition.parts ?? []);
  // Each cell's drawn parts, by the variant's key, as `drawn-parts.ts` records them.
  const drawnParts = new Map<string, readonly DrawnPart[]>();
  const wrappedRoots = new Set<string>();
  const recordedParts = (cell: string): readonly DrawnPart[] => {
    const parts = drawnParts.get(cell);
    if (parts === undefined) {
      throw new KitUnmappable({
        message: `${definition.name}: the build recorded no drawn parts for ${cell}`,
      });
    }
    return parts;
  };
  const variants = cells.map((cell): VariantSpec => {
    const cellCascade = cascade.cell(cell);
    const drawn = new DrawnParts();
    const plain: MapScope = {
      variant: variantKey(definition, cell),
      cell,
      context,
      scaling,
      instances,
      values: NO_VALUES,
      painted: new PaintedInstances(),
      translates: new WeakMap(),
      drawn,
    };
    const scope: MapScope =
      definition.viewport === undefined ? plain : { ...plain, viewport: definition.viewport };
    const rootCascade = cellCascade.root(definition.slot);
    // A root clips its content, because Figma draws a drop shadow's spread only from a frame
    // that clips, and a focus ring is a spread shadow. The first run on a real file stored the
    // ring's 2px spread as 0 on a root that did not clip. Clipping costs a root nothing, since
    // every child sits inside its padding, except a child's shadow at the root's edge, which a
    // root that paints nothing leaves unclipped through `rootOverflow`.
    const room = rootRoom(
      {
        width: previewWidthIn(definition, cell),
        height: definition.previewHeight ?? rootCascade.heightBasis,
        // A root the rows around it stretch to its host takes the host's height, the preview's.
        stretched:
          rootCascade.stretchedToHost === true && definition.previewHeight?.css === undefined
            ? definition.previewHeight?.pixels
            : undefined,
      },
      rootCascade.style,
      context.variables,
      definition.viewport
    );
    const ordered =
      rootCascade.drawnSlots === undefined
        ? definition
        : inDrawnOrder(definition, rootCascade.drawnSlots, cell);
    const box = mapBox(ordered, rootCascade, scope, room, prepareParts(ordered, rootCascade, scope));
    const behind = box.fill === undefined ? cellCascade.backdrop() : undefined;
    const backdrop = behind && readBackdrop(behind, rootCascade.style, context.variables);
    const mapped = backdrop === undefined ? box : { ...box, fill: backdrop };
    if (definition.rootOverflow === "visible" && mapped.shadows.length > 0) {
      throw new KitUnmappable({
        message: `${definition.name}: a root that leaves its layers unclipped must cast no shadow, and ${variantKey(definition, cell)} casts one`,
      });
    }
    const clipped: ComponentRootSpec = {
      name: definition.slot,
      ...mapped,
      clips: rootClips(
        { style: rootCascade.style, shadows: mapped.shadows, children: mapped.children },
        { overflowVisible: definition.rootOverflow === "visible", castsShadowOrClips: setClips }
      ),
    };
    placeRoot(rootCascade.style, room, context.variables, clipped.children, definition.viewport);
    const wrapped = wrapHanging(clipped, clipsInCss(rootCascade.style), definition.slot);
    const root = wrapped ?? clipped;
    if (wrapped !== undefined) {
      wrappedRoots.add(variantKey(definition, cell));
    }
    drawnParts.set(
      variantKey(definition, cell),
      drawn.resolve(root, rootCascade.drawnAt, variantKey(definition, cell))
    );
    if (clipped.clips && !clipsInCss(rootCascade.style)) {
      const shadowsOf = (layer: InstanceLayerSpec): readonly ShadowSpec[] =>
        rootEffects(layer) ??
        inner.get(layer.componentSet)?.variants.find((variant) => variant.key === layer.variant)?.root
          .shadows ??
        [];
      // A wrapped root's hanging layers cast no shadow (`wrapHanging`), so the clipped root's cuts are
      // those of the frame that draws its box.
      for (const cut of clippedShadows(clipped, shadowsOf, context.variables, context.modes ?? [])) {
        record({
          part: cut.part,
          className: "",
          property: "effects",
          value: `${cut.reach}px`,
          outcome: "dropped",
          detail: clippedDetail(variantKey(definition, cell), cut),
        });
      }
    }
    cellCascade.settle();
    instances.settle();
    for (const layer of walkLayers(root)) {
      if (layer.kind === "text") {
        const family = kitFamily(layer.fontFamily);
        for (const style of layer.weight?.faces ?? [layer.fontStyle]) {
          fonts.set(`${family} ${style}`, { family, style });
        }
      }
    }
    return { key: variantKey(definition, cell), properties: cell, root };
  });
  cascade.finish();
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
    wrappedRoots,
    // A set without an optional part leaves the field out, so a set built before it keeps its spec.
    componentSet: booleans.length === 0 ? componentSet : { ...componentSet, booleanProperties: booleans },
    coverage: [...coverage.values()],
    fonts: [...fonts.values()],
    accounting: new Map(
      [...cascade.instancePlaces()].map(([cell, instances]) => [
        cell,
        { accounted: accounted.get(cell) ?? new Set<string>(), instances, parts: recordedParts(cell) },
      ])
    ),
  };
}

/**
 * A set's capture, which its cascade reads, how an open composite places its cells' roots, and the
 * root `data-slot` of each set that holds it as an instance, which no root's fill reaches past.
 */
type CapturedSource = {
  readonly capture: SetCapture;
  readonly open: OpenPlacement | undefined;
  readonly instancedIn: ReadonlySet<string>;
  /** The capture of a set before this one, by its key, which tells the classes an instance of it is passed. */
  readonly captureOf: (key: string) => SetCapture | undefined;
};

/** The cascade of a set's cells from the set's capture. */
function setCascade(
  definition: ComponentDefinition,
  context: BuildContext,
  record: (row: RecordedRow) => void,
  source: CapturedSource,
  inner: ReadonlyMap<string, InnerSet>
): CaptureSetCascade {
  const { capture, open, instancedIn, captureOf } = source;
  return new CaptureSetCascade({
    capture,
    definition,
    context,
    record,
    captureOf,
    open,
    anchorWidth: (cell) =>
      open?._tag === "anchored"
        ? anchorWidth(definition, capture, cell, inner)
        : // A popup set alone has no anchor of its own: its sample's anchor fills the host it renders in.
          sampleAnchorWidth(definition, cell),
    instancedIn,
  });
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
 * The width that stands for Base UI's `--anchor-width` in an anchored composite's cell, one of the
 * outcomes {@link AnchorWidth} lists, chosen by the anchor's span as {@link anchorSpan} reads it from
 * the capture. A `column` anchor gives `100%` of the column, a `limited` one leaves the width
 * unresolved, and an `own` one gives its set's fixed width or, where it hugs, the popup's minimum.
 */
function anchorWidth(
  definition: ComponentDefinition,
  capture: SetCapture,
  cell: Cell,
  inner: ReadonlyMap<string, InnerSet>
): AnchorWidth {
  const captured = capture.cells.find((each) => each.key === variantKey(definition, cell));
  if (captured === undefined) {
    return HUGGING_ANCHOR;
  }
  const placement = anchoredPlacement(captured, 0, capture.declarations);
  switch (anchorSpan(placement, previewWidthIn(definition, cell))) {
    case "column":
      return { _tag: "length", css: "100%" };
    case "limited":
      return { _tag: "unresolved" };
    case "own":
      return ownAnchorWidth(definition, cell, placement.anchor, inner);
  }
}

/** What stands for the anchor's width where it hugs its content, as {@link AnchorWidth} says. */
const HUGGING_ANCHOR: AnchorWidth = { _tag: "minimum" };

/**
 * The width of an anchor whose width is its own: its set's fixed literal width, or, for an anchor
 * that hugs its content, the popup's own minimum, as {@link anchorWidth} says.
 */
function ownAnchorWidth(
  definition: ComponentDefinition,
  cell: Cell,
  anchor: CapturedRoot,
  inner: ReadonlyMap<string, InnerSet>
): AnchorWidth {
  const slot = anchor.root.attributes["data-slot"];
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
      ? { _tag: "length", css: `${String(width.length.value)}px` }
      : HUGGING_ANCHOR;
  }
  return HUGGING_ANCHOR;
}

/**
 * The width of a popup set's sample anchor, which fills the host the sample renders in, where the
 * set names the host's width. Otherwise the anchor hugs its text, as a Select trigger does, and the
 * width is the popup's own `min-width` (`minimum`), as {@link AnchorWidth} says.
 */
function sampleAnchorWidth(definition: ComponentDefinition, cell: Cell): AnchorWidth {
  const width = previewWidthIn(definition, cell);
  return width === undefined ? HUGGING_ANCHOR : { _tag: "length", css: `${String(width)}px` };
}

/**
 * An anchored composite's definition with its instance parts in the order its placement rule draws
 * them in one cell, as the cell's root cascade lists their slots: the popup first on the `top` and
 * `left` sides, the anchor first otherwise. A set whose cells open the popup on different sides, as
 * `Tooltip (open)` does, orders each variant's layers its own way.
 *
 * @param definition - The composite's definition, as its manifest gives it.
 * @param slots - The slots of the roots the cell draws, in drawn order.
 * @param cell - The cell to order the parts for.
 * @returns The definition with its parts in the cell's drawn order.
 */
function inDrawnOrder(
  definition: ComponentDefinition,
  slots: readonly (string | undefined)[],
  cell: Cell
): ComponentDefinition {
  const parts = definition.parts ?? [];
  const rank = (part: (typeof parts)[number]): number =>
    "kind" in part ? slots.indexOf(instanceRootSlotOf(part, part.cell(cell))) : -1;
  return { ...definition, parts: parts.toSorted((left, right) => rank(left) - rank(right)) };
}
