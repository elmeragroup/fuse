/**
 * The perturbation probe's reading of the boxes it measured: the horizontal sizing each box's
 * widths imply, and the contradictions between that sizing and the kind the capture build maps for
 * the layer the box draws. `capture/perturbation.ts` measures the boxes in the browser, and this
 * module reads them with no browser, so each rule holds against widths written by hand.
 */

import { widthAround } from "../components/box-sizing.ts";
import type { DrawnPart } from "../components/drawn-parts.ts";
import { AXIS_CONSTRAINT, layerAt, outOfLayout } from "../components/kit-spec.ts";
import type {
  BoxSpec,
  ChildLayerSpec,
  ComponentRootSpec,
  ComponentSetSpec,
  InstanceLayerSpec,
  NumberSpec,
  RotationSpec,
  SizeSpec,
} from "../components/kit-spec.ts";
import type { ProbedBox, ProbedCell } from "./perturbation.ts";

/**
 * What the probe infers a box's horizontal sizing is. `tracks` is a box as wide as its parent's
 * content box in every run: it fills its parent, or it is the only child its hugging parent hugs.
 * `overflows` is a box its longer text pushed past its parent's content box, as text that cannot wrap
 * does, which tells hug from fill no more. `fill-viewport` is a `position: fixed` box that fills its
 * container, the viewport the sample declares, which draws fixed at that viewport's size. `fits` is a
 * box that widens with its text and stops at the room its parent leaves it, as `w-fit` does: it hugs
 * short text and fills past it, so the probe cannot tell the two apart, and either kind agrees. `unknown`
 * is a box without text whose root's container the probe could not widen, or whose container
 * follows the root's own text, so widening it shows nothing the page would do.
 */
export type InferredKind =
  | "fill"
  | "fill-viewport"
  | "hug"
  | "fixed"
  | "not-fill"
  | "tracks"
  | "overflows"
  | "fits"
  | "unknown";

/** How much a width must change, in CSS pixels, for the probe to read a change. */
const CHANGED = 1;

/**
 * Infer a box's horizontal sizing from its widths.
 *
 * @param box - The box as measured.
 * @returns What the deltas say.
 */
export function inferKind(box: ProbedBox): InferredKind {
  if (box.wider - box.base > CHANGED) {
    return box.fixedInViewport ? "fill-viewport" : "fill";
  }
  // Without text, a box narrower than its parent does not fill it, and otherwise only a parent that
  // widened tells a box that fills it from one that does not.
  const withoutText: InferredKind =
    box.widened && (box.parentWidened || !box.tracksParent) ? "not-fill" : "unknown";
  // Text that cannot widen the box, as a visually hidden label, tells nothing a text run would. A
  // box that grew in either text run was reached, though the longer run read as not reaching it, as
  // text held at a `min-width` reaches its box only once the far longer text passes the minimum.
  const grew = [box.longer, box.longest].some((run) => run - box.base > CHANGED);
  if (!box.text || !(box.textReaches || grew)) {
    return withoutText;
  }
  if (box.tracksParent && !box.root) {
    return "tracks";
  }
  if (box.overflows && !box.root) {
    return "overflows";
  }
  if (grew && box.capsAtParent && !box.root) {
    return "fits";
  }
  // A width is fixed only where every run kept it: an auto width held at a minimum, as an
  // inline-block's `min-width`, keeps it under longer text and grows past it under far longer text.
  return [box.longer, box.longest].some((run) => Math.abs(run - box.base) > CHANGED) ? "hug" : "fixed";
}

/**
 * What else decides how a mapped layer's width behaves: whether it is an absolute layer whose
 * horizontal constraint resizes it with its parent (`SCALE` or `STRETCH`), as Meter's fill keeps its
 * share of the bar, and whether a literal maximum width holds it at the width the probe measured, as
 * Empty's content sits at its `max-w-sm`.
 */
