/* oxlint-disable anti-slop/no-conditional-empty-object-spread -- optional fields preserve model JSON. */

import { Context, Effect, Layer, Schema } from "effect";

import type {
  BackendCompilerOperations,
  BackendExtractionSession,
  BackendProject,
} from "./backend/contracts.ts";
import { CompilerBackend } from "./backend/service.ts";
import { BackendError, ExtractError, FileNotInProgramError, safeCause } from "./errors.ts";
import type { ConfigError } from "./errors.ts";
import { InternalProjectExtractorTiming } from "./internal/project-options.ts";
import type {
  InternalOpenProjectOptions,
  InternalTimedExtraction,
  InternalTimingFactory,
} from "./internal/project-options.ts";
import { ExtractionResultSchema, ModuleNodeSchema } from "./model.ts";
import type { ModuleNode } from "./model.ts";
import type { ExtractorOptions, OpenProjectOptions } from "./options.ts";
import { ResolverFailure } from "./parse/resolver.ts";
import { readModuleDraft, resolveModuleDraft } from "./parser.ts";
import type { ProvenanceEntry } from "./provenance.ts";
import { ProvenanceEntrySchema } from "./provenance.ts";
import type { ExtractWarning } from "./warnings.ts";
import { ExtractWarningSchema } from "./warnings.ts";

export type ExtractionResult = {
  readonly module: ModuleNode;
  readonly warnings: readonly ExtractWarning[];
  readonly provenance: readonly ProvenanceEntry[];
};

type ExtractionErrors = BackendError | FileNotInProgramError | ExtractError;

export type ProjectExtractorService = {
  readonly extractModule: (
    filePath: string,
    options?: ExtractorOptions
  ) => Effect.Effect<ExtractionResult, ExtractionErrors>;
};

export class ProjectExtractor extends Context.Service<ProjectExtractor, ProjectExtractorService>()(
  "elmera/api-extractor/ProjectExtractor"
) {
  static layer(options: OpenProjectOptions): Layer.Layer<ProjectExtractor, ConfigError | BackendError> {
    return projectExtractorLayerInternal(publicProjectOptions(options)).pipe(
      Layer.provide(CompilerBackend.layer)
    );
  }

  static live(options: OpenProjectOptions): Layer.Layer<ProjectExtractor, ConfigError | BackendError> {
    return ProjectExtractor.layer(options);
  }
}
/** @internal Test seam for injecting a package-owned backend implementation. */
export function projectExtractorLayer(
  options: OpenProjectOptions
): Layer.Layer<ProjectExtractor, ConfigError | BackendError, CompilerBackend> {
  return projectExtractorLayerInternal(publicProjectOptions(options));
}

/** @internal Evidence-only factory; timing is deliberately absent from the public service. */
export function projectExtractorLayerInternal(
  options: InternalOpenProjectOptions
): Layer.Layer<ProjectExtractor, ConfigError | BackendError, CompilerBackend> {
  const project = openProject(options);
  const createService = (opened: BackendProject): ProjectExtractorService => ({
    extractModule: (filePath, extractorOptions) => extractFromProject(opened, filePath, extractorOptions),
  });
  return Layer.effect(ProjectExtractor, Effect.map(project, createService));
}

/** @internal Evidence-only factory; timing is deliberately absent from the public service. */
export function projectExtractorLayerWithTiming(
  options: InternalOpenProjectOptions,
  timingFactory: InternalTimingFactory
): Layer.Layer<
  ProjectExtractor | InternalProjectExtractorTiming,
  ConfigError | BackendError,
  CompilerBackend
> {
  const project = openProject(options);
  return Layer.effectContext(
    Effect.map(project, (opened) => {
      const service: ProjectExtractorService = {
        extractModule: (filePath, extractorOptions) => extractFromProject(opened, filePath, extractorOptions),
      };
      const timedMethod = (filePath: string, extractorOptions?: ExtractorOptions) =>
        extractFromProjectWithTiming(opened, filePath, extractorOptions);
      return Context.add(
        Context.make(ProjectExtractor, service),
        InternalProjectExtractorTiming,
        timingFactory(timedMethod)
      );
    })
  );
}

function openProject(options: InternalOpenProjectOptions) {
  const acquire = Effect.gen(function* () {
    const backend = yield* CompilerBackend;
    return yield* backend.openProject(options);
  });
  return Effect.acquireRelease(acquire, (opened) => Effect.sync(() => opened.close()));
}

function publicProjectOptions(options: OpenProjectOptions): InternalOpenProjectOptions {
  return {
    tsconfigPath: options.tsconfigPath,
    cwd: options.cwd,
    fileSystem: options.fileSystem,
  };
}

function extractFromProject(
  project: BackendProject,
  filePath: string,
  options: ExtractorOptions | undefined
): Effect.Effect<ExtractionResult, BackendError | FileNotInProgramError | ExtractError> {
  return extractFromProjectWithTiming(project, filePath, options).pipe(Effect.map(({ result }) => result));
}

