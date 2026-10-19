/**
 * Preview frames. Each pins one theme and density through explicit variable modes and holds
 * instances of the kit's variants, so a designer can check that every bound value renders
 * the theme's value.
 */

import type { NumberSpec, PreviewSpec } from "../../src/components/kit-spec.ts";
import type { SyncedSet } from "./component-set.ts";
import { near, syncNumber, syncPaints, syncScalar } from "./fields.ts";
import type { Run } from "./fields.ts";
import { findOwned, setKey, staleOwned } from "./identity.ts";
import { change, create, muted } from "./ledger.ts";

/** Previews wrap their instances at this width. */
const PREVIEW_WIDTH = 960;
const PREVIEW_GAP = 16;
const PREVIEW_PADDING = 24;

/** The space between the component sets and the first preview, and between previews. */
const PREVIEW_MARGIN = 64;
const PREVIEW_SPACING = 32;

/** Previews paint the theme's background, so a dark preview reads as dark. */
const BACKGROUND = { collection: "Fuse tokens", name: "background" } as const;

const isFrame = (node: BaseNode): node is FrameNode => node.type === "FRAME";
const isInstance = (node: BaseNode): node is InstanceNode => node.type === "INSTANCE";

function literal(value: number): NumberSpec {
  return { kind: "literal", value };
}