export type MappedWidth = {
  readonly resizesWithParent: boolean;
  readonly heldAtMaximum: boolean;
  /**
   * The width a hugging layer draws as its text lengthens. `follows-text` is a hug whose width the
   * probe cannot add up, as one around text, or a layer that does not hug. `kept` is a hug of only
   * layers whose widths are fixed, at any depth, so no text it holds widens it, where the box kept
   * the width that hug draws in every run that lengthened its text, as the Navigation menu popup
   * hugs its `w-64` list to the 264px the browser lays it out at. `outgrown` is such a hug where the
   * box did not keep that width.
   */
  readonly hugWidth: "follows-text" | "kept" | "outgrown";
  /**
   * Whether the layer is fixed at a width, literal or bound to a variable read at the probe page's
   * density and held at its minimum, and the box kept that width in every run that lengthened its
   * text, as a calendar day's `size-9` button in the cell that hugs it.
   */
  readonly fixedAtMeasuredWidth: boolean;
  /**
   * Whether the box is a table cell and the layer is fixed at the width the box measured as
   * rendered. A table cell's set width is a minimum, so text longer than the cell widens it (CSS 2.1
   * §17.5.2.2), and the kit draws the cell fixed at the width the browser renders it, as Calendar's
   * 36px weekday cell. A word wider than such a cell widens Chromium's column and not the kit's
   * fixed cell, which the probe does not see.
   */
  readonly cellFixedAtRenderedWidth: boolean;
};

/**
 * Whether a mapped horizontal sizing agrees with what the probe inferred. A root that fills its host
 * draws fixed at the host's width, since a component's root has no parent in Figma. A fixed layer
 * that resizes with its parent agrees with a box that fills, and a filling layer held at its maximum
 * agrees with a box that kept its width, as does a hugging layer that holds only fixed widths. Such
 * a hug draws one width whatever its text, so it agrees with no box that outgrew that width. A
 * table cell that grows with its text agrees with a layer fixed at the width it renders.
 *
 * @param inferred - The inferred kind.
 * @param mapped - The layer's horizontal sizing.
 * @param root - Whether the box is a set's root.
 * @param width - What else decides the layer's width.
 * @returns True where they agree.
 */
export function agrees(inferred: InferredKind, mapped: SizeSpec, root: boolean, width: MappedWidth): boolean {
  switch (inferred) {
    case "fill":
      return mapped.kind === "fill" || (mapped.kind === "fixed" && (root || width.resizesWithParent));
    case "fill-viewport":
      return mapped.kind === "fixed" || mapped.kind === "fill";
    case "hug":
      return (
        (mapped.kind === "hug" && width.hugWidth !== "outgrown") ||
        (mapped.kind === "fixed" && width.cellFixedAtRenderedWidth)
      );
    case "fixed":
      return (
        mapped.kind === "fixed" ||
        (mapped.kind === "fill" && width.heldAtMaximum) ||
        (mapped.kind === "hug" && width.hugWidth === "kept")
      );
    case "not-fill":
      return mapped.kind !== "fill";
    case "tracks":
      return mapped.kind !== "fixed" || width.fixedAtMeasuredWidth;
    case "overflows":
    case "fits":
      return mapped.kind === "fill" || mapped.kind === "hug";
    case "unknown":
      return true;
  }
}

/**
 * A variant as a layer of it draws: its root, and whether each BOOLEAN property of its set is on
 * there, which decides whether a layer linked to it takes room.
 */
type DrawnVariant = {
  readonly root: ComponentRootSpec;
  /** Whether the BOOLEAN property of the variant's set with this name is on. */
  readonly shows: (property: string) => boolean;
};

/**
 * What the probe reads of the built kit to tell the width a layer draws: a spec length's pixels at
 * the probe page's density, and the variant an instance layer shows.
 */
export type SizingReads = {
  /**
   * A spec length's pixels at the density the probe's page renders, undefined where that density
   * does not decide them. The probe renders at one density, so a length bound to a variable is
   * checked at that density's value only.
   */
  readonly lengthOf: (length: NumberSpec) => number | undefined;
  /**
   * The variant an instance layer shows, with the BOOLEAN values the instance sets over its set's
   * defaults, undefined where the kit builds no such variant.
   */
  readonly shownBy: (instance: InstanceLayerSpec) => DrawnVariant | undefined;
};

/** The sets the probe reads instances' variants and BOOLEAN defaults from. */
type ReadSet = Pick<ComponentSetSpec, "key" | "variants" | "booleanProperties">;

/**
 * What the probe reads of the built kit.
 *
 * @param sets - The built sets, whose variants the kit's instance layers show.
 * @param lengthOf - A spec length's pixels at the density the probe's page renders, as `densityLengths` reads them.
 * @returns The reads.
 */