function openExtraction(project: BackendProject) {
  return Effect.acquireRelease(
    Effect.try({
      try: () => project.openExtraction(),
      catch: (cause) => toBackendError("<session>", cause, "openExtraction"),
    }),
    (session) => Effect.sync(() => session.close())
  );
}

function extractFromProjectWithTiming(
  project: BackendProject,
  filePath: string,
  options: ExtractorOptions | undefined
): Effect.Effect<InternalTimedExtraction, BackendError | FileNotInProgramError | ExtractError> {
  return Effect.scoped(
    openExtraction(project).pipe(
      Effect.map((session) => guardedExtractionSession(session, filePath)),
      Effect.flatMap((guardedSession) =>
        Effect.try({
          try: () => readModuleDraft(guardedSession, filePath),
          catch: (cause) => toBackendError(filePath, cause, "readModule"),
        }).pipe(
          Effect.flatMap((draft) =>
            Effect.try({
              try: () => resolveModuleDraft(guardedSession, draft, filePath, options),
              catch: (cause) => toBackendOrExtractionError(filePath, cause),
            })
          )
        )
      ),
      Effect.flatMap((resolved) =>
        Effect.try({
          try: () => decodeResult(resolved.module, resolved.warnings, resolved.provenance),
          catch: (cause) => toExtractionError(filePath, cause),
        })
      ),
      Effect.flatMap((result) =>
        Effect.try({
          try: () => project.getTimingInfo?.() ?? disabledTiming(),
          catch: (cause) => toBackendError(filePath, cause, "getTimingInfo"),
        }).pipe(Effect.map((timing) => ({ result, timing })))
      )
    )
  );
}

function toBackendOrExtractionError(
  filePath: string,
  cause: unknown
): BackendError | FileNotInProgramError | ExtractError {
  if (cause instanceof BackendError || cause instanceof FileNotInProgramError) return cause;
  return toExtractionError(filePath, cause);
}

function decodeResult(
  module: ModuleNode,
  warnings: readonly unknown[],
  provenance: readonly ProvenanceEntry[]
): ExtractionResult {
  return Schema.decodeUnknownSync(ExtractionResultSchema)({
    module: Schema.decodeUnknownSync(ModuleNodeSchema)(module),
    warnings: warnings.map((warning) => Schema.decodeUnknownSync(ExtractWarningSchema)(warning)),
    provenance: provenance.map((entry) => Schema.decodeUnknownSync(ProvenanceEntrySchema)(entry)),
  });
}

function toBackendError(
  filePath: string,
  cause: unknown,
  operation = "extractModule",
  symbolStack: readonly string[] = []
): BackendError | FileNotInProgramError {
  if (cause instanceof FileNotInProgramError) return cause;
  if (cause instanceof BackendError) {
    const existingStack = cause.symbolStack;
    const needsOperation = cause.operation === undefined;
    const needsFilePath = cause.filePath === undefined;
    const needsSymbolStack =
      symbolStack.length > 0 && (existingStack === undefined || existingStack.length === 0);
    if (!needsOperation && !needsFilePath && !needsSymbolStack) return cause;
    return new BackendError({
      message: cause.message,
      cause: cause.cause,
      operation: cause.operation ?? operation,
      filePath: cause.filePath ?? filePath,
      ...(needsSymbolStack
        ? { symbolStack: [...symbolStack] }
        : existingStack === undefined
          ? {}
          : { symbolStack: [...existingStack] }),
    });
  }
  return new BackendError({
    message: `Compiler operation ${operation} failed while extracting ${filePath}`,
    cause: safeCause(cause),
    operation,
    filePath,
    ...(symbolStack.length === 0 ? {} : { symbolStack: [...symbolStack] }),
  });
}

function toExtractionError(
  filePath: string,
  cause: unknown
): BackendError | FileNotInProgramError | ExtractError {
  if (cause instanceof BackendError || cause instanceof FileNotInProgramError) return cause;
  if (cause instanceof ExtractError) return cause;
  const resolver = cause instanceof ResolverFailure ? cause : undefined;
  const stack = resolver?.symbolStack ?? [];
  return new ExtractError({
    filePath,
    symbolStack: [filePath, ...stack],
    message: `Could not parse or model ${filePath}${resolver === undefined ? "" : `: ${resolver.message}`}`,
    cause: safeCause(resolver?.cause ?? cause),
  });
}

function disabledTiming(): InternalTimedExtraction["timing"] {
  return {
    enabled: false,
    totals: {
      requestCount: 0,
      roundTripMs: 0,
      bytesSent: 0,
      bytesReceived: 0,
      serverTimeMs: 0,
      transportOverheadMs: 0,
      nodesMaterialized: 0,
      sourceFilesFetched: 0,
      nodesFetched: 0,
    },
    recentRequests: [],
  };
}

