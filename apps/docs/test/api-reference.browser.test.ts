/**
 * Unit under test: a closed API reference row's `summary` on a phone-width page, where the type
 * and default columns drop out of view. Oracle: Chromium's computed accessible name for the
 * `Dialog.Content` row `showCloseButton`, written by hand from its committed `api.json` entry
 * (type `boolean | undefined`, default `true`). A hidden column that leaves the accessibility
 * tree drops its words from the name.
 */
import { describe, expect, it } from "vitest";

import { docsBaseUrl } from "./docs-server";
import { launchSuiteBrowser } from "./suite-browser";

/** Narrower than both column breakpoints, 34rem and 52rem. */
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

describe("API reference rows", () => {
  const browser = launchSuiteBrowser();

  it("keeps the hidden type and default in a closed row's accessible name at phone width", async () => {
    const page = await browser().newPage({ viewport: PHONE_VIEWPORT });
    await page.goto(new URL("/components/dialog", docsBaseUrl()).href);
    const summarySelector = "#api-dialog-content-showCloseButton";
    // The reference skips rendering off-screen rows (`content-visibility: auto`).
    await page.locator(summarySelector).scrollIntoViewIfNeeded();

    // Playwright's own name computation has no role for `summary`, so ask Chromium for its name.
    const cdp = await page.context().newCDPSession(page);
    const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
    const { nodeId } = await cdp.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: summarySelector,
    });
    const { node } = await cdp.send("DOM.describeNode", { nodeId });
    // A partial tree for the summary comes back as an ignored stub, so read the full tree. The row
    // joins the tree once the browser renders it after the scroll, so wait until it is there.
    const summaryNode = async () => {
      const { nodes } = await cdp.send("Accessibility.getFullAXTree");
      return nodes.find((axNode) => axNode.backendDOMNodeId === node.backendNodeId);
    };
    await expect.poll(async () => (await summaryNode()) !== undefined).toBe(true);
    const name: unknown = (await summaryNode())?.name?.value;

    // Chromium puts a space at each block cell's edge, ahead of the comma that opens the next cell.
    expect(name).toMatch(/^showCloseButton\s*, type boolean \| undefined\s*, default true$/u);
    await page.context().close();
  });
});
