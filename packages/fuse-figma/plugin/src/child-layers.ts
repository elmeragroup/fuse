/**
 * The layers inside a variant's root, and the layers each frame holds. The walk finds or creates
 * each layer and plans it by its kind: a text layer through `text-layer.ts`, an instance through
 * `instance-layers.ts`, and an icon or a frame here. `fonts.ts` requires the fonts a new layer needs.
 */

import { Effect } from "effect";

import { shownLabels, walkLayers } from "../../src/components/kit-spec.ts";
import type {
  BoxSpec,
  ChildLayerSpec,
  FrameLayerSpec,
  IconLayerSpec,
  RotationSpec,
} from "../../src/components/kit-spec.ts";
import { planBox } from "./box.ts";
import type { LayerParent } from "./box.ts";
import type { PlannedSet } from "./component-set.ts";
import type { PluginError } from "./errors.ts";
import { near, planNumber, planPaints, planScalar, planVisibleLink, solidPaint } from "./fields.ts";
import type { Held, Run } from "./fields.ts";
import { fontLayers, heldFonts, requireNewTextFonts } from "./fonts.ts";
import { planGridItems } from "./grid.ts";
import { glyphOf } from "./icons.ts";
import type { PlannedIcon } from "./icons.ts";
import { planOwnedChildren } from "./identity.ts";
import type { OwnedChild } from "./identity.ts";
import { innerSpecs, innerVariant, planInstance, planNewInstance } from "./instance-layers.ts";
import { planPivotPlace, planPivotPositioning } from "./pivot.ts";
import { planLeaving, planPlace } from "./placing.ts";
import { change, Plan } from "./plan.ts";
import { currentRun } from "./services.ts";
import type { PlanServices } from "./services.ts";
import { planText } from "./text-layer.ts";

/**
 * The TEXT, BOOLEAN and INSTANCE_SWAP properties of a component set, from the name in the spec to
 * the full property id. An operation that adds a property puts its id here when it runs, before
 * any layer links to it.
 */
export type PropertyIds = ReadonlyMap<string, string>;

/**
 * What a variant's layers link to: the set's properties, the kit's icons, and the sets the run
 * planned before this one, whose variants its instance layers show.
 */
export type LayerLinks = {
  readonly properties: PropertyIds;
  readonly icons: ReadonlyMap<string, PlannedIcon>;
  readonly sets: ReadonlyMap<string, PlannedSet>;
};

/**
 * The box a layer sits in, as the layer's planners need it: the node, and `held`, which is `unknown`
 * when the box turns in this run.
 * A turn moves a layer's fill to the other axis and can change its size, so the layer's planners
 * write its lengths and sizing whatever it reads now.
 */
type Holder = {
  readonly node: LayerParent;
  readonly held: Held;
  /**
   * `unknown` when the run writes a field that can resize the box or a box above it, which moves an
   * absolute layer inside it by its constraints once the write runs, so the layer's place and size
   * are written whatever they read now.
   */
  readonly size: Held;
};

/**
 * Plan a layer's turn. Figma reads a rotation from -180 to 180, so two that differ by whole turns
 * match. Auto layout keeps a turned layer's box in its slot and moves its `x` and `y` with the turn,
 * as a real file did on 2026-10-22 (PR), so the plan compares the rotation alone.
 *
 * @param rotation - The turn the spec asks for, or undefined for none.
 * @returns Whether the turn changes in this run.
 */
function planRotation(
  run: Run,
  node: FrameNode | InstanceNode,
  label: string,
  rotation: RotationSpec | undefined
): boolean {
  const desired = rotation ?? 0;
  const off = (((node.rotation - desired) % 360) + 360) % 360;
  if (near(off, 0) || near(off, 360)) {
    return false;
  }
  change(run.plan, label, `rotation → ${desired}`, () => {
    node.rotation = desired;
  });
  return true;
}

/**
 * Plan an icon layer: an instance of the icon component the spec names, linked to the set's
 * swap property when it has one, sized and turned by the cell, its visibility linked to the set's
 * BOOLEAN property when it hides behind one (PI2), and with its glyph in the label's color. A placed
 * icon leaves the flow after its size and before its turn, and its parent places it after its
 * siblings, as a placed instance.
 */
