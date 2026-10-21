/**
 * How the plugin finds the nodes it owns. Each node it creates carries a key in shared
 * plugin data, so a designer can rename a layer and the next run still finds it. A node
 * without a key is matched by name once, then gets the key. A node with a key the spec does
 * not list belongs to the kit and may be deleted. A node without a key is never deleted.
 */

import { PLUGIN_DATA_KEY, PLUGIN_DATA_NAMESPACE } from "../../src/components/kit-spec.ts";
import { change, keepsOrder, warn } from "./plan.ts";
import type { Plan, Target } from "./plan.ts";

/**
 * The key a node carries.
 *
 * @param node - Any node.
 * @returns The key, or an empty string for a node the kit does not own.
 */
export function keyOf(node: BaseNode): string {
  return node.getSharedPluginData(PLUGIN_DATA_NAMESPACE, PLUGIN_DATA_KEY);
}

/**
 * Give a node its key.
 *
 * @param node - The node.
 * @param key - The key from the spec.
 */
export function setKey(node: BaseNode, key: string): void {
  node.setSharedPluginData(PLUGIN_DATA_NAMESPACE, PLUGIN_DATA_KEY, key);
}

/**
 * Put a node an operation created into its parent and give it its key and name.
 *
 * @param parent - The parent.
 * @param node - The new node.
 * @param key - The key from the spec.
 * @param name - The node's name, or undefined to keep the one Figma gave it.
 * @returns The node.
 */
export function placeOwned<Node extends SceneNode>(
  parent: ChildrenMixin,
  node: Node,
  key: string,
  name?: string
): Node {
  parent.appendChild(node);
  setKey(node, key);
  if (name !== undefined) {
    node.name = name;
  }
  return node;
}

/**
 * Children indexed once for a walk that looks up many specs among them: the keyed ones by key,
 * and the ones without a key by name, each list in layer order.
 */
export type Siblings = {
  readonly byKey: ReadonlyMap<string, readonly BaseNode[]>;
  readonly unkeyedByName: ReadonlyMap<string, readonly BaseNode[]>;
};

/**
 * Index children by key and, for the ones without a key, by name.
 *
 * @param children - The children, in layer order.
 * @returns The index.
 */
export function indexSiblings(children: ReadonlyArray<BaseNode>): Siblings {
  const byKey = new Map<string, BaseNode[]>();
  const unkeyedByName = new Map<string, BaseNode[]>();
  for (const node of children) {
    const key = keyOf(node);
    const [index, entry] = key === "" ? [unkeyedByName, node.name] : [byKey, key];
    const list = index.get(entry);
    if (list === undefined) {
      index.set(entry, [node]);
    } else {
      list.push(node);
    }
  }
  return { byKey, unkeyedByName };
}

/**
 * Find the child that the spec calls `key`, by its key and then by its name.
 *
 * A name match only counts for a child that carries no key, and the plan writes the key onto
 * it, so the match survives a later rename. Two children with the same key stop the run,
 * because the plugin cannot tell which one a designer meant to keep.
 *
 * @param plan - The run's plan, which records the key it writes onto a name match.
 * @param siblings - The children to search, indexed.
 * @param where - The parent's label, for messages.
 * @param key - The key from the spec.
 * @param name - The name to fall back on.
 * @param accept - Narrows a match to the node type the spec needs.
 * @returns The child, or undefined when the parent has none.
 */
export function findOwned<Node extends BaseNode>(
  plan: Plan,
  siblings: Siblings,
  where: string,
  key: string,
  name: string,
  accept: (node: BaseNode) => node is Node
): Node | undefined {
  const keyed = siblings.byKey.get(key) ?? [];
  if (keyed.length > 1) {
    throw new Error(
      `${where} holds ${keyed.length} layers with the key ${key}. Delete the copies, then run the plugin again.`
    );
  }
  const [match] = keyed;
  if (match !== undefined) {
    if (!accept(match)) {
      throw new Error(
        `${where}: the layer with the key ${key} is a ${match.type}. Delete it, then run the plugin again.`
      );
    }
    return match;
  }
  const named = siblings.unkeyedByName.get(name)?.find((node): node is Node => accept(node));
  if (named !== undefined) {
    change(plan, where, `adopt the layer named ${name} as ${key}`, () => setKey(named, key));
  }
  return named;
}

/**
 * The kit's children that the spec no longer lists.
 *
 * @param siblings - The children to search.
 * @param keep - The keys the spec lists.
 * @returns The children whose key is set and not in `keep`.
 */
export function staleOwned(siblings: ReadonlyArray<SceneNode>, keep: ReadonlySet<string>): SceneNode[] {
  return siblings.filter((node) => {
    const key = keyOf(node);
    return key !== "" && !keep.has(key);
  });
}

/**
 * The children the kit does not own. A child without a key that the plan adopts by name
 * counts as owned, because the plan writes the key onto it.
 *
 * @param siblings - The children to search.
 * @param owned - The children the plan matched or creates.
 * @returns The children with no key that no spec matched.
 */
function unowned(siblings: ReadonlyArray<SceneNode>, owned: ReadonlyArray<Target<BaseNode>>): SceneNode[] {
  const matched = new Set(owned.map((target) => target.existing));
  return siblings.filter((node) => keyOf(node) === "" && !matched.has(node));
}

/**
 * Plan a parent's owned children against the spec: delete the kit's children the spec dropped,
 * plan each spec's child, warn about the children the kit does not own, and restore the spec's
 * order.
 *
 * @param plan - The run's plan.
 * @param parent - The parent.
 * @param label - The parent's label, for change lines.
 * @param noun - What a child is, such as `variant`, for change lines.
 * @param specs - The children's specs, in order.
 * @param planOne - Plans one spec's child and returns it. It finds the child among the
 *   parent's children, which the walk indexes once.
 */
export async function planOwnedChildren<Spec extends { readonly key: string }, Node extends SceneNode>(
  plan: Plan,
  parent: ChildrenMixin,
  label: string,
  noun: string,
  specs: readonly Spec[],
  planOne: (spec: Spec, siblings: Siblings) => Target<Node> | Promise<Target<Node>>
): Promise<void> {
  const keep = new Set(specs.map((spec) => spec.key));
  for (const stale of staleOwned(parent.children, keep)) {
    change(plan, label, `delete the ${noun} ${stale.name}`, () => stale.remove());
  }
  const siblings = indexSiblings(parent.children);
  const owned: Target<Node>[] = [];
  for (const spec of specs) {
    owned.push(await planOne(spec, siblings));
  }
  for (const child of unowned(parent.children, owned)) {
    warn(plan, label, `keeps the layer ${child.name}, which the kit does not own`);
  }
  if (!keepsOrder(parent.children, owned)) {
    change(plan, label, `reorder the ${noun}s`, () => {
      owned.forEach((target, index) => parent.insertChild(index, target.get()));
    });
  }
}
