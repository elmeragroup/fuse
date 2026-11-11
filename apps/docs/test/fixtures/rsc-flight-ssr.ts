/**
 * The SSR layer's half of a Flight fixture: decode a payload with React's Flight client the way
 * Next's SSR does, loading each referenced client module as real code, and prerender a tree to
 * HTML. Import it only from a process that registered `rsc-chart-register-ssr.mjs`.
 */
import type { ReactNode } from "react";

import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { prerenderToNodeStream } from "react-dom/static";

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

/**
 * Prerender a tree to its static HTML.
 *
 * @param node - The tree to render.
 * @returns The HTML text.
 */
export async function prerenderHtml(node: ReactNode): Promise<string> {
  const { prelude } = await prerenderToNodeStream(node);
  const parts: Buffer[] = [];
  for await (const chunk of prelude) {
    parts.push(Buffer.from(chunk));
  }
  return Buffer.concat(parts).toString("utf8");
}

/** A decoded payload: the client modules it loaded and the tree it revived. */
export type DecodedFlight = { readonly clientModules: readonly string[]; readonly tree: ReactNode };

/**
 * Decode a Flight payload, loading every client module it references as real code.
 *
 * @param payload - The Flight payload text the server layer wrote.
 * @returns The loaded module ids and the revived tree.
 */
export async function decodeFlight(payload: string): Promise<DecodedFlight> {
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
  return { clientModules: [...modules.keys()], tree };
}
