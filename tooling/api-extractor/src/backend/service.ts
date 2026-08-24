import { Context, Effect, Layer } from "effect";

import { BackendError, ConfigError, safeCause } from "../errors.ts";
import type { InternalOpenProjectOptions } from "../internal/project-options.ts";
import type { BackendProject } from "./contracts.ts";
import { openTsgoProject } from "./ts7/project.ts";

export type CompilerBackendService = {
  readonly openProject: (
    options: InternalOpenProjectOptions
  ) => Effect.Effect<BackendProject, ConfigError | BackendError>;
};

export class CompilerBackend extends Context.Service<CompilerBackend, CompilerBackendService>()(
  "elmera/api-extractor/CompilerBackend"
) {
  static readonly layer: Layer.Layer<CompilerBackend> = Layer.succeed(CompilerBackend, {
    openProject: (options) =>
      Effect.try({
        try: () => openTsgoProject(options),
        catch: (cause) => toOpenError(options.tsconfigPath, cause),
      }),
  });
}

function toOpenError(tsconfigPath: string, cause: unknown): ConfigError | BackendError {
  if (cause instanceof ConfigError || cause instanceof BackendError) {
    return cause;
  }
  return new BackendError({
    message: `Could not start TypeScript project ${tsconfigPath}`,
    cause: safeCause(cause),
    filePath: tsconfigPath,
  });
}
