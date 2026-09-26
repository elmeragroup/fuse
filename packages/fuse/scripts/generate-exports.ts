import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  discoverEntries,
  exportKey,
  PUBLISHED_DEPENDENCY_RANGES,
  PUBLISHED_PEER_RANGES,
  publishCssTarget,
  publishExportTarget,
  sourceCssTarget,
  sourceExportTarget,
  TOOLING_ONLY_JS_ENTRIES,
} from "./entries";
import type { CssExportEntry, DiscoveredEntries, ExportCondition, JsExportEntry } from "./entries";
import { ARTIFACTS_DIR } from "./tarball";
import { copyTwemojiNotices } from "./twemoji-notices";

export type { ExportCondition };

export type ExportBinding = {
  key: string;
  target: ExportCondition | string;
};

type WorkspacePeers = {
  react: string;
  "react-dom": string;
  tailwindcss: string;
  recharts?: string;
};

type WorkspaceDependencies = {
  "@base-ui/react": string;
  clsx: string;
  "tailwind-merge": string;
  "tailwind-variants": string;
  "tailwindcss-react-aria-components": string;
  "tw-animate-css": string;
  "react-aria-components"?: string;
  "react-aria"?: string;
  "@internationalized/date"?: string;
  "@phosphor-icons/react"?: string;
  "@internationalized/string"?: string;
  "libphonenumber-js"?: string;
  "sugar-high"?: string;
};

/** npm registry metadata. Carried verbatim from the workspace manifest into the published one. */
type PackageMetadata = {
  description: string;
  keywords: string[];
  homepage: string;
  bugs: { url: string };
  repository: { type: string; url: string; directory: string };
};

/** The workspace manifest fields the publish manifest is built from. */
type WorkspaceManifest = PackageMetadata & {
  name: string;
  version: string;
  license: string;
  sideEffects: string[];
  peerDependenciesMeta: { tailwindcss: { optional: boolean }; recharts?: { optional: boolean } };
  dependencies: WorkspaceDependencies;
};

function sortExportKeys(left: string, right: string): number {
  if (left === ".") {
    return -1;
  }
  if (right === ".") {
    return 1;
  }
  return left.localeCompare(right);
}

function pushJsBindings(
  bindings: ExportBinding[],
  jsEntries: readonly JsExportEntry[],
  target: (entry: JsExportEntry) => ExportCondition
): void {
  for (const entry of jsEntries) {
    bindings.push({ key: exportKey(entry.subpath), target: target(entry) });
  }
}

function pushCssBindings(
  bindings: ExportBinding[],
  cssEntries: readonly CssExportEntry[],
  target: (entry: CssExportEntry) => string
): void {
  for (const entry of cssEntries) {
    bindings.push({ key: exportKey(entry.subpath), target: target(entry) });
  }
}

function pushToolingOnlyBindings(bindings: ExportBinding[]): void {
  for (const entry of TOOLING_ONLY_JS_ENTRIES) {
    const target = `./${entry.sourceFile}`;
    bindings.push({ key: exportKey(entry.subpath), target: { types: target, import: target } });
  }
}

export function buildSourceExportMap(discovered: DiscoveredEntries): ExportBinding[] {
  const bindings: ExportBinding[] = [];
  pushJsBindings(bindings, discovered.jsEntries, sourceExportTarget);
  pushToolingOnlyBindings(bindings);
  pushCssBindings(bindings, discovered.cssEntries, sourceCssTarget);
  for (const pattern of discovered.assetPatterns) {
    bindings.push({ key: exportKey(pattern.subpath), target: `./${pattern.sourceFile}` });
  }
  return bindings.toSorted((left, right) => sortExportKeys(left.key, right.key));
}

export function buildPublishExportMap(discovered: DiscoveredEntries): ExportBinding[] {
  const bindings: ExportBinding[] = [];
  pushJsBindings(bindings, discovered.jsEntries, publishExportTarget);
  pushCssBindings(bindings, discovered.cssEntries, publishCssTarget);
  for (const pattern of discovered.assetPatterns) {
    bindings.push({ key: exportKey(pattern.subpath), target: `./${pattern.publishFile}` });
  }
  return bindings.toSorted((left, right) => sortExportKeys(left.key, right.key));
}

export function exportBindingTarget(
  bindings: readonly ExportBinding[],
  key: string
): ExportCondition | string | undefined {
  return bindings.find((binding) => binding.key === key)?.target;
}