/**
 * Wraps the complete backend session once per extraction. Backend operations
 * are kept distinct from resolver policy so transport/compiler failures stay
 * BackendErrors while user callbacks still become ExtractErrors at the shell.
 */
function guardedExtractionSession(
  session: BackendExtractionSession,
  filePath: string
): BackendExtractionSession {
  let symbolStack: readonly string[] = [];
  let currentFilePath = filePath;
  const guard =
    <Arguments extends readonly unknown[], Result>(
      name: string,
      operation: (...arguments_: Arguments) => Result,
      operationFilePath?: (...arguments_: Arguments) => string
    ) =>
    (...arguments_: Arguments): Result => {
      const operationPath = operationFilePath?.(...arguments_) ?? currentFilePath;
      try {
        return operation(...arguments_);
      } catch (cause) {
        throw toBackendError(operationPath, cause, name, symbolStack);
      }
    };

  const compiler = session.compiler;
  const constructSignaturesOfType = compiler.constructSignaturesOfType;
  const declarationOwnership = compiler.declarationOwnership;
  const documentationOfNode = compiler.documentationOfNode;
  const documentationOfParameter = compiler.documentationOfParameter;
  const guardedCompiler: BackendCompilerOperations = {
    setErrorContext: (next) => {
      symbolStack = [...next];
      if (compiler.setErrorContext !== undefined) {
        guard("setErrorContext", () => compiler.setErrorContext?.(next))();
      }
    },
    typeOfSymbol: guard("typeOfSymbol", (symbol, declared) => compiler.typeOfSymbol(symbol, declared)),
    typeAtNode: guard("typeAtNode", (node) => compiler.typeAtNode(node)),
    typeFacts: guard("typeFacts", (type) => compiler.typeFacts(type)),
    symbolFacts: guard("symbolFacts", (symbol) => compiler.symbolFacts(symbol)),
    symbolOrigin: guard("symbolOrigin", (symbol) => compiler.symbolOrigin(symbol)),
    declaringParentIsClass: guard("declaringParentIsClass", (symbol) =>
      compiler.declaringParentIsClass(symbol)
    ),
    ...(compiler.documentationOfSymbol === undefined
      ? {}
      : {
          documentationOfSymbol: guard("documentationOfSymbol", (symbol) =>
            compiler.documentationOfSymbol?.(symbol)
          ),
        }),
    ...(compiler.enumFacts === undefined
      ? {}
      : {
          enumFacts: guard("enumFacts", (type) => compiler.enumFacts?.(type)),
        }),
    nodeFacts: guard("nodeFacts", (node) => compiler.nodeFacts(node)),
    nodeKind: guard("nodeKind", (node) => compiler.nodeKind(node)),
    typeNameFacts: guard("typeNameFacts", (type, sourceNode) => compiler.typeNameFacts(type, sourceNode)),
    signaturesOfType: guard("signaturesOfType", (type) => compiler.signaturesOfType(type)),
    ...(constructSignaturesOfType === undefined
      ? {}
      : { constructSignaturesOfType: guard("constructSignaturesOfType", constructSignaturesOfType) }),
    declarationOwnership: guard("declarationOwnership", declarationOwnership),
    signatureFacts: guard("signatureFacts", (signature) => compiler.signatureFacts(signature)),
    ...(documentationOfNode === undefined
      ? {}
      : { documentationOfNode: guard("documentationOfNode", documentationOfNode) }),
    ...(documentationOfParameter === undefined
      ? {}
      : { documentationOfParameter: guard("documentationOfParameter", documentationOfParameter) }),
    propertiesOfType: guard("propertiesOfType", (type) => compiler.propertiesOfType(type)),
    propertyType: guard("propertyType", (property) => compiler.propertyType(property)),
    indexSignaturesOfType: guard("indexSignaturesOfType", (type) => compiler.indexSignaturesOfType(type)),
    baseConstraintOfType: guard("baseConstraintOfType", (type) => compiler.baseConstraintOfType(type)),
    isArrayType: guard("isArrayType", (type) => compiler.isArrayType(type)),
    isReadonlyType: guard("isReadonlyType", (type) => compiler.isReadonlyType(type)),
    typeToString: guard("typeToString", (type) => compiler.typeToString(type)),
  };

  return {
    readModule: guard(
      "readModule",
      (modulePath) => session.readModule(modulePath),
      (modulePath) => {
        currentFilePath = modulePath;
        return modulePath;
      }
    ),
    compiler: guardedCompiler,
    resolveModule: guard(
      "resolveModule",
      (specifier, containingFile) => session.resolveModule(specifier, containingFile),
      (_specifier, containingFile) => {
        currentFilePath = containingFile;
        return containingFile;
      }
    ),
    close: () => session.close(),
  };
}
