/**
 * The sets the capture renders: each kit entry switched to the capture, as its manifest names it.
 */

import { previewWidthIn } from "../components/component-spec.ts";
import { KIT } from "../components/kit-registry.ts";
import { manifestDefinition } from "./manifest.ts";
import type { InstanceManifest, PartManifest } from "./manifest.ts";

/** The BOOLEAN properties of a manifest's optional frame parts, depth first. */
function optionalProperties(parts: readonly (PartManifest | InstanceManifest)[]): readonly string[] {
  return parts.flatMap((part) =>
    "kind" in part
      ? []
      : [
          ...(part.optional === undefined ? [] : [part.optional.name]),
          ...optionalProperties(part.parts ?? []),
        ]
  );
}
import type { CaptureTarget } from "./run-capture.ts";

/**
 * The capture targets of the kit's switched sets, in kit order.
 *
 * @param only - The keys of the sets to capture, or undefined for every switched set.
 * @returns The targets.
 */
export function captureTargets(only?: ReadonlySet<string>): readonly CaptureTarget[] {
  return KIT.flatMap(({ manifest }) => {
    if (manifest === undefined || (only !== undefined && !only.has(manifest.key))) {
      return [];
    }
    const definition = manifestDefinition(manifest);
    const target: CaptureTarget = {
      ...manifest,
      optional: new Set(optionalProperties(manifest.parts ?? [])),
      previewWidthFor: (cell) => previewWidthIn(definition, cell),
    };
    return [target];
  });
}
