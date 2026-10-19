/**
 * One component set: its variants, its text properties and the grid the variants sit in.
 * The plugin edits an existing set in place, so the set and every variant keep their node
 * ids and component keys, and instances in other files keep following them.
 */

import type { ComponentSetSpec, VariantSpec } from "../../src/components/kit-spec.ts";
import { syncChildren } from "./child-layers.ts";
import type { TextPropertyIds } from "./child-layers.ts";
import { near, syncScalar } from "./fields.ts";
import type { Run } from "./fields.ts";
import { findOwned, keyOf, setKey, staleOwned } from "./identity.ts";
import { change, create, muted, warn } from "./ledger.ts";
import { syncRoot } from "./root-layer.ts";

/** The gap between variants in the set's grid, and between the grid and the set's edge. */
const GRID_GAP = 16;
const GRID_PADDING = 24;

/** A component set after a run, with its variant components by key. */
export type SyncedSet = {
  readonly spec: ComponentSetSpec;
  /** Undefined when a plan finds no set, so every variant is still to be created. */
  readonly node: ComponentSetNode | undefined;
  readonly variants: ReadonlyMap<string, ComponentNode>;
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

function syncTextProperties(run: Run, set: ComponentSetNode, spec: ComponentSetSpec): TextPropertyIds {
  const ids = new Map<string, string>();
  for (const property of spec.textProperties) {
    const existing = Object.entries(set.componentPropertyDefinitions).find(
      ([id, definition]) => definition.type === "TEXT" && id.split("#")[0] === property.name
    );
    if (existing === undefined) {
      const id = create(run.ledger, spec.name, `add the text property ${property.name}`, () =>
        set.addComponentProperty(property.name, "TEXT", property.defaultValue)
      );
      if (id !== undefined) {
        ids.set(property.name, id);
      }
      continue;
    }
    const [id, definition] = existing;
    ids.set(property.name, id);
    if (definition.defaultValue !== property.defaultValue) {
      change(run.ledger, spec.name, `${property.name} default → ${property.defaultValue}`, () => {
        ids.set(property.name, set.editComponentProperty(id, { defaultValue: property.defaultValue }));
      });
    }
  }
  return ids;
}

function createSet(run: Run, page: PageNode, spec: ComponentSetSpec): ComponentSetNode | undefined {
  return create(
    run.ledger,
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
    }
  );
}

async function syncVariant(
  run: Run,
  set: ComponentSetNode,
  spec: ComponentSetSpec,
  variant: VariantSpec,
  propertyIds: TextPropertyIds
): Promise<ComponentNode | undefined> {
  const name = variantName(spec, variant);
  const label = `${spec.name} / ${name}`;
  let component = findOwned(run.ledger, set.children, spec.name, variant.key, name, isComponent);
  let variantRun = run;
  if (component === undefined) {
    component = create(run.ledger, spec.name, `create the variant ${name}`, () => {
      const made = run.figma.createComponent();
      set.appendChild(made);
      setKey(made, variant.key);
      made.name = name;
      return made;
    });
    if (component === undefined) {
      return undefined;
    }
    variantRun = { ...run, ledger: muted(run.ledger) };
  }
  const target = component;
  syncScalar(variantRun, label, "name", target.name, name, () => {
    target.name = name;
  });
  syncRoot(variantRun, target, label, variant.root);
  await syncChildren(variantRun, target, label, variant.root.children, propertyIds);
  return target;
}

/** A cell of the variant grid, counted from the top left. */
type GridCell = {
  readonly row: number;
  readonly column: number;
};

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

function syncGrid(
  run: Run,
  set: ComponentSetNode,
  spec: ComponentSetSpec,
  variants: ReadonlyMap<string, ComponentNode>
): void {
  const columnAxis = spec.axes.find((axis) => axis.name === spec.columnAxis);
  if (columnAxis === undefined) {
    throw new Error(`${spec.name}: the column axis ${spec.columnAxis} is not one of the set's axes.`);
  }
  const rows = spec.axes
    .filter((axis) => axis !== columnAxis)
    .reduce((count, axis) => count * axis.values.length, 1);
  const placed = spec.variants.flatMap((variant) => {
    const node = variants.get(variant.key);
    return node === undefined ? [] : [{ node, ...gridCell(spec, variant) }];
  });
  const columnWidths = columnAxis.values.map((_, column) =>
    Math.max(0, ...placed.filter((cell) => cell.column === column).map((cell) => Math.ceil(cell.node.width)))
  );
  const rowHeight = Math.max(0, ...placed.map((cell) => Math.ceil(cell.node.height)));
  const columnX = columnWidths.map(
    (_, column) =>
      GRID_PADDING + columnWidths.slice(0, column).reduce((sum, width) => sum + width + GRID_GAP, 0)
  );
  const width =
    GRID_PADDING * 2 +
    columnWidths.reduce((sum, columnWidth) => sum + columnWidth, 0) +
    GRID_GAP * (columnWidths.length - 1);
  const height = GRID_PADDING * 2 + rows * rowHeight + GRID_GAP * (rows - 1);

  const target = (cell: (typeof placed)[number]) => ({
    x: columnX[cell.column] ?? GRID_PADDING,
    y: GRID_PADDING + cell.row * (rowHeight + GRID_GAP),
  });
  const moved = placed.filter((cell) => {
    const { x, y } = target(cell);
    return !near(cell.node.x, x) || !near(cell.node.y, y);
  });
  if (moved.length === 0 && near(set.width, width) && near(set.height, height)) {
    return;
  }
  change(
    run.ledger,
    spec.name,
    `lay out ${placed.length} variants in ${columnWidths.length} columns and ${rows} rows`,
    () => {
      for (const cell of placed) {
        const { x, y } = target(cell);
        cell.node.x = x;
        cell.node.y = y;
      }
      set.resizeWithoutConstraints(width, height);
    }
  );
}

/**
 * Bring one component set in line with the spec.
 *
 * @param run - The run.
 * @param page - The kit's page.
 * @param spec - The component set.
 * @returns The set and its variants as they stand after the run.
 */
export async function syncComponentSet(run: Run, page: PageNode, spec: ComponentSetSpec): Promise<SyncedSet> {
  const variants = new Map<string, ComponentNode>();
  let set = findOwned(run.ledger, page.children, page.name, spec.key, spec.name, isComponentSet);
  let inner = run;
  if (set === undefined) {
    set = createSet(run, page, spec);
    if (set === undefined) {
      return { spec, node: undefined, variants };
    }
    inner = { ...run, ledger: muted(run.ledger) };
  }
  const node = set;
  syncScalar(inner, spec.name, "name", node.name, spec.name, () => {
    node.name = spec.name;
  });
  const propertyIds = syncTextProperties(inner, node, spec);

  const keep = new Set(spec.variants.map((variant) => variant.key));
  for (const stale of staleOwned(node.children, keep)) {
    change(inner.ledger, spec.name, `delete the variant ${stale.name}`, () => stale.remove());
  }
  for (const variant of spec.variants) {
    const component = await syncVariant(inner, node, spec, variant, propertyIds);
    if (component !== undefined) {
      variants.set(variant.key, component);
    }
  }
  for (const child of node.children) {
    if (keyOf(child) === "") {
      warn(run.ledger, spec.name, `keeps the variant ${child.name}, which the kit does not own`);
    }
  }
  if (variants.size === spec.variants.length) {
    syncGrid(run, node, spec, variants);
  }
  return { spec, node, variants };
}
