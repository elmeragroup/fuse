/**
 * One component set: its variants, its text, boolean and swap properties and the grid the variants
 * sit in.
 * The plugin edits an existing set in place, so the set and every variant keep their node
 * ids and component keys, and instances in other files keep following them.
 */

import { Effect } from "effect";

import { columnAxisOf, gridCell, variantName } from "../../src/components/kit-check.ts";
import { walkLayers } from "../../src/components/kit-spec.ts";
import type {
  AxisSpec,
  BooleanPropertySpec,
  ComponentSetSpec,
  TextPropertySpec,
  VariantSpec,
} from "../../src/components/kit-spec.ts";
import { planBox } from "./box.ts";
import { planChildren } from "./child-layers.ts";
import type { LayerLinks, PropertyIds } from "./child-layers.ts";
import { planSetProperty } from "./component-properties.ts";
import { near, planScalar } from "./fields.ts";
import type { Run } from "./fields.ts";
import { fontLayers, requireNewSetFonts, requireNewTextFonts } from "./fonts.ts";
import type { PlannedIcon } from "./icons.ts";
import { indexSiblings, placeOwned, planOwnedChildren, setKey } from "./identity.ts";
import type { OwnedChild, Siblings } from "./identity.ts";
import { innerSpecs } from "./instance-layers.ts";
import type { PlannedPage } from "./pages.ts";
import { change, create, existing, Plan, watchLeaf } from "./plan.ts";
import type { Target } from "./plan.ts";
import { currentRun } from "./services.ts";
import { settleInstances } from "./settle.ts";

/** The gap between variants in the set's grid, and between the grid and the set's edge. */
const GRID_GAP = 16;
const GRID_PADDING = 24;

/** A component set as the plan leaves it, with its variant components by key. */
export type PlannedSet = {
  readonly spec: ComponentSetSpec;
  readonly node: Target<ComponentSetNode>;
  readonly variants: ReadonlyMap<string, Target<ComponentNode>>;
  /**
   * The set's TEXT, BOOLEAN and INSTANCE_SWAP property ids by name. An operation that adds a property
   * puts its id here when it runs, so an instance layer of a later set reads an id when its own
   * operation runs, whether or not this run creates the set.
   */
  readonly properties: PropertyIds;
  /**
   * Whether the run writes to the set, which can resize its variants, and so the instances of them in
   * later sets and in the previews.
   */
  readonly changed: boolean;
};

/** The set's variants as the plan leaves them, and whether the plan writes to the set. */
type PlannedContents = {
  readonly variants: ReadonlyMap<string, Target<ComponentNode>>;
  readonly changed: boolean;
};

const isComponentSet = (node: BaseNode): node is ComponentSetNode => node.type === "COMPONENT_SET";
const isComponent = (node: BaseNode): node is ComponentNode => node.type === "COMPONENT";

/** A variant's place in the grid, and the set's size around the grid. */
type GridLayout = {
  readonly cells: readonly PlacedVariant[];
  readonly width: number;
  readonly height: number;
};

/** A variant component and where the grid puts it. */
type PlacedVariant = {
  readonly node: ComponentNode;
  readonly x: number;
  readonly y: number;
};

function rowCount(spec: ComponentSetSpec, columnAxis: AxisSpec): number {
  return spec.axes
    .filter((axis) => axis !== columnAxis)
    .reduce((count, axis) => count * axis.values.length, 1);
}

function gridLayout(spec: ComponentSetSpec, nodeOf: (variant: VariantSpec) => ComponentNode): GridLayout {
  const columnAxis = columnAxisOf(spec);
  const rows = rowCount(spec, columnAxis);
  const placed = spec.variants.map((variant) => ({ node: nodeOf(variant), ...gridCell(spec, variant) }));
  const columnWidths = columnAxis.values.map((_, column) =>
    Math.max(0, ...placed.filter((cell) => cell.column === column).map((cell) => Math.ceil(cell.node.width)))
  );
  const rowHeight = Math.max(0, ...placed.map((cell) => Math.ceil(cell.node.height)));
  const columnX = columnWidths.map(
    (_, column) =>
      GRID_PADDING + columnWidths.slice(0, column).reduce((sum, width) => sum + width + GRID_GAP, 0)
  );
  return {
    cells: placed.map((cell) => ({
      node: cell.node,
      x: columnX[cell.column] ?? GRID_PADDING,
      y: GRID_PADDING + cell.row * (rowHeight + GRID_GAP),
    })),
    width:
      GRID_PADDING * 2 +
      columnWidths.reduce((sum, columnWidth) => sum + columnWidth, 0) +
      GRID_GAP * (columnWidths.length - 1),
    height: GRID_PADDING * 2 + rows * rowHeight + GRID_GAP * (rows - 1),
  };
}

