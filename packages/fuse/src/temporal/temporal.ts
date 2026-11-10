// The one door to Temporal for Fuse's date components. Fuse never installs Temporal on its own:
// a host imports `@elmeragroup/fuse/temporal-polyfill` once, which installs the polyfill where the
// engine lacks Temporal and sets the install marker. The accessor reads `globalThis` at call
// time, not import time, so a host may import the subpath after Fuse's modules have loaded, and a
// test may remove Temporal between calls.

// The theme validator owns Fuse's one `process.env.NODE_ENV` read, which lint allows nowhere else.
import { isThemeDevelopment } from "../theme/validate-theme";
import { hostTemporal, TEMPORAL_INSTALL_MARKER } from "./install-marker";

/** The subpath named in the warning and the error, so a host can copy it as written. */
const POLYFILL_SUBPATH = "@elmeragroup/fuse/temporal-polyfill";

/** Thrown when the runtime has no `globalThis.Temporal`. */
const TEMPORAL_MISSING_MESSAGE = `Fuse's date components need Temporal, which this runtime lacks. Import "${POLYFILL_SUBPATH}" once in your app's entry, on the server and in the browser, before they render.`;

/** Warned once in development when Temporal is present but the host never imported the subpath. */
const TEMPORAL_MARKER_MISSING_MESSAGE = `Fuse's date components read Temporal from globalThis, and "${POLYFILL_SUBPATH}" was not imported. This engine has Temporal, but an engine without it, such as Node 24, will throw. Import "${POLYFILL_SUBPATH}" once in your app's entry, on the server and in the browser.`;

let warnedMarkerMissing = false;

/**
 * The runtime's Temporal namespace, read when called.
 *
 * In development it warns once when the host never imported `@elmeragroup/fuse/temporal-polyfill`,
 * in every engine, so a host testing in an engine with native Temporal learns before Safari does.
 *
 * @returns `globalThis.Temporal`.
 * @throws TypeError naming `@elmeragroup/fuse/temporal-polyfill` when the runtime has no Temporal.
 *   That is a host setup defect: no date component can render without it.
 */
export function temporal(): typeof Temporal {
  const runtime = hostTemporal();
  if (runtime === undefined) {
    throw new TypeError(TEMPORAL_MISSING_MESSAGE);
  }
  // The marker check first: `isThemeDevelopment` reads `process.env` on every call.
  if (!warnedMarkerMissing && !(TEMPORAL_INSTALL_MARKER in globalThis) && isThemeDevelopment()) {
    warnedMarkerMissing = true;
    console.warn(TEMPORAL_MARKER_MISSING_MESSAGE);
  }
  return runtime;
}
