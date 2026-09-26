import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

import { BESPOKE_ICON_NAMES, LOGO_NAMES, PHOSPHOR_ICON_NAMES } from "../src/icons/roster.ts";
import { requireFlagsDirectory } from "./flag-assets.ts";
import { parseFacadeValueExports } from "./parse-facade.ts";
import { packageRootFromScript, toPosix } from "./paths.ts";

/** Public bare component entries, including explicitly deferred entries below. */
export const BARE_COMPONENT_ENTRIES = [
  "accordion",
  "alert",
  "alert-dialog",
  "avatar",
  "badge",
  "breadcrumb",
  "button",
  "button-group",
  "card",
  "chart",
  "checkbox",
  "checkbox-card",
  "code",
  "collapsible",
  "combobox",
  "confirm-button",
  "description-list",
  "dialog",
  "dropdown-menu",
  "emoji",
  "empty",
  "field",
  "frame",
  "heading",
  "input",
  "input-group",
  "item",
  "loader",
  "meter",
  "number-field",
  "pagination",
  "phone-number-field",
  "popover",
  "popover-info-button",
  "radio-group",
  "scroll-area",
  "select",
  "selection-item",
  "separator",
  "sheet",
  "show",
  "sidebar",
  "skeleton",
  "span",
  "switch",
  "table",
  "tabs",
  "text",
  "text-field",
  "textarea",
  "textarea-field",
  "timeline-list",
  "toast",
  "toggle",
  "toggle-group",
  "tooltip",
  // plop:component-entry
] as const;

/**
 * Allowlisted entries with no source until they ship.
 * Chart stays deferred until a consuming product needs it; see the root TODO.md.
 */
export const DEFERRED_ENTRIES = ["chart"] as const;

/** Appendix A — 11 quarantined react-aria interim entries. */
export const RAC_ENTRIES = [
  "calendar",
  "date-field",
  "date-picker",
  "date-range-picker",
  "file-trigger",
  "focusable",
  "grid-list",
  "link",
  "range-calendar",
  "search-field",
  "ui-providers",
] as const;

export const NON_COMPONENT_JS_ENTRIES = [".", "theme", "icons", "illustrations", "flags"] as const;

/**
 * In-repo `package.json#exports` only. Neither packed nor in the root barrel.
 */
export const TOOLING_ONLY_JS_ENTRIES = [
  { subpath: "theme-catalog", sourceFile: "src/theme/catalog.ts" },
] as const;

/**
 * In-repo `package.json#exports` only. `build-css` writes each `distFile` into `dist/` beside the
 * published CSS, and the publish `.npmignore` lists the same `distFile`s to keep them out of the tarball.
 */
export const TOOLING_ONLY_CSS_ENTRIES = [
  // The docs' demo stage previews comfortable density; no consumer surface depends on it.
  { subpath: "demo-stage-comfortable.css", distFile: "demo-stage-comfortable.css" },
] as const;

export const CSS_ENTRY_NAMES = ["css", "styles.css", "themes.css"] as const;

/** Runtime packages that published JS is allowed to import. */
export const runtimeDependencies = [
  "react",
  "react-dom",
  "@base-ui/react",
  "clsx",
  "tailwind-merge",
  "tailwind-variants",
  "react-aria-components",
  "react-aria",
  "@internationalized/date",
  "@phosphor-icons/react",
  "@internationalized/string",
  "sugar-high",
  "libphonenumber-js",
] as const;

export const PUBLISHED_PEER_RANGES = {
  react: "^19",
  "react-dom": "^19",
  tailwindcss: "^4",
} as const;

export const PUBLISHED_DEPENDENCY_RANGES = {
  "@base-ui/react": "1.8.0",
  clsx: "^2.1.1",
  "tailwind-merge": "^3.6.0",
  "tailwind-variants": "^3.2.2",
  "tailwindcss-react-aria-components": "2.2.0",
  "tw-animate-css": "^1.4.0",
  "react-aria-components": "1.21.1",
  "react-aria": "3.52.1",
  "@internationalized/date": "^3.12.2",
  "@phosphor-icons/react": "2.1.10",
  "@internationalized/string": "^3.2.10",
  "libphonenumber-js": "^1.13.9",
  "sugar-high": "^2.4.0",
} as const;