function syncFrameLayout(run: Run, frame: FrameNode, label: string): void {
  syncScalar(run, label, "layoutMode", frame.layoutMode, "HORIZONTAL", () => {
    frame.layoutMode = "HORIZONTAL";
  });
  syncScalar(run, label, "layoutWrap", frame.layoutWrap, "WRAP", () => {
    frame.layoutWrap = "WRAP";
  });
  // `resize` turns both sizing modes to FIXED, so the width comes before the sizing modes.
  syncNumber(
    run,
    frame,
    label,
    {
      name: "width",
      bindings: ["width"],
      matches: (value) => near(frame.width, value),
      write: (value) => frame.resize(value, frame.height),
    },
    literal(PREVIEW_WIDTH)
  );
  syncScalar(run, label, "primaryAxisSizingMode", frame.primaryAxisSizingMode, "FIXED", () => {
    frame.primaryAxisSizingMode = "FIXED";
  });
  syncScalar(run, label, "counterAxisSizingMode", frame.counterAxisSizingMode, "AUTO", () => {
    frame.counterAxisSizingMode = "AUTO";
  });
  syncScalar(run, label, "counterAxisAlignItems", frame.counterAxisAlignItems, "CENTER", () => {
    frame.counterAxisAlignItems = "CENTER";
  });
  for (const field of ["itemSpacing", "counterAxisSpacing"] as const) {
    syncNumber(
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
    syncNumber(
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
  syncPaints(
    run,
    label,
    "fill",
    frame.fills,
    { kind: "variable", variable: BACKGROUND, opacity: 1 },
    (paints) => {
      frame.fills = paints;
    }
  );
}

function syncModes(run: Run, frame: FrameNode, label: string, spec: PreviewSpec): void {
  for (const ref of spec.modes) {
    const { collection, modeId } = run.variables.mode(ref);
    if (frame.explicitVariableModes[collection.id] !== modeId) {
      change(run.ledger, label, `${ref.collection} mode → ${ref.mode}`, () =>
        frame.setExplicitVariableModeForCollection(collection, modeId)
      );
    }
  }
}

async function syncInstances(
  run: Run,
  frame: FrameNode,
  label: string,
  spec: PreviewSpec,
  set: SyncedSet
): Promise<void> {
  const keys = spec.variants.map((variant) => `${spec.key}/${variant}`);
  for (const stale of staleOwned(frame.children, new Set(keys))) {
    change(run.ledger, label, `delete the instance ${stale.name}`, () => stale.remove());
  }
  const owned: InstanceNode[] = [];
  for (const [index, variant] of spec.variants.entries()) {
    if (!set.spec.variants.some((candidate) => candidate.key === variant)) {
      throw new Error(`${spec.name} places ${variant}, which ${set.spec.name} does not define.`);
    }
    const key = keys[index] ?? variant;
    const component = set.variants.get(variant);
    const existing = findOwned(run.ledger, frame.children, label, key, key, isInstance);
    if (existing === undefined) {
      const created = create(run.ledger, label, `add an instance of ${variant}`, () => {
        if (component === undefined) {
          throw new Error(`${set.spec.name} has no variant ${variant} to place in ${spec.name}.`);
        }
        const instance = component.createInstance();
        frame.appendChild(instance);
        setKey(instance, key);
        return instance;
      });
      if (created !== undefined) {
        owned.push(created);
      }
      continue;
    }
    owned.push(existing);
    if (component === undefined) {
      continue;
    }
    const main = await existing.getMainComponentAsync();
    if (main?.id !== component.id) {
      change(run.ledger, label, `point the instance ${key} at ${variant}`, () =>
        existing.swapComponent(component)
      );
    }
  }
  const order = frame.children.filter(
    (node): node is InstanceNode => isInstance(node) && owned.includes(node)
  );
  if (order.some((node, index) => node !== owned[index])) {
    change(run.ledger, label, "reorder the instances", () => {
      owned.forEach((node, index) => frame.insertChild(index, node));
    });
  }
}

/**
 * Bring the preview frames in line with the spec.
 *
 * @param run - The run.
 * @param page - The kit's page.
 * @param specs - The previews.
 * @param sets - The component sets after this run, by key.
 */
export async function syncPreviews(
  run: Run,
  page: PageNode,
  specs: readonly PreviewSpec[],
  sets: ReadonlyMap<string, SyncedSet>
): Promise<void> {
  const frames: FrameNode[] = [];
  for (const spec of specs) {
    const set = sets.get(spec.componentSet);
    if (set === undefined) {
      throw new Error(`${spec.name} places variants of ${spec.componentSet}, which the kit does not define.`);
    }
    let frame = findOwned(run.ledger, page.children, page.name, spec.key, spec.name, isFrame);
    let previewRun = run;
    if (frame === undefined) {
      frame = create(run.ledger, page.name, `create the preview ${spec.name}`, () => {
        const made = run.figma.createFrame();
        page.appendChild(made);
        setKey(made, spec.key);
        made.name = spec.name;
        return made;
      });
      if (frame === undefined) {
        continue;
      }
      previewRun = { ...run, ledger: muted(run.ledger) };
    }
    const target = frame;
    syncScalar(previewRun, spec.name, "name", target.name, spec.name, () => {
      target.name = spec.name;
    });
    syncFrameLayout(previewRun, target, spec.name);
    syncModes(previewRun, target, spec.name, spec);
    await syncInstances(previewRun, target, spec.name, spec, set);
    frames.push(target);
  }
  placePreviews(run, page, frames, sets);
}

/** Stack the previews below the component sets, left-aligned with the first set. */
function placePreviews(
  run: Run,
  page: PageNode,
  frames: readonly FrameNode[],
  sets: ReadonlyMap<string, SyncedSet>
): void {
  const setNodes = [...sets.values()].flatMap((set) => (set.node === undefined ? [] : [set.node]));
  const [first] = setNodes;
  if (first === undefined || frames.length === 0) {
    return;
  }
  let y = Math.max(...setNodes.map((node) => node.y + node.height)) + PREVIEW_MARGIN;
  const targets = frames.map((frame) => {
    const target = { frame, x: first.x, y };
    y += frame.height + PREVIEW_SPACING;
    return target;
  });
  if (targets.every((target) => near(target.frame.x, target.x) && near(target.frame.y, target.y))) {
    return;
  }
  change(run.ledger, page.name, `stack ${frames.length} previews below the component sets`, () => {
    for (const target of targets) {
      target.frame.x = target.x;
      target.frame.y = target.y;
    }
  });
}
