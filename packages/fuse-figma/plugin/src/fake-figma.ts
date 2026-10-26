/**
 * An in-memory Figma file behind the parts of the Plugin API that the components plugin calls,
 * for tests that run `reconcileKit` end to end and for the planners' unit tests. The file starts as a synced file: it holds the
 * variable collections `figma:sync` writes, with their modes, values and aliases, and one empty
 * page. Variables, collections, modes and nodes get ids in the order the file makes them, so a
 * test sees the same ids on every run.
 *
 * Every node, variable, collection and API object sits behind a guard that throws for a member
 * the fake does not model, so a plugin change that reads or writes something new fails here
 * instead of passing on an `undefined`. Every write lands in a log, so a test can tell that a
 * run stopped before its first write.
 *
 * The fake models the Figma rules its modules list, numbered 1 to 58. Each rule a real file showed
 * in 2026-10 names that run.
 * Rules 12 to 47 name the probe behind each, from net-zero probes on the test file `Elmera Fuse -
 * Import test` from 2026-10-22 to 2026-10-25: P0 and P0b read the kit's nodes, P1 to P9, PB, PR,
 * PQ, PD, PL, PF, PH, PZ, PI, PZ2, N1 to N5, N9, N11, NS, NA, NH, PI2, PI3, PH3 and PS built nodes on a scratch page, and
 * P9b stored images and built no node. Rule 48 names PK, a reading of the owner's file on 2026-10-25,
 * and PK2, built on a scratch frame the same day. Rule 49 names PS2, a reading of the owner's file
 * and frames built on a scratch page on 2026-10-25. Rules 57 and 58 name PS3, and rule 57 also PS4,
 * probes on scratch frames in the owner's file `Untitled` on 2026-10-26.
 *
 * Each rule's probe notes sit beside the code that models it. `fake/paints.ts` models rules 1, 2,
 * 3, 22, 23, 27, 33, 46, 49. `fake/overrides.ts` models rules 36, 37, 38, 48. `fake/instances.ts`
 * models rules 4, 25, 34, 35, 39, 41, 43, 44, 45. `fake/svg.ts` models rule 6. `fake/text.ts`
 * models rules 7, 10, 19, 20, 21, 28, 30, 50, 51, 52, 53, 54, 55. `fake/variables.ts` models rules
 * 8, 11. `fake/layout.ts` models rules 5, 9, 12, 13, 14, 15, 16, 17, 18, 24, 26, 29, 31, 32, 40,
 * 42, 47, 56, 57, 58. `fake/guard.ts` holds the guard, `fake/state.ts` the file's records, `fake/tree.ts`
 * the node tree and `fake/nodes.ts` the node classes. Each module imports only the ones listed
 * before it here: guard, state, overrides, tree, variables, paints, text, layout, instances, svg
 * and nodes.
 *
 * It also models what the plugin typings document for a plugin with
 * `"documentAccess": "dynamic-page"`, as the components plugin declares: a page other than the
 * current one needs `loadAsync` before its children are read or changed, and an instance's
 * `mainComponent` cannot be read. `insertChild` refuses an index past the end. `layoutWrap` needs
 * an auto layout frame. A layer links only a property of the component or set it sits in, of the
 * type the link needs. A component set holds only components. A removed node throws on every
 * read but its id. A page's `remove` refuses the current page and the file's last page, as the
 * Figma editor does. The typings say nothing about either, so the plugin shows another page
 * before it removes one. On a real file on 2026-10-22, `remove` on the current page threw
 * `Removing this node is not allowed`, and removed the page once another page showed.
 *
 * The fake does not lay out: an auto layout frame keeps the size it was given, so a hugging
 * frame does not grow with its content, apart from the frames rule 32 sizes from their children
 * as they stand. Nor does it set text: a text keeps the size it was given,
 * so a wrapped, filling or truncated text's height is not modelled. It draws nothing either: a
 * layer's render bounds are its box, and a PNG export holds bytes that name the layer and the
 * scale.
 */

import type { CollectionSpec } from "../../src/variable-set.ts";
import { guard } from "./fake/guard.ts";
import { combineAsVariants } from "./fake/instances.ts";
import { settled } from "./fake/layout.ts";
import { makeNode } from "./fake/nodes.ts";
import {
  base64Decode,
  base64Encode,
  bindEffect,
  bindPaint,
  createImage,
  exposeImage,
} from "./fake/paints.ts";
import { componentOf, live, MIXED, pageOf, write } from "./fake/state.ts";
import type { FileState, NodeState } from "./fake/state.ts";
import { drawSvg, flatten } from "./fake/svg.ts";
import { fontKey, fontUnavailable } from "./fake/text.ts";
import { createNode, placeOnCurrentPage } from "./fake/tree.ts";
import { exposeCollection, exposeVariable, seedVariables } from "./fake/variables.ts";

