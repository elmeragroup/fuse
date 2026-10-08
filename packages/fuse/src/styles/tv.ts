import { createTV } from "tailwind-variants";

import { twMergeConfig } from "./tw-merge-config";

/**
 * Fuse's `tv`: tailwind-variants configured with the same tailwind-merge extension as `cn`, so a
 * recipe merges a consumer's `rounded-*` class over `rounded-inner` as `cn` does. Every recipe
 * in the package imports it instead of tailwind-variants' default `tv`.
 */
export const tv = createTV({ twMergeConfig });
