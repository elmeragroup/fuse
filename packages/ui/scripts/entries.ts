import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PHOSPHOR_ICON_NAMES } from "../src/icons/roster.ts";

/** Appendix A — 56 bare component entries. */
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
] as const;

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

export const CSS_ENTRY_NAMES = ["css", "styles.css", "themes.css"] as const;

export const THEME_RUNTIME_EXPORTS = [
  "BRANDS",
  "ColorSchemeScript",
  "ElmeraGroupUiProvider",
  "ForceColorScheme",
  "ThemeProvider",
  "ThemeScope",
  "colorSchemeScriptSource",
  "parseThemeSlug",
  "themeAttributes",
  "themeSlug",
  "useColorScheme",
  "useElmeraGroupUi",
  "useTheme",
  "validateTheme",
] as const;

/** architecture.md §6 packages that published JS is allowed to import. */
export const runtimeDependencies = [
  "react",
  "react-dom",
  "@base-ui/react",
  "clsx",
  "tailwind-merge",
  "tailwind-variants",
  "recharts",
  "react-aria-components",
  "react-aria",
  "@internationalized/date",
  "@phosphor-icons/react",
  "@internationalized/string",
  "libphonenumber-js",
  "sugar-high",
] as const;

export const PUBLISHED_PEER_RANGES = {
  react: "^19",
  "react-dom": "^19",
  tailwindcss: "^4",
  recharts: "^2.15.4",
} as const;

export const PUBLISHED_DEPENDENCY_RANGES = {
  "@base-ui/react": "1.6.0",
  clsx: "^2.1.1",
  "tailwind-merge": "^3.6.0",
  "tailwind-variants": "^3.2.2",
  "tailwindcss-react-aria-components": "2.2.0",
  "tw-animate-css": "^1.4.0",
  "react-aria-components": "1.19.0",
  "react-aria": "3.50.0",
  "@internationalized/date": "^3.12.2",
  "@phosphor-icons/react": "2.1.10",
  "@internationalized/string": "^3.2.10",
  "libphonenumber-js": "^1.13.9",
  "sugar-high": "^1.2.1",
} as const;

const REQUIRED_JS_SUBPATHS: readonly string[] = [".", "theme"];

function isBareComponent(subpath: string): boolean {
  for (const name of BARE_COMPONENT_ENTRIES) {
    if (name === subpath) {
      return true;
    }
  }
  return false;
}
const IMPLEMENTATION_DIRECTORIES = new Set(["components", "hooks", "icons", "styles", "theme", "react-aria"]);

const BUTTON_RUNTIME_EXPORTS = ["Button", "buttonVariants"] as const;
const SCROLL_AREA_RUNTIME_EXPORTS = ["ScrollArea"] as const;
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

export function packageRootFromScript(scriptUrl: string): string {
  return join(dirname(fileURLToPath(scriptUrl)), "..");
}

export function toPosix(path: string): string {
  return path.replaceAll("\\", "/");
}

