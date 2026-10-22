/**
 * One component set: its variants, its text and swap properties and the grid the variants sit
 * in.
 * The plugin edits an existing set in place, so the set and every variant keep their node
 * ids and component keys, and instances in other files keep following them.
 */

import { walkLayers } from "../../src/components/kit-spec.ts";
import type { AxisSpec, ComponentSetSpec, VariantSpec } from "../../src/components/kit-spec.ts";
import { planChildren, requireNewSetFonts, requireNewTextFonts } from "./child-layers.ts";
import type { LayerLinks } from "./child-layers.ts";
import { near, planScalar } from "./fields.ts";
import type { Run } from "./fields.ts";
import type { PlannedIcon } from "./icons.ts";
import { findOwned, indexSiblings, placeOwned, planOwnedChildren, setKey } from "./identity.ts";
import type { Siblings } from "./identity.ts";
import type { PlannedPage } from "./pages.ts";
import { change, create, existing } from "./plan.ts";
import type { Target } from "./plan.ts";
import { planBox } from "./root-layer.ts";

/** The gap between variants in the set's grid, and between the grid and the set's edge. */
const GRID_GAP = 16;
const GRID_PADDING = 24;

/** A component set as the plan leaves it, with its variant components by key. */
export type PlannedSet = {
  readonly spec: ComponentSetSpec;
  readonly node: Target<ComponentSetNode>;
  readonly variants: ReadonlyMap<string, Target<ComponentNode>>;
};

const isComponentSet = (node: BaseNode): node is ComponentSetNode => node.type === "COMPONENT_SET";
const isComponent = (node: BaseNode): node is ComponentNode => node.type === "COMPONENT";

/**
 * A variant's Figma name, which is also where Figma reads its variant property values from.
 *
 * @param spec - The component set.
 * @param variant - The variant.
 * @returns `prop=value, prop=value` in the set's axis order.
 */
function variantName(spec: ComponentSetSpec, variant: VariantSpec): string {
  return spec.axes
    .map((axis) => {
      const value = variant.properties[axis.name];
      if (value === undefined) {
        throw new Error(`${spec.name}: the variant ${variant.key} sets no ${axis.name}.`);
      }
      return `${axis.name}=${value}`;
    })
    .join(", ");
}

/** A cell of the variant grid, counted from the top left. */
type GridCell = {
  readonly row: number;
  readonly column: number;
};

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

function columnAxisOf(spec: ComponentSetSpec): AxisSpec {
  const columnAxis = spec.axes.find((axis) => axis.name === spec.columnAxis);
  if (columnAxis === undefined) {
    throw new Error(`${spec.name}: the column axis ${spec.columnAxis} is not one of the set's axes.`);
  }
  return columnAxis;
}

function rowCount(spec: ComponentSetSpec, columnAxis: AxisSpec): number {
  return spec.axes
    .filter((axis) => axis !== columnAxis)
    .reduce((count, axis) => count * axis.values.length, 1);
}

/**
 * A variant's cell in the grid. Its column is its value on the column axis, and its row is its
 * position among the combinations of the other axes, in axis order.
 */
function gridCell(spec: ComponentSetSpec, variant: VariantSpec): GridCell {
  let row = 0;
  let column = 0;
  for (const axis of spec.axes) {
    const index = axis.values.indexOf(variant.properties[axis.name] ?? "");
    if (index < 0) {
      throw new Error(`${spec.name}: the variant ${variant.key} has a ${axis.name} the axis does not list.`);
    }
    if (axis.name === spec.columnAxis) {
      column = index;
    } else {
      row = row * axis.values.length + index;
    }
  }
  return { row, column };
}

/**
 * Check that a component set's spec agrees with itself. Every variant sets a listed value on
 * each axis, the column axis is one of the axes, and every text layer links a property the
 * set defines. The planning pass runs this before it records any write, because an operation
 * that creates a set plans the set's contents when it runs.
 *
 * @param spec - The component set.
 * @throws When the spec contradicts itself.
 */
