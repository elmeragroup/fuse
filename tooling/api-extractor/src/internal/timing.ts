import { Layer } from "effect";

import { CompilerBackend } from "../backend/service.ts";
import type { BackendError, ConfigError } from "../errors.ts";
import { projectExtractorLayerWithTiming } from "../extractor.ts";
import type { ProjectExtractor } from "../extractor.ts";
import type { OpenProjectOptions } from "../options.ts";
import { InternalProjectExtractorTiming } from "./project-options.ts";
import type {
  InternalOpenProjectOptions,
  InternalTimedExtraction,
  InternalTimingFactory,
  InternalTimingMethod,
} from "./project-options.ts";

export type TimedExtraction = InternalTimedExtraction;

/** Private factory used only by the timing layer; no timing state is attached to ProjectExtractor. */
export const makeInternalTimingService: InternalTimingFactory = (method: InternalTimingMethod) => ({
  extractModule: method,
});

/**
 * Internal evidence-only layer.  The public ProjectExtractor layer never
 * accepts or forwards the timing switch; timing tests and reports opt into
 * this factory explicitly instead.
 */
export function timedProjectExtractorLayer(
  options: OpenProjectOptions
): Layer.Layer<ProjectExtractor | InternalProjectExtractorTiming, ConfigError | BackendError> {
  const internalOptions: InternalOpenProjectOptions = { ...options, collectTiming: true };
  return projectExtractorLayerWithTiming(internalOptions, makeInternalTimingService).pipe(
    Layer.provide(CompilerBackend.layer)
  );
}

export { InternalProjectExtractorTiming };
