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

type WorkspaceScripts = {
  build: string;
  "ci:checks": string;
  pack: string;
  "package:check": string;
  "size-limit": string;
  test: string;
  "test:browser": string;
  "test:types": string;
  "type-check": string;
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

type WorkspaceDevDependencies = {
  "@arethetypeswrong/cli": string;
  "@arethetypeswrong/core": string;
  "@elmeragroup/typescript-config": string;
  "@tailwindcss/cli": string;
  "@types/node": string;
  "@types/react": string;
  "@types/react-dom": string;
  "@vitest/browser-playwright": string;
  "libphonenumber-js": string;
  playwright: string;
  publint: string;
  rolldown: string;
  react: string;
  "react-dom": string;
  tailwindcss: string;
  tsdown: string;
  typescript: string;
  vitest: string;
};

type WorkspaceManifest = {
  name: string;
  version: string;
  private: boolean;
  license: string;
  type: string;
  sideEffects: string[];
  exports: ExportBinding[];
  publishConfig: { directory: string; access: string; linkDirectory: false };
  scripts: WorkspaceScripts;
  peerDependencies: WorkspacePeers;
  peerDependenciesMeta: { tailwindcss: { optional: boolean }; recharts?: { optional: boolean } };
  dependencies: WorkspaceDependencies;
  devDependencies: WorkspaceDevDependencies;
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

function readWorkspaceManifest(path: string): WorkspaceManifest {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (parsed === null || Array.isArray(parsed)) {
    throw new Error(`${path} must be a JSON object`);
  }
  // SAFETY: workspace package.json is the I/O boundary; exports are always regenerated.
  const raw = parsed as Omit<WorkspaceManifest, "exports">;
  return {
    name: requiredString(raw.name, "name"),
    version: requiredString(raw.version, "version"),
    private: raw.private,
    license: requiredString(raw.license, "license"),
    type: requiredString(raw.type, "type"),
    sideEffects: raw.sideEffects,
    exports: [],
    publishConfig: raw.publishConfig,
    scripts: raw.scripts,
    peerDependencies: raw.peerDependencies,
    peerDependenciesMeta: raw.peerDependenciesMeta,
    dependencies: raw.dependencies,
    devDependencies: raw.devDependencies,
  };
}

function writeWorkspacePackageJson(path: string, manifest: WorkspaceManifest): void {
  writeFileSync(
    path,
    `${JSON.stringify({ ...manifest, exports: exportBindingsObject(manifest.exports) }, null, 2)}\n`
  );
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

type PublishManifest = {
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
  const pkg = readWorkspaceManifest(packageJsonPath);
  pkg.exports = buildSourceExportMap(discovered);
  pkg.publishConfig = { directory: "dist", access: "public", linkDirectory: false };
  writeWorkspacePackageJson(packageJsonPath, pkg);
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
    license: workspace.license,
    type: "module",
    sideEffects: ["**/*.css"],
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
