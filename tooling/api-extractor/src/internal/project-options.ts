import { Context } from "effect";
import type { Effect } from "effect";

import type { BackendError } from "../errors.ts";
import type { ExtractError, FileNotInProgramError } from "../errors.ts";
import type { ExtractionResult } from "../extractor.ts";
import type { ExtractorOptions, OpenProjectOptions } from "../options.ts";

/**
 * Options understood by the package-owned project factory.  Compiler timing
 * is an evidence concern, so this type is intentionally kept out of the
 * package entry point and is only consumed by the internal timing seam.
 */
export type InternalOpenProjectOptions = OpenProjectOptions & {
  readonly collectTiming?: boolean;
};

export type InternalTimedExtraction = {
  readonly result: ExtractionResult;
  readonly timing: {
    readonly enabled: boolean;
    readonly totals: {
      readonly requestCount: number;
      readonly roundTripMs: number;
      readonly bytesSent: number;
      readonly bytesReceived: number;
      readonly serverTimeMs: number;
      readonly transportOverheadMs: number;
      readonly nodesMaterialized: number;
      readonly sourceFilesFetched: number;
      readonly nodesFetched: number;
    };
    readonly recentRequests: readonly {
      readonly method: string;
      readonly roundTripMs: number;
      readonly bytesSent: number;
      readonly bytesReceived: number;
      readonly serverTimeMs?: number;
      readonly transportOverheadMs?: number;
    }[];
  };
};

export type InternalTimingMethod = (
  filePath: string,
  options?: ExtractorOptions
) => Effect.Effect<InternalTimedExtraction, BackendError | FileNotInProgramError | ExtractError>;

export type InternalTimingService = {
  readonly extractModule: InternalTimingMethod;
};

/** Private evidence service; deliberately not re-exported from the package index. */
export class InternalProjectExtractorTiming extends Context.Service<
  InternalProjectExtractorTiming,
  InternalTimingService
>()("elmera/api-extractor/InternalProjectExtractorTiming") {}

export type InternalTimingFactory = (method: InternalTimingMethod) => InternalTimingService;