export function isSkippedSourceFile(relativePath: string): boolean {
  const posix = toPosix(relativePath);
  if (posix.includes("/__snapshots__/") || posix.includes("/demos/")) {
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

export function unexpectedJsEntryFiles(packageRoot: string): string[] {
  const allow = canonicalJsAllowlist();
  const unexpected: string[] = [];
  const srcRoot = join(packageRoot, "src");
  if (!existsSync(srcRoot)) {
    return unexpected;
  }

  for (const entry of readdirSync(srcRoot)) {
    const fullPath = join(srcRoot, entry);
    const stat = statSync(fullPath);
    if (stat.isFile()) {
      if (!SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
        continue;
      }
      if (isSkippedSourceFile(`src/${entry}`)) {
        continue;
      }
      const baseName = entry.replace(/\.(tsx|ts|jsx|js)$/u, "");
      const subpath = baseName === "index" ? "." : baseName;
      if (!allow.has(subpath)) {
        unexpected.push(toPosix(`src/${entry}`));
      }
      continue;
    }
    if (!stat.isDirectory() || IMPLEMENTATION_DIRECTORIES.has(entry)) {
      continue;
    }
    const index = resolveExistingSource(packageRoot, `src/${entry}`);
    if (index?.startsWith(`src/${entry}/`) && !allow.has(entry)) {
      unexpected.push(index);
    }
  }

  const racRoot = join(srcRoot, "react-aria");
  if (!existsSync(racRoot) || !statSync(racRoot).isDirectory()) {
    return unexpected;
  }
  for (const entry of readdirSync(racRoot)) {
    const fullPath = join(racRoot, entry);
    const stat = statSync(fullPath);
    if (stat.isFile()) {
      if (!SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
        continue;
      }
      if (isSkippedSourceFile(`src/react-aria/${entry}`)) {
        continue;
      }
      const baseName = entry.replace(/\.(tsx|ts|jsx|js)$/u, "");
      if (!allow.has(`react-aria/${baseName}`)) {
        unexpected.push(toPosix(`src/react-aria/${entry}`));
      }
      continue;
    }
    if (!stat.isDirectory()) {
      continue;
    }
    const index = resolveExistingSource(packageRoot, `src/react-aria/${entry}`);
    if (index?.startsWith(`src/react-aria/${entry}/`) && !allow.has(`react-aria/${entry}`)) {
      unexpected.push(index);
    }
  }
  return unexpected;
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

function runtimeExportsFor(subpath: string): readonly string[] {
  if (subpath === "theme") {
    return THEME_RUNTIME_EXPORTS;
  }
  if (subpath === ".") {
    return [...THEME_RUNTIME_EXPORTS, ...BUTTON_RUNTIME_EXPORTS, ...SCROLL_AREA_RUNTIME_EXPORTS];
  }
  if (subpath === "icons") {
    return PHOSPHOR_ICON_NAMES;
  }
  if (subpath === "button") {
    return BUTTON_RUNTIME_EXPORTS;
  }
  if (subpath === "scroll-area") {
    return SCROLL_AREA_RUNTIME_EXPORTS;
  }
  return [];
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
  const rawCss = "src/styles/ui.css";
  if (!fileExists(join(packageRoot, rawCss))) {
    throw new Error(`Missing required CSS source ${rawCss}`);
  }
  return [
    { subpath: "css", sourceFile: rawCss, publishFile: "styles/ui.css" },
    { subpath: "styles.css", sourceFile: "dist/styles.css", publishFile: "styles.css" },
    { subpath: "themes.css", sourceFile: "dist/themes.css", publishFile: "themes.css" },
  ];
}

function flagAssetPattern(packageRoot: string): AssetPatternExport | undefined {
  const sourceDir = join(packageRoot, "src/flags");
  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
    return undefined;
  }
  const svgs = readdirSync(sourceDir).filter((name) => name.endsWith(".svg"));
  if (svgs.length === 0) {
    return undefined;
  }
  return {
    subpath: "flags/*.svg",
    sourceFile: "src/flags/*.svg",
    publishFile: "flags/*.svg",
  };
}

export function discoverEntries(packageRoot: string): DiscoveredEntries {
  const unexpected = unexpectedJsEntryFiles(packageRoot);
  if (unexpected.length > 0) {
    throw new Error(
      `Unexpected public entry files (not in architecture Appendix A): ${unexpected.join(", ")}`
    );
  }

  const jsEntries: JsExportEntry[] = [];
  const seenSubpaths = new Set<string>();
  const allow = [
    ...NON_COMPONENT_JS_ENTRIES,
    ...BARE_COMPONENT_ENTRIES,
    ...RAC_ENTRIES.map((name) => `react-aria/${name}`),
  ];

  for (const subpath of allow) {
    const sourceFile = resolveJsSource(packageRoot, subpath);
    if (sourceFile === undefined) {
      if (REQUIRED_JS_SUBPATHS.includes(subpath)) {
        throw new Error(`Missing required source entry for ${subpath}`);
      }
      continue;
    }
    if (seenSubpaths.has(subpath)) {
      throw new Error(`Duplicate public entry ${subpath}`);
    }
    seenSubpaths.add(subpath);
    jsEntries.push({
      subpath,
      sourceFile,
      runtimeExports: runtimeExportsFor(subpath),
      inRootBarrel: subpath === "." || subpath === "theme" || isBareComponent(subpath),
    });
  }

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