export { drawsShadowSpread, paintsAbove } from "./fake/paints.ts";

/** What a test sets up the fake file with. */
export type FakeFigmaOptions = {
  /** The collections the token sync writes, such as `fuseVariableSet()` builds them. */
  readonly collections: readonly CollectionSpec[];
  /** Fonts this machine cannot load. A font without a style marks every style of its family. */
  readonly unavailableFonts?: readonly FontNameInput[];
};

/** A fake file and what a test reads from it beside the Plugin API. */
export type FakeFigma = {
  /** The Plugin API over the file. */
  readonly figma: PluginAPI;
  /** Every write the file took, in order, such as `12:3 fills`. */
  readonly writes: readonly string[];
  /**
   * Start a new plugin run: every page but the current one needs `loadAsync` again, and so does
   * every font, and `skipInvisibleInstanceChildren` is false again. A run on another machine can
   * lack fonts the file holds.
   */
  readonly reopen: (options?: { readonly unavailableFonts?: readonly FontNameInput[] }) => void;
  /**
   * A synced variable by its collection and name.
   *
   * @throws When the file holds no such variable.
   */
  readonly variable: (collection: string, name: string) => Variable;
};

/**
 * Make a fake file that a sync has filled with the given collections. It holds one empty page,
 * `Page 1`, which is the current page.
 *
 * @param options - The synced collections and the fonts the machine lacks.
 * @returns The Plugin API over the file and what a test reads beside it.
 */
