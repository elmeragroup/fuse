/**
 * The sets the capture renders: each kit entry, as its manifest names it.
 */

import { matrixCells, previewWidthIn } from "../components/component-spec.ts";
import type { Cell } from "../components/component-spec.ts";
import { KIT } from "../components/kit-registry.ts";
import { manifestDefinition } from "./manifest.ts";
import type { IconManifest, InstanceManifest, PartManifest } from "./manifest.ts";

/**
 * The BOOLEAN properties of a manifest's optional frame parts and icons in any of its cells, depth
 * first, which every cell renders turned on.
 */
function optionalProperties(
  box: {
    readonly iconsFor: (cell: Cell) => readonly IconManifest[];
    readonly parts?: readonly (PartManifest | InstanceManifest)[];
  },
  cells: readonly Cell[]
): readonly string[] {
  const icons = cells.flatMap((cell) =>
    box.iconsFor(cell).flatMap((icon) => (icon.optional === undefined ? [] : [icon.optional.name]))
  );
  const parts = (box.parts ?? []).flatMap((part) =>
    "kind" in part
      ? []
      : [...(part.optional === undefined ? [] : [part.optional.name]), ...optionalProperties(part, cells)]
  );
  return [...icons, ...parts];
}
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
      optional: new Set(optionalProperties(manifest, matrixCells(manifest.axes))),
      previewWidthFor: (cell) => previewWidthIn(definition, cell),
    };
    return [target];
  });
}
