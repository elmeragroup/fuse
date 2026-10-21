/**
 * The icon library: a frame of icon components, one per icon in the kit. An icon layer is an
 * instance of one of them, and a swap property offers all of them.
 *
 * Each component draws the markup the Fuse icon renders, through `createNodeFromSvg`. A run on
 * a real file on 2026-10-20 showed what that returns: a frame the size of the SVG, painted
 * white and clipping, whose layers take their names from the elements' `id`s. The plugin moves
 * the layers into the component, scales them to fit its square, centers them and flattens them
 * to one vector, the glyph, whose fill binds the library's color. An icon layer overrides that
 * fill, and the override survives a swap, because every glyph has the same name. The component
 * records the markup it drew and the glyph's box, so a run redraws an icon whose markup
 * changed or whose glyph a designer moved, scaled or unpinned from its component.
 */

import { ICON_GLYPH, PLUGIN_DATA_NAMESPACE } from "../../src/components/kit-spec.ts";
import type { IconLibrarySpec, IconSpec } from "../../src/components/kit-spec.ts";
import { near, planNumber, planPaints, planScalar, solidPaint } from "./fields.ts";
import type { Run } from "./fields.ts";
import { findOwned, indexSiblings, placeOwned, planOwnedChildren } from "./identity.ts";
import type { Siblings } from "./identity.ts";
import type { PlannedPage } from "./pages.ts";
import { change, create, existing } from "./plan.ts";
import type { Target } from "./plan.ts";
import { planWrapFrame } from "./previews.ts";
import type { WrapGrid } from "./previews.ts";

/** An icon component as the plan leaves it, with the spec it draws. */
export type PlannedIcon = {
  readonly spec: IconSpec;
  readonly node: Target<ComponentNode>;
  /**
   * Whether the run draws the icon, which replaces its glyph. An instance's override of the
   * glyph's fill goes with the old glyph, so an icon layer colors the new glyph after the draw.
   */
  readonly redrawn: boolean;
};

/** The library frame and its icons by key, as later operations find them. */
export type PlannedIcons = {
  readonly frame: Target<FrameNode>;
  readonly icons: ReadonlyMap<string, PlannedIcon>;
};

/** The shared plugin data entry that holds a hash of the markup an icon was drawn from. */
const DRAWN_FROM = "svg";

/**
 * The shared plugin data entry that holds the glyph's x, y, width and height as drawn, each a
 * fraction of the component's width or height, so the record holds after the component and its
 * glyph scale together.
 */
const GLYPH_BOX = "glyph";

/** Sixteen icons a row. */
const ICON_GRID: WrapGrid = { width: 544, gap: 16, padding: 24 };

const SCALE: Constraints = { horizontal: "SCALE", vertical: "SCALE" };

const isFrame = (node: BaseNode): node is FrameNode => node.type === "FRAME";
const isComponent = (node: BaseNode): node is ComponentNode => node.type === "COMPONENT";

/**
 * A short hash of an icon's markup, FNV-1a over its UTF-16 code units, so a run redraws an icon
 * whose markup changed.
 *
 * @param svg - The markup.
 * @returns The hash, as hexadecimal.
 */
