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
import { PassThrough } from "node:stream";

/** A `"use client"` module as the server sees it: each export is a client reference. */
type ClientModuleProxy = {
  readonly [name: string]: ClientModuleProxy;
};

/** One client module entry in the bundler manifest Flight resolves references through. */
export type FlightModuleRecord = {
  id: string;
  chunks: readonly string[];
  /** The export the reference names, or `*` for the whole module. */
  name: string;
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

/**
 * A bundler manifest that knows every client module. A reference id `<module url>#<export>`
 * resolves to that module and export with no chunks, which is what a fixture needs, since no
 * browser loads the chunks.
 *
 * @returns The manifest Flight's server resolves client references through.
 */
export function flightManifest() {
  return new Proxy<FlightManifest>(
    {},
    {
      get(_target, property): FlightModuleRecord | undefined {
        const id = String(property);
        // `then` would make the manifest a thenable. Symbol keys are not module ids.
        if (id === "then" || id.startsWith("Symbol(")) {
          return undefined;
        }
        const hash = id.lastIndexOf("#");
        return hash === -1
          ? { id, chunks: [], name: "*", async: false }
          : { id: id.slice(0, hash), chunks: [], name: id.slice(hash + 1), async: false };
      },
    }
  );
}

/** A Flight render's outcome: the payload text and every error the render reported. */
export type FlightRender = { readonly payload: string; readonly errors: readonly Error[] };

/**
 * Render a tree through Flight with the fixture manifest and collect the whole payload.
 *
 * @param element - The server tree.
 * @returns The payload and the render errors, which a fixture reports as it needs.
 */
export async function renderFlight(element: ReactNode): Promise<FlightRender> {
  const chunks: Buffer[] = [];
  const errors: Error[] = [];
  const destination = new PassThrough();
  const finished = new Promise<void>((resolve, reject) => {
    destination.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.from(chunk));
    });
    destination.on("end", resolve);
    destination.on("error", reject);
  });
  renderToPipeableStream(element, flightManifest(), {
    onError(error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    },
  }).pipe(destination);
  await finished;
  return { payload: Buffer.concat(chunks).toString("utf8"), errors };
}
