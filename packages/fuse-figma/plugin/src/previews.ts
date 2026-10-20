/**
 * Preview frames. Each pins one theme and density through explicit variable modes and holds
 * instances of the kit's variants, so a designer can check that every bound value renders
 * the theme's value.
 */

import type { NumberSpec, PreviewSpec } from "../../src/components/kit-spec.ts";
import type { PlannedSet } from "./component-set.ts";
import { near, planNumber, planPaints, planScalar, planSizing } from "./fields.ts";
import type { Run } from "./fields.ts";
import { findOwned, setKey, staleOwned } from "./identity.ts";
import { change, create, existing, keepsOrder } from "./plan.ts";
import type { Target } from "./plan.ts";

/** A frame that wraps its children in rows of a fixed width, with even gaps and padding. */
export type WrapGrid = {
  readonly width: number;
  readonly gap: number;
  readonly padding: number;
};

/** Previews wrap their instances at 960px. */
const PREVIEW_GRID: WrapGrid = { width: 960, gap: 16, padding: 24 };

/** The space between component sets, between the sets and the first preview, and between previews. */
const SET_SPACING = 64;
const PREVIEW_MARGIN = 64;
const PREVIEW_SPACING = 32;

/** Previews paint the theme's background, so a dark preview reads as dark. */
export const PREVIEW_BACKGROUND = { collection: "Fuse tokens", name: "background" } as const;

/** A component set or preview frame, and where the page layout puts it. */
type Placed = {
  readonly node: ComponentSetNode | FrameNode;
  readonly x: number;
  readonly y: number;
};

const isFrame = (node: BaseNode): node is FrameNode => node.type === "FRAME";
const isInstance = (node: BaseNode): node is InstanceNode => node.type === "INSTANCE";

function literal(value: number): NumberSpec {
  return { kind: "literal", value };
}

/**
 * Plan a frame that wraps its children in rows and paints the theme's background.
 *
 * @param run - The run.
 * @param frame - The frame.
 * @param label - The frame's label, for change lines.
 * @param grid - The row width, gaps and padding.
 */
export function planWrapFrame(run: Run, frame: FrameNode, label: string, grid: WrapGrid): void {
  planScalar(run, label, "layoutMode", frame.layoutMode, "HORIZONTAL", () => {
    frame.layoutMode = "HORIZONTAL";
  });
  planScalar(run, label, "layoutWrap", frame.layoutWrap, "WRAP", () => {
    frame.layoutWrap = "WRAP";
  });
  planSizing(
    run,
    frame,
    label,
    (group) =>
      planNumber(
        group,
        frame,
        label,
        {
          name: "width",
          bindings: ["width"],
          matches: (value) => near(frame.width, value),
          write: (value) => frame.resize(value, frame.height),
        },
        literal(grid.width)
      ),
    { primary: "FIXED", counter: "AUTO" }
  );
  planScalar(run, label, "counterAxisAlignItems", frame.counterAxisAlignItems, "CENTER", () => {
    frame.counterAxisAlignItems = "CENTER";
  });
  for (const field of ["itemSpacing", "counterAxisSpacing"] as const) {
    planNumber(
      run,
      frame,
      label,
      {
        name: field,
        bindings: [field],
        matches: (value) => near(frame[field] ?? 0, value),
        write: (value) => {
          frame[field] = value;
        },
      },
      literal(grid.gap)
    );
  }
  for (const field of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const) {
    planNumber(
      run,
      frame,
      label,
      {
        name: field,
        bindings: [field],
        matches: (value) => near(frame[field], value),
        write: (value) => {
          frame[field] = value;
        },
      },
      literal(grid.padding)
    );
  }
  planPaints(
    run,
    label,
    "fill",
    frame.fills,
    { kind: "variable", variable: PREVIEW_BACKGROUND },
    (paints) => {
      frame.fills = paints;
    }
  );
}

function planModes(run: Run, frame: FrameNode, label: string, spec: PreviewSpec): void {
  for (const ref of spec.modes) {
    const { collection, modeId } = run.variables.mode(ref);
    if (frame.explicitVariableModes[collection.id] !== modeId) {
      change(run.plan, label, `${ref.collection} mode → ${ref.mode}`, () =>
        frame.setExplicitVariableModeForCollection(collection, modeId)
      );
    }
  }
}