/**
 * Plan the grid. The grid reads the variants' sizes when its operation runs, after the writes
 * that change them, so a plan that changes anything in the set, or in a set whose variants its
 * instance layers show, lays the grid out again. It reads the instances inside each variant first,
 * the deepest first, since a variant sizes from its instances as they stand (`settle.ts`).
 */
function planGrid(
  run: Run,
  set: ComponentSetNode,
  spec: ComponentSetSpec,
  variants: ReadonlyMap<string, Target<ComponentNode>>,
  changed: boolean
): void {
  const nodeOf = (variant: VariantSpec): ComponentNode => {
    const target = variants.get(variant.key);
    if (target === undefined) {
      throw new Error(`${spec.name}: the plan has no variant ${variant.key} to lay out.`);
    }
    const node = target.get();
    settleInstances(node);
    return node;
  };
  const settled =
    !changed && spec.variants.every((variant) => variants.get(variant.key)?.existing !== undefined);
  if (settled) {
    const layout = gridLayout(spec, nodeOf);
    if (
      layout.cells.every((cell) => near(cell.node.x, cell.x) && near(cell.node.y, cell.y)) &&
      near(set.width, layout.width) &&
      near(set.height, layout.height)
    ) {
      return;
    }
  }
  const columnAxis = columnAxisOf(spec);
  change(
    run.plan,
    spec.name,
    `lay out ${spec.variants.length} variants in ${columnAxis.values.length} columns and ${rowCount(spec, columnAxis)} rows`,
    () => {
      const layout = gridLayout(spec, nodeOf);
      for (const cell of layout.cells) {
        cell.node.x = cell.x;
        cell.node.y = cell.y;
      }
      set.resizeWithoutConstraints(layout.width, layout.height);
    }
  );
}

/** A set's TEXT or BOOLEAN properties, each a name and the value it starts with. */
type ValueProperties =
  | { readonly type: "TEXT"; readonly properties: readonly TextPropertySpec[] }
  | { readonly type: "BOOLEAN"; readonly properties: readonly BooleanPropertySpec[] };

/** How a change line names each kind of property. */
const KIND_NAMES = { TEXT: "text", BOOLEAN: "boolean" } as const;

/**
 * Plan the TEXT or BOOLEAN properties: add each one the set lacks, and give each one it holds the
 * spec's default. An operation that adds a property puts its id in `ids` when it runs.
 */
function planValueProperties(
  run: Run,
  set: ComponentSetNode,
  spec: ComponentSetSpec,
  { type, properties }: ValueProperties,
  ids: Map<string, string>
): void {
  for (const property of properties) {
    planSetProperty(
      run.plan,
      set,
      spec.name,
      {
        name: property.name,
        type,
        addLine: `add the ${KIND_NAMES[type]} property ${property.name}`,
        add: () => set.addComponentProperty(property.name, type, property.defaultValue),
        holds: (definition) => definition.defaultValue === property.defaultValue,
        editLine: `${property.name} default → ${String(property.defaultValue)}`,
        edit: (id) => set.editComponentProperty(id, { defaultValue: property.defaultValue }),
      },
      ids
    );
  }
}

/** The preferred values of a swap property: every icon in the kit's library, in order. */
function preferredIcons(icons: ReadonlyMap<string, PlannedIcon>): InstanceSwapPreferredValue[] {
  return [...icons.values()].map((icon) => ({ type: "COMPONENT", key: icon.node.get().key }));
}

