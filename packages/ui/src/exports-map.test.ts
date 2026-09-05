import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  BARE_COMPONENT_ENTRIES,
  DEFERRED_ENTRIES,
  discoverEntries,
  TOOLING_ONLY_JS_ENTRIES,
  unexpectedJsEntryFiles,
  uniqueBarrelRuntimeExports,
} from "../scripts/entries";
import {
  buildPublishExportMap,
  buildSourceExportMap,
  exportBindingsObject,
  exportBindingTarget,
  renderRootBarrel,
} from "../scripts/generate-exports";
import { parseFacadeValueExports } from "../scripts/parse-facade";
import { BESPOKE_ICON_NAMES, LOGO_NAMES, PHOSPHOR_ICON_NAMES } from "./icons/roster";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("exports map", () => {
  const discovered = discoverEntries(packageRoot);
  const sourceExports = buildSourceExportMap(discovered);
  const publishExports = buildPublishExportMap(discovered);

  it("is generated from discovered source entries, not a hand-maintained list of files", () => {
    expect(discovered.jsEntries.map((entry) => entry.subpath)).toEqual([
      ".",
      "theme",
      "icons",
      "illustrations",
      "flags",
      "button",
      "field",
      "input",
      "input-group",
      "item",
      "scroll-area",
      "separator",
      "textarea",
    ]);
    expect(unexpectedJsEntryFiles(packageRoot)).toEqual([]);
  });

  it("asserts the deferred list and the shipped bare-component count separately", () => {
    expect(DEFERRED_ENTRIES).toEqual(["chart"]);
    expect(BARE_COMPONENT_ENTRIES).toHaveLength(9);
    const shippedBare = discovered.jsEntries.filter(
      (entry) => entry.inRootBarrel && entry.subpath !== "." && entry.subpath !== "theme"
    );
    expect(shippedBare).toHaveLength(BARE_COMPONENT_ENTRIES.length - DEFERRED_ENTRIES.length);
    expect(shippedBare.map((entry) => entry.subpath)).not.toContain("chart");
    expect(exportBindingTarget(sourceExports, "./chart")).toBeUndefined();
    expect(exportBindingTarget(publishExports, "./chart")).toBeUndefined();
  });

  it("always includes the CSS dual-mode entries and /theme", () => {
    expect(exportBindingTarget(sourceExports, "./css")).toBe("./src/styles/ui.css");
    expect(exportBindingTarget(sourceExports, "./demo-stage-comfortable.css")).toBe(
      "./dist/demo-stage-comfortable.css"
    );
    expect(exportBindingTarget(sourceExports, "./themes.css")).toBe("./dist/themes.css");
    expect(exportBindingTarget(sourceExports, "./styles.css")).toBe("./dist/styles.css");
    expect(exportBindingTarget(sourceExports, "./theme")).toEqual({
      types: "./src/theme.ts",
      import: "./src/theme.ts",
    });
    expect(exportBindingTarget(sourceExports, ".")).toEqual({
      types: "./src/index.ts",
      import: "./src/index.ts",
    });
    expect(exportBindingTarget(sourceExports, "./icons")).toEqual({
      types: "./src/icons.ts",
      import: "./src/icons.ts",
    });
    expect(exportBindingTarget(sourceExports, "./button")).toEqual({
      types: "./src/button.ts",
      import: "./src/button.ts",
    });
    expect(exportBindingTarget(sourceExports, "./scroll-area")).toEqual({
      types: "./src/scroll-area.ts",
      import: "./src/scroll-area.ts",
    });
    expect(exportBindingTarget(sourceExports, "./flags")).toEqual({
      types: "./src/flags.ts",
      import: "./src/flags.ts",
    });
    expect(exportBindingTarget(sourceExports, "./flags/*.svg")).toBe("./src/flags/*.svg");
    expect(exportBindingTarget(sourceExports, "./illustrations")).toEqual({
      types: "./src/illustrations.ts",
      import: "./src/illustrations.ts",
    });
  });

  it("does not use a custom source or development export condition", () => {
    const serialized = JSON.stringify(sourceExports);
    expect(serialized).not.toContain('"source"');
    expect(serialized).not.toContain('"development"');
  });

  it("maps the published layout to package-root files, not nested dist/", () => {
    expect(exportBindingTarget(publishExports, "./theme")).toEqual({
      types: "./theme.d.ts",
      import: "./theme.js",
    });
    expect(exportBindingTarget(publishExports, ".")).toEqual({
      types: "./index.d.ts",
      import: "./index.js",
    });
    expect(exportBindingTarget(publishExports, "./icons")).toEqual({
      types: "./icons.d.ts",
      import: "./icons.js",
    });
    expect(exportBindingTarget(publishExports, "./button")).toEqual({
      types: "./button.d.ts",
      import: "./button.js",
    });
    expect(exportBindingTarget(publishExports, "./scroll-area")).toEqual({
      types: "./scroll-area.d.ts",
      import: "./scroll-area.js",
    });
    expect(exportBindingTarget(publishExports, "./flags")).toEqual({
      types: "./flags.d.ts",
      import: "./flags.js",
    });
    expect(exportBindingTarget(publishExports, "./flags/*.svg")).toBe("./flags/*.svg");
    expect(exportBindingTarget(publishExports, "./illustrations")).toEqual({
      types: "./illustrations.d.ts",
      import: "./illustrations.js",
    });
    expect(exportBindingTarget(publishExports, "./css")).toBe("./styles/ui.css");
    expect(exportBindingTarget(publishExports, "./demo-stage-comfortable.css")).toBe(
      "./demo-stage-comfortable.css"
    );
    expect(exportBindingTarget(publishExports, "./themes.css")).toBe("./themes.css");
    expect(exportBindingTarget(publishExports, "./styles.css")).toBe("./styles.css");
    expect(JSON.stringify(publishExports)).not.toContain("/dist/");
  });

  it("keeps the committed package.json exports in sync with the generator", () => {
    const parsed: unknown = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
    if (parsed === null || Array.isArray(parsed)) {
      throw new Error("package.json is not an object");
    }
    // SAFETY: this test only reads the generated exports map and publishConfig.
    const pkg = parsed as {
      exports: ReturnType<typeof exportBindingsObject>;
      publishConfig: { directory: string; linkDirectory: boolean };
    };
    expect(pkg.exports).toEqual(exportBindingsObject(sourceExports));
    expect(pkg.publishConfig.directory).toBe("dist");
    expect(pkg.publishConfig.linkDirectory).toBe(false);
  });

  it("re-exports the theme API from the root barrel and the /theme entry", () => {
    const theme = discovered.jsEntries.find((entry) => entry.subpath === "theme");
    const root = discovered.jsEntries.find((entry) => entry.subpath === ".");
    expect(theme?.runtimeExports).toEqual(
      parseFacadeValueExports("src/theme.ts", readFileSync(join(packageRoot, "src/theme.ts"), "utf8"))
    );
    expect(theme?.runtimeExports).toContain("BRAND_CODES");
    expect(theme?.runtimeExports).toContain("isBrandCode");
    expect(theme?.runtimeExports).toContain("THEME_VARIANTS");
    expect(theme?.runtimeExports).toContain("THEME_SEGMENTS");
    expect(theme?.runtimeExports).toContain("LEGAL_THEMES");
    expect(theme?.runtimeExports).not.toContain("composeTheme");
    expect(theme?.runtimeExports).not.toContain("TOKEN_NAMES");
    expect(theme?.runtimeExports).not.toContain("PRIMITIVES");
    expect(theme?.runtimeExports).toContain("ThemeProvider");
    expect(theme?.runtimeExports).toContain("coerceTheme");
    expect(theme?.runtimeExports).toContain("themeAttributes");
    expect(theme?.runtimeExports).toContain("defaultDensityForVariant");
    expect(theme?.runtimeExports).toContain("densityAttributes");
    expect(theme?.runtimeExports).toContain("ColorSchemeScript");
    expect(theme?.runtimeExports).toContain("ForceColorScheme");
    expect(theme?.runtimeExports).toContain("colorSchemeScriptSource");
    expect(root?.runtimeExports).toEqual(uniqueBarrelRuntimeExports(discovered.jsEntries));
    expect(root?.runtimeExports).toContain("Button");
    expect(root?.runtimeExports).toContain("buttonVariants");
    expect(root?.runtimeExports).toContain("ScrollArea");
    expect(root?.runtimeExports).toContain("ThemeProvider");
    expect(root?.runtimeExports).toContain("LEGAL_THEMES");
    expect(root?.runtimeExports).not.toContain("composeTheme");
  });

  it("exposes a workspace-only theme-catalog tooling entry that is not published", () => {
    expect(TOOLING_ONLY_JS_ENTRIES).toEqual([
      { subpath: "theme-catalog", sourceFile: "src/theme/catalog.ts" },
    ]);
    expect(exportBindingTarget(sourceExports, "./theme-catalog")).toEqual({
      types: "./src/theme/catalog.ts",
      import: "./src/theme/catalog.ts",
    });
    expect(exportBindingTarget(publishExports, "./theme-catalog")).toBeUndefined();
    expect(discovered.jsEntries.map((entry) => entry.subpath)).not.toContain("theme-catalog");
    const catalog = parseFacadeValueExports(
      "src/theme/catalog.ts",
      readFileSync(join(packageRoot, "src/theme/catalog.ts"), "utf8")
    );
    expect(catalog).toEqual([
      "composeTheme",
      "oklchToLinearSrgb",
      "parseOklch",
      "defaultDensityForVariant",
      "densityAttributes",
      "themeAttributes",
      "TOKEN_NAMES",
      "PRIMITIVE_NAMES",
      "PRIMITIVES",
      "LEGAL_THEMES",
      "themeSlug",
    ]);
    expect(catalog).not.toContain("ThemeProvider");
    expect(catalog).not.toContain("ColorSchemeScript");
  });

  it("publishes Button and buttonVariants from /button and the root barrel", () => {
    const button = discovered.jsEntries.find((entry) => entry.subpath === "button");
    expect(button?.inRootBarrel).toBe(true);
    expect(button?.runtimeExports).toEqual(["Button", "buttonVariants"]);
  });

  it("publishes ScrollArea from /scroll-area and the root barrel", () => {
    const scrollArea = discovered.jsEntries.find((entry) => entry.subpath === "scroll-area");
    expect(scrollArea?.inRootBarrel).toBe(true);
    expect(scrollArea?.runtimeExports).toEqual(["ScrollArea"]);
  });

  it("publishes the Wave 3 spine entries from the barrel", () => {
    const separator = discovered.jsEntries.find((entry) => entry.subpath === "separator");
    const field = discovered.jsEntries.find((entry) => entry.subpath === "field");
    const item = discovered.jsEntries.find((entry) => entry.subpath === "item");
    const input = discovered.jsEntries.find((entry) => entry.subpath === "input");
    const textarea = discovered.jsEntries.find((entry) => entry.subpath === "textarea");
    expect(separator?.inRootBarrel).toBe(true);
    expect(separator?.runtimeExports).toEqual(["Separator"]);
    expect(field?.inRootBarrel).toBe(true);
    expect(field?.runtimeExports).toEqual(["Field"]);
    expect(item?.inRootBarrel).toBe(true);
    expect(item?.runtimeExports).toEqual(["Item", "itemVariants"]);
    expect(input?.inRootBarrel).toBe(true);
    expect(input?.runtimeExports).toEqual(["Input"]);
    expect(textarea?.inRootBarrel).toBe(true);
    expect(textarea?.runtimeExports).toEqual(["Textarea"]);
  });

  it("publishes InputGroup from /input-group and the root barrel with private recipes", () => {
    const inputGroup = discovered.jsEntries.find((entry) => entry.subpath === "input-group");
    expect(inputGroup?.inRootBarrel).toBe(true);
    expect(inputGroup?.runtimeExports).toEqual(["InputGroup"]);
  });

  it("keeps /icons as a subpath-only entry with the curated roster", () => {
    const icons = discovered.jsEntries.find((entry) => entry.subpath === "icons");
    expect(icons?.inRootBarrel).toBe(false);
    expect(icons?.runtimeExports).toEqual([
      ...PHOSPHOR_ICON_NAMES,
      ...BESPOKE_ICON_NAMES,
      ...LOGO_NAMES,
      "BrandLogo",
    ]);
    expect(icons?.runtimeExports).not.toContain("Icon");
  });

  it("keeps /illustrations as a subpath-only entry with FkasMeter", () => {
    const illustrations = discovered.jsEntries.find((entry) => entry.subpath === "illustrations");
    expect(illustrations?.inRootBarrel).toBe(false);
    expect(illustrations?.runtimeExports).toEqual(["FkasMeter"]);
  });

  it("keeps the committed root barrel in sync with the generator", () => {
    const committed = readFileSync(join(packageRoot, "src/index.ts"), "utf8");
    expect(committed).toEqual(renderRootBarrel(discovered));
  });

  it("does not hardcode component runtime-export lists in entries.ts", () => {
    // Source-grep: absence of hardcoded lists has no packed-export probe beyond package-check.
    const source = readFileSync(join(packageRoot, "scripts/entries.ts"), "utf8");
    expect(source).not.toContain("BUTTON_RUNTIME_EXPORTS");
    expect(source).not.toContain("SCROLL_AREA_RUNTIME_EXPORTS");
    expect(source).not.toContain('["Button", "buttonVariants"]');
    expect(source).not.toContain('["ScrollArea"]');
  });
});
