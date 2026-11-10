"use client";

// The docs app is a host: it installs Temporal where the engine lacks it, in the browser and on the
// server, before any date component renders. Node 26, which serves the docs, ships Temporal, so
// there the import only sets the marker. Rendering this first in the shell pulls the module into the
// client bundle and evaluates it on the server.
import "@elmeragroup/fuse/temporal-polyfill";

/** Renders nothing; importing it installs Temporal. */
export function TemporalPolyfill(): null {
  return null;
}
