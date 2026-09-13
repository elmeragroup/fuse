import { resolve } from "node:path";

import { resolveReleasePackage } from "@elmeragroup/internal/release";

const checkoutRoot = resolve(import.meta.dirname, "..");

/** The one published package, resolved by the shared release engine (release.md §1). */
export const releasePackage = resolveReleasePackage(
  checkoutRoot,
  resolve(checkoutRoot, "packages/ui"),
  "@elmeragroup/ui"
);