const planIcon = Effect.fnUntraced(function* (
  instance: InstanceNode,
  label: string,
  spec: IconLayerSpec,
  icon: PlannedIcon,
  links: LayerLinks,
  origin: "found" | "new"
) {
  const run = yield* currentRun;
  planScalar(run, label, "name", instance.name, spec.name, () => {
    instance.name = spec.name;
  });
  // A new layer is made as an instance of the icon, so it shows the icon already.
  const main = origin === "new" ? undefined : yield* Effect.promise(() => instance.getMainComponentAsync());
  const swapped =
    origin === "found" && (icon.node.existing === undefined || main?.id !== icon.node.existing.id);
  if (swapped) {
    change(run.plan, label, `show ${icon.spec.name}`, () => instance.swapComponent(icon.node.get()));
  }
  const property = spec.swapProperty;
  const linked = instance.componentPropertyReferences?.mainComponent;
  if (property !== undefined && (linked === undefined || linked !== links.properties.get(property))) {
    change(run.plan, label, `icon → the ${property} property`, () => {
      const id = links.properties.get(property);
      if (id === undefined) {
        throw new Error(`${label}: the ${property} property has no id when the layer links to it.`);
      }
      instance.componentPropertyReferences = { ...instance.componentPropertyReferences, mainComponent: id };
    });
  } else if (property === undefined && linked !== undefined) {
    change(run.plan, label, "icon → no property", () => {
      const { mainComponent: _unlinked, ...rest } = instance.componentPropertyReferences ?? {};
      instance.componentPropertyReferences = rest;
    });
  }
  planNumber(
    run,
    instance,
    label,
    {
      name: "size",
      bindings: ["width", "height"],
      matches: (value) => near(instance.width, value) && near(instance.height, value),
      write: (value) => instance.resize(value, value),
    },
    spec.size
  );
  planLeaving(run, instance, label, spec.placement);
  planRotation(run, instance, label, spec.rotation);
  planVisibleLink(run, instance, label, spec.visibleProperty, links.properties);
  // A swap or a redraw replaces the glyph, and a repaint of the component reaches a glyph whose color
  // equals it (NS), so the color goes on the glyph the instance holds once those ran.
  const glyph = swapped || icon.changesGlyph ? undefined : glyphOf(instance);
  if (glyph === undefined) {
    const paint = solidPaint(run, spec.color);
    change(
      run.plan,
      label,
      `glyph fill → ${spec.color.kind === "variable" ? spec.color.variable.name : "a literal"}`,
      () => {
        const drawn = glyphOf(instance);
        if (drawn === undefined) {
          throw new Error(`${label}: ${icon.spec.name} has no glyph to color.`);
        }
        drawn.fills = [paint];
      }
    );
    return;
  }
  planPaints(run, `${label} / glyph`, "fill", glyph.fills, spec.color, (paints) => {
    glyph.fills = paints;
  });
});

const isText = (node: BaseNode): node is TextNode => node.type === "TEXT";
const isInstance = (node: BaseNode): node is InstanceNode => node.type === "INSTANCE";
const isFrame = (node: BaseNode): node is FrameNode => node.type === "FRAME";

/**
 * Plan a frame layer: its name, where it sits, its box, the property that shows or hides it and its
 * turn, then the layers it holds.
 */
const planFrame = Effect.fnUntraced(function* (
  frame: FrameNode,
  label: string,
  spec: FrameLayerSpec,
  links: LayerLinks,
  holder: Holder
) {
  const run = yield* currentRun;
  planScalar(run, label, "name", frame.name, spec.name, () => {
    frame.name = spec.name;
  });
  // A frame leaves the flow before its box, since Figma refuses FILL on an absolute layer (P8). A
  // frame placed by its centre comes back to its place last, after its turn, and one placed by its
  // parent's edges takes its place from its parent, after its siblings.
  const { placement } = spec;
  const pivot = placement?.kind === "pivot" ? placement : undefined;
  let repositions = false;
  if (placement?.kind === "pivot") {
    repositions = planPivotPositioning(run, frame, label, placement);
  } else {
    planLeaving(run, frame, label, placement);
  }
  // A resize of the parent moves an absolute layer's size by its constraints after the plan read it,
  // as a turn of the parent moves a fill, so the layer's lengths are written whatever they read.
  const moved = placement !== undefined && holder.size === "unknown" ? "unknown" : holder.held;
  const size = planBox(run, frame, label, spec, { kind: "frame", parent: moved });
  planVisibleLink(run, frame, label, spec.visibleProperty, links.properties);
  // A layer that follows a BOOLEAN property shows as its default says, so only the others are written.
  if (spec.visibleProperty === undefined) {
    const visible = spec.hidden !== true;
    planScalar(run, label, "visible", frame.visible, visible, () => {
      frame.visible = visible;
    });
  }
  const turns = planRotation(run, frame, label, spec.rotation);
  if (pivot !== undefined) {
    // A size write moves the frame's centre about its origin, so the place is written after it, from
    // the size it leaves, whatever the centre reads now.
    const resizes = size === "unknown";
    planPivotPlace(run, frame, label, pivot, spec.rotation, repositions || turns || resizes, holder.size);
  }
  yield* planChildren(frame, label, spec, links, holder.size === "unknown" ? "unknown" : size);
});

