/**
 * Preview frames. Each pins one theme through explicit variable modes and holds a group of
 * instances for each component set on its page, so a designer can check that every bound value
 * renders the theme's value.
 */

import * as Effect from "effect/Effect";

import { previewInstanceKey } from "../../src/components/kit-spec.ts";
import type {
  NumberSpec,
  PreviewGroupSpec,
  PreviewInstanceSpec,
  PreviewSpec,
} from "../../src/components/kit-spec.ts";
import { findProperty } from "./component-properties.ts";
import type { PlannedSet } from "./component-set.ts";
import { near, planLayoutSizing, planNumber, planPaints, planScalar } from "./fields.ts";
import type { Run } from "./fields.ts";
import { placeOwned, planOwnedChildren } from "./identity.ts";
import type { OwnedChild } from "./identity.ts";
import { planInstanceSizing } from "./instance-sizing.ts";
import type { PlannedPage } from "./pages.ts";
import { change, create, existing } from "./plan.ts";
import type { Target } from "./plan.ts";
import { currentRun } from "./services.ts";

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

/** Previews paint the theme's background, so a dark preview reads as dark. */
export const PREVIEW_BACKGROUND = { collection: "Fuse tokens", name: "background" } as const;

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
 * Plan an instance's BOOLEAN properties: each at the value the preview gives it, or else at its
 * default. A new instance starts at the defaults, so it writes only the values the preview sets. A held
 * instance writes the values it does not hold, and one the run swaps writes them all, since the values
 * it held belong to another main.
 *
 * @param run - The run.
 * @param instance - The instance.
 * @param label - The instance's label, for change lines.
 * @param spec - What the preview places.
 * @param set - The instance's set as the plan leaves it, whose ids the write finds when it runs.
 * @param held - How the instance stands: new, swapped this run, or held.
 */
function planBooleans(
  run: Run,
  instance: InstanceNode,
  label: string,
  spec: PreviewInstanceSpec,
  set: PlannedSet,
  held: "new" | "swapped" | "held"
): void {
  const differ = (set.spec.booleanProperties ?? []).flatMap(({ name, defaultValue }) => {
    const value = spec.booleans?.[name] ?? defaultValue;
    switch (held) {
      case "new":
        return value === defaultValue ? [] : [{ name, value }];
      case "swapped":
        return [{ name, value }];
      case "held": {
        const found = findProperty(instance.componentProperties, "BOOLEAN", name);
        return found?.[1].value === value ? [] : [{ name, value }];
      }
    }
  });
  if (differ.length === 0) {
    return;
  }
  const described = differ.map(({ name, value }) => `${name} ${String(value)}`).join(", ");
  change(run.plan, label, `properties → ${described}`, () => {
    const values: { [id: string]: boolean } = {};
    for (const { name, value } of differ) {
      const id = set.properties.get(name);
      if (id === undefined) {
        throw new Error(`${label}: ${set.spec.name} has no ${name} property when the instance sets it.`);
      }
      values[id] = value;
    }
    instance.setProperties(values);
  });
}

/**
 * Plan a group's instances. Each instance's key is the preview's key, `/` and the variant's key,
 * which starts with the set's key, so it nests under the group's key too, then `/` and the BOOLEAN
 * values it sets off their defaults, as `previewInstanceKey` writes it.
 *
 * Each instance's sizing and fixed lengths are planned against its variant's root, a new instance's
 * included, as an instance layer's are (`planInstanceSizing`). An instance whose preview's modes give
 * it another size than its main holds its literal lengths and stops following the main's (G13), so a
 * literal length is compared and written. A bound length follows its variable (G14), so only the
 * binding is compared, and an instance that lost it is bound again (G15). An instance can hug on an
 * axis the root fixes while its length or binding reads as the spec's (N4), so that axis is written
 * FIXED first and its length written after, since a HUG drops a width binding (G19). After a planned
 * swap the pass cannot read the new variant's lengths ahead, so they are written whatever the
 * instance reads now.
 */
