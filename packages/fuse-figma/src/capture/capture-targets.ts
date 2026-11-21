/**
 * The sets the capture renders: each kit entry, as its manifest names it, and the text style
 * samples, which no component set draws.
 */

import { previewWidthIn } from "../components/component-spec.ts";
import { KIT } from "../components/kit-registry.ts";
import { setBooleanProperties } from "../components/optional-parts.ts";
import { TEXT_STYLE_CAPTURE } from "../components/text-style-samples.ts";
import { manifestDefinition } from "./manifest.ts";
import type { CaptureTarget } from "./run-capture.ts";

/**
 * The capture targets of the kit's component sets, in kit order, which `figma:probe` measures.
 *
 * @param only - The keys of the sets to include, or undefined for every set.
 * @returns The targets.
 */
export function setTargets(only?: ReadonlySet<string>): readonly CaptureTarget[] {
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

/**
 * Everything `figma:capture` captures: the kit's sets, then the text style samples, which
 * `text-styles.ts` reads.
 *
 * @param only - The keys of the captures to take, or undefined for every one.
 * @returns The targets.
 */
export function captureTargets(only?: ReadonlySet<string>): readonly CaptureTarget[] {
  const sets = setTargets(only);
  return only === undefined || only.has(TEXT_STYLE_CAPTURE.key) ? [...sets, TEXT_STYLE_CAPTURE] : sets;
}
