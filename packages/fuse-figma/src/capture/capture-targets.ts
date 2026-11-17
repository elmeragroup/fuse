/**
 * The sets the capture renders: each kit entry, as its manifest names it.
 */

import { previewWidthIn } from "../components/component-spec.ts";
import { KIT } from "../components/kit-registry.ts";
import { setBooleanProperties } from "../components/optional-parts.ts";
import { manifestDefinition } from "./manifest.ts";
import type { CaptureTarget } from "./run-capture.ts";

/**
 * The capture targets of the kit's sets, in kit order.
 *
 * @param only - The keys of the sets to capture, or undefined for every set.
 * @returns The targets.
 */
export function captureTargets(only?: ReadonlySet<string>): readonly CaptureTarget[] {
  return KIT.flatMap(({ manifest }) => {
    if (only !== undefined && !only.has(manifest.key)) {
      return [];
    }
    const definition = manifestDefinition(manifest);
    const target: CaptureTarget = {
      ...manifest,
      // The capture renders every optional part: the set draws each, and its property hides it.
      optional: new Set(setBooleanProperties(definition).map(({ name }) => name)),
      previewWidthFor: (cell) => previewWidthIn(definition, cell),
    };
    return [target];
  });
}
