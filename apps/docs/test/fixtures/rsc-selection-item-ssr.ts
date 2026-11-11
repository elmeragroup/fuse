/**
 * The SSR layer of the SelectionItem Flight fixture. It reads the Flight payload on stdin, revives
 * and prerenders it, prerenders `SelectionItemPage` again with no Flight as the oracle, and prints
 * both HTML strings as JSON.
 */
import { createElement } from "react";

import { readFileSync } from "node:fs";

import { decodeFlight, prerenderHtml } from "./rsc-flight-ssr.ts";
import { SelectionItemPage } from "./rsc-selection-item-page.tsx";

const { tree } = await decodeFlight(readFileSync(0, "utf8"));
process.stdout.write(
  JSON.stringify({
    flight: await prerenderHtml(tree),
    clientOnly: await prerenderHtml(createElement(SelectionItemPage)),
  })
);
