/**
 * How the plugin finds the nodes it owns. Each node it creates carries a key in shared
 * plugin data, so a designer can rename a layer and the next run still finds it. A node
 * without a key is matched by name once, then gets the key. A node with a key the spec does
 * not list belongs to the kit and may be deleted. A node without a key is never deleted.
 */

import { Effect } from "effect";

import { PLUGIN_DATA_KEY, PLUGIN_DATA_NAMESPACE } from "../../src/components/kit-spec.ts";
import { LayerConflict } from "./errors.ts";
import type { PluginError } from "./errors.ts";
import { change, create, existing, keepsOrder, Plan, warn } from "./plan.ts";
import type { Target } from "./plan.ts";
import type { PlanServices } from "./services.ts";

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
 * @param siblings - The children to search, indexed.
 * @param where - The parent's label, for messages.
 * @param key - The key from the spec.
 * @param name - The name to fall back on.
 * @param accept - Narrows a match to the node type the spec needs.
 * @returns The child, or undefined when the parent has none. The Effect records the key it writes
 *   onto a name match, and fails with `LayerConflict` for copies of the key or a keyed node of
 *   another type.
 */
export const findOwned = Effect.fnUntraced(function* <Node extends BaseNode>(
  siblings: Siblings,
  where: string,
  key: string,
  name: string,
  accept: (node: BaseNode) => node is Node
): Effect.fn.Return<Node | undefined, LayerConflict, Plan> {
  const keyed = siblings.byKey.get(key) ?? [];
  if (keyed.length > 1) {
    return yield* new LayerConflict({
      message: `${where} holds ${keyed.length} layers with the key ${key}. Delete the copies, then run the plugin again.`,
      key,
    });
  }
  const [match] = keyed;
  if (match !== undefined) {
    if (!accept(match)) {
      return yield* new LayerConflict({
        message: `${where}: the layer with the key ${key} is a ${match.type}. Delete it, then run the plugin again.`,
        key,
      });
    }
    return match;
  }
  const named = siblings.unkeyedByName.get(name)?.find((node): node is Node => accept(node));
  if (named !== undefined) {
    change(yield* Plan, where, `adopt the layer named ${name} as ${key}`, () => setKey(named, key));
  }
  return named;
});

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
 * How to find, create and plan one owned child of a kind, such as a text layer or a variant.
 */
export type OwnedChild<Node extends SceneNode, Fact> = {
  /** The name a child without a key matches by. A new child takes it unless `keepsName` is set. */
  readonly name: string;
  /** Whether a new child keeps the name Figma gives it, as a preview's instance does. */
  readonly keepsName?: boolean;
  /** Narrows a match to the node type the spec needs. */
  readonly accept: (node: BaseNode) => node is Node;
  /** The change line for creating the child, such as `create the text layer Label`. */
  readonly description: string;
  /** Creates the child when its operation runs. The walk puts it into the parent and keys it. */
  readonly make: () => Node;
  /**
   * Runs at planning time for a child the run creates, before the walk records its creation, such
   * as to require the fonts its text needs.
   */
  readonly requireNew?: () => void;
  /**
   * Plans a child: a found child now, into the walk's recorder, and a new one when its creation
   * runs, into the recorder of its contents. It reads the run through `currentRun`. It is a method
   * so that a walk over several kinds, such as a frame's layers, can return each kind as one
   * `OwnedChild<SceneNode>`. The walk passes it only a node that `accept` narrowed or `make` made.
   *
   * @returns What planning a found child learned, such as whether it changes an icon's glyph.
   */
  plan(node: Node, origin: "found" | "new"): Effect.Effect<Fact, PluginError, PlanServices>;
};

/** One owned child as the plan leaves it. */
export type PlannedChild<Spec, Node extends SceneNode, Fact> = {
  readonly spec: Spec;
  readonly node: Target<Node>;
  /** What `plan` returned for a found child, or undefined for one the run creates. */
  readonly fact: Fact | undefined;
};

/**
 * Plan a parent's owned children against the spec: delete the kit's children the spec dropped,
 * find each spec's child by its key or its name and plan it, or create and plan it when the parent
 * lacks it, warn about the children the kit does not own, and restore the spec's order.
 *
 * @param parent - The parent.
 * @param label - The parent's label, for change lines.
 * @param noun - What a child is, such as `variant`, for change lines.
 * @param specs - The children's specs, in order.
 * @param kindOf - Describes how to find, create and plan one spec's child. It runs at planning time,
 *   before the walk looks the child up, so it can check the spec or require what every child of
 *   the kind needs.
 * @returns Each spec's child, in spec order.
 */
export const planOwnedChildren = Effect.fnUntraced(function* <
  Spec extends { readonly key: string },
  Node extends SceneNode,
  Fact,
>(
  parent: ChildrenMixin,
  label: string,
  noun: string,
  specs: readonly Spec[],
  kindOf: (spec: Spec) => OwnedChild<Node, Fact>
): Effect.fn.Return<readonly PlannedChild<Spec, Node, Fact>[], PluginError, PlanServices> {
  const plan = yield* Plan;
  const keep = new Set(specs.map((spec) => spec.key));
  for (const stale of staleOwned(parent.children, keep)) {
    change(plan, label, `delete the ${noun} ${stale.name}`, () => stale.remove());
  }
  const siblings = indexSiblings(parent.children);
  const planned: PlannedChild<Spec, Node, Fact>[] = [];
  for (const spec of specs) {
    const child = kindOf(spec);
    const found = yield* findOwned(siblings, label, spec.key, child.name, child.accept);
    if (found !== undefined) {
      planned.push({ spec, node: existing(found), fact: yield* child.plan(found, "found") });
      continue;
    }
    child.requireNew?.();
    const node = yield* create(
      label,
      child.description,
      () => placeOwned(parent, child.make(), spec.key, child.keepsName === true ? undefined : child.name),
      (made) => child.plan(made, "new")
    );
    planned.push({ spec, node, fact: undefined });
  }
  const owned = planned.map((child) => child.node);
  for (const child of unowned(parent.children, owned)) {
    warn(plan, label, `keeps the layer ${child.name}, which the kit does not own`);
  }
  if (!keepsOrder(parent.children, owned)) {
    change(plan, label, `reorder the ${noun}s`, () => {
      owned.forEach((target, index) => parent.insertChild(index, target.get()));
    });
  }
  return planned;
});