export function exportBindingsObject(bindings: readonly ExportBinding[]) {
  return Object.fromEntries(bindings.map((binding) => [binding.key, binding.target]));
}

function requiredString(value: string | undefined, field: string): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`package.json missing string field ${field}`);
  }
  return value;
}

function requiredStringArray(value: string[] | undefined, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`package.json missing string array field ${field}`);
  }
  return value;
}

/** Rejects a missing, null or array-valued field; the object's entries keep their declared type. */
function requiredObject<T extends object>(value: T | undefined, field: string): T {
  if (!(value instanceof Object) || Array.isArray(value)) {
    throw new Error(`package.json missing object field ${field}`);
  }
  return value;
}

/**
 * The npm metadata block, validated at the one boundary that reads it and spread into both
 * manifests. Every field carries the same presence guarantee the other required fields do: an
 * unvalidated pass-through is dropped silently by `JSON.stringify`, so a typo publishes a package
 * with no repository link rather than failing the build.
 */
function packageMetadata(raw: Partial<PackageMetadata>): PackageMetadata {
  return {
    description: requiredString(raw.description, "description"),
    keywords: requiredStringArray(raw.keywords, "keywords"),
    homepage: requiredString(raw.homepage, "homepage"),
    // Reading through the field also rejects a missing or string-valued `bugs`.
    bugs: { url: requiredString(raw.bugs?.url, "bugs.url") },
    // Reading through the three fields also rejects a missing or string-valued `repository`.
    repository: {
      type: requiredString(raw.repository?.type, "repository.type"),
      url: requiredString(raw.repository?.url, "repository.url"),
      directory: requiredString(raw.repository?.directory, "repository.directory"),
    },
  };
}

type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;

type JsonObject = { readonly [key: string]: JsonValue };

function readManifestObject(path: string): JsonObject {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  // `instanceof Object` rejects `null` and JSON's primitive roots (`42`, `"x"`, `true`) in one test,
  // so a corrupt manifest fails here instead of being spread into a near-empty rewrite.
  if (!(parsed instanceof Object) || Array.isArray(parsed)) {
    throw new Error(`${path} must be a JSON object`);
  }
  // SAFETY: workspace package.json is the I/O boundary. JSON.parse yields only JSON values, and the
  // guard above rejected every root that is not a plain object.
  return parsed as JsonObject;
}

function readWorkspaceManifest(path: string): WorkspaceManifest {
  // SAFETY: workspace package.json is the I/O boundary. Every field stays optional until a check
  // below rejects its absence; the checks test presence, not JSON type, so each present value is
  // trusted to have its declared type. That trust reaches the publish manifest unchanged for the
  // scalar fields, `sideEffects` and `peerDependenciesMeta`; `dependencies` is read only for which
  // names it declares, since `publishedDependencies` replaces every range.
  const raw = readManifestObject(path) as Partial<WorkspaceManifest>;
  return {
    name: requiredString(raw.name, "name"),
    version: requiredString(raw.version, "version"),
    ...packageMetadata(raw),
    license: requiredString(raw.license, "license"),
    sideEffects: requiredStringArray(raw.sideEffects, "sideEffects"),
    peerDependenciesMeta: requiredObject(raw.peerDependenciesMeta, "peerDependenciesMeta"),
    dependencies: requiredObject(raw.dependencies, "dependencies"),
  };
}

