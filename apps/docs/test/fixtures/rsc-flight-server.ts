/**
 * React Flight's server, the same one Next uses for React Server Components. The only
 * module that reaches into Next's compiled copy; the loader and the server fixture import it.
 *
 * `createClientModuleProxy` builds the object Next installs for a `"use client"` module:
 * property access one level deep is a client reference, and a second dot throws
 * "Cannot access X.Y on the server".
 */
import type { ReactNode } from "react";

import { createRequire } from "node:module";

/** A `"use client"` module as the server sees it: each export is a client reference. */
type ClientModuleProxy = {
  readonly [name: string]: ClientModuleProxy;
};

/** One client module entry in the bundler manifest Flight resolves references through. */
export type FlightModuleRecord = {
  id: string;
  chunks: readonly string[];
  name: "*";
  async: false;
};

/** The bundler manifest, keyed by client reference id. */
export type FlightManifest = {
  readonly [id: string]: FlightModuleRecord;
};

type FlightServer = {
  createClientModuleProxy: (id: string) => ClientModuleProxy;
  renderToPipeableStream: (
    node: ReactNode,
    manifest: FlightManifest,
    options?: { onError?: (error: Error) => void }
  ) => { pipe: (destination: NodeJS.WritableStream) => void };
};

const require = createRequire(import.meta.url);

function loadFlightServer(): FlightServer {
  // SAFETY: Next ships this Flight server as untyped compiled CJS. The fixtures only call createClientModuleProxy and renderToPipeableStream.
  return require("next/dist/compiled/react-server-dom-webpack/server.node.js") as FlightServer;
}

export const { createClientModuleProxy, renderToPipeableStream } = loadFlightServer();
