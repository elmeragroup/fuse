/**
 * Preview frames. Each pins one theme through explicit variable modes and holds a group of
 * instances for each component set on its page, so a designer can check that every bound value
 * renders the theme's value.
 */

import { fixedLength } from "../../src/components/kit-spec.ts";
import type { NumberSpec, PreviewGroupSpec, PreviewSpec, SizingSpec } from "../../src/components/kit-spec.ts";
import type { PlannedSet } from "./component-set.ts";
import { LAYOUT_SIZING, near, planLayoutSizing, planNumber, planPaints, planScalar } from "./fields.ts";
import type { Held, NumberField, Run } from "./fields.ts";
import { findOwned, placeOwned, planOwnedChildren } from "./identity.ts";
import type { Siblings } from "./identity.ts";
import type { PlannedPage } from "./pages.ts";
import { change, changeTogether, create, existing } from "./plan.ts";
import type { Target } from "./plan.ts";
import { settleInstances } from "./settle.ts";

/** A frame that wraps its children in rows of a fixed width, with even gaps and padding. */
export type WrapGrid = {
  readonly width: number;
  readonly gap: number;
  readonly padding: number;
};

/** Previews wrap their groups at 960px. */
const PREVIEW_GRID: WrapGrid = { width: 960, gap: 16, padding: 24 };

/**
 * A group fills a preview's row, so each set's instances start on a row of their own, and wraps
 * its instances inside it.
 */
const GROUP_GRID: WrapGrid = {
  width: PREVIEW_GRID.width - 2 * PREVIEW_GRID.padding,
  gap: PREVIEW_GRID.gap,
  padding: 0,
};

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
  planLayoutSizing(
    run,
    frame,
    label,
    { direction: "HORIZONTAL", sizing: { horizontal: "FIXED", vertical: "HUG" } },
    // A preview sits on its page, and a group in a preview that lays it out in rows.
    "read",
    (group, lengths) =>
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
        literal(grid.width),
        lengths
      )
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

/**
 * Plan a preview instance's fixed lengths against its variant root's, as one operation. An instance
 * whose preview's modes give it another size than its main holds its literal lengths and stops
 * following the main's (G13), so a literal length is compared and written: a resize keeps the other
 * axis's length and turns it fixed (rule 5), so the operation writes the hug back after. A bound
 * length follows its variable (G14), so only the binding is compared, and an instance that lost it is
 * bound again (G15). A hugging axis is left as the instance reads it.
 *
 * @param run - The run.
 * @param instance - The preview instance.
 * @param label - The instance's label, for change lines.
 * @param sizing - The sizing of the variant's root.
 * @param held - `unknown` when the run points the instance at another variant, whose lengths the
 *   pass cannot read ahead, so the operation writes them whatever the instance reads now.
 */
function planInstanceLengths(
  run: Run,
  instance: InstanceNode,
  label: string,
  sizing: SizingSpec,
  held: Held
): void {
  const writeSizing = (): void => {
    instance.layoutSizingHorizontal = LAYOUT_SIZING[sizing.horizontal.kind];
    instance.layoutSizingVertical = LAYOUT_SIZING[sizing.vertical.kind];
  };
  changeTogether(
    run.plan,
    label,
    (plan) => {
      for (const [name, size] of [
        ["width", sizing.horizontal],
        ["height", sizing.vertical],
      ] as const) {
        const length = fixedLength(size);
        if (length === undefined) {
          continue;
        }
        const field: NumberField = {
          name,
          bindings: [name],
          matches: (value) => near(instance[name], value),
          write: (value) =>
            name === "width"
              ? instance.resize(value, instance.height)
              : instance.resize(instance.width, value),
        };
        planNumber({ ...run, plan }, instance, label, field, length, held);
      }
    },
    writeSizing
  );
}

/**
 * Plan a group's instances. Each instance's key is the preview's key, `/` and the variant's key,
 * which starts with the set's key, so it nests under the group's key too. Each instance's fixed
 * lengths are planned against its variant's root, a new instance's included (`planInstanceLengths`).
 */
