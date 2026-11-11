/**
 * The SSR layer of the chart Flight fixture. It reads a Flight payload on stdin, decodes it with
 * React's Flight client the way Next's SSR does, loads each referenced client module as real code,
 * and prerenders the result. It also prerenders the scenario's page, `ChartPage` or the
 * `ComposedPage` or `PolarPage` that its first argument names, with no Flight at all, which is the oracle the
 * Flight path must reproduce, and prints both HTML strings as JSON.
 */
import { createElement } from "react";

import { readFileSync } from "node:fs";

import { ChartPage, ComposedPage, PolarPage } from "./rsc-chart-page.tsx";
import { decodeFlight, prerenderHtml } from "./rsc-flight-ssr.ts";

/** The pages a scenario other than the default `page` names. */
const PAGES = new Map([
  ["composed", ComposedPage],
  ["polar", PolarPage],
]);

const { clientModules, tree } = await decodeFlight(readFileSync(0, "utf8"));
process.stdout.write(
  JSON.stringify({
    clientModules,
    flight: await prerenderHtml(tree),
    clientOnly: await prerenderHtml(createElement(PAGES.get(process.argv[2] ?? "") ?? ChartPage)),
  })
);