function isBareComponent(subpath: string): boolean {
  for (const name of BARE_COMPONENT_ENTRIES) {
    if (name === subpath) {
      return true;
    }
  }
  return false;
}

export function isDeferredEntry(subpath: string, deferred: readonly string[] = DEFERRED_ENTRIES): boolean {
  return deferred.includes(subpath);
}
const IMPLEMENTATION_DIRECTORIES = new Set(["components", "hooks", "icons", "styles", "theme", "react-aria"]);

const RELATIVE_IMPORT = /(?:import|export)(?:\s+type)?\s+(?:[^'"\n;]*?\sfrom\s+)?["'](\.[^"']+)["']/g;
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"] as const;

export type JsExportEntry = {
  subpath: string;
  sourceFile: string;
  runtimeExports: readonly string[];
  inRootBarrel: boolean;
};

export type CssExportEntry = {
  subpath: string;
  sourceFile: string;
  publishFile: string;
};

export type AssetPatternExport = {
  subpath: string;
  sourceFile: string;
  publishFile: string;
};

export type ExportCondition = {
  types: string;
  import: string;
};

export type DiscoveredEntries = {
  jsEntries: JsExportEntry[];
  cssEntries: CssExportEntry[];
  assetPatterns: AssetPatternExport[];
  sourceFiles: string[];
};

export function isSkippedSourceFile(relativePath: string): boolean {
  const posix = toPosix(relativePath);
  if (posix.includes("/__snapshots__/")) {
    return true;
  }
  return (
    posix.endsWith(".test.ts") ||
    posix.endsWith(".test.tsx") ||
    posix.endsWith(".browser.test.tsx") ||
    posix.endsWith(".test-d.tsx") ||
    posix.includes(".stories.") ||
    posix.includes(".demo.")
  );
}

function fileExists(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

function resolveExistingSource(packageRoot: string, relativeWithoutExt: string): string | undefined {
  for (const extension of SOURCE_EXTENSIONS) {
    const candidate = `${relativeWithoutExt}${extension}`;
    if (fileExists(join(packageRoot, candidate))) {
      return toPosix(candidate);
    }
  }
  for (const extension of SOURCE_EXTENSIONS) {
    const candidate = `${relativeWithoutExt}/index${extension}`;
    if (fileExists(join(packageRoot, candidate))) {
      return toPosix(candidate);
    }
  }
  return undefined;
}

function canonicalJsAllowlist(): Set<string> {
  const allow = new Set<string>(NON_COMPONENT_JS_ENTRIES);
  for (const name of BARE_COMPONENT_ENTRIES) {
    allow.add(name);
  }
  for (const name of RAC_ENTRIES) {
    allow.add(`react-aria/${name}`);
  }
  return allow;
}

function collectUnexpectedJsFiles(
  packageRoot: string,
  relativeDir: string,
  allow: Set<string>,
  toSubpath: (baseName: string) => string,
  skipDirectory: (name: string) => boolean
): string[] {
  const unexpected: string[] = [];
  const dir = join(packageRoot, relativeDir);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return unexpected;
  }

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    const relativePath = `${relativeDir}/${entry}`;
    if (stat.isFile()) {
      if (!SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
        continue;
      }
      if (isSkippedSourceFile(relativePath)) {
        continue;
      }
      const baseName = entry.replace(/\.(tsx|ts|jsx|js)$/u, "");
      if (!allow.has(toSubpath(baseName))) {
        unexpected.push(toPosix(relativePath));
      }
      continue;
    }
    if (!stat.isDirectory() || skipDirectory(entry)) {
      continue;
    }
    const index = resolveExistingSource(packageRoot, relativePath);
    if (index?.startsWith(`${relativeDir}/${entry}/`) && !allow.has(toSubpath(entry))) {
      unexpected.push(index);
    }
  }
  return unexpected;
}

export function unexpectedJsEntryFiles(packageRoot: string): string[] {
  const allow = canonicalJsAllowlist();
  return [
    ...collectUnexpectedJsFiles(
      packageRoot,
      "src",
      allow,
      (baseName) => (baseName === "index" ? "." : baseName),
      (name) => IMPLEMENTATION_DIRECTORIES.has(name)
    ),
    ...collectUnexpectedJsFiles(
      packageRoot,
      "src/react-aria",
      allow,
      (baseName) => `react-aria/${baseName}`,
      () => false
    ),
  ];
}

function resolveJsSource(packageRoot: string, subpath: string): string | undefined {
  if (subpath === ".") {
    return resolveExistingSource(packageRoot, "src/index");
  }
  if (subpath.startsWith("react-aria/")) {
    return resolveExistingSource(packageRoot, `src/${subpath}`);
  }
  return resolveExistingSource(packageRoot, `src/${subpath}`);
}

function iconRuntimeExports(): readonly string[] {
  return [...PHOSPHOR_ICON_NAMES, ...BESPOKE_ICON_NAMES, ...LOGO_NAMES, "BrandLogo"];
}

function sortedNames(names: readonly string[]): string[] {
  return [...names].toSorted((left, right) => left.localeCompare(right));
}

function facadeRuntimeExports(subpath: string, sourceFile: string, packageRoot: string): readonly string[] {
  const parsed = parseFacadeValueExports(sourceFile, readFileSync(join(packageRoot, sourceFile), "utf8"));
  if (subpath === "icons") {
    const roster = iconRuntimeExports();
    if (sortedNames(parsed).join("\0") !== sortedNames(roster).join("\0")) {
      throw new Error(
        `${sourceFile} facade exports do not match the icons roster (parse the facade, do not ignore it)`
      );
    }
    return roster;
  }
  return parsed;
}

function barrelCollisionMessage(name: string, firstSubpath: string, secondSubpath: string): string {
  return `Duplicate barrel export ${name} from ${firstSubpath} and ${secondSubpath}`;
}

function uniqueBarrelRuntimeExports(jsEntries: readonly JsExportEntry[]): string[] {
  const ownerByName = new Map<string, string>();
  const names: string[] = [];
  for (const entry of jsEntries) {
    if (!entry.inRootBarrel || entry.subpath === ".") {
      continue;
    }
    for (const name of entry.runtimeExports) {
      const owner = ownerByName.get(name);
      if (owner !== undefined) {
        throw new Error(barrelCollisionMessage(name, owner, entry.subpath));
      }
      ownerByName.set(name, entry.subpath);
      names.push(name);
    }
  }
  return names.toSorted((left, right) => left.localeCompare(right));
}

function walkImportedSourceFiles(packageRoot: string, entryFiles: readonly string[]): string[] {
  const pending = [...entryFiles];
  const seen = new Set<string>();

  while (pending.length > 0) {
    const relativePath = pending.pop();
    if (relativePath === undefined || seen.has(relativePath) || isSkippedSourceFile(relativePath)) {
      continue;
    }
    seen.add(relativePath);
    const absolute = join(packageRoot, relativePath);
    if (!fileExists(absolute)) {
      throw new Error(`Missing source file ${relativePath}`);
    }
    const text = readFileSync(absolute, "utf8");
    const directory = dirname(relativePath);
    RELATIVE_IMPORT.lastIndex = 0;
    for (const match of text.matchAll(RELATIVE_IMPORT)) {
      const specifier = match[1];
      if (specifier === undefined || specifier.endsWith(".css")) {
        continue;
      }
      const resolvedWithoutExt = toPosix(join(directory, specifier));
      if (resolvedWithoutExt.startsWith("src/") === false && resolvedWithoutExt !== "src") {
        continue;
      }
      const resolved = resolveExistingSource(packageRoot, resolvedWithoutExt);
      if (resolved === undefined) {
        throw new Error(`Cannot resolve ${specifier} from ${relativePath}`);
      }
      if (!seen.has(resolved)) {
        pending.push(resolved);
      }
    }
  }

  return [...seen].toSorted((left, right) => left.localeCompare(right));
}

function cssEntries(packageRoot: string): CssExportEntry[] {
  const rawCss = "src/styles/fuse.css";
  if (!fileExists(join(packageRoot, rawCss))) {
    throw new Error(`Missing required CSS source ${rawCss}`);
  }
  return [
    { subpath: "css", sourceFile: rawCss, publishFile: "styles/fuse.css" },
    { subpath: "styles.css", sourceFile: "dist/styles.css", publishFile: "styles.css" },
    { subpath: "themes.css", sourceFile: "dist/themes.css", publishFile: "themes.css" },
  ];
}

function flagAssetPattern(packageRoot: string): AssetPatternExport | undefined {
  if (requireFlagsDirectory(join(packageRoot, "src/flags")) === "missing") {
    return undefined;
  }
  return {
    subpath: "flags/*.svg",
    sourceFile: "src/flags/*.svg",
    publishFile: "flags/*.svg",
  };
}

export function discoverJsEntriesFromAllowlist(
  packageRoot: string,
  allow: readonly string[],
  deferred: readonly string[] = DEFERRED_ENTRIES
): JsExportEntry[] {
  const jsEntries: JsExportEntry[] = [];
  const seenSubpaths = new Set<string>();
  let rootSourceFile: string | undefined;

  for (const subpath of allow) {
    if (isDeferredEntry(subpath, deferred)) {
      continue;
    }
    const sourceFile = resolveJsSource(packageRoot, subpath);
    if (sourceFile === undefined) {
      throw new Error(`Missing source entry for ${subpath}`);
    }
    if (seenSubpaths.has(subpath)) {
      throw new Error(`Duplicate public entry ${subpath}`);
    }
    seenSubpaths.add(subpath);
    if (subpath === ".") {
      rootSourceFile = sourceFile;
      continue;
    }
    jsEntries.push({
      subpath,
      sourceFile,
      runtimeExports: facadeRuntimeExports(subpath, sourceFile, packageRoot),
      inRootBarrel: subpath === "theme" || isBareComponent(subpath),
    });
  }

  if (rootSourceFile === undefined) {
    throw new Error("Missing source entry for .");
  }
  jsEntries.unshift({
    subpath: ".",
    sourceFile: rootSourceFile,
    runtimeExports: uniqueBarrelRuntimeExports(jsEntries),
    inRootBarrel: true,
  });
  return jsEntries;
}

export function discoverEntries(packageRoot: string): DiscoveredEntries {
  const unexpected = unexpectedJsEntryFiles(packageRoot);
  if (unexpected.length > 0) {
    throw new Error(
      `Unexpected public entry files (not registered in scripts/entries.ts): ${unexpected.join(", ")}`
    );
  }

  const allow = [
    ...NON_COMPONENT_JS_ENTRIES,
    ...BARE_COMPONENT_ENTRIES,
    ...RAC_ENTRIES.map((name) => `react-aria/${name}`),
  ];
  const jsEntries = discoverJsEntriesFromAllowlist(packageRoot, allow);

  const css = cssEntries(packageRoot);
  const assetPatterns = flagAssetPattern(packageRoot);
  const sourceFiles = walkImportedSourceFiles(
    packageRoot,
    jsEntries.map((entry) => entry.sourceFile)
  );

  return {
    jsEntries,
    cssEntries: css,
    assetPatterns: assetPatterns === undefined ? [] : [assetPatterns],
    sourceFiles,
  };
}

export function exportKey(subpath: string): string {
  return subpath === "." ? "." : `./${subpath}`;
}

export function sourceExportTarget(entry: JsExportEntry): ExportCondition {
  const target = `./${entry.sourceFile}`;
  return { types: target, import: target };
}

export function publishExportTarget(entry: JsExportEntry): ExportCondition {
  const withoutSrc = entry.sourceFile.replace(/^src\//, "");
  const withoutExt = withoutSrc.replace(/\.(tsx|ts|jsx|js)$/u, "");
  return {
    types: `./${withoutExt}.d.ts`,
    import: `./${withoutExt}.js`,
  };
}

export function sourceCssTarget(entry: CssExportEntry): string {
  return `./${entry.sourceFile}`;
}

export function publishCssTarget(entry: CssExportEntry): string {
  return `./${entry.publishFile}`;
}

export const entries = {
  get sourceFiles(): string[] {
    return discoverEntries(packageRootFromScript(import.meta.url)).sourceFiles;
  },
  runtimeDependencies,
};