export function checkComponentSet(spec: ComponentSetSpec): void {
  columnAxisOf(spec);
  const properties = new Set(spec.textProperties.map((property) => property.name));
  for (const variant of spec.variants) {
    variantName(spec, variant);
    gridCell(spec, variant);
    for (const layer of walkLayers(variant.root)) {
      if (layer.kind === "text" && layer.textProperty !== undefined && !properties.has(layer.textProperty)) {
        throw new Error(
          `${spec.name}: the variant ${variant.key} links ${layer.textProperty}, which the set does not define.`
        );
      }
    }
  }
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
 * that change them, so a plan that changes anything in the set lays the grid out again.
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
    return target.get();
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

function planTextProperties(
  run: Run,
  set: ComponentSetNode,
  spec: ComponentSetSpec,
  ids: Map<string, string>
): void {
  for (const property of spec.textProperties) {
    const found = Object.entries(set.componentPropertyDefinitions).find(
      ([id, definition]) => definition.type === "TEXT" && id.split("#")[0] === property.name
    );
    if (found === undefined) {
      change(run.plan, spec.name, `add the text property ${property.name}`, () => {
        ids.set(property.name, set.addComponentProperty(property.name, "TEXT", property.defaultValue));
      });
      continue;
    }
    const [id, definition] = found;
    ids.set(property.name, id);
    if (definition.defaultValue !== property.defaultValue) {
      change(run.plan, spec.name, `${property.name} default → ${property.defaultValue}`, () => {
        ids.set(property.name, set.editComponentProperty(id, { defaultValue: property.defaultValue }));
      });
    }
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
    const found = Object.entries(set.componentPropertyDefinitions).find(
      ([id, definition]) => definition.type === "INSTANCE_SWAP" && id.split("#")[0] === property.name
    );
    if (found === undefined) {
      change(
        run.plan,
        spec.name,
        `add the swap property ${property.name}, starting with ${icon.spec.name}`,
        () => {
          ids.set(
            property.name,
            set.addComponentProperty(property.name, "INSTANCE_SWAP", icon.node.get().id, {
              preferredValues: preferredIcons(icons),
            })
          );
        }
      );
      continue;
    }
    const [id, definition] = found;
    ids.set(property.name, id);
    const starts = icon.node.existing !== undefined && definition.defaultValue === icon.node.existing.id;
    if (!starts || !offersLibrary(definition, icons)) {
      change(
        run.plan,
        spec.name,
        `${property.name} → ${icon.spec.name} and the ${icons.size} library icons`,
        () => {
          ids.set(
            property.name,
            set.editComponentProperty(id, {
              defaultValue: icon.node.get().id,
              preferredValues: preferredIcons(icons),
            })
          );
        }
      );
    }
  }
}

async function planVariantFields(
  run: Run,
  component: ComponentNode,
  name: string,
  label: string,
  variant: VariantSpec,
  links: LayerLinks
): Promise<void> {
  planScalar(run, label, "name", component.name, name, () => {
    component.name = name;
  });
  const size = planBox(run, component, label, variant.root, { kind: "root" });
  await planChildren(run, component, label, variant.root, links, size);
}

async function planVariant(
  run: Run,
  set: ComponentSetNode,
  siblings: Siblings,
  spec: ComponentSetSpec,
  variant: VariantSpec,
  links: LayerLinks
): Promise<Target<ComponentNode>> {
  const name = variantName(spec, variant);
  const label = `${spec.name} / ${name}`;
  const found = findOwned(run.plan, siblings, spec.name, variant.key, name, isComponent);
  if (found !== undefined) {
    await planVariantFields(run, found, name, label, variant, links);
    return existing(found);
  }
  requireNewTextFonts(run, set, label, walkLayers(variant.root));
  return create(
    run.plan,
    spec.name,
    `create the variant ${name}`,
    () => placeOwned(set, run.figma.createComponent(), variant.key, name),
    (made, plan) => planVariantFields({ ...run, plan }, made, name, label, variant, links)
  );
}

async function planSetContents(
  run: Run,
  set: ComponentSetNode,
  spec: ComponentSetSpec,
  icons: ReadonlyMap<string, PlannedIcon>
): Promise<ReadonlyMap<string, Target<ComponentNode>>> {
  const start = run.plan.operations.length;
  planScalar(run, spec.name, "name", set.name, spec.name, () => {
    set.name = spec.name;
  });
  const properties = new Map<string, string>();
  planTextProperties(run, set, spec, properties);
  planSwapProperties(run, set, spec, icons, properties);
  const links: LayerLinks = { properties, icons };

  // The layers panel lists the variants in spec order. Figma keeps each variant property's
  // values in an order of its own: a new value goes last, and moving the variants or renaming a
  // value leaves it where it is, as a real file showed on 2026-10-20. A set the plugin creates
  // lists its values in spec order, but a set that gained values later keeps them last.
  const variants = new Map<string, Target<ComponentNode>>();
  await planOwnedChildren(run.plan, set, spec.name, "variant", spec.variants, async (variant, siblings) => {
    const target = await planVariant(run, set, siblings, spec, variant, links);
    variants.set(variant.key, target);
    return target;
  });
  planGrid(run, set, spec, variants, run.plan.operations.length > start);
  return variants;
}

/**
 * Record the creation of a set. Figma builds a set from components, so the operation creates
 * every variant with its key and name, combines them, and then plans the set's contents. The
 * caller requires the fonts the set's labels need first.
 */
function createSet(
  run: Run,
  page: PlannedPage,
  spec: ComponentSetSpec,
  icons: ReadonlyMap<string, PlannedIcon>
): PlannedSet {
  const node = create(
    run.plan,
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
    async (set, plan) => {
      await planSetContents({ ...run, plan }, set, spec, icons);
    }
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
  return { spec, node, variants };
}

/**
 * Plan one component set against the spec.
 *
 * @param run - The run.
 * @param page - The page the set sits on.
 * @param spec - The component set.
 * @param icons - The kit's icons, by key, which the set's icon layers and swap properties use.
 * @returns The set and its variants, as later operations find them.
 */
export async function planComponentSet(
  run: Run,
  page: PlannedPage,
  spec: ComponentSetSpec,
  icons: ReadonlyMap<string, PlannedIcon>
): Promise<PlannedSet> {
  const found = page.find(spec.key, spec.name, isComponentSet);
  if (found === undefined) {
    await requireNewSetFonts(run, page.modes, spec);
    return createSet(run, page, spec, icons);
  }
  return { spec, node: existing(found), variants: await planSetContents(run, found, spec, icons) };
}
