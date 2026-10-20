/**
 * The icon library: a frame of icon components, one per icon in the kit. An icon layer is an
 * instance of one of them, and a swap property offers all of them.
 *
 * Each component draws the markup the Fuse icon renders, through `createNodeFromSvg`. A run on
 * a real file on 2026-10-20 showed what that returns: a frame the size of the SVG, painted
 * white and clipping, whose layers take their names from the elements' `id`s. The plugin moves
 * the layers into the component, scales them to fit its square, centers them and flattens them
 * to one vector, the glyph, whose fill binds the library's color. An icon layer overrides that
 * fill, and the override survives a swap, because every glyph has the same name.
 */

import { ICON_GLYPH, PLUGIN_DATA_NAMESPACE } from "../../src/components/kit-spec.ts";
import type { IconLibrarySpec, IconSpec } from "../../src/components/kit-spec.ts";
import { near, planNumber, planPaints, planScalar, solidPaint } from "./fields.ts";
import type { Run } from "./fields.ts";
import { findOwned, keyOf, setKey, staleOwned, unowned } from "./identity.ts";
import { change, create, existing, keepsOrder, warn } from "./plan.ts";
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
export function markupHash(svg: string): string {
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

/** Whether an icon component holds the glyph its markup draws. */
function holdsDrawing(component: ComponentNode, spec: IconSpec): boolean {
  return (
    component.getSharedPluginData(PLUGIN_DATA_NAMESPACE, DRAWN_FROM) === markupHash(spec.svg) &&
    glyphOf(component) !== undefined
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
      // The drawing scales with the component, so the size changes without the constraints.
      write: (value) => component.resizeWithoutConstraints(value, value),
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

function planIcon(run: Run, frame: FrameNode, library: IconLibrarySpec, spec: IconSpec): PlannedIcon {
  const label = `${library.name} / ${spec.name}`;
  const found = findOwned(run.plan, frame.children, library.name, spec.key, spec.name, isComponent);
  if (found !== undefined) {
    const redrawn = !holdsDrawing(found, spec);
    planIconComponent(run, found, label, library, spec);
    return { spec, node: existing(found), redrawn };
  }
  const node = create(
    run.plan,
    library.name,
    `create the icon ${spec.name}`,
    () => {
      const made = run.figma.createComponent();
      frame.appendChild(made);
      setKey(made, spec.key);
      made.name = spec.name;
      return made;
    },
    (made, plan) => planIconComponent({ ...run, plan }, made, label, library, spec)
  );
  return { spec, node, redrawn: true };
}

function planLibraryContents(
  run: Run,
  frame: FrameNode,
  library: IconLibrarySpec
): ReadonlyMap<string, PlannedIcon> {
  planScalar(run, library.name, "name", frame.name, library.name, () => {
    frame.name = library.name;
  });
  planWrapFrame(run, frame, library.name, ICON_GRID);
  const keep = new Set(library.icons.map((icon) => icon.key));
  for (const stale of staleOwned(frame.children, keep)) {
    change(run.plan, library.name, `delete the icon ${stale.name}`, () => stale.remove());
  }
  const icons = new Map(
    library.icons.map((icon) => [icon.key, planIcon(run, frame, library, icon)] as const)
  );
  const owned = [...icons.values()].map((icon) => icon.node);
  for (const child of unowned(frame.children, owned)) {
    warn(run.plan, library.name, `keeps the layer ${child.name}, which the kit does not own`);
  }
  if (!keepsOrder(frame.children, owned)) {
    change(run.plan, library.name, "reorder the icons", () => {
      owned.forEach((target, index) => frame.insertChild(index, target.get()));
    });
  }
  return icons;
}

/**
 * Plan the icon library against the spec.
 *
 * @param run - The run.
 * @param page - The kit's page.
 * @param library - The icon library.
 * @returns The frame and its icons, as later operations find them.
 */
export function planIconLibrary(run: Run, page: PageNode, library: IconLibrarySpec): PlannedIcons {
  const found = findOwned(run.plan, page.children, page.name, library.key, library.name, isFrame);
  if (found !== undefined) {
    return { frame: existing(found), icons: planLibraryContents(run, found, library) };
  }
  const frame = create(
    run.plan,
    page.name,
    `create the ${library.name} frame with ${library.icons.length} icons`,
    () => {
      const made = run.figma.createFrame();
      page.appendChild(made);
      setKey(made, library.key);
      made.name = library.name;
      return made;
    },
    (made, plan) => {
      planLibraryContents({ ...run, plan }, made, library);
    }
  );
  const icons = new Map(
    library.icons.map((spec): readonly [string, PlannedIcon] => [
      spec.key,
      {
        spec,
        redrawn: true,
        node: {
          existing: undefined,
          get: () => {
            const component = frame
              .get()
              .children.find(
                (child): child is ComponentNode => isComponent(child) && keyOf(child) === spec.key
              );
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