function writePublishPackageJson(path: string, manifest: PublishManifest): void {
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

/** The release identity written to, and read back from, the packed `elmeraRelease` field. */
type ReleaseSource = {
  readonly commit: string;
  readonly channel: "canary" | "stable";
};

/**
 * The release stamp `writePublishManifest` records. The engine's branded `ReleaseIntent`
 * satisfies it; the stamping path only serializes these fields, so it depends on the shape,
 * not on the engine's identity types.
 */
export type ReleaseStamp = {
  readonly version: string;
  readonly commit: string;
  readonly channel: "canary" | "stable";
};

type PublishManifest = PackageMetadata & {
  name: string;
  version: string;
  license: string;
  type: "module";
  sideEffects: string[];
  exports: ReturnType<typeof exportBindingsObject>;
  peerDependencies: WorkspacePeers;
  peerDependenciesMeta: WorkspaceManifest["peerDependenciesMeta"];
  dependencies: WorkspaceDependencies;
  publishConfig: { access: "public" };
  elmeraRelease?: ReleaseSource;
};

function publishedPeerDependencies(): WorkspacePeers {
  return {
    react: PUBLISHED_PEER_RANGES.react,
    "react-dom": PUBLISHED_PEER_RANGES["react-dom"],
    tailwindcss: PUBLISHED_PEER_RANGES.tailwindcss,
  };
}

export function publishedDependencies(declared: WorkspaceDependencies): WorkspaceDependencies {
  const dependencies: Partial<WorkspaceDependencies> = {};
  for (const name of Object.keys(PUBLISHED_DEPENDENCY_RANGES)) {
    // SAFETY: Object.keys of the published-range const object yields that object's keys.
    const key = name as keyof typeof PUBLISHED_DEPENDENCY_RANGES;
    if (declared[key] !== undefined) {
      dependencies[key] = PUBLISHED_DEPENDENCY_RANGES[key];
    }
  }
  // SAFETY: every WorkspaceDependencies key that the workspace manifest declares is
  // copied from PUBLISHED_DEPENDENCY_RANGES; required keys are always on that manifest.
  return dependencies as WorkspaceDependencies;
}

const ROOT_BARREL_BANNER = `/**
 * AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY.
 *
 * Root barrel of bare component entries plus /theme.
 * Icons, illustrations, flags, and react-aria/* stay subpath-only.
 */

`;

export function renderRootBarrel(discovered: DiscoveredEntries): string {
  const lines = discovered.jsEntries
    .filter((entry) => entry.inRootBarrel && entry.subpath !== ".")
    .map((entry) => entry.subpath)
    .toSorted((left, right) => left.localeCompare(right))
    .map((subpath) => `export * from "./${subpath}";`);
  return `${ROOT_BARREL_BANNER}${lines.join("\n")}\n`;
}

export function writeSourceExports(packageRoot: string): DiscoveredEntries {
  for (const entry of TOOLING_ONLY_JS_ENTRIES) {
    if (!existsSync(join(packageRoot, entry.sourceFile))) {
      throw new Error(`Missing tooling-only source ${entry.sourceFile}`);
    }
  }
  const discovered = discoverEntries(packageRoot);
  writeFileSync(join(packageRoot, "src/index.ts"), renderRootBarrel(discovered));
  const packageJsonPath = join(packageRoot, "package.json");
  // Patch only the generated fields into the parsed manifest, so every other field, known to
  // this script or not, keeps its value and position.
  const pkg = {
    ...readManifestObject(packageJsonPath),
    exports: exportBindingsObject(buildSourceExportMap(discovered)),
    publishConfig: { directory: "dist", access: "public", linkDirectory: false },
  };
  writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return discovered;
}

/**
 * Writes `dist/package.json` plus the packaging side files. A release stamp overrides the
 * workspace version and records the packed identity; an ordinary build keeps the workspace
 * version and no stamp, so the release engine's identity check stays meaningful.
 */
export function writePublishManifest(packageRoot: string, release?: ReleaseStamp): void {
  const discovered = discoverEntries(packageRoot);
  const workspace = readWorkspaceManifest(join(packageRoot, "package.json"));
  const licensePath = join(packageRoot, "LICENSE");
  const readmePath = join(packageRoot, "README.md");
  if (!existsSync(licensePath)) {
    throw new Error("packages/fuse/LICENSE is required in the published package");
  }

  const published: PublishManifest = {
    name: workspace.name,
    version: release?.version ?? workspace.version,
    ...packageMetadata(workspace),
    license: workspace.license,
    type: "module",
    sideEffects: workspace.sideEffects,
    exports: exportBindingsObject(buildPublishExportMap(discovered)),
    peerDependencies: publishedPeerDependencies(),
    peerDependenciesMeta: workspace.peerDependenciesMeta,
    dependencies: publishedDependencies(workspace.dependencies),
    publishConfig: { access: "public" },
  };
  if (release !== undefined) {
    published.elmeraRelease = { commit: release.commit, channel: release.channel };
  }

  writePublishPackageJson(join(packageRoot, "dist/package.json"), published);
  copyFileSync(licensePath, join(packageRoot, "dist/LICENSE"));
  copyTwemojiNotices(packageRoot, join(packageRoot, "dist"));
  if (existsSync(readmePath)) {
    copyFileSync(readmePath, join(packageRoot, "dist/README.md"));
  }
  writeFileSync(
    join(packageRoot, "dist/.npmignore"),
    `# published package root — include the built tree\n${ARTIFACTS_DIR}\n`
  );
}