/** How to find, create and plan one layer of a variant or of a frame layer. */
function childKind(
  run: Run,
  holder: Holder,
  label: string,
  spec: ChildLayerSpec,
  links: LayerLinks
): OwnedChild<SceneNode, void> {
  const parent = holder.node;
  const layerLabel = `${label} / ${spec.name}`;
  const description = `create the ${spec.kind} layer ${spec.name}`;
  if (spec.kind === "frame") {
    return {
      name: spec.name,
      accept: isFrame,
      description,
      make: () => run.figma.createFrame(),
      requireNew: () =>
        requireNewTextFonts(run, parent, label, fontLayers(walkLayers(spec), innerSpecs(links.sets))),
      plan: (frame) => planFrame(frame, layerLabel, spec, links, holder),
    } satisfies OwnedChild<FrameNode, void>;
  }
  if (spec.kind === "text") {
    return {
      name: spec.name,
      accept: isText,
      description,
      make: () => run.figma.createText(),
      requireNew: () => requireNewTextFonts(run, parent, label, [spec]),
      plan: (text, origin) =>
        Effect.map(currentRun, (inner) =>
          planText(
            inner,
            text,
            layerLabel,
            spec,
            links.properties,
            origin === "found" ? heldFonts(inner, text) : [],
            holder.held
          )
        ),
    } satisfies OwnedChild<TextNode, void>;
  }
  if (spec.kind === "instance") {
    const inner = innerVariant(links.sets, spec, layerLabel);
    // A TEXT property writes the inner labels' characters, which needs their fonts (rule 34).
    requireNewTextFonts(
      run,
      parent,
      label,
      shownLabels(spec, { variant: inner.spec, textProperties: inner.set.spec.textProperties })
    );
    return {
      name: spec.name,
      accept: isInstance,
      description,
      make: () => inner.node.get().createInstance(),
      plan: (instance, origin) =>
        origin === "found"
          ? planInstance(instance, layerLabel, spec, inner, links, holder.held)
          : planNewInstance(instance, layerLabel, spec, inner, links),
    } satisfies OwnedChild<InstanceNode, void>;
  }
  const icon = links.icons.get(spec.icon);
  if (icon === undefined) {
    throw new Error(`${layerLabel} shows ${spec.icon}, which the kit's icon library lacks.`);
  }
  return {
    name: spec.name,
    accept: isInstance,
    description,
    make: () => icon.node.get().createInstance(),
    plan: (instance, origin) => planIcon(instance, layerLabel, spec, icon, links, origin),
  } satisfies OwnedChild<InstanceNode, void>;
}

/**
 * Plan the layers of a variant or of a frame layer against the spec: create the missing ones,
 * update the rest, delete the kit's layers the spec dropped and restore the spec's order. A
 * frame layer plans its own layers the same way, so a key is unique among its siblings alone.
 *
 * @param parent - The variant component, or a frame layer below it.
 * @param label - The parent's label, for change lines.
 * @param box - The parent's spec: its layers, in order, and the direction it lays them out along.
 *   A parent whose direction differs from it turns in this run, so its layers' sizing is planned
 *   to be written again after the turn.
 * @param links - The set's properties and the kit's icons.
 * @param size - `unknown` when the run writes a field that can resize the parent or a box above it,
 *   as {@link planBox} returns for the parent, so the parent's absolute layers are planned to be
 *   written again after the resize.
 */
export const planChildren = Effect.fnUntraced(function* (
  parent: LayerParent,
  label: string,
  box: Pick<BoxSpec, "direction" | "children" | "grid">,
  links: LayerLinks,
  size: Held
): Effect.fn.Return<void, PluginError, PlanServices> {
  const run = yield* currentRun;
  const holder: Holder = {
    node: parent,
    held: parent.layoutMode === box.direction ? "read" : "unknown",
    size,
  };
  const [planned, recorded] = yield* Plan.watch(
    planOwnedChildren(parent, label, "layer", box.children, (spec) =>
      childKind(run, holder, label, spec, links)
    )
  );
  // A layer placed by the parent's edges sits where the parent's size, which its other layers set,
  // leaves it, so it is placed once they are planned.
  planGridItems(run, label, box.grid, parent.layoutMode === "GRID", planned);
  const resized = size === "unknown" || recorded ? "unknown" : "read";
  for (const { spec, node } of planned) {
    const placement = spec.kind === "text" ? undefined : spec.placement;
    if (placement?.kind === "edges") {
      planPlace(
        run,
        node,
        `${label} / ${spec.name}`,
        placement,
        resized,
        spec.kind === "frame" ? spec.sizing : undefined
      );
    }
  }
});
