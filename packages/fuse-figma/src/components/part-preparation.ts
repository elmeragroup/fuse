/**
 * The parts a box maps, cascaded below it: its frame parts, its instance parts, the parts a wrapper
 * that generates no box hands it (`no-box.ts`) and the pseudo-elements it draws as layers
 * (`pseudo-layers.ts`). Every part cascades before any maps, since an absolute part sits out of the
 * box's flow, and each frame part prepares its own parts only when something first asks for them, so
 * the cascade reads each box in the order the mapping reaches it.
 *
 * A box also takes the instance parts below whose containing block is its element, which the capture
 * measured that many steps up (`blockSteps`, `capture/block-frame.ts`), out of the frame parts between
 * and into its own parts, each after the frame that held it (`block-frame.ts`). It prepares a frame's
 * parts early only where the capture measured such a part below that frame.
 */
import { bordersNothing } from "./absolute-placement";
import type { BoxCascade, PartElement } from "./box-cascade";
import type { MapScope } from "./box-mapping";
import type { BoxDefinition, PartDefinition } from "./component-spec";
import type { CascadedInstance } from "./instance-parts";
import { liftParts } from "./no-box";
import { placementKey } from "./placement-wrapper";
import { pseudoParts } from "./pseudo-layers";

/** A frame part a cell shows in a box, cascaded. */
export type FramePart = {
  readonly kind: "frame";
  readonly child: PartDefinition;
  /** The frame's key, the part's. */
  readonly key: string;
  readonly name: string;
  readonly cascade: BoxCascade;
  /** Set on a pseudo-element the box draws as a layer, which no DOM order or flow reads place. */
  readonly pseudo?: true;
  /** The frame's own parts, prepared on the first call. */
  readonly parts: () => PreparedParts;
};

/** A part a cell shows in a box, cascaded: a frame, or an instance of another set. */
export type ShownPart = FramePart | CascadedInstance;

/** What preparing a box's parts reads of the cell's scope: the cell, and the instance parts that build in place. */
type PartScope = Pick<MapScope, "cell" | "instances">;

/** The parts a box maps, as {@link prepareParts} prepares them. */
export type PreparedParts = {
  /** The box's parts in DOM order, each part it lifted from below after the frame that held it. */
  readonly parts: readonly ShownPart[];
  /** The instance parts the box lifted from frames below, which it draws as its last layers. */
  readonly liftedIn: ReadonlySet<ShownPart>;
};

/**
 * A part's layer name: its `data-slot`, or its key for an element without one.
 *
 * @param part - The part.
 * @returns The name.
 */
export function partName(part: PartDefinition): string {
  return part.slot ?? part.key;
}

/**
 * The parts a box maps, prepared on the first call: each part it shows in the cell cascaded below it,
 * and the instance parts it lifts from the frames below.
 *
 * @param box - The box's definition.
 * @param cascade - The box's cascade.
 * @param scope - The cell and the instance parts that build in place.
 * @returns What prepares the parts once and hands them out after.
 */
export function prepareParts(box: BoxDefinition, cascade: BoxCascade, scope: PartScope): () => PreparedParts {
  let prepared: PreparedParts | undefined;
  return () => {
    prepared ??= liftInto(box, cascade, cascadeParts(box, cascade, scope), scope);
    return prepared;
  };
}

/**
 * Cascade the parts a box shows in the cell, each below the box: a frame part, and an instance part's
 * inner root, as `InstanceParts.cascade` builds it in place.
 *
 * @returns The parts, in DOM order.
 */
function cascadeParts(box: BoxDefinition, cascade: BoxCascade, scope: PartScope): readonly ShownPart[] {
  const { cell } = scope;
  const elements = (box.parts ?? [])
    .filter((child) => child.shownIn(cell))
    .flatMap((child): readonly ShownPart[] => {
      if ("kind" in child) {
        return [scope.instances.cascade(child, cascade, cell)];
      }
      const name = partName(child);
      const own = cascade.part(name, elementOf(child));
      // A part that generates no box hands its parts to this box (`no-box.ts`).
      if (own.measured?.noBox === true) {
        return cascadeParts({ ...child, parts: liftParts(child, own, cell) }, own, scope);
      }
      return [
        { kind: "frame", child, key: child.key, name, cascade: own, parts: prepareParts(child, own, scope) },
      ];
    });
  const pseudo = pseudoParts(cascade).map(
    ({ pseudo, child, cascade: own }): FramePart & { readonly at: "before" | "after" } => ({
      kind: "frame",
      child,
      key: child.key,
      name: child.key,
      cascade: own,
      pseudo: true,
      parts: prepareParts(child, own, scope),
      at: pseudo,
    })
  );
  return [
    ...pseudo.filter(({ at }) => at === "before"),
    ...elements,
    ...pseudo.filter(({ at }) => at === "after"),
  ];
}