export function sizingReadsOf(
  sets: readonly ReadSet[],
  lengthOf: (length: NumberSpec) => number | undefined
): SizingReads {
  const byKey = new Map(sets.map((set) => [set.key, set]));
  return {
    lengthOf,
    shownBy: (instance) => {
      const set = byKey.get(instance.componentSet);
      const variant = set?.variants.find(({ key }) => key === instance.variant);
      return set === undefined || variant === undefined
        ? undefined
        : {
            root: variant.root,
            shows: (property) =>
              instance.properties?.boolean?.[property] ??
              set.booleanProperties?.find(({ name }) => name === property)?.defaultValue ??
              true,
          };
    },
  };
}

/** Whether a layer takes room in its parent's flow: placed, hidden or switched off, it takes none. */
function takesRoom(layer: ChildLayerSpec, shows: (property: string) => boolean): boolean {
  if (outOfLayout(layer) || (layer.kind === "frame" && layer.hidden === true)) {
    return false;
  }
  return layer.kind === "text" || layer.visibleProperty === undefined || shows(layer.visibleProperty);
}

/**
 * The width a hugging box draws around its layers that take room, where each draws a width no text
 * widens, added up as `widthAround` adds them for the builder's least width. A column's filling
 * layer takes the width the others give it, so it adds nothing. A row's filling layer, or any width
 * the probe cannot read, leaves the width unknown.
 *
 * @param box - The box.
 * @param minWidth - The least width the box takes.
 * @param shows - Whether each BOOLEAN property of the box's set is on.
 * @param reads - The lengths at the probe page's density and the kit's variants.
 */
function hugExtent(
  box: Box,
  minWidth: NumberSpec | undefined,
  shows: (property: string) => boolean,
  reads: SizingReads
): number | undefined {
  const column = box.direction === "VERTICAL";
  const widths = box.children
    .filter((child) => takesRoom(child, shows))
    .flatMap((child) =>
      column && child.kind !== "icon" && child.sizing.horizontal.kind === "fill"
        ? []
        : [rigidWidth(child, shows, reads)]
    );
  return widths.length === 0 ? undefined : widthAround(box, minWidth, widths, reads.lengthOf);
}

/** A frame layer or a variant's root: a box that may be turned. */
type Box = BoxSpec & { readonly rotation?: RotationSpec };

/**
 * The width a layer draws whatever text it holds, where nothing it holds can widen it, in pixels as
 * the probe's page draws them: an icon's size, a fixed text's width, or a box's or an instance's.
 *
 * @param layer - A layer of the spec, or a variant's root.
 * @param shows - Whether each BOOLEAN property of the layer's set is on.
 * @param reads - The lengths at the probe page's density and the kit's variants.
 * @returns The width in pixels, or undefined where the layer's width is not fixed so.
 */
function rigidWidth(
  layer: ChildLayerSpec | ComponentRootSpec,
  shows: (property: string) => boolean,
  reads: SizingReads
): number | undefined {
  if (!("kind" in layer)) {
    return boxWidth(layer, shows, reads);
  }
  switch (layer.kind) {
    case "icon":
      return reads.lengthOf(layer.size);
    case "text":
      return layer.sizing.horizontal.kind === "fixed"
        ? reads.lengthOf(layer.sizing.horizontal.length)
        : undefined;
    case "frame":
      return boxWidth(layer, shows, reads);
    case "instance":
      return instanceWidth(layer, reads);
  }
}

/**
 * The width a box draws: a fixed width held at its minimum, or the hug of its layers. A maximum
 * width leaves it unknown, since no probe of Figma measured a hug or a fixed width against one.
 */
function boxWidth(box: Box, shows: (property: string) => boolean, reads: SizingReads): number | undefined {
  const size = box.sizing.horizontal;
  if (box.limits.maxWidth !== undefined) {
    return undefined;
  }
  if (size.kind === "fixed") {
    return heldAtLeast(reads.lengthOf(size.length), box.limits.minWidth, reads);
  }
  return size.kind === "hug" ? hugExtent(box, box.limits.minWidth, shows, reads) : undefined;
}

/**
 * The width an instance draws. Its minimum width is its own or, without one, its variant's root's,
 * which the plugin sets on it (PH3), and its root's maximum width leaves the width unknown. A fixed
 * instance draws its width held at that minimum. A hugging instance draws the hug of its variant's
 * root, with the instance's BOOLEAN values deciding which layers take room, only where that root
 * hugs too: a root fixed at a preview width draws that width in its own set, which the instance's
 * hug does not keep.
 */
