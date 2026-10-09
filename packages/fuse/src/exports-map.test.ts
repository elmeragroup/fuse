import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries, TOOLING_ONLY_JS_ENTRIES } from "../scripts/entries";
import {
  buildPublishExportMap,
  buildSourceExportMap,
  exportBindingsObject,
  exportBindingTarget,
  renderRootBarrel,
} from "../scripts/generate-exports";
import { parseFacadeValueExports } from "../scripts/parse-facade";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Reviewed public surface of every discovered JS entry, in discovery order.
 * A new entry, a changed value export, or a move into or out of the root barrel
 * must be decided here. The root barrel's names are the union of the
 * `inRootBarrel` rows. The icons row omits its names because the tracked roster
 * snapshot in `src/icons/__snapshots__/roster.json` owns them.
 */
type EntrySurface = {
  readonly inRootBarrel: boolean;
  readonly runtimeExports?: readonly string[];
};

const EXPECTED_ENTRIES = {
  ".": { inRootBarrel: true },
  theme: {
    inRootBarrel: true,
    runtimeExports: [
      "ColorSchemeScript",
      "colorSchemeScriptSource",
      "COLOR_SCHEMES",
      "LocaleProvider",
      "useLocale",
      "ForceColorScheme",
      "defaultDensityForVariant",
      "densityAttributes",
      "themeAttributes",
      "ThemeProvider",
      "useTheme",
      "ThemeScope",
      "BRAND_CODES",
      "BRANDS",
      "isBrandCode",
      "LEGAL_THEMES",
      "parseThemeSlug",
      "THEME_SEGMENTS",
      "THEME_VARIANTS",
      "themeSlug",
      "useColorScheme",
      "coerceTheme",
      "validateTheme",
    ],
  },
  icons: { inRootBarrel: false },
  illustrations: { inRootBarrel: false, runtimeExports: ["FkasMeter"] },
  flags: { inRootBarrel: false, runtimeExports: ["flagAssets"] },
  accordion: { inRootBarrel: true, runtimeExports: ["Accordion", "accordionVariants"] },
  alert: { inRootBarrel: true, runtimeExports: ["Alert"] },
  "alert-dialog": { inRootBarrel: true, runtimeExports: ["AlertDialog"] },
  avatar: { inRootBarrel: true, runtimeExports: ["Avatar"] },
  badge: { inRootBarrel: true, runtimeExports: ["Badge", "badgeVariants"] },
  breadcrumb: { inRootBarrel: true, runtimeExports: ["Breadcrumb"] },
  button: { inRootBarrel: true, runtimeExports: ["Button", "buttonVariants"] },
  "button-group": { inRootBarrel: true, runtimeExports: ["ButtonGroup", "buttonGroupVariants"] },
  card: { inRootBarrel: true, runtimeExports: ["Card", "cardVariants"] },
  checkbox: {
    inRootBarrel: true,
    runtimeExports: ["Checkbox", "CheckboxDescription", "CheckboxGroup", "CheckboxItem", "CheckboxItemGroup"],
  },
  "checkbox-card": { inRootBarrel: true, runtimeExports: ["CheckboxCard"] },
  code: { inRootBarrel: true, runtimeExports: ["Code"] },
  collapsible: { inRootBarrel: true, runtimeExports: ["Collapsible"] },
  combobox: { inRootBarrel: true, runtimeExports: ["Combobox", "useComboboxAnchor"] },
  "confirm-button": { inRootBarrel: true, runtimeExports: ["ConfirmButton"] },
  // Subpath-only: it imports the optional @tanstack/react-table peer.
  "data-table": {
    inRootBarrel: false,
    runtimeExports: [
      "DataTable",
      "createFuseTableHook",
      "selectColumn",
      "actionsColumn",
      "CurrencyCell",
      "DateCell",
      "DateTimeCell",
      "NumberCell",
      "TextCell",
    ],
  },
  "description-list": { inRootBarrel: true, runtimeExports: ["DescriptionList"] },
  dialog: { inRootBarrel: true, runtimeExports: ["Dialog"] },
  "dropdown-menu": { inRootBarrel: true, runtimeExports: ["DropdownMenu"] },
  emoji: {
    inRootBarrel: true,
    runtimeExports: [
      "Emoji",
      "LoudlyCryingFace",
      "NeutralFace",
      "PartyingFace",
      "SlightlyFrowningFace",
      "SlightlySmilingFace",
    ],
  },
  empty: { inRootBarrel: true, runtimeExports: ["Empty"] },
  field: { inRootBarrel: true, runtimeExports: ["Field"] },
  frame: { inRootBarrel: true, runtimeExports: ["Frame"] },
  heading: { inRootBarrel: true, runtimeExports: ["Heading", "headingVariants"] },
  input: { inRootBarrel: true, runtimeExports: ["Input"] },
  "input-group": { inRootBarrel: true, runtimeExports: ["InputGroup"] },
  item: { inRootBarrel: true, runtimeExports: ["Item", "itemVariants"] },
  loader: { inRootBarrel: true, runtimeExports: ["Loader", "loaderVariants"] },
  meter: { inRootBarrel: true, runtimeExports: ["Meter", "METER_CONSTANTS"] },
  "number-field": { inRootBarrel: true, runtimeExports: ["NumberField"] },
  pagination: { inRootBarrel: true, runtimeExports: ["Pagination", "paginationVariants"] },
  "phone-number-field": { inRootBarrel: true, runtimeExports: ["PhoneNumberField"] },
  popover: { inRootBarrel: true, runtimeExports: ["Popover"] },
  "popover-info-button": { inRootBarrel: true, runtimeExports: ["PopoverInfoButton"] },
  "radio-group": {
    inRootBarrel: true,
    runtimeExports: [
      "Radio",
      "RadioGroup",
      "RadioGroupItem",
      "RadioIconButton",
      "RadioItem",
      "RadioItemGroup",
    ],
  },
  "scroll-area": { inRootBarrel: true, runtimeExports: ["ScrollArea"] },
  select: { inRootBarrel: true, runtimeExports: ["Select"] },
  "selection-item": { inRootBarrel: true, runtimeExports: ["SelectionItem"] },
  separator: { inRootBarrel: true, runtimeExports: ["Separator"] },
  sheet: { inRootBarrel: true, runtimeExports: ["Sheet"] },
  show: { inRootBarrel: true, runtimeExports: ["Show"] },
  sidebar: {
    inRootBarrel: true,
    runtimeExports: [
      "SIDEBAR_COOKIE_MAX_AGE",
      "SIDEBAR_COOKIE_NAME",
      "SIDEBAR_KEYBOARD_SHORTCUT",
      "SIDEBAR_WIDTH",
      "SIDEBAR_WIDTH_ICON",
      "SIDEBAR_WIDTH_MOBILE",
      "useSidebar",
      "Sidebar",
    ],
  },
  skeleton: { inRootBarrel: true, runtimeExports: ["Skeleton"] },
  span: { inRootBarrel: true, runtimeExports: ["Span", "spanVariants"] },
  switch: { inRootBarrel: true, runtimeExports: ["Switch"] },
  table: { inRootBarrel: true, runtimeExports: ["Table", "VerticalTable"] },
  tabs: { inRootBarrel: true, runtimeExports: ["Tabs", "tabsListVariants"] },
  text: { inRootBarrel: true, runtimeExports: ["Text", "textVariants"] },
  "text-field": { inRootBarrel: true, runtimeExports: ["TextField", "textFieldVariants"] },
  textarea: { inRootBarrel: true, runtimeExports: ["Textarea"] },
  "textarea-field": { inRootBarrel: true, runtimeExports: ["TextareaField"] },
  "timeline-list": { inRootBarrel: true, runtimeExports: ["TimelineList"] },
  toast: { inRootBarrel: true, runtimeExports: ["Toast"] },
  toggle: { inRootBarrel: true, runtimeExports: ["Toggle", "toggleVariants"] },
  "toggle-group": { inRootBarrel: true, runtimeExports: ["ToggleGroup"] },
  tooltip: { inRootBarrel: true, runtimeExports: ["Tooltip"] },
  "select-field": { inRootBarrel: true, runtimeExports: ["SelectField"] },
  form: { inRootBarrel: true, runtimeExports: ["Form"] },
  "navigation-menu": { inRootBarrel: true, runtimeExports: ["NavigationMenu"] },
  "react-aria/calendar": {
    inRootBarrel: false,
    runtimeExports: ["Calendar", "CalendarHeader", "CalendarGridHeader"],
  },
  "react-aria/date-field": { inRootBarrel: false, runtimeExports: ["DateField", "DateInput"] },
  "react-aria/date-picker": {
    inRootBarrel: false,
    runtimeExports: ["DatePicker", "DatePickerPresetGroup", "DatePickerPresetItem"],
  },
  "react-aria/date-range-picker": {
    inRootBarrel: false,
    runtimeExports: ["DateRangePicker", "DateRangePickerPresetGroup", "DateRangePickerPresetItem"],
  },
  "react-aria/file-trigger": { inRootBarrel: false, runtimeExports: ["FileTrigger"] },
  "react-aria/focusable": { inRootBarrel: false, runtimeExports: ["Focusable", "useFocusable"] },
  "react-aria/grid-list": { inRootBarrel: false, runtimeExports: ["GridList", "GridListItem"] },
  "react-aria/link": { inRootBarrel: false, runtimeExports: ["Link"] },
  "react-aria/range-calendar": { inRootBarrel: false, runtimeExports: ["RangeCalendar"] },
  "react-aria/search-field": { inRootBarrel: false, runtimeExports: ["SearchField"] },
  "react-aria/ui-providers": { inRootBarrel: false, runtimeExports: ["UiProviders"] },
} satisfies Record<string, EntrySurface>;

