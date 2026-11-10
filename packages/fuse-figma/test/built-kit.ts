/**
 * The kit's built component sets, shared by the suites that check them against hand-written
 * expectations, and the Figma field values those expectations name.
 */
import { Effect } from "effect";

import { buildComponentSets } from "../src/components/build-kit.ts";
import type { CoverageRow } from "../src/components/coverage.ts";
import type {
  BoxSpec,
  ChildLayerSpec,
  ComponentRootSpec,
  KitSpec,
  TextLayerSpec,
} from "../src/components/kit-spec.ts";
import { deepFrozen } from "./frozen.ts";

/** The parts of the built kit a per-set suite reads. */
export type BuiltSets = {
  readonly spec: Pick<KitSpec, "componentSets">;
  readonly coverage: readonly CoverageRow[];
};

let built: Promise<BuiltSets> | undefined;

async function buildSets(): Promise<BuiltSets> {
  const sets = await Effect.runPromise(buildComponentSets());
  return deepFrozen({
    spec: { componentSets: sets.map((set) => set.componentSet) },
    coverage: sets.flatMap((set) => set.coverage),
  });
}

/**
 * Build the kit's component sets and their coverage on the first call, deep frozen, without the
 * icon library or the previews. The suites a Vitest worker runs share one module registry
 * (`vitest.config.ts`), so each worker builds the sets once.
 *
 * @returns The component sets, as the kit spec holds them, and their coverage rows.
 */
export function builtKit(): Promise<BuiltSets> {
  built ??= buildSets();
  return built;
}

/**
 * The root of one variant.
 *
 * @param spec - The built component sets.
 * @param key - The variant's key, such as `checkbox/checked=on,state=rest`.
 * @returns The variant's root.
 * @throws When the kit has no such variant.
 */
export function variantRoot(spec: Pick<KitSpec, "componentSets">, key: string): ComponentRootSpec {
  const found = spec.componentSets.flatMap((set) => set.variants).find((cell) => cell.key === key);
  if (found === undefined) {
    throw new Error(`the kit has no ${key}`);
  }
  return found.root;
}

/**
 * The property, outcome and detail of each coverage row of one class, in table order.
 *
 * @param coverage - The coverage rows.
 * @param className - The class whose rows to read.
 * @returns One `[property, outcome, detail]` triple per row.
 */
export const notesOf = (coverage: readonly CoverageRow[], className: string) =>
  coverage.filter((row) => row.className === className).map((row) => [row.property, row.outcome, row.detail]);

/**
 * The first text layer a box holds directly.
 *
 * @param box - A root or frame, or undefined where the caller found none.
 * @returns The text layer, or undefined where the box holds none directly.
 */
export function textOf(box: BoxSpec | undefined): TextLayerSpec | undefined {
  const found = box?.children.find((child) => child.kind === "text");
  return found?.kind === "text" ? found : undefined;
}

/**
 * Each layer's key, and the variant it shows where it is an instance, depth first, indented two
 * spaces per level.
 *
 * @param layers - The layers.
 * @param depth - The level of these layers.
 * @returns One line per layer.
 */
export function outline(layers: readonly ChildLayerSpec[], depth = 0): readonly string[] {
  return layers.flatMap((layer) => [
    `${"  ".repeat(depth)}${layer.key}${layer.kind === "instance" ? ` -> ${layer.variant}` : ""}`,
    ...(layer.kind === "frame" ? outline(layer.children, depth + 1) : []),
  ]);
}

/**
 * Every instance layer at or below some layers, depth first.
 *
 * @param layers - The layers.
 * @returns The instance layers.
 */
export function instancesIn(
  layers: readonly ChildLayerSpec[]
): readonly Extract<ChildLayerSpec, { kind: "instance" }>[] {
  return layers.flatMap((layer) =>
    layer.kind === "instance" ? [layer] : layer.kind === "frame" ? instancesIn(layer.children) : []
  );
}

/** A field bound to a `Fuse tokens` variable. */
export const token = (name: string) =>
  ({ kind: "variable", variable: { collection: "Fuse tokens", name } }) as const;

/** A color bound to a `Fuse tokens` variable, the name the expectations give a paint. */
export const paint = token;

/** A field bound to a `Fuse density` variable. */
export const density = (name: string) =>
  ({ kind: "variable", variable: { collection: "Fuse density", name } }) as const;

/** A literal number field. */
export const literal = (value: number) => ({ kind: "literal", value }) as const;

/** An axis fixed at a length. */
export const fixed = <Length>(length: Length) => ({ kind: "fixed", length }) as const;

/** An axis that hugs the box's content. */
export const HUG = { kind: "hug" } as const;

/** An axis that fills the room its parent's auto layout gives the box. */
export const FILL = { kind: "fill" } as const;

/** A box fixed at a width and a height. */
export const fixedSize = <Width, Height>(width: Width, height: Height) =>
  ({ horizontal: fixed(width), vertical: fixed(height) }) as const;

/** No limit on either axis. */
export const UNLIMITED = {
  minWidth: undefined,
  maxWidth: undefined,
  minHeight: undefined,
  maxHeight: undefined,
} as const;

/**
 * A horizontal box with no limits, padding or gap that centers its layers, with no shadow and
 * full opacity.
 */
export const CENTERED_BOX = {
  direction: "HORIZONTAL",
  limits: UNLIMITED,
  paddingTop: literal(0),
  paddingRight: literal(0),
  paddingBottom: literal(0),
  paddingLeft: literal(0),
  itemSpacing: literal(0),
  primaryAlign: "CENTER",
  counterAlign: "CENTER",
  shadows: [],
  opacity: 1,
} as const;