async function planInstances(
  run: Run,
  frame: FrameNode,
  label: string,
  spec: PreviewSpec,
  set: PlannedSet
): Promise<void> {
  const keys = spec.variants.map((variant) => `${spec.key}/${variant}`);
  for (const stale of staleOwned(frame.children, new Set(keys))) {
    change(run.plan, label, `delete the instance ${stale.name}`, () => stale.remove());
  }
  const owned: Target<InstanceNode>[] = [];
  for (const [index, variant] of spec.variants.entries()) {
    const component = set.variants.get(variant);
    if (component === undefined) {
      throw new Error(`${spec.name} places ${variant}, which ${set.spec.name} does not define.`);
    }
    const key = keys[index] ?? variant;
    const found = findOwned(run.plan, frame.children, label, key, key, isInstance);
    if (found === undefined) {
      owned.push(
        create(run.plan, label, `add an instance of ${variant}`, () => {
          const instance = component.get().createInstance();
          frame.appendChild(instance);
          setKey(instance, key);
          return instance;
        })
      );
      continue;
    }
    owned.push(existing(found));
    const main = await found.getMainComponentAsync();
    if (component.existing === undefined || main?.id !== component.existing.id) {
      change(run.plan, label, `point the instance ${key} at ${variant}`, () =>
        found.swapComponent(component.get())
      );
    }
  }
  if (!keepsOrder(frame.children, owned)) {
    change(run.plan, label, "reorder the instances", () => {
      owned.forEach((target, index) => frame.insertChild(index, target.get()));
    });
  }
}

async function planFrame(run: Run, frame: FrameNode, spec: PreviewSpec, set: PlannedSet): Promise<void> {
  planScalar(run, spec.name, "name", frame.name, spec.name, () => {
    frame.name = spec.name;
  });
  planWrapFrame(run, frame, spec.name, PREVIEW_GRID);
  planModes(run, frame, spec.name, spec);
  await planInstances(run, frame, spec.name, spec, set);
}

/**
 * Plan the preview frames against the spec.
 *
 * @param run - The run.
 * @param page - The kit's page.
 * @param specs - The previews.
 * @param sets - The component sets as the plan leaves them, by key.
 * @returns The preview frames, in spec order, as later operations find them.
 */
export async function planPreviews(
  run: Run,
  page: PageNode,
  specs: readonly PreviewSpec[],
  sets: ReadonlyMap<string, PlannedSet>
): Promise<Target<FrameNode>[]> {
  const frames: Target<FrameNode>[] = [];
  for (const spec of specs) {
    const set = sets.get(spec.componentSet);
    if (set === undefined) {
      throw new Error(`${spec.name} places variants of ${spec.componentSet}, which the kit does not define.`);
    }
    const found = findOwned(run.plan, page.children, page.name, spec.key, spec.name, isFrame);
    if (found !== undefined) {
      await planFrame(run, found, spec, set);
      frames.push(existing(found));
      continue;
    }
    frames.push(
      create(
        run.plan,
        page.name,
        `create the preview ${spec.name}`,
        () => {
          const made = run.figma.createFrame();
          page.appendChild(made);
          setKey(made, spec.key);
          made.name = spec.name;
          return made;
        },
        (made, plan) => planFrame({ ...run, plan }, made, spec, set)
      )
    );
  }
  return frames;
}

/**
 * The page layout: the component sets in a row from where the first set sits, then the icon
 * library, then the previews stacked below the tallest of them, left-aligned with the first set.
 */
function pageLayout(
  sets: readonly PlannedSet[],
  library: Target<FrameNode>,
  frames: readonly Target<FrameNode>[]
): Placed[] {
  const row = [...sets.map((set) => set.node.get()), library.get()];
  const [first] = row;
  if (first === undefined) {
    return [];
  }
  const placed: Placed[] = [];
  let x = first.x;
  for (const node of row) {
    placed.push({ node, x, y: first.y });
    x += node.width + SET_SPACING;
  }
  let y = first.y + Math.max(...row.map((node) => node.height)) + PREVIEW_MARGIN;
  for (const target of frames) {
    const frame = target.get();
    placed.push({ node: frame, x: first.x, y });
    y += frame.height + PREVIEW_SPACING;
  }
  return placed;
}

/**
 * Plan the page layout: the component sets and the icon library in a row, and the previews
 * stacked below them. The layout reads the sizes of what it places when its operation runs,
 * after the writes that change them.
 *
 * @param run - The run.
 * @param page - The kit's page.
 * @param sets - The component sets.
 * @param library - The icon library frame.
 * @param frames - The preview frames, in spec order.
 * @param changed - Whether the plan changes anything on the page, which may move or resize
 *   what the layout reads.
 */
export function placePageContents(
  run: Run,
  page: PageNode,
  sets: readonly PlannedSet[],
  library: Target<FrameNode>,
  frames: readonly Target<FrameNode>[],
  changed: boolean
): void {
  // The first set stays where it is and leads the row.
  if (sets.length === 0) {
    return;
  }
  const settled =
    !changed &&
    library.existing !== undefined &&
    sets.every((set) => set.node.existing !== undefined) &&
    frames.every((frame) => frame.existing !== undefined);
  if (
    settled &&
    pageLayout(sets, library, frames).every(
      (placed) => near(placed.node.x, placed.x) && near(placed.node.y, placed.y)
    )
  ) {
    return;
  }
  change(
    run.plan,
    page.name,
    `place ${sets.length} component sets and the icons in a row and stack ${frames.length} previews below them`,
    () => {
      for (const placed of pageLayout(sets, library, frames)) {
        placed.node.x = placed.x;
        placed.node.y = placed.y;
      }
    }
  );
}