function markupHash(svg: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < svg.length; index += 1) {
    hash ^= svg.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** The glyph an icon component, or an instance of one, draws. */
export function glyphOf(node: ComponentNode | InstanceNode): VectorNode | undefined {
  return node.children.find(
    (child): child is VectorNode => child.type === "VECTOR" && child.name === ICON_GLYPH
  );
}

/**
 * Whether an icon component holds the glyph its markup draws: drawn from the same markup, in
 * the box it was drawn in, and pinned to scale with the component.
 */
function holdsDrawing(component: ComponentNode, spec: IconSpec): boolean {
  const glyph = glyphOf(component);
  if (
    component.getSharedPluginData(PLUGIN_DATA_NAMESPACE, DRAWN_FROM) !== markupHash(spec.svg) ||
    glyph === undefined ||
    glyph.constraints.horizontal !== SCALE.horizontal ||
    glyph.constraints.vertical !== SCALE.vertical
  ) {
    return false;
  }
  const [x, y, width, height, ...rest] = component
    .getSharedPluginData(PLUGIN_DATA_NAMESPACE, GLYPH_BOX)
    .split(",")
    .map(Number);
  if (x === undefined || y === undefined || width === undefined || height === undefined || rest.length > 0) {
    return false;
  }
  return (
    near(glyph.x, x * component.width) &&
    near(glyph.y, y * component.height) &&
    near(glyph.width, width * component.width) &&
    near(glyph.height, height * component.height)
  );
}

/**
 * Draw an icon into its component, replacing whatever it held. The paint is built before the
 * operation runs, as every planner builds them.
 */
function drawIcon(
  run: Run,
  component: ComponentNode,
  library: IconLibrarySpec,
  spec: IconSpec,
  glyphPaint: SolidPaint
): void {
  for (const child of [...component.children]) {
    child.remove();
  }
  const drawing = run.figma.createNodeFromSvg(spec.svg);
  const scale = library.size / Math.max(drawing.width, drawing.height);
  if (!near(scale, 1)) {
    drawing.rescale(scale);
  }
  const dx = (library.size - drawing.width) / 2;
  const dy = (library.size - drawing.height) / 2;
  for (const part of [...drawing.children]) {
    component.appendChild(part);
    part.x += dx;
    part.y += dy;
  }
  drawing.remove();
  const glyph = run.figma.flatten([...component.children], component);
  glyph.name = ICON_GLYPH;
  glyph.fills = [glyphPaint];
  glyph.constraints = SCALE;
  component.setSharedPluginData(PLUGIN_DATA_NAMESPACE, DRAWN_FROM, markupHash(spec.svg));
  const box = [
    glyph.x / component.width,
    glyph.y / component.height,
    glyph.width / component.width,
    glyph.height / component.height,
  ];
  component.setSharedPluginData(PLUGIN_DATA_NAMESPACE, GLYPH_BOX, box.join(","));
}

function planIconComponent(
  run: Run,
  component: ComponentNode,
  label: string,
  library: IconLibrarySpec,
  spec: IconSpec
): void {
  planScalar(run, label, "name", component.name, spec.name, () => {
    component.name = spec.name;
  });
  planNumber(
    run,
    component,
    label,
    {
      name: "size",
      bindings: ["width", "height"],
      matches: (value) => near(component.width, value) && near(component.height, value),
      // `resize` applies the glyph's SCALE constraints, so the glyph follows the component back
      // to the library size after a designer scaled both.
      write: (value) => component.resize(value, value),
    },
    { kind: "literal", value: library.size }
  );
  planPaints(run, label, "fill", component.fills, undefined, (paints) => {
    component.fills = paints;
  });
  const glyph = holdsDrawing(component, spec) ? glyphOf(component) : undefined;
  if (glyph === undefined) {
    const glyphPaint = solidPaint(run, library.color);
    change(run.plan, label, "draw the icon from its Fuse markup", () =>
      drawIcon(run, component, library, spec, glyphPaint)
    );
    return;
  }
  planPaints(run, `${label} / ${ICON_GLYPH}`, "fill", glyph.fills, library.color, (paints) => {
    glyph.fills = paints;
  });
}

function planIcon(
  run: Run,
  frame: FrameNode,
  siblings: Siblings,
  library: IconLibrarySpec,
  spec: IconSpec
): PlannedIcon {
  const label = `${library.name} / ${spec.name}`;
  const found = findOwned(run.plan, siblings, library.name, spec.key, spec.name, isComponent);
  if (found !== undefined) {
    const redrawn = !holdsDrawing(found, spec);
    planIconComponent(run, found, label, library, spec);
    return { spec, node: existing(found), redrawn };
  }
  const node = create(
    run.plan,
    library.name,
    `create the icon ${spec.name}`,
    () => placeOwned(frame, run.figma.createComponent(), spec.key, spec.name),
    (made, plan) => planIconComponent({ ...run, plan }, made, label, library, spec)
  );
  return { spec, node, redrawn: true };
}

async function planLibraryContents(
  run: Run,
  frame: FrameNode,
  library: IconLibrarySpec
): Promise<ReadonlyMap<string, PlannedIcon>> {
  planScalar(run, library.name, "name", frame.name, library.name, () => {
    frame.name = library.name;
  });
  planWrapFrame(run, frame, library.name, ICON_GRID);
  const icons = new Map<string, PlannedIcon>();
  await planOwnedChildren(run.plan, frame, library.name, "icon", library.icons, (spec, siblings) => {
    const icon = planIcon(run, frame, siblings, library, spec);
    icons.set(spec.key, icon);
    return icon.node;
  });
  return icons;
}

/**
 * Plan the icon library against the spec.
 *
 * @param run - The run.
 * @param page - The page the library sits on.
 * @param library - The icon library.
 * @returns The frame and its icons, as later operations find them.
 */
export async function planIconLibrary(
  run: Run,
  page: PlannedPage,
  library: IconLibrarySpec
): Promise<PlannedIcons> {
  const found = page.find(library.key, library.name, isFrame);
  if (found !== undefined) {
    return { frame: existing(found), icons: await planLibraryContents(run, found, library) };
  }
  const frame = create(
    run.plan,
    page.spec.name,
    `create the ${library.name} frame with ${library.icons.length} icons`,
    () => placeOwned(page.node.get(), run.figma.createFrame(), library.key, library.name),
    async (made, plan) => {
      await planLibraryContents({ ...run, plan }, made, library);
    }
  );
  // The frame's children, indexed by key the first time a later operation reads an icon.
  let made: Siblings | undefined;
  const icons = new Map(
    library.icons.map((spec): readonly [string, PlannedIcon] => [
      spec.key,
      {
        spec,
        redrawn: true,
        node: {
          existing: undefined,
          get: () => {
            made ??= indexSiblings(frame.get().children);
            const component = made.byKey.get(spec.key)?.find(isComponent);
            if (component === undefined) {
              throw new Error(`${library.name} has no icon ${spec.name} after its creation.`);
            }
            return component;
          },
        },
      },
    ])
  );
  return { frame, icons };
}
