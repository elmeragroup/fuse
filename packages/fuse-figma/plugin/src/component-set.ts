/**
 * One component set: its variants, its text properties and the grid the variants sit in.
 * The plugin edits an existing set in place, so the set and every variant keep their node
 * ids and component keys, and instances in other files keep following them.
 */

import type { AxisSpec, ComponentSetSpec, VariantSpec } from "../../src/components/kit-spec.ts";
import { planChildren, requireNewSetFonts, requireNewTextFonts } from "./child-layers.ts";
import type { TextPropertyIds } from "./child-layers.ts";
import { near, planScalar } from "./fields.ts";
import type { Run } from "./fields.ts";
import { findOwned, keyOf, setKey, staleOwned, unowned } from "./identity.ts";
import { change, create, existing, warn } from "./plan.ts";
import type { Target } from "./plan.ts";
import { planRoot } from "./root-layer.ts";

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
export function variantName(spec: ComponentSetSpec, variant: VariantSpec): string {
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
    for (const child of variant.root.children) {
      if (child.kind === "text" && child.textProperty !== undefined && !properties.has(child.textProperty)) {
        throw new Error(
          `${spec.name}: the variant ${variant.key} links ${child.textProperty}, which the set does not define.`
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

function planTextProperties(run: Run, set: ComponentSetNode, spec: ComponentSetSpec): TextPropertyIds {
  const ids = new Map<string, string>();
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
  return ids;
}

function planVariantFields(
  run: Run,
  component: ComponentNode,
  name: string,
  label: string,
  variant: VariantSpec,
  propertyIds: TextPropertyIds
): void {
  planScalar(run, label, "name", component.name, name, () => {
    component.name = name;
  });
  planRoot(run, component, label, variant.root);
  planChildren(run, component, label, variant.root.children, propertyIds);
}

function planVariant(
  run: Run,
  set: ComponentSetNode,
  spec: ComponentSetSpec,
  variant: VariantSpec,
  propertyIds: TextPropertyIds
): Target<ComponentNode> {
  const name = variantName(spec, variant);
  const label = `${spec.name} / ${name}`;
  const found = findOwned(run.plan, set.children, spec.name, variant.key, name, isComponent);
  if (found !== undefined) {
    planVariantFields(run, found, name, label, variant, propertyIds);
    return existing(found);
  }
  requireNewTextFonts(run, set, label, variant.root.children);
  return create(
    run.plan,
    spec.name,
    `create the variant ${name}`,
    () => {
      const made = run.figma.createComponent();
      set.appendChild(made);
      setKey(made, variant.key);
      made.name = name;
      return made;
    },
    (made, plan) => planVariantFields({ ...run, plan }, made, name, label, variant, propertyIds)
  );
}

function planSetContents(
  run: Run,
  set: ComponentSetNode,
  spec: ComponentSetSpec
): ReadonlyMap<string, Target<ComponentNode>> {
  const start = run.plan.operations.length;
  planScalar(run, spec.name, "name", set.name, spec.name, () => {
    set.name = spec.name;
  });
  const propertyIds = planTextProperties(run, set, spec);

  const keep = new Set(spec.variants.map((variant) => variant.key));
  for (const stale of staleOwned(set.children, keep)) {
    change(run.plan, spec.name, `delete the variant ${stale.name}`, () => stale.remove());
  }
  const variants = new Map(
    spec.variants.map((variant) => [variant.key, planVariant(run, set, spec, variant, propertyIds)] as const)
  );
  for (const child of unowned(set.children, [...variants.values()])) {
    warn(run.plan, spec.name, `keeps the variant ${child.name}, which the kit does not own`);
  }
  planGrid(run, set, spec, variants, run.plan.operations.length > start);
  return variants;
}

/**
 * Record the creation of a set. Figma builds a set from components, so the operation creates
 * every variant with its key and name, combines them, and then plans the set's contents. The
 * caller requires the fonts the set's labels need first.
 */
function createSet(run: Run, page: PageNode, spec: ComponentSetSpec): PlannedSet {
  const node = create(
    run.plan,
    page.name,
    `create the component set ${spec.name} with ${spec.variants.length} variants`,
    () => {
      const components = spec.variants.map((variant) => {
        const component = run.figma.createComponent();
        page.appendChild(component);
        setKey(component, variant.key);
        component.name = variantName(spec, variant);
        return component;
      });
      const set = run.figma.combineAsVariants(components, page);
      setKey(set, spec.key);
      set.name = spec.name;
      return set;
    },
    (set, plan) => {
      planSetContents({ ...run, plan }, set, spec);
    }
  );
  const variants = new Map(
    spec.variants.map((variant): readonly [string, Target<ComponentNode>] => [
      variant.key,
      {
        existing: undefined,
        get: () => {
          const component = node
            .get()
            .children.find(
              (child): child is ComponentNode => isComponent(child) && keyOf(child) === variant.key
            );
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
 * @param page - The kit's page.
 * @param spec - The component set.
 * @returns The set and its variants, as later operations find them.
 */
export async function planComponentSet(
  run: Run,
  page: PageNode,
  spec: ComponentSetSpec
): Promise<PlannedSet> {
  const found = findOwned(run.plan, page.children, page.name, spec.key, spec.name, isComponentSet);
  if (found === undefined) {
    await requireNewSetFonts(run, page.explicitVariableModes, spec);
    return createSet(run, page, spec);
  }
  return { spec, node: existing(found), variants: planSetContents(run, found, spec) };
}
