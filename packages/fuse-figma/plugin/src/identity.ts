/**
 * How the plugin finds the nodes it owns. Each node it creates carries a key in shared
 * plugin data, so a designer can rename a layer and the next run still finds it. A node
 * without a key is matched by name once, then gets the key. A node with a key the spec does
 * not list belongs to the kit and may be deleted. A node without a key is never deleted.
 */

import { PLUGIN_DATA_KEY, PLUGIN_DATA_NAMESPACE } from "../../src/components/kit-spec.ts";
import { change } from "./plan.ts";
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
 * Find the child that the spec calls `key`, by its key and then by its name.
 *
 * A name match only counts for a child that carries no key, and the plan writes the key onto
 * it, so the match survives a later rename. Two children with the same key stop the run,
 * because the plugin cannot tell which one a designer meant to keep.
 *
 * @param plan - The run's plan, which records the key it writes onto a name match.
 * @param siblings - The children to search.
 * @param where - The parent's label, for messages.
 * @param key - The key from the spec.
 * @param name - The name to fall back on.
 * @param accept - Narrows a match to the node type the spec needs.
 * @returns The child, or undefined when the parent has none.
 */
export function findOwned<Node extends BaseNode>(
  plan: Plan,
  siblings: ReadonlyArray<BaseNode>,
  where: string,
  key: string,
  name: string,
  accept: (node: BaseNode) => node is Node
): Node | undefined {
  const keyed = siblings.filter((node) => keyOf(node) === key);
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
  const named = siblings.find(
    (node): node is Node => keyOf(node) === "" && node.name === name && accept(node)
  );
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
export function unowned(
  siblings: ReadonlyArray<SceneNode>,
  owned: ReadonlyArray<Target<BaseNode>>
): SceneNode[] {
  return siblings.filter((node) => keyOf(node) === "" && !owned.some((target) => target.existing === node));
}