/**
 * Whether a swap property already offers exactly the library's icons. A library icon the run
 * creates has no key yet, so the property must change.
 */
function offersLibrary(
  definition: ComponentPropertyDefinitions[string],
  icons: ReadonlyMap<string, PlannedIcon>
): boolean {
  const keys = new Set((definition.preferredValues ?? []).map((value) => value.key));
  return (
    keys.size === icons.size &&
    [...icons.values()].every((icon) => icon.node.existing !== undefined && keys.has(icon.node.existing.key))
  );
}

/**
 * Plan the INSTANCE_SWAP properties. Each starts with its default icon and offers every icon in
 * the library, so the swap menu lists the Fuse icons first.
 */
function planSwapProperties(
  run: Run,
  set: ComponentSetNode,
  spec: ComponentSetSpec,
  icons: ReadonlyMap<string, PlannedIcon>,
  ids: Map<string, string>
): void {
  for (const property of spec.swapProperties) {
    const icon = icons.get(property.defaultIcon);
    if (icon === undefined) {
      throw new Error(
        `${spec.name}: the ${property.name} property starts with ${property.defaultIcon}, which the library lacks.`
      );
    }
    planSetProperty(
      run.plan,
      set,
      spec.name,
      {
        name: property.name,
        type: "INSTANCE_SWAP",
        addLine: `add the swap property ${property.name}, starting with ${icon.spec.name}`,
        add: () =>
          set.addComponentProperty(property.name, "INSTANCE_SWAP", icon.node.get().id, {
            preferredValues: preferredIcons(icons),
          }),
        holds: (definition) =>
          icon.node.existing !== undefined &&
          definition.defaultValue === icon.node.existing.id &&
          offersLibrary(definition, icons),
        editLine: `${property.name} → ${icon.spec.name} and the ${icons.size} library icons`,
        edit: (id) =>
          set.editComponentProperty(id, {
            defaultValue: icon.node.get().id,
            preferredValues: preferredIcons(icons),
          }),
      },
      ids
    );
  }
}

const planVariantFields = Effect.fnUntraced(function* (
  component: ComponentNode,
  name: string,
  label: string,
  variant: VariantSpec,
  links: LayerLinks
) {
  const run = yield* currentRun;
  planScalar(run, label, "name", component.name, name, () => {
    component.name = name;
  });
  const size = planBox(run, component, label, variant.root, { kind: "root" });
  yield* planChildren(component, label, variant.root, links, size);
});

/** How to find, create and plan one variant of a set. */
function variantKind(
  run: Run,
  set: ComponentSetNode,
  spec: ComponentSetSpec,
  variant: VariantSpec,
  links: LayerLinks
): OwnedChild<ComponentNode, void> {
  const name = variantName(spec, variant);
  const label = `${spec.name} / ${name}`;
  return {
    name,
    accept: isComponent,
    description: `create the variant ${name}`,
    make: () => run.figma.createComponent(),
    requireNew: () =>
      requireNewTextFonts(run, set, label, fontLayers(walkLayers(variant.root), innerSpecs(links.sets))),
    plan: (component) => planVariantFields(component, name, label, variant, links),
  };
}

/**
 * Whether a set holds an instance of a set the run writes to, whose variants can change size, so the
 * set's own variants, which size from those instances, can too.
 */
function holdsChanged(spec: ComponentSetSpec, sets: ReadonlyMap<string, PlannedSet>): boolean {
  return spec.variants.some((variant) =>
    walkLayers(variant.root).some(
      (layer) => layer.kind === "instance" && sets.get(layer.componentSet)?.changed === true
    )
  );
}

/**
 * Plan a set's name, properties, variants and grid.
 *
 * @param properties - The set's property ids by name, which this fills in, at once for a property the
 *   set holds and when its operation runs for one the run adds.
 */
