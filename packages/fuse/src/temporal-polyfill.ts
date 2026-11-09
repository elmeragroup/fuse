/**
 * Installs Temporal for Fuse's date components where the engine lacks it.
 *
 * Import it bare, once, in the app's entry on the server and in the browser, before any date
 * component renders:
 *
 * ```ts
 * import "@elmeragroup/fuse/temporal-polyfill";
 * ```
 *
 * It installs `temporal-polyfill` on `globalThis` only when no `Temporal` is there when it runs,
 * so an engine's native Temporal, or one a host installed earlier, stays in place. Installing also
 * replaces `Intl.DateTimeFormat` with the polyfill's, which formats Temporal values, and adds
 * `Date.prototype.toTemporalInstant`. Either way it sets the marker that silences Fuse's
 * development warning. The root `@elmeragroup/fuse` entry never imports it: the host decides
 * whether and where the polyfill loads.
 *
 * @packageDocumentation
 */

// oxlint-disable elmera/facade-reexport-grammar -- An installer entry, not a facade: it exports
// nothing and its statements are the install (scripts/entries.ts INSTALLER_ENTRIES).

// Exit criterion: once stable Safari on macOS and iOS and every Node LTS that Fuse supports ship
// Temporal, this entry stops installing and only sets the marker, and the next major removes it
// together with the `temporal-polyfill` dependency. Until then Fuse's date components throw
// without Temporal, so the entry stays the one supported way to provide it.
//
// `package.json#sideEffects` lists this file by the path each manifest's exports resolve
// (scripts/generate-exports.ts). Without that, a bundler would drop a bare import of an entry
// that exports nothing.

import { installImplementation } from "temporal-polyfill/shim";

import { hostTemporal, TEMPORAL_INSTALL_MARKER } from "./temporal/install-marker";

// The global as it stands now, not the shim's own `install()`: that one checks the Temporal the
// polyfill's modules saw when they first loaded, so it replaces a Temporal a host installed after
// them, such as `temporal-polyfill/full/global` imported before this entry. Values made by that
// implementation then fail under the replacement.
if (hostTemporal() === undefined) {
  installImplementation();
}
Reflect.set(globalThis, TEMPORAL_INSTALL_MARKER, true);