async function planInstances(
  run: Run,
  group: FrameNode,
  label: string,
  previewKey: string,
  spec: PreviewGroupSpec,
  set: PlannedSet
): Promise<void> {
  const children = spec.variants.map((variant) => ({ key: `${previewKey}/${variant}`, variant }));
  await planOwnedChildren(
    run.plan,
    group,
    label,
    "instance",
    children,
    async ({ key, variant }, siblings) => {
      const component = set.variants.get(variant);
      const root = set.spec.variants.find((candidate) => candidate.key === variant)?.root;
      if (component === undefined || root === undefined) {
        throw new Error(`${label} places ${variant}, which ${set.spec.name} does not define.`);
      }
      const lengthsLabel = `${label} / ${variant}`;
      const found = findOwned(run.plan, siblings, label, key, key, isInstance);
      if (found === undefined) {
        return create(
          run.plan,
          label,
          `add an instance of ${variant}`,
          () => placeOwned(group, component.get().createInstance(), key),
          (made, plan) => planInstanceLengths({ ...run, plan }, made, lengthsLabel, root.sizing, "read")
        );
      }
      const main = await found.getMainComponentAsync();
      const swaps = component.existing === undefined || main?.id !== component.existing.id;
      if (swaps) {
        change(run.plan, label, `point the instance ${key} at ${variant}`, () =>
          found.swapComponent(component.get())
        );
      }
      planInstanceLengths(run, found, lengthsLabel, root.sizing, swaps ? "unknown" : "read");
      return existing(found);
    }
  );
}

async function planGroupFields(
  run: Run,
  group: FrameNode,
  label: string,
  previewKey: string,
  spec: PreviewGroupSpec,
  set: PlannedSet
): Promise<void> {
  planScalar(run, label, "name", group.name, spec.name, () => {
    group.name = spec.name;
  });
  planWrapFrame(run, group, label, GROUP_GRID);
  // A new frame clips, and a group has no padding, so a clipping group would cut the focus ring
  // off an instance at its edge.
  planScalar(run, label, "clipsContent", group.clipsContent, false, () => {
    group.clipsContent = false;
  });
  await planInstances(run, group, label, previewKey, spec, set);
}

async function planGroup(
  run: Run,
  frame: FrameNode,
  siblings: Siblings,
  preview: PreviewSpec,
  spec: PreviewGroupSpec,
  sets: ReadonlyMap<string, PlannedSet>
): Promise<Target<FrameNode>> {
  const set = sets.get(spec.componentSet);
  if (set === undefined) {
    throw new Error(
      `${preview.name} places variants of ${spec.componentSet}, which the kit does not define.`
    );
  }
  const label = `${preview.name} / ${spec.name}`;
  const found = findOwned(run.plan, siblings, preview.name, spec.key, spec.name, isFrame);
  if (found !== undefined) {
    await planGroupFields(run, found, label, preview.key, spec, set);
    return existing(found);
  }
  return create(
    run.plan,
    preview.name,
    `create the group ${spec.name}`,
    () => placeOwned(frame, run.figma.createFrame(), spec.key, spec.name),
    (made, plan) => planGroupFields({ ...run, plan }, made, label, preview.key, spec, set)
  );
}

async function planFrame(
  run: Run,
  frame: FrameNode,
  spec: PreviewSpec,
  sets: ReadonlyMap<string, PlannedSet>
): Promise<void> {
  planScalar(run, spec.name, "name", frame.name, spec.name, () => {
    frame.name = spec.name;
  });
  planWrapFrame(run, frame, spec.name, PREVIEW_GRID);
  planModes(run, frame, spec.name, spec);
  await planOwnedChildren(run.plan, frame, spec.name, "group", spec.groups, (group, siblings) =>
    planGroup(run, frame, siblings, spec, group, sets)
  );
}

