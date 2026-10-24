/**
 * Fixture definitions with hand-written classes, and the component sets `buildComponentSet`
 * builds from them, shared by the suites that check one rule of the spec builder at a time.
 * Each fixture is `chip`, a one-cell set whose root carries the classes a test gives it, and
 * each build compiles every class the fixture uses, as the kit build compiles its definitions'.
 */
import { buildComponentSet, buildSetsInOrder, definitionClasses } from "../src/components/component-spec.ts";
import type {
  BuiltComponent,
  ComponentDefinition,
  IconSlot,
  OuterDeclaration,
  PartDefinition,
} from "../src/components/component-spec.ts";
import { makeVariableIndex } from "../src/components/css-values.ts";
import type { VariableIndex } from "../src/components/css-values.ts";
import type { BoxSpec, FrameLayerSpec, VariantSpec } from "../src/components/kit-spec.ts";
import { compileUtilities } from "../src/components/utility-css.ts";

/**
 * The `chip` fixture: one cell, `state=rest`, whose root carries `classes`. It has no states,
 * facts, omissions, label, icons or parts other than the ones `fields` gives it.
 *
 * @param classes - The root's classes.
 * @param fields - Fields of the definition to set, such as `axes` or `parts`.
 * @returns The definition.
 */
export function chip(
  classes: string,
  fields: Partial<Omit<ComponentDefinition, "classesFor">> = {}
): ComponentDefinition {
  return {
    key: "chip",
    name: "Chip",
    slot: "chip",
    axes: [{ name: "state", values: ["rest"] }],
    columnAxis: "state",
    classesFor: () => classes,
    states: {},
    facts: new Map(),
    omittedStates: new Set(),
    label: undefined,
    iconsFor: () => [],
    swapProperties: [],
    ...fields,
  };
}

/** The fixtures' icon: `Plus`, a direct child of the box that lists it, with no `data-icon`. */
export const ICON: IconSlot = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "Plus",
  swapProperty: undefined,
};

/**
 * A part below the chip's root, the `chip-dot`, shown in every cell. Its type keeps the `data-slot`,
 * so a test can spread it into another part with a slot of its own.
 *
 * @param classes - The part's classes.
 * @param icons - The icons the part holds.
 * @returns The part.
 */
export function dot(
  classes: string,
  icons: readonly IconSlot[] = []
): Extract<PartDefinition, { readonly slot: string }> {
  return {
    key: "dot",
    slot: "chip-dot",
    shownIn: () => true,
    classesFor: () => classes,
    label: undefined,
    iconsFor: () => icons,
  };
}

/** What a fixture build reads beside the fixture's own classes. Each field is empty by default. */
export type FixtureContext = {
  /**
   * Classes compiled beside the fixture's own, such as `ring-2`, which makes Tailwind register
   * the custom properties it sets.
   */
  readonly registered?: readonly string[];
  /** The synced variables a value can bind. */
  readonly variables?: VariableIndex;
  /** The base-layer declarations below every class. */
  readonly base?: readonly OuterDeclaration[];
  /** The host page's inherited declarations, below the base layer's. */
  readonly page?: readonly OuterDeclaration[];
};

/** A fixture's built set, with the variant of its first cell. */
export type BuiltFixture = BuiltComponent & {
  readonly variant: VariantSpec | undefined;
};

/**
 * Build a fixture's component set, compiling every class the definition uses and the
 * context's `registered` classes.
 *
 * @param definition - The fixture.
 * @param context - The extra classes, variables, and page and base-layer declarations.
 * @returns The set, its coverage and font styles, and its first cell's variant.
 */
export async function buildFixture(
  definition: ComponentDefinition,
  context: FixtureContext = {}
): Promise<BuiltFixture> {
  const built = buildComponentSet(definition, {
    compiled: await compileUtilities([...definitionClasses(definition), ...(context.registered ?? [])]),
    variables: context.variables ?? makeVariableIndex([]),
    page: context.page ?? [],
    base: context.base ?? [],
  });
  return { ...built, variant: built.componentSet.variants[0] };
}

/**
 * Build fixtures' component sets in their order, each with the sets before it, as the kit build
 * builds the sets its instance parts show first, compiling every class the definitions use and the
 * context's `registered` classes.
 *
 * @param definitions - The fixtures, each after the fixtures it holds instances of.
 * @param context - The extra classes, variables, and page and base-layer declarations.
 * @returns Each fixture's set, its coverage and font styles, in the definitions' order.
 */
export async function buildFixtures(
  definitions: readonly ComponentDefinition[],
  context: FixtureContext = {}
): Promise<readonly BuiltComponent[]> {
  const compiled = await compileUtilities([
    ...definitions.flatMap((definition) => definitionClasses(definition)),
    ...(context.registered ?? []),
  ]);
  const built = buildSetsInOrder(
    definitions.map((definition) => ({ definition })),
    {
      compiled,
      variables: context.variables ?? makeVariableIndex([]),
      page: context.page ?? [],
      base: context.base ?? [],
    }
  );
  return built.map(([, set]) => set);
}

/**
 * The frame a box holds first, as a part's frame sits in its parent's box.
 *
 * @param box - A built root or frame.
 * @returns The box's first layer when it is a frame.
 */
export function frameOf(box: BoxSpec | undefined): FrameLayerSpec | undefined {
  const [first] = box?.children ?? [];
  return first?.kind === "frame" ? first : undefined;
}
