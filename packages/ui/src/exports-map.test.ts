import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { BARE_COMPONENT_ENTRIES, discoverEntries, unexpectedJsEntryFiles } from "../scripts/entries";
import {
  buildPublishExportMap,
  buildSourceExportMap,
  exportBindingsObject,
  exportBindingTarget,
} from "../scripts/generate-exports";
import { PHOSPHOR_ICON_NAMES } from "./icons/roster";

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
      "button",
      "scroll-area",
    ]);
    expect(unexpectedJsEntryFiles(packageRoot)).toEqual([]);
    expect(BARE_COMPONENT_ENTRIES).toHaveLength(56);
  });

  it("always includes the CSS dual-mode entries and /theme", () => {
    expect(exportBindingTarget(sourceExports, "./css")).toBe("./src/styles/ui.css");
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
  });

  it("does not invent component entries before their source files exist", () => {
    expect(exportBindingTarget(sourceExports, "./illustrations")).toBeUndefined();
    expect(exportBindingTarget(sourceExports, "./react-aria/calendar")).toBeUndefined();
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
    expect(exportBindingTarget(publishExports, "./css")).toBe("./styles/ui.css");
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
    expect(theme?.runtimeExports).toContain("ThemeProvider");
    expect(theme?.runtimeExports).toContain("themeAttributes");
    expect(theme?.runtimeExports).toContain("ColorSchemeScript");
    expect(theme?.runtimeExports).toContain("ForceColorScheme");
    expect(theme?.runtimeExports).toContain("colorSchemeScriptSource");
    expect(root?.runtimeExports).toEqual([
      ...(theme?.runtimeExports ?? []),
      "Button",
      "buttonVariants",
      "ScrollArea",
    ]);
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

  it("keeps /icons as a subpath-only entry with the curated roster", () => {
    const icons = discovered.jsEntries.find((entry) => entry.subpath === "icons");
    expect(icons?.inRootBarrel).toBe(false);
    expect(icons?.runtimeExports).toEqual([...PHOSPHOR_ICON_NAMES, "BrandLogo"]);
    expect(icons?.runtimeExports).not.toContain("Icon");
  });
});
