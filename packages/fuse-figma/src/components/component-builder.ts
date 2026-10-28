/**
 * Turn a recipe into a Figma component set. For every cell of the variant matrix the builder
 * asks `cascade.ts` for the computed style of the root, each part and each icon, and
 * `box-mapping.ts` maps it onto Figma fields. Every declaration it reads lands in the coverage
 * table with what became of it. `component-spec.ts` holds the definition types this module reads.
 */

import { mapBox, NO_VALUES, partName } from "./box-mapping";
import type { MapScope } from "./box-mapping";
import { readBackdrop } from "./box-paint";
import { rootRoom } from "./box-sizing";
import { KitUnmappable } from "./build-errors";
import { SetCascade } from "./cascade";
import type { LayerStyle } from "./cascade";
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
import { allPartsOf, framePartsOf, instancePartsOf, partsOf, renderedSlots } from "./definition-parts";
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
 * Build the component sets of a list of definitions in its order, each with the sets before it at
 * hand, so a set builds after the sets its instance parts show.
 *
 * @template Entry - What the list holds for each set, its definition among it.
 * @param entries - The definitions, each set after the sets it holds instances of.
 * @param context - The compiled utilities and the synced variables.
 * @returns Each entry with its built set, in the list's order.
 * @throws When an instance part shows a set the list puts later or lacks, or the instance parts form
 *   a cycle, as {@link checkInstanceOrder} says, or a set does not build.
 */
export function buildSetsInOrder<Entry extends { readonly definition: ComponentDefinition }>(
  entries: readonly Entry[],
  context: BuildContext
): readonly (readonly [Entry, BuiltComponent])[] {
  checkInstanceOrder(entries.map(({ definition }) => definition));
  const built = new Map<string, InnerSet>();
  return entries.map((entry) => {
    const set = buildComponentSet(entry.definition, context, built);
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
 * @returns The component set, its coverage and the font styles its text uses.
 * @throws When an instance part shows a set `inner` lacks, or a cell does not build.
 */
export function buildComponentSet(
  definition: ComponentDefinition,
  context: BuildContext,
  inner: ReadonlyMap<string, InnerSet> = new Map()
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
  const cascade = new SetCascade(makeStateTable(definition), context, record);
  const instances = new InstanceParts(context, inner, record);
  const scaling = partsThatScale(partsOf(definition), cells, context.compiled);
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
    const rootCascade = cellCascade.root(definition.classesFor(cell), definition.slot, {
      declarations: definition.inheritedFor?.(cell) ?? [],
      ancestors: definition.ancestorsFor?.(cell) ?? [],
      defaults: definition.elementDefaults ?? [],
      inline: definition.styleFor?.(cell) ?? [],
    });
    // A root clips its content, because Figma draws a drop shadow's spread only from a frame
    // that clips, and a focus ring is a spread shadow. The first run on a real file stored the
    // ring's 2px spread as 0 on a root that did not clip. Clipping costs a root nothing, since
    // every child sits inside its padding, except a child's shadow at the root's edge, which a
    // root that paints nothing leaves unclipped through `rootOverflow`.
    const room = rootRoom(
      { width: previewWidthIn(definition, cell), height: definition.previewHeight },
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
    const root: ComponentRootSpec = {
      name: definition.slot,
      ...mapped,
      clips: definition.rootOverflow !== "visible",
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