function instanceWidth(instance: InstanceLayerSpec, reads: SizingReads): number | undefined {
  const shown = reads.shownBy(instance);
  if (shown === undefined || shown.root.limits.maxWidth !== undefined) {
    return undefined;
  }
  const size = instance.sizing.horizontal;
  const minWidth = instance.minWidth ?? shown.root.limits.minWidth;
  if (size.kind === "fixed") {
    return heldAtLeast(reads.lengthOf(size.length), minWidth, reads);
  }
  return size.kind === "hug" && shown.root.sizing.horizontal.kind === "hug"
    ? hugExtent(shown.root, minWidth, shown.shows, reads)
    : undefined;
}

/** A width held at a minimum, undefined where either is unknown. */
function heldAtLeast(
  width: number | undefined,
  minWidth: NumberSpec | undefined,
  reads: SizingReads
): number | undefined {
  const minimum = minWidth === undefined ? 0 : reads.lengthOf(minWidth);
  return width === undefined || minimum === undefined ? undefined : Math.max(width, minimum);
}

/**
 * Whether a box kept one width in every run that lengthened its text: rendered within 1px of the
 * width, and with its text longer and far longer within 1px of its rendered width. A width the spec
 * draws whatever text the layer holds agrees only with a box that kept it. Each run is held to the
 * rendered width, not to the width, so a box that grew 1.625px from 35.25px does not keep 36px.
 */
function keptAt(box: ProbedBox, width: number): boolean {
  return (
    Math.abs(box.base - width) <= CHANGED &&
    [box.longer, box.longest].every((run) => Math.abs(run - box.base) <= CHANGED)
  );
}

/** The runs the probe measures each box in, by the name of the width it records for each. */
const RUNS = ["base", "wider", "longer", "longest"] as const;

/** One of the runs the probe measures a box in. */
export type ProbeRun = (typeof RUNS)[number];

/**
 * The first run in which an icon's box was not within 1px of the size the icon draws, with the width
 * the probe measured there, or undefined where every run measured that size. An icon draws one size
 * whatever its container's width or its cell's text, so every run is held to that size. A size the
 * probe cannot read fails at the first run.
 */
function iconOff(
  box: ProbedBox,
  size: number | undefined
): { readonly run: ProbeRun; readonly measured: number } | undefined {
  return RUNS.map((run) => ({ run, measured: box[run] })).find(
    ({ measured }) => size === undefined || Math.abs(measured - size) > CHANGED
  );
}

/** One contradiction the probe found: the box, what it inferred and what the spec maps. */
export type Contradiction = {
  readonly cell: string;
  readonly slot: string;
  /** The part's key and its element's place, which tell apart parts that share a slot. */
  readonly part: string;
  readonly place: string;
  readonly inferred: InferredKind;
  readonly mapped: SizeSpec["kind"];
  /**
   * For an icon, which draws at its fixed size whatever the probe infers, the size it draws, the
   * first run whose width was not that size and the width the probe measured in it; absent otherwise.
   */
  readonly widths?: { readonly drawn: number | undefined; readonly run: ProbeRun; readonly measured: number };
};

/** A part the build drew that the probe could not pair with its box and its layer, and why. */
export type Unpaired = {
  readonly cell: string;
  readonly slot: string | undefined;
  readonly part: string;
  readonly place: string;
  readonly why: string;
};

/** What the probe found of a set: each contradiction, how many boxes it compared, and the parts it could not pair. */
export type Contradictions = {
  readonly found: readonly Contradiction[];
  readonly compared: number;
  /** How many compared boxes the probe inferred each kind for. */
  readonly inferred: ReadonlyMap<InferredKind, number>;
  readonly unpaired: readonly Unpaired[];
  /** The cells the probe measured that the build recorded no parts for. */
  readonly unrecorded: readonly string[];
  /** The cells the probe measured that the set builds no variant for. */
  readonly unbuilt: readonly string[];
};

/**
 * The contradictions between a set's mapped horizontal sizings and what the probe inferred of its
 * boxes. Each part a cell draws pairs with the box at its element's place and with the layer at the
 * path the build recorded for it. A part whose element carries a `data-slot` and has no box at its
 * place, whose box carries another slot, or whose path reaches no layer is unpaired. A part the build
 * leaves out draws no layer to compare, and a part without a `data-slot` below a root has no box.
 *
 * @param set - The built set.
 * @param probed - Each cell's boxes, by the variant key of its cell.
 * @param drawn - Each cell's drawn parts, by the variant key of its cell, as `drawn-parts.ts` records them.
 * @param reads - The lengths at the probe page's density and the kit's variants, as {@link sizingReadsOf} reads them.
 * @returns Each contradiction, how many boxes the probe compared, the parts it could not pair, and
 *   the measured cells the build recorded nothing for or built no variant for.
 */
