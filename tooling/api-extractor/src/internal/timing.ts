import { Layer } from "effect";
import type { Effect } from "effect";

import type { BackendTiming } from "../backend/contracts.ts";
import { CompilerBackend } from "../backend/service.ts";
import type { BackendError, ConfigError, ExtractError, FileNotInProgramError } from "../errors.ts";
import { projectExtractorLayerWithTiming } from "../extractor.ts";
import type { ProjectExtractor } from "../extractor.ts";
import type { ExtractorOptions, OpenProjectOptions } from "../options.ts";
import { InternalProjectExtractorTiming } from "./project-options.ts";
import type {
  InternalOpenProjectOptions,
  InternalTimedExtraction,
  InternalTimingFactory,
  InternalTimingMethod,
  InternalTimingService,
} from "./project-options.ts";

/** Timing evidence is intentionally package-internal and absent from ExtractionResult. */
export type InternalExtractionTiming = BackendTiming;

export type TimedExtraction = InternalTimedExtraction;

/** Private factory used only by the timing layer; no timing state is attached to ProjectExtractor. */
export const makeInternalTimingService: InternalTimingFactory = (method: InternalTimingMethod) => ({
  extractModule: method,
});

/**
 * Internal scripts and evidence tests receive an explicit private timing
 * service from the timing layer. It is not part of the package index.
 */
export function extractModuleWithTiming(
  service: InternalTimingService,
  filePath: string,
  options?: ExtractorOptions
): Effect.Effect<InternalTimedExtraction, BackendError | FileNotInProgramError | ExtractError> {
  return service.extractModule(filePath, options);
}

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
