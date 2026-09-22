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
      "accordion",
      "alert",
      "alert-dialog",
      "avatar",
      "badge",
      "breadcrumb",
      "button",
      "button-group",
      "card",
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
      "react-aria/calendar",
      "react-aria/date-field",
      "react-aria/date-picker",
      "react-aria/date-range-picker",
      "react-aria/file-trigger",
      "react-aria/focusable",
      "react-aria/grid-list",
      "react-aria/link",
      "react-aria/range-calendar",
      "react-aria/search-field",
      "react-aria/ui-providers",
    ]);
    expect(unexpectedJsEntryFiles(packageRoot)).toEqual([]);
  });

  it("asserts the deferred list and the shipped bare-component count separately", () => {
    expect(DEFERRED_ENTRIES).toEqual(["chart"]);
    expect(BARE_COMPONENT_ENTRIES).toHaveLength(56);
    const shippedBare = discovered.jsEntries.filter(
      (entry) => entry.inRootBarrel && entry.subpath !== "." && entry.subpath !== "theme"
    );
    expect(shippedBare).toHaveLength(BARE_COMPONENT_ENTRIES.length - DEFERRED_ENTRIES.length);
    expect(shippedBare.map((entry) => entry.subpath)).not.toContain("chart");
    expect(exportBindingTarget(sourceExports, "./chart")).toBeUndefined();
    expect(exportBindingTarget(publishExports, "./chart")).toBeUndefined();
  });

  it("always includes the CSS dual-mode entries and /theme", () => {
    expect(exportBindingTarget(sourceExports, "./css")).toBe("./src/styles/fuse.css");
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

  it("does not invent component entries before their source files exist", () => {
    expect(exportBindingTarget(sourceExports, "./react-aria/calendar")).toEqual({
      types: "./src/react-aria/calendar.ts",
      import: "./src/react-aria/calendar.ts",
    });
    expect(exportBindingTarget(sourceExports, "./react-aria/date-field")).toEqual({
      types: "./src/react-aria/date-field.ts",
      import: "./src/react-aria/date-field.ts",
    });
    expect(exportBindingTarget(sourceExports, "./react-aria/date-picker")).toEqual({
      types: "./src/react-aria/date-picker.ts",
      import: "./src/react-aria/date-picker.ts",
    });
    expect(exportBindingTarget(sourceExports, "./react-aria/date-range-picker")).toEqual({
      types: "./src/react-aria/date-range-picker.ts",
      import: "./src/react-aria/date-range-picker.ts",
    });
    expect(exportBindingTarget(sourceExports, "./react-aria/file-trigger")).toEqual({
      types: "./src/react-aria/file-trigger.ts",
      import: "./src/react-aria/file-trigger.ts",
    });
    expect(exportBindingTarget(sourceExports, "./react-aria/focusable")).toEqual({
      types: "./src/react-aria/focusable.ts",
      import: "./src/react-aria/focusable.ts",
    });
    expect(exportBindingTarget(sourceExports, "./react-aria/grid-list")).toEqual({
      types: "./src/react-aria/grid-list.ts",
      import: "./src/react-aria/grid-list.ts",
    });
    expect(exportBindingTarget(sourceExports, "./react-aria/link")).toEqual({
      types: "./src/react-aria/link.ts",
      import: "./src/react-aria/link.ts",
    });
    expect(exportBindingTarget(sourceExports, "./react-aria/search-field")).toEqual({
      types: "./src/react-aria/search-field.ts",
      import: "./src/react-aria/search-field.ts",
    });
    expect(exportBindingTarget(sourceExports, "./react-aria/range-calendar")).toEqual({
      types: "./src/react-aria/range-calendar.ts",
      import: "./src/react-aria/range-calendar.ts",
    });
    expect(exportBindingTarget(sourceExports, "./react-aria/ui-providers")).toEqual({
      types: "./src/react-aria/ui-providers.ts",
      import: "./src/react-aria/ui-providers.ts",
    });
  });

  it("publishes DateField and DateInput from the quarantined react-aria/date-field entry only", () => {
    const dateField = discovered.jsEntries.find((entry) => entry.subpath === "react-aria/date-field");
    const root = discovered.jsEntries.find((entry) => entry.subpath === ".");
    expect(dateField?.inRootBarrel).toBe(false);
    expect(dateField?.runtimeExports).toEqual(["DateField", "DateInput"]);
    expect(root?.runtimeExports).not.toContain("DateField");
    expect(root?.runtimeExports).not.toContain("DateInput");
    expect(exportBindingTarget(publishExports, "./react-aria/date-field")).toEqual({
      types: "./react-aria/date-field.d.ts",
      import: "./react-aria/date-field.js",
    });
  });

  it("publishes UiProviders from the quarantined react-aria/ui-providers entry only", () => {
    const uiProviders = discovered.jsEntries.find((entry) => entry.subpath === "react-aria/ui-providers");
    const root = discovered.jsEntries.find((entry) => entry.subpath === ".");
    expect(uiProviders?.inRootBarrel).toBe(false);
    expect(uiProviders?.runtimeExports).toEqual(["UiProviders"]);
    expect(root?.runtimeExports).not.toContain("UiProviders");
    expect(exportBindingTarget(publishExports, "./react-aria/ui-providers")).toEqual({
      types: "./react-aria/ui-providers.d.ts",
      import: "./react-aria/ui-providers.js",
    });
  });

  it("publishes Calendar, CalendarHeader, and CalendarGridHeader from the quarantined react-aria/calendar entry only", () => {
    const calendar = discovered.jsEntries.find((entry) => entry.subpath === "react-aria/calendar");
    const root = discovered.jsEntries.find((entry) => entry.subpath === ".");
    expect(calendar?.inRootBarrel).toBe(false);
    expect(calendar?.runtimeExports).toEqual(["Calendar", "CalendarHeader", "CalendarGridHeader"]);
    expect(root?.runtimeExports).not.toContain("Calendar");
    expect(root?.runtimeExports).not.toContain("CalendarHeader");
    expect(root?.runtimeExports).not.toContain("CalendarGridHeader");
    expect(exportBindingTarget(publishExports, "./react-aria/calendar")).toEqual({
      types: "./react-aria/calendar.d.ts",
      import: "./react-aria/calendar.js",
    });
  });

  it("publishes RangeCalendar from the quarantined react-aria/range-calendar entry only", () => {
    const rangeCalendar = discovered.jsEntries.find((entry) => entry.subpath === "react-aria/range-calendar");
    const root = discovered.jsEntries.find((entry) => entry.subpath === ".");
    expect(rangeCalendar?.inRootBarrel).toBe(false);
    expect(rangeCalendar?.runtimeExports).toEqual(["RangeCalendar"]);
    expect(root?.runtimeExports).not.toContain("RangeCalendar");
    expect(exportBindingTarget(publishExports, "./react-aria/range-calendar")).toEqual({
      types: "./react-aria/range-calendar.d.ts",
      import: "./react-aria/range-calendar.js",
    });
  });

  it("publishes FileTrigger from the quarantined react-aria/file-trigger entry only", () => {
    const fileTrigger = discovered.jsEntries.find((entry) => entry.subpath === "react-aria/file-trigger");
    const root = discovered.jsEntries.find((entry) => entry.subpath === ".");
    expect(fileTrigger?.inRootBarrel).toBe(false);
    expect(fileTrigger?.runtimeExports).toEqual(["FileTrigger"]);
    expect(root?.runtimeExports).not.toContain("FileTrigger");
    expect(exportBindingTarget(publishExports, "./react-aria/file-trigger")).toEqual({
      types: "./react-aria/file-trigger.d.ts",
      import: "./react-aria/file-trigger.js",
    });
  });

  it("publishes Focusable and useFocusable from the quarantined react-aria/focusable entry only", () => {
    const focusable = discovered.jsEntries.find((entry) => entry.subpath === "react-aria/focusable");
    const root = discovered.jsEntries.find((entry) => entry.subpath === ".");
    expect(focusable?.inRootBarrel).toBe(false);
    expect(focusable?.runtimeExports).toEqual(["Focusable", "useFocusable"]);
    expect(root?.runtimeExports).not.toContain("Focusable");
    expect(root?.runtimeExports).not.toContain("useFocusable");
    expect(exportBindingTarget(publishExports, "./react-aria/focusable")).toEqual({
      types: "./react-aria/focusable.d.ts",
      import: "./react-aria/focusable.js",
    });
  });

  it("publishes GridList and GridListItem from the quarantined react-aria/grid-list entry only", () => {
    const gridList = discovered.jsEntries.find((entry) => entry.subpath === "react-aria/grid-list");
    const root = discovered.jsEntries.find((entry) => entry.subpath === ".");
    expect(gridList?.inRootBarrel).toBe(false);
    expect(gridList?.runtimeExports).toEqual(["GridList", "GridListItem"]);
    expect(root?.runtimeExports).not.toContain("GridList");
    expect(root?.runtimeExports).not.toContain("GridListItem");
    expect(exportBindingTarget(publishExports, "./react-aria/grid-list")).toEqual({
      types: "./react-aria/grid-list.d.ts",
      import: "./react-aria/grid-list.js",
    });
  });

  it("publishes Link from the quarantined react-aria/link entry only", () => {
    const link = discovered.jsEntries.find((entry) => entry.subpath === "react-aria/link");
    const root = discovered.jsEntries.find((entry) => entry.subpath === ".");
    expect(link?.inRootBarrel).toBe(false);
    expect(link?.runtimeExports).toEqual(["Link"]);
    expect(root?.runtimeExports).not.toContain("Link");
    expect(exportBindingTarget(publishExports, "./react-aria/link")).toEqual({
      types: "./react-aria/link.d.ts",
      import: "./react-aria/link.js",
    });
  });

  it("publishes SearchField from the quarantined react-aria/search-field entry only", () => {
    const searchField = discovered.jsEntries.find((entry) => entry.subpath === "react-aria/search-field");
    const root = discovered.jsEntries.find((entry) => entry.subpath === ".");
    expect(searchField?.inRootBarrel).toBe(false);
    expect(searchField?.runtimeExports).toEqual(["SearchField"]);
    expect(root?.runtimeExports).not.toContain("SearchField");
    expect(exportBindingTarget(publishExports, "./react-aria/search-field")).toEqual({
      types: "./react-aria/search-field.d.ts",
      import: "./react-aria/search-field.js",
    });
  });

  it("publishes the DatePicker family from the quarantined react-aria/date-picker entry only", () => {
    const datePicker = discovered.jsEntries.find((entry) => entry.subpath === "react-aria/date-picker");
    const root = discovered.jsEntries.find((entry) => entry.subpath === ".");
    expect(datePicker?.inRootBarrel).toBe(false);
    expect(datePicker?.runtimeExports).toEqual([
      "DatePicker",
      "DatePickerPresetGroup",
      "DatePickerPresetItem",
    ]);
    for (const name of ["DatePicker", "DatePickerPresetGroup", "DatePickerPresetItem"]) {
      expect(root?.runtimeExports).not.toContain(name);
    }
    expect(exportBindingTarget(publishExports, "./react-aria/date-picker")).toEqual({
      types: "./react-aria/date-picker.d.ts",
      import: "./react-aria/date-picker.js",
    });
  });

  it("publishes DateRangePicker from the quarantined react-aria/date-range-picker entry only", () => {
    const dateRangePicker = discovered.jsEntries.find(
      (entry) => entry.subpath === "react-aria/date-range-picker"
    );
    const root = discovered.jsEntries.find((entry) => entry.subpath === ".");
    expect(dateRangePicker?.inRootBarrel).toBe(false);
    expect(dateRangePicker?.runtimeExports).toEqual(["DateRangePicker"]);
    expect(root?.runtimeExports).not.toContain("DateRangePicker");
    expect(exportBindingTarget(publishExports, "./react-aria/date-range-picker")).toEqual({
      types: "./react-aria/date-range-picker.d.ts",
      import: "./react-aria/date-range-picker.js",
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
    expect(exportBindingTarget(publishExports, "./css")).toBe("./styles/fuse.css");
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
      "cssColorToSrgb",
      "cssFirstFontFamily",
      "cssLengthToPx",
      "cssVarReference",
      "defaultDensityForVariant",
      "densityAttributes",
      "themeAttributes",
      "TOKEN_KINDS",
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

  it("publishes ButtonGroup and the public buttonGroupVariants recipe from /button-group and the root barrel", () => {
    const buttonGroup = discovered.jsEntries.find((entry) => entry.subpath === "button-group");
    expect(buttonGroup?.inRootBarrel).toBe(true);
    expect(buttonGroup?.runtimeExports).toEqual(["ButtonGroup", "buttonGroupVariants"]);
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

  it("publishes Badge and the public badgeVariants recipe from /badge and the root barrel", () => {
    const badge = discovered.jsEntries.find((entry) => entry.subpath === "badge");
    expect(badge?.inRootBarrel).toBe(true);
    expect(badge?.runtimeExports).toEqual(["Badge", "badgeVariants"]);
  });

  it("publishes Show from /show and the root barrel", () => {
    const show = discovered.jsEntries.find((entry) => entry.subpath === "show");
    expect(show?.inRootBarrel).toBe(true);
    expect(show?.runtimeExports).toEqual(["Show"]);
  });

  it("publishes Loader and the public loaderVariants recipe from /loader and the root barrel", () => {
    const loader = discovered.jsEntries.find((entry) => entry.subpath === "loader");
    expect(loader?.inRootBarrel).toBe(true);
    expect(loader?.runtimeExports).toEqual(["Loader", "loaderVariants"]);
  });

  it("publishes Frame from /frame and the root barrel", () => {
    const frame = discovered.jsEntries.find((entry) => entry.subpath === "frame");
    expect(frame?.inRootBarrel).toBe(true);
    expect(frame?.runtimeExports).toEqual(["Frame"]);
  });

  it("publishes Code from /code and the root barrel", () => {
    const code = discovered.jsEntries.find((entry) => entry.subpath === "code");
    expect(code?.inRootBarrel).toBe(true);
    expect(code?.runtimeExports).toEqual(["Code"]);
  });

  it("publishes DescriptionList from /description-list and the root barrel", () => {
    const descriptionList = discovered.jsEntries.find((entry) => entry.subpath === "description-list");
    expect(descriptionList?.inRootBarrel).toBe(true);
    expect(descriptionList?.runtimeExports).toEqual(["DescriptionList"]);
  });

  it("publishes Skeleton from /skeleton and the root barrel", () => {
    const skeleton = discovered.jsEntries.find((entry) => entry.subpath === "skeleton");
    expect(skeleton?.inRootBarrel).toBe(true);
    expect(skeleton?.runtimeExports).toEqual(["Skeleton"]);
  });

  it("publishes Emoji and the five named faces from /emoji and the root barrel", () => {
    const emoji = discovered.jsEntries.find((entry) => entry.subpath === "emoji");
    expect(emoji?.inRootBarrel).toBe(true);
    expect(emoji?.runtimeExports).toEqual([
      "Emoji",
      "LoudlyCryingFace",
      "NeutralFace",
      "PartyingFace",
      "SlightlyFrowningFace",
      "SlightlySmilingFace",
    ]);
  });

  it("publishes Avatar from /avatar and the root barrel", () => {
    const avatar = discovered.jsEntries.find((entry) => entry.subpath === "avatar");
    expect(avatar?.inRootBarrel).toBe(true);
    expect(avatar?.runtimeExports).toEqual(["Avatar"]);
  });

  it("publishes Empty from /empty and the root barrel with private recipes", () => {
    const empty = discovered.jsEntries.find((entry) => entry.subpath === "empty");
    expect(empty?.inRootBarrel).toBe(true);
    expect(empty?.runtimeExports).toEqual(["Empty"]);
  });

  it("publishes TimelineList from /timeline-list and the root barrel with a private recipe", () => {
    const timelineList = discovered.jsEntries.find((entry) => entry.subpath === "timeline-list");
    expect(timelineList?.inRootBarrel).toBe(true);
    expect(timelineList?.runtimeExports).toEqual(["TimelineList"]);
  });

  it("publishes Card and the public cardVariants recipe from /card and the root barrel", () => {
    const card = discovered.jsEntries.find((entry) => entry.subpath === "card");
    expect(card?.inRootBarrel).toBe(true);
    expect(card?.runtimeExports).toEqual(["Card", "cardVariants"]);
  });

  it("publishes Heading and the public headingVariants recipe from /heading and the root barrel", () => {
    const heading = discovered.jsEntries.find((entry) => entry.subpath === "heading");
    expect(heading?.inRootBarrel).toBe(true);
    expect(heading?.runtimeExports).toEqual(["Heading", "headingVariants"]);
  });

  it("publishes Popover from /popover and the root barrel", () => {
    const popover = discovered.jsEntries.find((entry) => entry.subpath === "popover");
    expect(popover?.inRootBarrel).toBe(true);
    expect(popover?.runtimeExports).toEqual(["Popover"]);
  });

  it("publishes PopoverInfoButton from /popover-info-button and the root barrel", () => {
    const popoverInfoButton = discovered.jsEntries.find((entry) => entry.subpath === "popover-info-button");
    expect(popoverInfoButton?.inRootBarrel).toBe(true);
    expect(popoverInfoButton?.runtimeExports).toEqual(["PopoverInfoButton"]);
  });

  it("publishes Accordion and the public accordionVariants recipe from /accordion and the root barrel", () => {
    const accordion = discovered.jsEntries.find((entry) => entry.subpath === "accordion");
    expect(accordion?.inRootBarrel).toBe(true);
    expect(accordion?.runtimeExports).toEqual(["Accordion", "accordionVariants"]);
  });

  it("publishes AlertDialog from /alert-dialog and the root barrel", () => {
    const alertDialog = discovered.jsEntries.find((entry) => entry.subpath === "alert-dialog");
    expect(alertDialog?.inRootBarrel).toBe(true);
    expect(alertDialog?.runtimeExports).toEqual(["AlertDialog"]);
  });

  it("publishes DropdownMenu from /dropdown-menu and the root barrel", () => {
    const dropdownMenu = discovered.jsEntries.find((entry) => entry.subpath === "dropdown-menu");
    expect(dropdownMenu?.inRootBarrel).toBe(true);
    expect(dropdownMenu?.runtimeExports).toEqual(["DropdownMenu"]);
  });

  it("publishes Collapsible from /collapsible and the root barrel", () => {
    const collapsible = discovered.jsEntries.find((entry) => entry.subpath === "collapsible");
    expect(collapsible?.inRootBarrel).toBe(true);
    expect(collapsible?.runtimeExports).toEqual(["Collapsible"]);
  });

  it("publishes ConfirmButton from /confirm-button and the root barrel", () => {
    const confirmButton = discovered.jsEntries.find((entry) => entry.subpath === "confirm-button");
    expect(confirmButton?.inRootBarrel).toBe(true);
    expect(confirmButton?.runtimeExports).toEqual(["ConfirmButton"]);
  });

  it("publishes Table and VerticalTable from /table and the root barrel", () => {
    const table = discovered.jsEntries.find((entry) => entry.subpath === "table");
    expect(table?.inRootBarrel).toBe(true);
    expect(table?.runtimeExports).toEqual(["Table", "VerticalTable"]);
  });

  it("publishes Select from /select and the root barrel", () => {
    const select = discovered.jsEntries.find((entry) => entry.subpath === "select");
    expect(select?.inRootBarrel).toBe(true);
    expect(select?.runtimeExports).toEqual(["Select"]);
  });

  it("publishes Combobox and useComboboxAnchor from /combobox and the root barrel", () => {
    const combobox = discovered.jsEntries.find((entry) => entry.subpath === "combobox");
    expect(combobox?.inRootBarrel).toBe(true);
    expect(combobox?.runtimeExports).toEqual(["Combobox", "useComboboxAnchor"]);
  });

  it("publishes Sidebar, useSidebar and the six constants from /sidebar and the root barrel", () => {
    const sidebar = discovered.jsEntries.find((entry) => entry.subpath === "sidebar");
    expect(sidebar?.inRootBarrel).toBe(true);
    expect(sidebar?.runtimeExports).toEqual([
      "SIDEBAR_COOKIE_MAX_AGE",
      "SIDEBAR_COOKIE_NAME",
      "SIDEBAR_KEYBOARD_SHORTCUT",
      "SIDEBAR_WIDTH",
      "SIDEBAR_WIDTH_ICON",
      "SIDEBAR_WIDTH_MOBILE",
      "Sidebar",
      "useSidebar",
    ]);
  });

  it("publishes Toast from /toast and the root barrel", () => {
    const toast = discovered.jsEntries.find((entry) => entry.subpath === "toast");
    expect(toast?.inRootBarrel).toBe(true);
    expect(toast?.runtimeExports).toEqual(["Toast"]);
  });

  it("publishes PhoneNumberField from /phone-number-field and the root barrel", () => {
    const phoneNumberField = discovered.jsEntries.find((entry) => entry.subpath === "phone-number-field");
    expect(phoneNumberField?.inRootBarrel).toBe(true);
    expect(phoneNumberField?.runtimeExports).toEqual(["PhoneNumberField"]);
  });

  it("publishes Sheet from /sheet and the root barrel", () => {
    const sheet = discovered.jsEntries.find((entry) => entry.subpath === "sheet");
    expect(sheet?.inRootBarrel).toBe(true);
    expect(sheet?.runtimeExports).toEqual(["Sheet"]);
  });

  it("publishes Switch from /switch and the root barrel", () => {
    const switchEntry = discovered.jsEntries.find((entry) => entry.subpath === "switch");
    expect(switchEntry?.inRootBarrel).toBe(true);
    expect(switchEntry?.runtimeExports).toEqual(["Switch"]);
  });

  it("publishes Toggle and the public toggleVariants recipe from /toggle and the root barrel", () => {
    const toggle = discovered.jsEntries.find((entry) => entry.subpath === "toggle");
    expect(toggle?.inRootBarrel).toBe(true);
    expect(toggle?.runtimeExports).toEqual(["Toggle", "toggleVariants"]);
  });

  it("publishes ToggleGroup from /toggle-group and the root barrel without the toggle recipe", () => {
    const toggleGroup = discovered.jsEntries.find((entry) => entry.subpath === "toggle-group");
    expect(toggleGroup?.inRootBarrel).toBe(true);
    expect(toggleGroup?.runtimeExports).toEqual(["ToggleGroup"]);
  });

  it("publishes Tooltip from /tooltip and the root barrel", () => {
    const tooltip = discovered.jsEntries.find((entry) => entry.subpath === "tooltip");
    expect(tooltip?.inRootBarrel).toBe(true);
    expect(tooltip?.runtimeExports).toEqual(["Tooltip"]);
  });

  it("publishes InputGroup from /input-group and the root barrel with private recipes", () => {
    const inputGroup = discovered.jsEntries.find((entry) => entry.subpath === "input-group");
    expect(inputGroup?.inRootBarrel).toBe(true);
    expect(inputGroup?.runtimeExports).toEqual(["InputGroup"]);
  });

  it("publishes Text and the public textVariants recipe from /text and the root barrel", () => {
    const text = discovered.jsEntries.find((entry) => entry.subpath === "text");
    expect(text?.inRootBarrel).toBe(true);
    expect(text?.runtimeExports).toEqual(["Text", "textVariants"]);
  });

  it("publishes Span and the public spanVariants recipe from /span and the root barrel", () => {
    const span = discovered.jsEntries.find((entry) => entry.subpath === "span");
    expect(span?.inRootBarrel).toBe(true);
    expect(span?.runtimeExports).toEqual(["Span", "spanVariants"]);
  });

  it("publishes TextField and the public textFieldVariants recipe from /text-field and the root barrel", () => {
    const textField = discovered.jsEntries.find((entry) => entry.subpath === "text-field");
    expect(textField?.inRootBarrel).toBe(true);
    expect(textField?.runtimeExports).toEqual(["TextField", "textFieldVariants"]);
  });

  it("publishes NumberField from /number-field and the root barrel", () => {
    const numberField = discovered.jsEntries.find((entry) => entry.subpath === "number-field");
    expect(numberField?.inRootBarrel).toBe(true);
    expect(numberField?.runtimeExports).toEqual(["NumberField"]);
  });

  it("publishes TextareaField from /textarea-field and the root barrel", () => {
    const textareaField = discovered.jsEntries.find((entry) => entry.subpath === "textarea-field");
    expect(textareaField?.inRootBarrel).toBe(true);
    expect(textareaField?.runtimeExports).toEqual(["TextareaField"]);
  });

  it("publishes Meter and METER_CONSTANTS from /meter and the root barrel", () => {
    const meter = discovered.jsEntries.find((entry) => entry.subpath === "meter");
    expect(meter?.inRootBarrel).toBe(true);
    expect(meter?.runtimeExports).toEqual(["Meter", "METER_CONSTANTS"]);
  });

  it("publishes Tabs and the public tabsListVariants recipe from /tabs and the root barrel", () => {
    const tabs = discovered.jsEntries.find((entry) => entry.subpath === "tabs");
    expect(tabs?.inRootBarrel).toBe(true);
    expect(tabs?.runtimeExports).toEqual(["Tabs", "tabsListVariants"]);
  });

  it("publishes Pagination and the public paginationVariants recipe from /pagination and the root barrel", () => {
    const pagination = discovered.jsEntries.find((entry) => entry.subpath === "pagination");
    expect(pagination?.inRootBarrel).toBe(true);
    expect(pagination?.runtimeExports).toEqual(["Pagination", "paginationVariants"]);
  });

  it("publishes Breadcrumb from /breadcrumb and the root barrel", () => {
    const breadcrumb = discovered.jsEntries.find((entry) => entry.subpath === "breadcrumb");
    expect(breadcrumb?.inRootBarrel).toBe(true);
    expect(breadcrumb?.runtimeExports).toEqual(["Breadcrumb"]);
  });

  it("publishes Alert from /alert and the root barrel", () => {
    const alert = discovered.jsEntries.find((entry) => entry.subpath === "alert");
    expect(alert?.inRootBarrel).toBe(true);
    expect(alert?.runtimeExports).toEqual(["Alert"]);
  });

  it("publishes SelectionItem from /selection-item and the root barrel", () => {
    const selectionItem = discovered.jsEntries.find((entry) => entry.subpath === "selection-item");
    expect(selectionItem?.inRootBarrel).toBe(true);
    expect(selectionItem?.runtimeExports).toEqual(["SelectionItem"]);
  });

  it("publishes the checkbox surface from /checkbox and the root barrel", () => {
    const checkbox = discovered.jsEntries.find((entry) => entry.subpath === "checkbox");
    expect(checkbox?.inRootBarrel).toBe(true);
    expect(checkbox?.runtimeExports).toEqual([
      "Checkbox",
      "CheckboxDescription",
      "CheckboxGroup",
      "CheckboxItem",
      "CheckboxItemGroup",
    ]);
  });

  it("publishes CheckboxCard from /checkbox-card and the root barrel", () => {
    const checkboxCard = discovered.jsEntries.find((entry) => entry.subpath === "checkbox-card");
    expect(checkboxCard?.inRootBarrel).toBe(true);
    expect(checkboxCard?.runtimeExports).toEqual(["CheckboxCard"]);
  });

  it("publishes the radio-group surface from /radio-group and the root barrel", () => {
    const radioGroup = discovered.jsEntries.find((entry) => entry.subpath === "radio-group");
    expect(radioGroup?.inRootBarrel).toBe(true);
    expect(radioGroup?.runtimeExports).toEqual([
      "Radio",
      "RadioGroup",
      "RadioGroupItem",
      "RadioIconButton",
      "RadioItem",
      "RadioItemGroup",
    ]);
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