function planInstances(
  group: FrameNode,
  label: string,
  previewKey: string,
  spec: PreviewGroupSpec,
  set: PlannedSet
) {
  const children = spec.instances.map((instance) => ({
    key: previewInstanceKey(previewKey, instance),
    instance,
  }));
  return planOwnedChildren(group, label, "instance", children, ({ key, instance: placed }) => {
    const { variant } = placed;
    const component = set.variants.get(variant);
    const root = set.spec.variants.find((candidate) => candidate.key === variant)?.root;
    if (component === undefined || root === undefined) {
      throw new Error(`${label} places ${variant}, which ${set.spec.name} does not define.`);
    }
    const lengthsLabel = `${label} / ${variant}`;
    return {
      name: key,
      keepsName: true,
      accept: isInstance,
      description: `add an instance of ${variant}`,
      make: () => component.get().createInstance(),
      plan: Effect.fnUntraced(function* (instance, origin) {
        const inner = yield* currentRun;
        if (origin === "new") {
          planInstanceSizing(inner, instance, lengthsLabel, root.sizing, "read");
          planBooleans(inner, instance, key, placed, set, "new");
          return;
        }
        const main = yield* Effect.promise(() => instance.getMainComponentAsync());
        const swaps = component.existing === undefined || main?.id !== component.existing.id;
        if (swaps) {
          change(inner.plan, label, `point the instance ${key} at ${variant}`, () =>
            instance.swapComponent(component.get())
          );
        }
        planInstanceSizing(inner, instance, lengthsLabel, root.sizing, swaps ? "unknown" : "read");
        planBooleans(inner, instance, key, placed, set, swaps ? "swapped" : "held");
      }),
    } satisfies OwnedChild<InstanceNode, void>;
  });
}

/**
 * Plan a group frame of instances, as a preview holds one per set: its name, its wrapping rows and
 * its instances.
 *
 * @param group - The group frame.
 * @param label - The group's label, for change lines.
 * @param previewKey - The key the instances' keys start with.
 * @param spec - The group.
 * @param set - The set whose variants the instances show.
 */
export const planGroupFields = Effect.fnUntraced(function* (
  group: FrameNode,
  label: string,
  previewKey: string,
  spec: PreviewGroupSpec,
  set: PlannedSet
) {
  const run = yield* currentRun;
  planScalar(run, label, "name", group.name, spec.name, () => {
    group.name = spec.name;
  });
  planWrapFrame(run, group, label, GROUP_GRID);
  // A new frame clips, and a group has no padding, so a clipping group would cut the focus ring
  // off an instance at its edge.
  planScalar(run, label, "clipsContent", group.clipsContent, false, () => {
    group.clipsContent = false;
  });
  yield* planInstances(group, label, previewKey, spec, set);
});

/** How to find, create and plan one group of a preview frame, which places one set's variants. */
function groupKind(
  run: Run,
  preview: PreviewSpec,
  spec: PreviewGroupSpec,
  sets: ReadonlyMap<string, PlannedSet>
): OwnedChild<FrameNode, void> {
  const set = sets.get(spec.componentSet);
  if (set === undefined) {
    throw new Error(
      `${preview.name} places variants of ${spec.componentSet}, which the kit does not define.`
    );
  }
  const label = `${preview.name} / ${spec.name}`;
  return {
    name: spec.name,
    accept: isFrame,
    description: `create the group ${spec.name}`,
    make: () => run.figma.createFrame(),
    plan: (group) => planGroupFields(group, label, preview.key, spec, set),
  };
}

const planFrame = Effect.fnUntraced(function* (
  frame: FrameNode,
  spec: PreviewSpec,
  sets: ReadonlyMap<string, PlannedSet>
) {
  const run = yield* currentRun;
  planScalar(run, spec.name, "name", frame.name, spec.name, () => {
    frame.name = spec.name;
  });
  planWrapFrame(run, frame, spec.name, PREVIEW_GRID);
  planModes(run, frame, spec.name, spec);
  yield* planOwnedChildren(frame, spec.name, "group", spec.groups, (group) =>
    groupKind(run, spec, group, sets)
  );
});

/**
 * Plan a page's preview frames against the spec.
 *
 * @param page - The page the previews sit on.
 * @param specs - The page's previews.
 * @param sets - The component sets as the plan leaves them, by key.
 * @returns The preview frames, in spec order, as later operations find them.
 */
export const planPreviews = Effect.fnUntraced(function* (
  page: PlannedPage,
  specs: readonly PreviewSpec[],
  sets: ReadonlyMap<string, PlannedSet>
) {
  const run = yield* currentRun;
  const frames: Target<FrameNode>[] = [];
  for (const spec of specs) {
    const found = yield* page.find(spec.key, spec.name, isFrame);
    if (found !== undefined) {
      yield* planFrame(found, spec, sets);
      frames.push(existing(found));
      continue;
    }
    frames.push(
      yield* create(
        page.spec.name,
        `create the preview ${spec.name}`,
        () => placeOwned(page.node.get(), run.figma.createFrame(), spec.key, spec.name),
        (made) => planFrame(made, spec, sets)
      )
    );
  }
  return frames;
});
