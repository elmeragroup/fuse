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

/** Previews wrap their instances at this width. */
const PREVIEW_WIDTH = 960;
const PREVIEW_GAP = 16;
const PREVIEW_PADDING = 24;

/** The space between the component sets and the first preview, and between previews. */
const PREVIEW_MARGIN = 64;
const PREVIEW_SPACING = 32;

/** Previews paint the theme's background, so a dark preview reads as dark. */
export const PREVIEW_BACKGROUND = { collection: "Fuse tokens", name: "background" } as const;

/** A preview frame and where the stack puts it. */
type PlacedPreview = {
  readonly frame: FrameNode;
  readonly x: number;
  readonly y: number;
};

const isFrame = (node: BaseNode): node is FrameNode => node.type === "FRAME";
const isInstance = (node: BaseNode): node is InstanceNode => node.type === "INSTANCE";

function literal(value: number): NumberSpec {
  return { kind: "literal", value };
}

function planFrameLayout(run: Run, frame: FrameNode, label: string): void {
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
        literal(PREVIEW_WIDTH)
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
      literal(PREVIEW_GAP)
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
      literal(PREVIEW_PADDING)
    );
  }
  planPaints(
    run,
    label,
    "fill",
    frame.fills,
    { kind: "variable", variable: PREVIEW_BACKGROUND, opacity: 1 },
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
  planFrameLayout(run, frame, spec.name);
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

function previewStack(sets: readonly PlannedSet[], frames: readonly Target<FrameNode>[]): PlacedPreview[] {
  const setNodes = sets.map((set) => set.node.get());
  const [first] = setNodes;
  if (first === undefined) {
    return [];
  }
  let y = Math.max(...setNodes.map((node) => node.y + node.height)) + PREVIEW_MARGIN;
  return frames.map((target) => {
    const frame = target.get();
    const placed = { frame, x: first.x, y };
    y += frame.height + PREVIEW_SPACING;
    return placed;
  });
}

/**
 * Plan the stack of previews below the component sets, left-aligned with the first set. The
 * stack reads the sizes of the sets and the previews when its operation runs, after the
 * writes that change them.
 *
 * @param run - The run.
 * @param page - The kit's page.
 * @param frames - The preview frames, in spec order.
 * @param sets - The component sets.
 * @param changed - Whether the plan changes anything on the page, which may move or resize
 *   what the stack reads.
 */
export function placePreviews(
  run: Run,
  page: PageNode,
  frames: readonly Target<FrameNode>[],
  sets: readonly PlannedSet[],
  changed: boolean
): void {
  if (sets.length === 0 || frames.length === 0) {
    return;
  }
  const settled =
    !changed &&
    sets.every((set) => set.node.existing !== undefined) &&
    frames.every((frame) => frame.existing !== undefined);
  if (
    settled &&
    previewStack(sets, frames).every(
      (placed) => near(placed.frame.x, placed.x) && near(placed.frame.y, placed.y)
    )
  ) {
    return;
  }
  change(run.plan, page.name, `stack ${frames.length} previews below the component sets`, () => {
    for (const placed of previewStack(sets, frames)) {
      placed.frame.x = placed.x;
      placed.frame.y = placed.y;
    }
  });
}