/**
 * Plan a page's preview frames against the spec.
 *
 * @param run - The run.
 * @param page - The page the previews sit on.
 * @param specs - The page's previews.
 * @param sets - The component sets as the plan leaves them, by key.
 * @returns The preview frames, in spec order, as later operations find them.
 */
export async function planPreviews(
  run: Run,
  page: PlannedPage,
  specs: readonly PreviewSpec[],
  sets: ReadonlyMap<string, PlannedSet>
): Promise<Target<FrameNode>[]> {
  const frames: Target<FrameNode>[] = [];
  for (const spec of specs) {
    const found = page.find(spec.key, spec.name, isFrame);
    if (found !== undefined) {
      await planFrame(run, found, spec, sets);
      frames.push(existing(found));
      continue;
    }
    frames.push(
      create(
        run.plan,
        page.spec.name,
        `create the preview ${spec.name}`,
        () => placeOwned(page.node.get(), run.figma.createFrame(), spec.key, spec.name),
        (made, plan) => planFrame({ ...run, plan }, made, spec, sets)
      )
    );
  }
  return frames;
}

/** A node of a page's row, such as a component set, and its name for the change line. */
export type RowNode = {
  readonly name: string;
  readonly node: Target<ComponentSetNode | FrameNode>;
};

/**
 * The page layout: the row's nodes from where the first one sits, then the previews stacked below
 * the tallest of them, left-aligned with the first node. Each preview's instances, and the instances
 * nested in them, settle before its height is read (`settle.ts`).
 */
function pageLayout(row: readonly RowNode[], frames: readonly Target<FrameNode>[]): Placed[] {
  const nodes = row.map((entry) => entry.node.get());
  const [first] = nodes;
  if (first === undefined) {
    return [];
  }
  const placed: Placed[] = [];
  let x = first.x;
  for (const node of nodes) {
    placed.push({ node, x, y: first.y });
    x += node.width + SET_SPACING;
  }
  let y = first.y + Math.max(...nodes.map((node) => node.height)) + PREVIEW_MARGIN;
  for (const target of frames) {
    const frame = target.get();
    settleInstances(frame);
    placed.push({ node: frame, x: first.x, y });
    y += frame.height + PREVIEW_SPACING;
  }
  return placed;
}

/** `A`, `A and B`, or `A, B and C`. */
function listed(names: readonly string[]): string {
  const last = names.at(-1) ?? "";
  return names.length < 2 ? last : `${names.slice(0, -1).join(", ")} and ${last}`;
}

/**
 * Plan a page's layout: its component sets, or its icon library, in a row, and its previews
 * stacked below them. The layout reads the sizes of what it places when its operation runs,
 * after the writes that change them.
 *
 * @param run - The run.
 * @param page - The page.
 * @param row - The nodes of the row, in order.
 * @param frames - The preview frames, in spec order.
 * @param changed - Whether the plan changes anything on the page, which may move or resize
 *   what the layout reads.
 */
export function placePageContents(
  run: Run,
  page: PlannedPage,
  row: readonly RowNode[],
  frames: readonly Target<FrameNode>[],
  changed: boolean
): void {
  // The first node stays where it is and leads the row, so a lone node needs no layout.
  if (row.length === 0 || row.length + frames.length === 1) {
    return;
  }
  const settled =
    !changed &&
    row.every((entry) => entry.node.existing !== undefined) &&
    frames.every((frame) => frame.existing !== undefined);
  if (
    settled &&
    pageLayout(row, frames).every((placed) => near(placed.node.x, placed.x) && near(placed.node.y, placed.y))
  ) {
    return;
  }
  const stack = frames.length === 0 ? "" : ` and stack ${frames.length} previews below them`;
  change(run.plan, page.spec.name, `place ${listed(row.map((entry) => entry.name))} in a row${stack}`, () => {
    for (const placed of pageLayout(row, frames)) {
      placed.node.x = placed.x;
      placed.node.y = placed.y;
    }
  });
}