describe("exports map", () => {
  const discovered = discoverEntries(packageRoot);
  const sourceExports = buildSourceExportMap(discovered);
  const publishExports = buildPublishExportMap(discovered);

  it("is generated from discovered source entries, not a hand-maintained list of files", () => {
    expect(discovered.jsEntries.map((entry) => entry.subpath)).toEqual(Object.keys(EXPECTED_ENTRIES));
    const expectedBySubpath = new Map<string, EntrySurface>(Object.entries(EXPECTED_ENTRIES));
    const surfaces = Object.fromEntries(
      discovered.jsEntries.map(({ subpath, inRootBarrel, runtimeExports }) => [
        subpath,
        expectedBySubpath.get(subpath)?.runtimeExports === undefined
          ? { inRootBarrel }
          : { inRootBarrel, runtimeExports },
      ])
    );
    expect(surfaces).toEqual(EXPECTED_ENTRIES);

    const barrelNames = [...expectedBySubpath.values()].flatMap((entry) =>
      entry.inRootBarrel ? (entry.runtimeExports ?? []) : []
    );
    const root = discovered.jsEntries.find((entry) => entry.subpath === ".");
    expect([...(root?.runtimeExports ?? [])].sort()).toEqual(barrelNames.sort());

    for (const subpath of Object.keys(EXPECTED_ENTRIES)) {
      const file = subpath === "." ? "index" : subpath;
      expect(exportBindingTarget(publishExports, subpath === "." ? "." : `./${subpath}`)).toEqual({
        types: `./${file}.d.ts`,
        import: `./${file}.js`,
      });
    }
  });

  it("does not use a custom source or development export condition", () => {
    const serialized = JSON.stringify(sourceExports);
    expect(serialized).not.toContain('"source"');
    expect(serialized).not.toContain('"development"');
  });

  it("maps the published layout to package-root files, not nested dist/", () => {
    expect(exportBindingTarget(publishExports, "./flags/*.svg")).toBe("./flags/*.svg");
    expect(exportBindingTarget(publishExports, "./css")).toBe("./styles/fuse.css");
    expect(exportBindingTarget(publishExports, "./demo-stage-comfortable.css")).toBeUndefined();
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
    expect(catalog).toEqual(["resolveThemeCatalog"]);
  });

  it("keeps the committed root barrel in sync with the generator", () => {
    const committed = readFileSync(join(packageRoot, "src/index.ts"), "utf8");
    expect(committed).toEqual(renderRootBarrel(discovered));
  });
});
