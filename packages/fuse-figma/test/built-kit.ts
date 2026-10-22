/**
 * The kit's built component sets, shared by the suites that check them against hand-written
 * expectations, and the Figma field values those expectations name.
 */
import { buildComponentSets } from "../src/components/build-kit.ts";
import type { CoverageRow } from "../src/components/coverage.ts";
import type { ComponentRootSpec, KitSpec } from "../src/components/kit-spec.ts";

/** The parts of the built kit a per-set suite reads. */
export type BuiltSets = {
  readonly spec: Pick<KitSpec, "componentSets">;
  readonly coverage: readonly CoverageRow[];
};

let built: Promise<BuiltSets> | undefined;

async function buildSets(): Promise<BuiltSets> {
  const sets = await buildComponentSets();
  return {
    spec: { componentSets: sets.map((set) => set.componentSet) },
    coverage: sets.flatMap((set) => set.coverage),
  };
}

/**
 * Build the kit's component sets and their coverage on the first call, without the icon library
 * or the previews. Vitest gives each test file its own module registry, so a file that calls
 * this from several suites builds the sets once. The whole-kit invariants in `build-kit.test.ts`
 * build the full kit instead.
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

/**
 * The layout of a label that hugs its characters on both axes, with its lines set from the top
 * left as a new Figma text sets them, and no truncation.
 */
export const HUGGING_LABEL = {
  sizing: { horizontal: HUG, vertical: HUG },
  align: { horizontal: "LEFT", vertical: "TOP" },
} as const;

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

/** The 2px `ring` the focus ring in `styles/utils.ts` draws around a focused control. */
export const FOCUS_RING = {
  color: paint("ring"),
  offsetX: 0,
  offsetY: 0,
  radius: literal(0),
  spread: literal(2),
} as const;

/** The 3px `ring-error/20` halo the state face draws around an invalid control. */
export const ERROR_RING = {
  color: paint("error/20"),
  offsetX: 0,
  offsetY: 0,
  radius: literal(0),
  spread: literal(3),
} as const;

/** Tailwind's shadow-xs, 0 1px 2px at 5% black. */
export const SHADOW_XS = {
  color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0.05 } },
  offsetX: 0,
  offsetY: 1,
  radius: literal(2),
  spread: literal(0),
} as const;
