/**
 * The kit's pages. A kit page is a page that carries a key, and the plugin finds each page the
 * spec lists by that key alone, never by its name, so a page a designer named `Button` stays
 * theirs. A top-level node, such as a component set, may sit on any kit page: the plan moves it
 * onto the page the spec puts it on, and the move keeps the node, its id and its component key,
 * so instances in other files keep following it. A node reads its modes through its page, so
 * `reconcile.ts` performs the moves before it plans the moved nodes. A kit page the spec no
 * longer lists goes once the kit's nodes have left it.
 */

import { topLevelSpecs } from "../../src/components/kit-spec.ts";
import type { KitSpec, PageSpec } from "../../src/components/kit-spec.ts";
import type { Run } from "./fields.ts";
import { findOwned, indexSiblings, keyOf, setKey, staleOwned } from "./identity.ts";
import type { Siblings } from "./identity.ts";
import { change, create, existing, warn } from "./plan.ts";
import type { Target } from "./plan.ts";

/** A page the spec lists, as the plan leaves it, and how its top-level nodes are found. */
export type PlannedPage = {
  readonly spec: PageSpec;
  readonly node: Target<PageNode>;
  /** The modes the page pins. A page the run creates pins none. */
  readonly modes: PageNode["explicitVariableModes"];
  /**
   * Find the top-level node the spec calls `key` on this page: by its key, or by its name among
   * the page's children without a key.
   *
   * @throws When two top-level nodes on the kit pages carry `key`.
   */
  readonly find: <Node extends SceneNode>(
    key: string,
    name: string,
    accept: (node: BaseNode) => node is Node
  ) => Node | undefined;
};

/** The kit's pages: the ones the spec lists, in spec order, and the ones it dropped. */
export type KitPages = {
  readonly listed: readonly PlannedPage[];
  /** Kit pages the spec no longer lists, such as the one page the kit used to sit on. */
  readonly retired: readonly PageNode[];
  /** How many top-level nodes the plan moves to another page. */
  readonly moves: number;
};

const DOCUMENT = "Document";

const isPage = (node: BaseNode): node is PageNode => node.type === "PAGE";
const isLayer = (node: BaseNode): node is SceneNode => node.type !== "PAGE" && node.type !== "DOCUMENT";

/**
 * Plan the kit's pages: load every kit page, create each page the spec lists and the file
 * lacks, delete the top-level nodes on any kit page that the spec no longer lists, and move each
 * top-level node that sits on another kit page to the page the spec puts it on.
 *
 * @param run - The run.
 * @param kit - The kit.
 * @returns The pages, for the planners of their nodes and for {@link planRetiredPages}.
 * @throws When two pages carry the key of one the spec lists, or two top-level nodes on the kit
 *   pages carry one key.
 */
export async function planPages(run: Run, kit: KitSpec): Promise<KitPages> {
  const kitPages = run.figma.root.children.filter((page) => keyOf(page) !== "");
  // Under "documentAccess": "dynamic-page", a page's children need loading before a read.
  await Promise.all(kitPages.map((page) => page.loadAsync()));
  const pageKeys = indexSiblings(kitPages);
  const homeOf = new Map<BaseNode, PageNode>(
    kitPages.flatMap((page) => page.children.map((child) => [child, page] as const))
  );
  const keyed = indexSiblings([...homeOf.keys()]).byKey;

  const listed = kit.pages.map((spec): PlannedPage => {
    const found = findOwned(run.plan, pageKeys, DOCUMENT, spec.key, spec.name, isPage);
    const node =
      found === undefined
        ? create(run.plan, DOCUMENT, `create the page ${spec.name}`, () => {
            const made = run.figma.createPage();
            made.name = spec.name;
            setKey(made, spec.key);
            return made;
          })
        : existing(found);
    const siblings: Siblings = {
      byKey: keyed,
      unkeyedByName: found === undefined ? new Map() : indexSiblings(found.children).unkeyedByName,
    };
    return {
      spec,
      node,
      modes: found?.explicitVariableModes ?? {},
      find: (key, name, accept) => findOwned(run.plan, siblings, spec.name, key, name, accept),
    };
  });

  const topLevel = topLevelSpecs(kit);
  const keep = new Set(topLevel.map((spec) => spec.key));
  for (const page of kitPages) {
    for (const stale of staleOwned(page.children, keep)) {
      change(run.plan, page.name, `delete ${stale.name}`, () => stale.remove());
    }
  }

  // The move keeps the node, so its id and component key survive.
  const keyOnly: Siblings = { byKey: keyed, unkeyedByName: new Map() };
  let moves = 0;
  for (const spec of topLevel) {
    const page = listed.find((candidate) => candidate.spec.key === spec.page);
    const match = findOwned(run.plan, keyOnly, DOCUMENT, spec.key, spec.name, isLayer);
    const home = match === undefined ? undefined : homeOf.get(match);
    if (
      page === undefined ||
      match === undefined ||
      home === undefined ||
      home.id === page.node.existing?.id
    ) {
      continue;
    }
    moves += 1;
    change(run.plan, home.name, `move ${spec.name} to the ${page.spec.name} page`, () => {
      page.node.get().appendChild(match);
    });
  }

  const listedKeys = new Set(kit.pages.map((page) => page.key));
  return { listed, retired: kitPages.filter((page) => !listedKeys.has(keyOf(page))), moves };
}

/**
 * Plan the kit pages the spec no longer lists. The earlier operations move each kit node on
 * them to its page or delete it, so a retired page holds only layers the kit does not own. One
 * that holds none goes, and one that holds some stays with a warning.
 *
 * @param run - The run.
 * @param retired - The retired pages, from {@link planPages}.
 * @param shown - The page to show first when a retired page is the current one.
 */
export function planRetiredPages(run: Run, retired: readonly PageNode[], shown: Target<PageNode>): void {
  for (const page of retired) {
    const foreign = page.children.filter((node) => keyOf(node) === "");
    if (foreign.length > 0) {
      const names = foreign.map((node) => node.name).join(", ");
      warn(
        run.plan,
        page.name,
        `the kit no longer uses this page, and keeps it for ${names}, which the kit does not own`
      );
      continue;
    }
    change(run.plan, DOCUMENT, `delete the page ${page.name}`, async () => {
      if (run.figma.currentPage.id === page.id) {
        await run.figma.setCurrentPageAsync(shown.get());
      }
      page.remove();
    });
  }
}