export function contradictions(
  set: Omit<ComponentSetSpec, "page">,
  probed: ReadonlyMap<string, ProbedCell>,
  drawn: ReadonlyMap<string, readonly DrawnPart[]>,
  reads: SizingReads
): Contradictions {
  const found: Contradiction[] = [];
  const unpaired: Unpaired[] = [];
  const unrecorded: string[] = [];
  const unbuilt: string[] = [];
  let compared = 0;
  const counts = new Map<InferredKind, number>();
  // The probed cell renders the set's optional parts whatever their BOOLEAN defaults, as Sheet's
  // cell renders its corner close, so each layer of the set's own variant takes room.
  const shows = (): boolean => true;
  const variants = new Map(set.variants.map((variant) => [variant.key, variant]));
  for (const [key, cell] of probed) {
    const variant = variants.get(key);
    if (variant === undefined) {
      unbuilt.push(key);
      continue;
    }
    const boxes = new Map(cell.boxes.map((box) => [box.place, box]));
    const parts = drawn.get(variant.key);
    if (parts === undefined) {
      unrecorded.push(variant.key);
      continue;
    }
    for (const { place, slot, part, path } of parts) {
      const box = boxes.get(place);
      if (path === undefined || (box === undefined && slot === undefined)) {
        continue;
      }
      const miss = (why: string): void => {
        unpaired.push({ cell: variant.key, slot, part, place, why });
      };
      if (box === undefined) {
        miss("the probe measured no box at its place");
        continue;
      }
      if (box.slot !== (slot ?? "")) {
        miss(`the box at its place carries the data-slot ${box.slot}`);
        continue;
      }
      const below = path.length === 0 ? undefined : layerAt(variant.root, path);
      const layer =
        path.length === 0
          ? variant.root
          : below !== undefined && "kind" in below && below.kind !== "text"
            ? below
            : undefined;
      if (layer === undefined) {
        miss(`its path ${path.join("/")} reaches no frame, instance or icon of the variant`);
        continue;
      }
      compared += 1;
      const inferred = inferKind(box);
      counts.set(inferred, (counts.get(inferred) ?? 0) + 1);
      const isRoot = layer === variant.root;
      // An icon draws at its fixed size.
      const size: SizeSpec =
        "kind" in layer && layer.kind === "icon"
          ? { kind: "fixed", length: layer.size }
          : layer.sizing.horizontal;
      const maximum = "limits" in layer ? layer.limits.maxWidth : undefined;
      const placement = "placement" in layer ? layer.placement : undefined;
      const constraint: string | undefined =
        placement?.kind === "edges" ? AXIS_CONSTRAINT[placement.horizontal.kind] : undefined;
      const rigid =
        size.kind === "hug" || size.kind === "fixed" ? rigidWidth(layer, shows, reads) : undefined;
      const width: MappedWidth = {
        resizesWithParent: constraint === "SCALE" || constraint === "STRETCH",
        heldAtMaximum: maximum?.kind === "literal" && Math.abs(maximum.value - box.base) <= CHANGED,
        hugWidth:
          size.kind !== "hug" || rigid === undefined
            ? "follows-text"
            : keptAt(box, rigid)
              ? "kept"
              : "outgrown",
        fixedAtMeasuredWidth: size.kind === "fixed" && rigid !== undefined && keptAt(box, rigid),
        cellFixedAtRenderedWidth:
          box.tableCell &&
          size.kind === "fixed" &&
          rigid !== undefined &&
          Math.abs(rigid - box.base) <= CHANGED,
      };
      const contradiction: Contradiction = {
        cell: variant.key,
        slot: box.slot,
        part,
        place,
        inferred,
        mapped: size.kind,
      };
      // An icon holds no text the runs could lengthen, so its box shows its size only by keeping it.
      const icon = "kind" in layer && layer.kind === "icon" ? layer : undefined;
      const iconSize = icon === undefined ? undefined : rigidWidth(icon, shows, reads);
      const off = icon === undefined ? undefined : iconOff(box, iconSize);
      if (off !== undefined) {
        found.push({ ...contradiction, widths: { drawn: iconSize, ...off } });
      } else if (!agrees(inferred, size, isRoot, width)) {
        found.push(contradiction);
      }
    }
  }
  return { found, compared, inferred: counts, unpaired, unrecorded, unbuilt };
}
