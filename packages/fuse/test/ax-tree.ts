import { cdp } from "vitest/browser";

/** One node of Chromium's accessibility tree, as the DevTools protocol reports it. */
export type AxNode = {
  readonly nodeId: string;
  readonly parentId?: string;
  readonly role?: { readonly value?: string };
  readonly name?: { readonly value?: string };
  readonly value?: { readonly value?: string | number | boolean };
  readonly properties?: readonly {
    readonly name: string;
    readonly value: { readonly value?: string | number | boolean };
  }[];
};

type FrameTree = {
  readonly frame: { readonly id: string };
  readonly childFrames?: readonly FrameTree[];
};

type AxCdp = {
  send: ((method: "Accessibility.enable") => Promise<object>) &
    ((method: "Page.getFrameTree") => Promise<{ readonly frameTree: FrameTree }>) &
    ((
      method: "Accessibility.getFullAXTree",
      params: { readonly frameId: string }
    ) => Promise<{ readonly nodes: readonly AxNode[] }>);
};

/** Every frame of the page, the top page first. Vitest renders the test page in a child frame. */
const framesOf = (tree: FrameTree): string[] => [
  tree.frame.id,
  ...(tree.childFrames ?? []).flatMap(framesOf),
];

/**
 * Every node of Chromium's accessibility tree across the page's frames, read through the DevTools
 * protocol. Run it only in Chromium.
 *
 * @returns The nodes of every frame, the top page's first.
 */
export async function axNodes(): Promise<readonly AxNode[]> {
  // SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
  const session = cdp() as AxCdp;
  await session.send("Accessibility.enable");
  const { frameTree } = await session.send("Page.getFrameTree");
  const trees = await Promise.all(
    framesOf(frameTree).map((frameId) => session.send("Accessibility.getFullAXTree", { frameId }))
  );
  return trees.flatMap((tree) => tree.nodes);
}

/**
 * The value of a node's accessibility property, such as `"valuemax"` or `"focused"`.
 *
 * @param node - The node to read.
 * @param name - The property's protocol name.
 * @returns The property's value, or `undefined` when the node does not report it.
 */
export function axProperty(node: AxNode, name: string): string | number | boolean | undefined {
  return node.properties?.find((entry) => entry.name === name)?.value.value;
}

/**
 * The node that holds focus among nodes that {@link axNodes} read. Each document's web area reports
 * focus too, so this skips those.
 *
 * @param nodes - The accessibility tree's nodes.
 * @returns The focused node, or `undefined` when no element in the page holds focus.
 */
export function axFocused(nodes: readonly AxNode[]): AxNode | undefined {
  return nodes.find((node) => axProperty(node, "focused") === true && node.role?.value !== "RootWebArea");
}