const planSetContents = Effect.fnUntraced(function* (
  set: ComponentSetNode,
  spec: ComponentSetSpec,
  { icons, sets }: Omit<LayerLinks, "properties">,
  properties: Map<string, string>
) {
  const run = yield* currentRun;
  const planVariants = Effect.gen(function* () {
    planScalar(run, spec.name, "name", set.name, spec.name, () => {
      set.name = spec.name;
    });
    planValueProperties(run, set, spec, { type: "TEXT", properties: spec.textProperties }, properties);
    planValueProperties(
      run,
      set,
      spec,
      { type: "BOOLEAN", properties: spec.booleanProperties ?? [] },
      properties
    );
    planSwapProperties(run, set, spec, icons, properties);
    const links: LayerLinks = { properties, icons, sets };

    // The layers panel lists the variants in spec order. Figma keeps each variant property's
    // values in an order of its own: a new value goes last, and moving the variants or renaming a
    // value leaves it where it is, as a real file showed on 2026-10-20. A set the plugin creates
    // lists its values in spec order, but a set that gained values later keeps them last.
    const planned = yield* planOwnedChildren(set, spec.name, "variant", spec.variants, (variant) =>
      variantKind(run, set, spec, variant, links)
    );
    return new Map(planned.map((child) => [child.spec.key, child.node]));
  });
  const [variants, recorded] = yield* Plan.watch(planVariants);
  const [, gridded] = watchLeaf(run.plan, () =>
    planGrid(run, set, spec, variants, recorded || holdsChanged(spec, sets))
  );
  const contents: PlannedContents = { variants, changed: recorded || gridded };
  return contents;
});

/**
 * Record the creation of a set. Figma builds a set from components, so the operation creates
 * every variant with its key and name, combines them, and then plans the set's contents. The
 * caller requires the fonts the set's labels need first.
 */
const createSet = Effect.fnUntraced(function* (
  page: PlannedPage,
  spec: ComponentSetSpec,
  links: Omit<LayerLinks, "properties">
) {
  const run = yield* currentRun;
  const properties = new Map<string, string>();
  const node = yield* create(
    page.spec.name,
    `create the component set ${spec.name} with ${spec.variants.length} variants`,
    () => {
      const parent = page.node.get();
      const components = spec.variants.map((variant) =>
        placeOwned(parent, run.figma.createComponent(), variant.key, variantName(spec, variant))
      );
      const set = run.figma.combineAsVariants(components, parent);
      setKey(set, spec.key);
      set.name = spec.name;
      return set;
    },
    (set) => Effect.asVoid(planSetContents(set, spec, links, properties))
  );
  // The set's children, indexed by key the first time a later operation reads a variant.
  let made: Siblings | undefined;
  const variants = new Map(
    spec.variants.map((variant): readonly [string, Target<ComponentNode>] => [
      variant.key,
      {
        existing: undefined,
        get: () => {
          made ??= indexSiblings(node.get().children);
          const component = made.byKey.get(variant.key)?.find(isComponent);
          if (component === undefined) {
            throw new Error(`${spec.name} has no variant ${variant.key} after its creation.`);
          }
          return component;
        },
      },
    ])
  );
  const planned: PlannedSet = { spec, node, variants, properties, changed: true };
  return planned;
});

/**
 * Plan one component set against the spec. The kit lists a set after every set whose variants its
 * instance layers show, so those are planned first.
 *
 * @param page - The page the set sits on.
 * @param spec - The component set.
 * @param icons - The kit's icons, by key, which the set's icon layers and swap properties use.
 * @param sets - The sets the run planned before this one, by key, which its instance layers show.
 * @returns The set, its variants and its property ids, as later operations find them.
 */
export const planComponentSet = Effect.fnUntraced(function* (
  page: PlannedPage,
  spec: ComponentSetSpec,
  icons: ReadonlyMap<string, PlannedIcon>,
  sets: ReadonlyMap<string, PlannedSet>
) {
  const found = yield* page.find(spec.key, spec.name, isComponentSet);
  if (found === undefined) {
    yield* requireNewSetFonts(page.modes, spec, innerSpecs(sets));
    return yield* createSet(page, spec, { icons, sets });
  }
  const properties = new Map<string, string>();
  const contents = yield* planSetContents(found, spec, { icons, sets }, properties);
  const planned: PlannedSet = { spec, node: existing(found), properties, ...contents };
  return planned;
});