/** What finds a frame part's element: its key, its `data-slot`, or its place for a part without one. */
function elementOf(child: PartDefinition): PartElement {
  const element: PartElement = { key: child.key, slot: child.slot };
  const placed = child.place === undefined ? element : { ...element, place: child.place };
  const optional = child.optional === undefined ? placed : { ...placed, optional: true as const };
  return child.after === undefined ? optional : { ...optional, after: child.after };
}

/**
 * A box's parts with the instance parts below whose containing block is the box's element among them,
 * each after the frame part that held it, in tree order.
 *
 * - The box enters a frame part only where the capture measured below it an absolute element whose
 *   block is the box's element, so a frame with none prepares its parts when it maps, in its own turn.
 * - A frame part's cascade keeps the path of the frames that held it, so the box lifts no frame part,
 *   and it enters no frame that a BOOLEAN property shows, which would hide the part with it.
 * - Where the capture also measured that the part's parent spans the block (`parentSpansBlock`), the
 *   part keeps its place in its parent's frame, unless that parent draws a border, which leaves the
 *   span no place (`absolute-placement.ts`).
 * - The box lifts no instance where its key or its placement wrapper's key (`placement-wrapper.ts`)
 *   is already one of its layers': a part, a placement wrapper of one, its label or an icon.
 */
function liftInto(
  box: BoxDefinition,
  block: BoxCascade,
  parts: readonly ShownPart[],
  scope: PartScope
): PreparedParts {
  const top = block.depth;
  const liftedIn = new Set<ShownPart>();
  const taken = new Set([
    ...parts.flatMap(({ key }) => [key, placementKey(key)]),
    ...(box.label === undefined ? [] : [box.label.key]),
    ...box.iconsFor(scope.cell).map(({ key }) => key),
  ]);
  // A frame part, with the parts it holds that the box lifts after it.
  const descend = (part: ShownPart): readonly ShownPart[] => {
    if (top === undefined || part.kind !== "frame" || !holdsLifted(part, top)) {
      return [part];
    }
    const own = part.parts();
    const kept: ShownPart[] = [];
    const lifted: ShownPart[] = [];
    for (const child of own.parts) {
      const keys = [child.key, placementKey(child.key)];
      if (
        child.kind === "instance" &&
        takesAsBlock(block, child.cascade, part.cascade) &&
        keys.every((key) => !taken.has(key))
      ) {
        keys.forEach((key) => taken.add(key));
        liftedIn.add(child);
        lifted.push(child);
        continue;
      }
      const [first = child, ...deeper] = descend(child);
      kept.push(first);
      lifted.push(...deeper);
    }
    const held: PreparedParts = { ...own, parts: kept };
    return [{ ...part, parts: () => held }, ...lifted];
  };
  return { parts: parts.flatMap(descend), liftedIn };
}

/**
 * Whether a frame part, the steps below the block `top` gives, holds an instance part the block can
 * lift: the capture measured below the frame an absolute element whose block sits those steps above
 * it, and the frame is no pseudo-element and no part a BOOLEAN property shows. A child of the frame
 * whose parent spans the block counts only where the frame draws a border.
 */
function holdsLifted(part: FramePart, top: number): boolean {
  const { depth, measured } = part.cascade;
  if (
    depth === undefined ||
    measured === undefined ||
    part.pseudo === true ||
    part.child.optional !== undefined
  ) {
    return false;
  }
  const steps = depth - top;
  return (
    measured.blocksBelow.has(steps) ||
    (measured.spannedBelow.has(steps) && !bordersNothing(part.cascade.style))
  );
}

/**
 * Whether a box's element is the containing block the capture measured for an instance part below
 * it, which the part's parent frame does not place instead: the part's element sits its `blockSteps`
 * below the box's, and the capture measured no span of the parent, or the parent draws a border.
 */
function takesAsBlock(block: BoxCascade, part: BoxCascade, parent: BoxCascade): boolean {
  const steps = part.measured?.blockSteps;
  const spanned = part.measured?.parentSpansBlock === true && bordersNothing(parent.style);
  return (
    !spanned &&
    steps !== undefined &&
    part.depth !== undefined &&
    block.depth !== undefined &&
    part.depth - steps === block.depth
  );
}
