/**
 * The capture's page function run on hand-written markup in Chromium, shared by the suites that
 * check one measured fact against Chromium's own layout of each case.
 */
import type { Page } from "playwright";

import type { MeasuredFacts } from "../src/capture/capture-format.ts";
import { measuredFacts } from "../src/capture/page-facts.ts";

/** The markup a case measures. */
export type Markup = {
  /** Rules for the page's head. */
  readonly head: string;
  /** The markup inside the compared cell. */
  readonly body: string;
  /** The selector of the captured root. */
  readonly root: string;
  /** The id of the element whose `style` attribute the page must give back as it was. */
  readonly watched: string;
};

/**
 * Load the markup on the page and measure its root through `measuredFacts`, over a DevTools session
 * of its own.
 *
 * @param page - The page.
 * @param markup - The markup, its root and the element whose `style` attribute it watches.
 * @returns The facts by path, and whether the watched element's `style` attribute came back as it was.
 */
export async function measureMarkup(
  page: Page,
  markup: Markup
): Promise<{ readonly facts: ReadonlyMap<string, MeasuredFacts>; readonly restored: boolean }> {
  await page.setContent(
    `<!doctype html><style>body { margin: 0 } ${markup.head}</style><main data-compare-cell>${markup.body}</main>`
  );
  const styleOf = () =>
    page.evaluate((id) => document.getElementById(id)?.getAttribute("style"), markup.watched);
  const style = await styleOf();
  const cdp = await page.context().newCDPSession(page);
  const { root: tree } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: tree.nodeId, selector: markup.root });
  const facts = await measuredFacts(cdp, nodeId);
  await cdp.detach();
  return { facts, restored: (await styleOf()) === style };
}
