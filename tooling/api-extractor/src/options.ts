/** Output policy for the checker-resolved payload of preserved type operators. */
export type TypeOperatorOutputMode = "resolved" | "syntaxOnly";

/** Backwards-compatible alias for the package's original option name. */
export type TypeOperatorOutput = TypeOperatorOutputMode;

/** Data supplied before an object property is included in the semantic model. */
export type ShouldIncludeData = {
  name: string;
  depth: number;
};

/** Data supplied before an object's shape is expanded in the semantic model. */
export type ShouldResolveObjectData = {
  /** Name of the object's type, or an empty string for an anonymous shape. */
  name: string;
  /** Number of properties the object would contribute to the output. */
  propertyCount: number;
  /** Depth of the type-resolution stack, counting every intermediate type. */
  depth: number;
  /** Number of property values traversed to reach this object. */
  propertyDepth: number;
};

export type ExtractorOptions = {
  readonly shouldInclude?: (data: ShouldIncludeData) => boolean | undefined;
  readonly shouldResolveObject?: (data: ShouldResolveObjectData) => boolean | undefined;
  readonly includeExternalTypes?: boolean;
  readonly typeOperatorOutput?: TypeOperatorOutputMode;
};

export const defaultExtractorOptions: Required<
  Pick<ExtractorOptions, "shouldResolveObject" | "includeExternalTypes" | "typeOperatorOutput">
> = {
  shouldResolveObject: (data) => (data.propertyDepth === 0 || data.propertyCount <= 50) && data.depth <= 10,
  includeExternalTypes: false,
  typeOperatorOutput: "resolved",
};

export type ProjectFileSystemEntries = {
  readonly files: readonly string[];
  readonly directories: readonly string[];
};

export type ProjectFileSystem = {
  readonly directoryExists?: (directoryName: string) => boolean | undefined;
  readonly fileExists?: (fileName: string) => boolean | undefined;
  readonly getAccessibleEntries?: (directoryName: string) => ProjectFileSystemEntries | undefined;
  readonly readFile?: (fileName: string) => string | null | undefined;
  readonly realpath?: (path: string) => string | undefined;
  readonly writeFile?: (path: string, content: string) => void;
  readonly removeFile?: (path: string) => void;
};

export type OpenProjectOptions = {
  readonly tsconfigPath: string;
  readonly cwd?: string;
  readonly fileSystem?: ProjectFileSystem;
};
