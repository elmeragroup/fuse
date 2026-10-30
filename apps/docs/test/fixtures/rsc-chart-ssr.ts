/**
 * The SSR layer of the chart Flight fixture. It reads a Flight payload on stdin, decodes it with
 * React's Flight client the way Next's SSR does, loads each referenced client module as real code,
 * and prerenders the result. It also prerenders the scenario's page, `ChartPage` or the
 * `ComposedPage` that its first argument names, with no Flight at all, which is the oracle the
 * Flight path must reproduce, and prints both HTML strings as JSON.
 */
import { createElement } from "react";
import type { ReactNode } from "react";

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { prerenderToNodeStream } from "react-dom/static";

import { ChartPage, ComposedPage } from "./rsc-chart-page.tsx";
import { flightClientReferences } from "./rsc-flight-payload.ts";

type FlightClient = {
  createFromNodeStream: (
    stream: Readable,
    manifest: { moduleMap: null; serverModuleMap: null; moduleLoading: null }
  ) => PromiseLike<ReactNode>;
};

const require = createRequire(import.meta.url);
// SAFETY: Next ships this Flight client as untyped compiled CJS. The fixture only calls createFromNodeStream.
const client = require("next/dist/compiled/react-server-dom-webpack/client.node.js") as FlightClient;

async function html(node: ReactNode): Promise<string> {
  const { prelude } = await prerenderToNodeStream(node);
  const parts: Buffer[] = [];
  for await (const chunk of prelude) {
    parts.push(Buffer.from(chunk));
  }
  return Buffer.concat(parts).toString("utf8");
}

const payload = readFileSync(0, "utf8");
/** The client modules the payload references, loaded as real code, keyed by reference id. */
const modules = new Map<string, object>();
for (const id of new Set(flightClientReferences(payload).map((reference) => reference.module))) {
  const loaded: unknown = await import(id);
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- a module namespace object has a null prototype, so `instanceof Object` rejects it
  if (typeof loaded !== "object" || loaded === null) {
    throw new Error(`${id} did not load as a module`);
  }
  modules.set(id, loaded);
}
Object.assign(globalThis, { __next_require__: (id: string): object | undefined => modules.get(id) });

const tree = await client.createFromNodeStream(Readable.from([payload]), {
  moduleMap: null,
  serverModuleMap: null,
  moduleLoading: null,
});
process.stdout.write(
  JSON.stringify({
    clientModules: [...modules.keys()],
    flight: await html(tree),
    clientOnly: await html(createElement(process.argv[2] === "composed" ? ComposedPage : ChartPage)),
  })
);