export function createFakeFigma(options: FakeFigmaOptions): FakeFigma {
  const seeded = seedVariables(options.collections);
  const file: FileState = {
    nextNode: 0,
    nextProperty: 0,
    writes: [],
    nodes: new Map(),
    document: undefined,
    current: undefined,
    loadedFonts: new Set(),
    unavailableFonts: options.unavailableFonts ?? [],
    collections: seeded.collections,
    variables: seeded.variables,
    images: new Set(),
    skipInvisibleInstanceChildren: false,
    makeNode,
  };
  const document = createNode(file, "DOCUMENT", "Document", "0:0");
  const firstPage = createNode(file, "PAGE", "Page 1", "0:1");
  document.children = [firstPage];
  firstPage.parent = document;
  file.document = document;
  file.current = firstPage;

  const stateOfParent = (parent: (BaseNode & ChildrenMixin) | undefined): NodeState => {
    if (parent !== undefined) {
      return live(parent);
    }
    if (file.current === undefined) {
      throw new Error("The fake Figma file has no current page.");
    }
    return file.current;
  };

  const variables: Pick<
    VariablesAPI,
    | "getLocalVariableCollectionsAsync"
    | "getLocalVariablesAsync"
    | "getVariableByIdAsync"
    | "getVariableCollectionByIdAsync"
    | "setBoundVariableForPaint"
    | "setBoundVariableForEffect"
  > = {
    getLocalVariableCollectionsAsync: () => Promise.resolve(file.collections.map(exposeCollection)),
    getLocalVariablesAsync: (type) =>
      Promise.resolve(
        [...file.variables.values()]
          .filter((variable) => type === undefined || variable.resolvedType === type)
          .map((variable) => exposeVariable(file, variable))
      ),
    getVariableByIdAsync: (id) => {
      const variable = file.variables.get(id);
      return Promise.resolve(variable === undefined ? null : exposeVariable(file, variable));
    },
    getVariableCollectionByIdAsync: (id) => {
      const collection = file.collections.find((candidate) => candidate.id === id);
      return Promise.resolve(collection === undefined ? null : exposeCollection(collection));
    },
    setBoundVariableForPaint: (paint, _field, variable) => bindPaint(file, paint, variable),
    setBoundVariableForEffect: (effect, field, variable) => bindEffect(file, effect, field, variable),
  };

  const api: Pick<
    PluginAPI,
    | "root"
    | "currentPage"
    | "mixed"
    | "loadFontAsync"
    | "setCurrentPageAsync"
    | "createPage"
    | "createFrame"
    | "createComponent"
    | "createText"
    | "createNodeFromSvg"
    | "combineAsVariants"
    | "flatten"
    | "base64Encode"
    | "base64Decode"
    | "createImage"
    | "getImageByHash"
    | "variables"
    | "skipInvisibleInstanceChildren"
  > = {
    get skipInvisibleInstanceChildren(): boolean {
      return file.skipInvisibleInstanceChildren;
    },
    set skipInvisibleInstanceChildren(value: boolean) {
      file.skipInvisibleInstanceChildren = value;
    },
    get root(): DocumentNode {
      const node = document.exposed;
      if (node.type !== "DOCUMENT") {
        throw new Error("The fake Figma file's root is no document.");
      }
      return node;
    },
    get currentPage(): PageNode {
      if (file.current === undefined) {
        throw new Error("The fake Figma file has no current page.");
      }
      return pageOf(file.current);
    },
    mixed: MIXED,
    loadFontAsync: (font) => {
      if (fontUnavailable(file, font)) {
        return Promise.reject(new Error(`The font "${font.family} ${font.style ?? ""}" is not available.`));
      }
      file.loadedFonts.add(fontKey(font));
      return Promise.resolve();
    },
    setCurrentPageAsync: (page) => {
      const state = live(page);
      if (state.type !== "PAGE") {
        throw new Error(`${state.id} is a ${state.type}, not a page.`);
      }
      write(state, "show the page");
      state.loaded = true;
      file.current = state;
      return Promise.resolve();
    },
    createPage: () => {
      const page = createNode(file, "PAGE", `Page ${document.children.length + 1}`);
      document.children.push(page);
      page.parent = document;
      write(page, "create a page");
      return pageOf(page);
    },
    createFrame: () => {
      const frame = createNode(file, "FRAME", "Frame");
      placeOnCurrentPage(file, frame);
      write(frame, "create a frame");
      const node = frame.exposed;
      if (node.type !== "FRAME") {
        throw new Error(`${frame.id} is a ${node.type}, not a frame.`);
      }
      return node;
    },
    createComponent: () => {
      const component = createNode(file, "COMPONENT", "Component");
      placeOnCurrentPage(file, component);
      write(component, "create a component");
      return componentOf(component);
    },
    createText: () => {
      const text = createNode(file, "TEXT", "");
      placeOnCurrentPage(file, text);
      write(text, "create a text layer");
      const node = text.exposed;
      if (node.type !== "TEXT") {
        throw new Error(`${text.id} is a ${node.type}, not a text layer.`);
      }
      return node;
    },
    createNodeFromSvg: (svg) => {
      const node = drawSvg(file, svg).exposed;
      if (node.type !== "FRAME") {
        throw new Error(`${node.id} is a ${node.type}, not a frame.`);
      }
      return node;
    },
    combineAsVariants: (nodes, parent, index) => {
      const set = combineAsVariants(file, nodes.map(live), live(parent), index).exposed;
      if (set.type !== "COMPONENT_SET") {
        throw new Error(`${set.id} is a ${set.type}, not a component set.`);
      }
      return set;
    },
    flatten: (nodes, parent, index) => {
      const vector = flatten(file, nodes.map(live), stateOfParent(parent), index).exposed;
      if (vector.type !== "VECTOR") {
        throw new Error(`${vector.id} is a ${vector.type}, not a vector.`);
      }
      return vector;
    },
    base64Encode,
    base64Decode,
    createImage: (bytes) => createImage(file, bytes),
    getImageByHash: (hash) => (file.images.has(hash) ? exposeImage(hash) : null),
    // SAFETY: the object models the variable calls the plugin makes, and the guard throws for
    // every other member.
    variables: guard(variables, "figma.variables") as VariablesAPI,
  };

  return {
    // SAFETY: the object models the Plugin API calls the plugin makes, and the guard throws for
    // every other member.
    figma: guard(api, "figma") as PluginAPI,
    writes: file.writes,
    reopen: (reopened) => {
      for (const page of document.children) {
        page.loaded = page === file.current;
      }
      file.loadedFonts.clear();
      file.unavailableFonts = reopened?.unavailableFonts ?? file.unavailableFonts;
      file.skipInvisibleInstanceChildren = false;
      // A new run reads every instance at its main component's size (rule 32), a nested one before
      // the instances that show it, so the settling repeats until no size moves.
      const standing = [...file.nodes.values()].filter((node) => !node.removed);
      for (let pass = 0; pass <= standing.length; pass += 1) {
        const moved = standing.filter((node) => {
          const { width, height } = node;
          settled(node);
          return node.width !== width || node.height !== height;
        });
        if (moved.length === 0) {
          break;
        }
      }
    },
    variable: (collection, name) => {
      const found = [...file.variables.values()].find(
        (variable) => variable.collection.name === collection && variable.name === name
      );
      if (found === undefined) {
        throw new Error(`The fake Figma file holds no variable ${collection}/${name}.`);
      }
      return exposeVariable(file, found);
    },
  };
}
