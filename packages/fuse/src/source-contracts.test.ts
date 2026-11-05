import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync, Visitor } from "oxc-parser";
import type { Expression, JSXElementName, JSXOpeningElement } from "oxc-parser";
import { describe, expect, it } from "vitest";

import { OPTIONAL_PEER_ENTRIES, walkImportedSourceFiles } from "../scripts/entries";
import { FLOOR_MARKS, SCATTER_FLOOR_MARKS } from "../test/chart/floor-marks";
import { classTokens, colorRolePaints, splitVariants, tokenAssignments } from "../test/class-tokens";
import { svgMarks } from "../test/svg-marks";
import { writtenSlots } from "../test/written-slots";
import { CHART_SPRINGS, CHART_UPDATE_EASE, CHART_UPDATE_MS } from "./components/chart/layout/motion";
import { springEasing } from "./components/chart/layout/spring";
import { TOKEN_PAINTS } from "./theme/tokens/contract";
import type { ColorTokenName, TokenPaint } from "./theme/tokens/contract";
import { PART_DENSITY } from "./theme/tokens/density-roles";

/**
 * Remaining source-level invariants that are not already a lint rule
 * (`facade-reexport-grammar`, `no-rac-outside-quarantine`,
 * `no-hardcoded-density-metrics`, `no-primitive-colors`, `no-local-focus-ring`,
 * `restrict-focus-ring-call`, `restrict-browser-helper-copy`, `no-field-part-jsx`,
 * `no-tailwind-dark-variant`, `restrict-process-env`, `no-restricted-imports` for
 * `LocalizedStringDictionary`, for runtime values of `@tanstack/react-table` and
 * `@tanstack/react-virtual`, and for the `@base-ui/react/combobox` and
 * `@base-ui/react/autocomplete` subpaths, and the repository's own per-file `fuse/*` rules in
 * `scripts/oxlint/`) or an exports/package-check gate. What stays here needs the whole tree, a
 * second language, a module graph or a reviewed inventory. Each describe documents why the
 * contract is not a lint rule.
 */
const SRC_ROOT = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(SRC_ROOT, "..");

type RscStatus = "client" | "server";

type SourceRecord = {
  relative: string;
  source: string;
  code: string;
};

const CLIENT_COMPONENTS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["accordion", ["components/accordion/accordion.tsx"]],
  ["alert-dialog", ["components/alert-dialog/alert-dialog.tsx"]],
  [
    "attachment",
    [
      "components/attachment/attachment.tsx",
      "components/attachment/attachment-action.tsx",
      "components/attachment/attachment-trigger.tsx",
    ],
  ],
  ["autocomplete", ["components/autocomplete/autocomplete.tsx"]],
  ["avatar", ["components/avatar/avatar.tsx"]],
  ["breadcrumb", ["components/breadcrumb/breadcrumb.tsx"]],
  ["button", ["components/button/button.tsx"]],
  ["button-group", ["components/button-group/button-group.tsx"]],
  ["calendar", ["react-aria/calendar/calendar.tsx"]],
  ["checkbox", ["components/checkbox/checkbox.tsx"]],
  ["checkbox-card", ["components/checkbox-card/checkbox-card.tsx"]],
  ["collapsible", ["components/collapsible/collapsible.tsx"]],
  ["combobox", ["components/combobox/combobox.tsx"]],
  ["command", ["components/command/command.tsx", "components/command/command-list-context.ts"]],
  ["command-virtual", ["components/command-virtual/command-virtual.tsx"]],
  ["confirm-button", ["components/confirm-button/confirm-button.tsx"]],
  [
    "data-table",
    [
      "components/data-table/data-table.tsx",
      "components/data-table/data-table-cells.tsx",
      "components/data-table/data-table-column-toggle.tsx",
      "components/data-table/data-table-contexts.ts",
      "components/data-table/data-table-pagination.tsx",
      "components/data-table/data-table-registered.tsx",
      "components/data-table/data-table-row-actions.tsx",
      "components/data-table/data-table-selection.tsx",
      "components/data-table/data-table-sort-button.tsx",
      "components/data-table/create-fuse-table-hook.ts",
    ],
  ],
  [
    "data-table-filter",
    [
      "components/data-table-filter/data-table-filter.tsx",
      "components/data-table-filter/data-table-filter-bar.tsx",
      "components/data-table-filter/data-table-filter-content.tsx",
      "components/data-table-filter/searchable-menu.ts",
      "components/data-table-filter/data-table-filter-value-content.tsx",
      "components/data-table-filter/data-table-filter-editors.tsx",
      "components/data-table-filter/data-table-filter-editor-context.ts",
      "components/data-table-filter/use-contains.ts",
      "components/data-table-filter/operator-options.tsx",
    ],
  ],
  ["date-field", ["react-aria/date-field/date-field.tsx"]],
  ["date-picker", ["react-aria/date-picker/date-picker.tsx"]],
  ["date-range-picker", ["react-aria/date-range-picker/date-range-picker.tsx"]],
  ["dialog", ["components/dialog/dialog.tsx"]],
  ["dropdown-menu", ["components/dropdown-menu/dropdown-menu.tsx"]],
  ["field", ["components/field/field.tsx"]],
  ["file-trigger", ["react-aria/file-trigger/file-trigger.tsx"]],
  [
    "file-upload",
    [
      "components/file-upload/file-upload-context.ts",
      "components/file-upload/file-upload.tsx",
      "components/file-upload/file-upload-trigger.tsx",
      "components/file-upload/file-upload-description.tsx",
      "components/file-upload/file-upload-dropzone.tsx",
    ],
  ],
  ["focusable", ["react-aria/focusable/focusable.tsx"]],
  ["form", ["components/form/form.tsx"]],
  ["grid-list", ["react-aria/grid-list/grid-list.tsx"]],
  ["heading", ["components/heading/heading.tsx"]],
  ["input", ["components/input/input.tsx"]],
  ["input-group", ["components/input-group/input-group.tsx"]],
  ["item", ["components/item/item.tsx"]],
  ["link", ["components/link/link.tsx"]],
  ["meter", ["components/meter/meter.tsx"]],
  ["navigation-menu", ["components/navigation-menu/navigation-menu.tsx"]],
  ["number-field", ["components/number-field/number-field.tsx"]],
  ["pagination", ["components/pagination/pagination.tsx"]],
  [
    "phone-number-field",
    [
      "components/phone-number-field/phone-number-field.tsx",
      "components/phone-number-field/phone-field-context.tsx",
      "components/phone-number-field/hooks/use-phone-number-field-state.ts",
    ],
  ],
  ["popover", ["components/popover/popover.tsx"]],
  ["popover-info-button", ["components/popover-info-button/popover-info-button.tsx"]],
  ["radio-group", ["components/radio-group/radio-group.tsx"]],
  ["range-calendar", ["react-aria/range-calendar/range-calendar.tsx"]],
  ["scroll-area", ["components/scroll-area/scroll-area.tsx"]],
  ["search-field", ["react-aria/search-field/search-field.tsx"]],
  ["select", ["components/select/select.tsx"]],
  [
    "selection-item",
    [
      "components/selection-item/selection-item.tsx",
      "components/selection-item/selection-item-sub-section.tsx",
    ],
  ],
  ["separator", ["components/separator/separator.tsx"]],
  ["sheet", ["components/sheet/sheet.tsx"]],
  ["sidebar", ["components/sidebar/sidebar.tsx"]],
  ["slider", ["components/slider/slider.tsx"]],
  ["span", ["components/span/span.tsx"]],
  ["switch", ["components/switch/switch.tsx"]],
  ["tabs", ["components/tabs/tabs.tsx"]],
  ["text", ["components/text/text.tsx"]],
  ["text-field", ["components/text-field/text-field.tsx"]],
  ["textarea-field", ["components/textarea-field/textarea-field.tsx"]],
  ["toast", ["components/toast/toast.tsx"]],
  ["toggle", ["components/toggle/toggle.tsx"]],
  ["toggle-group", ["components/toggle-group/toggle-group.tsx"]],
  ["toolbar", ["components/toolbar/toolbar.tsx"]],
  ["tooltip", ["components/tooltip/tooltip.tsx"]],
  ["ui-providers", ["react-aria/ui-providers/ui-providers.tsx"]],
];

const SERVER_COMPONENTS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["alert", ["components/alert/alert.tsx"]],
  ["aspect-ratio", ["components/aspect-ratio/aspect-ratio.tsx"]],
  ["autocomplete-field", ["components/autocomplete-field/autocomplete-field.tsx"]],
  ["badge", ["components/badge/badge.tsx"]],
  ["card", ["components/card/card.tsx"]],
  ["code", ["components/code/code.tsx"]],
  ["combobox-field", ["components/combobox-field/combobox-field.tsx"]],
  ["description-list", ["components/description-list/description-list.tsx"]],
  ["emoji", ["components/emoji/emoji.tsx"]],
  ["empty", ["components/empty/empty.tsx"]],
  ["frame", ["components/frame/frame.tsx"]],
  ["kbd", ["components/kbd/kbd.tsx"]],
  ["loader", ["components/loader/loader.tsx"]],
  ["select-field", ["components/select-field/select-field.tsx"]],
  ["show", ["components/show/show.tsx"]],
  ["skeleton", ["components/skeleton/skeleton.tsx"]],
  ["table", ["components/table/table.tsx"]],
  ["textarea", ["components/textarea/textarea.tsx"]],
  ["timeline-list", ["components/timeline-list/timeline-list.tsx"]],
];

const CLIENT_ISLANDS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["table", ["components/table/vertical-table-header.tsx", "components/table/vertical-table-key.tsx"]],
  ["description-list", ["components/description-list/description-list-heading.tsx"]],
  // Loader stays a server component; only its dictionary default reads the client locale.
  ["loader", ["components/loader/loader-default-label.tsx"]],
];

const CLIENT_HOOKS = ["hooks/use-localized-strings.ts"] as const;

function isTestFile(path: string): boolean {
  return (
    path.endsWith(".test.ts") ||
    path.endsWith(".test.tsx") ||
    path.endsWith(".browser.test.tsx") ||
    path.endsWith(".test-d.tsx")
  );
}

function walkSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...walkSourceFiles(path));
      continue;
    }
    if ((path.endsWith(".ts") || path.endsWith(".tsx")) && !isTestFile(path)) {
      files.push(path);
    }
  }
  return files;
}

/** Line-comment and block-comment lines dropped, so prose citing a spelling is not a copy of it. */
function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

function loadSourceTree(): ReadonlyMap<string, SourceRecord> {
  const tree = new Map<string, SourceRecord>();
  for (const file of walkSourceFiles(SRC_ROOT)) {
    const source = readFileSync(file, "utf8");
    tree.set(file, {
      relative: relative(SRC_ROOT, file),
      source,
      code: codeOnly(source),
    });
  }
  return tree;
}

const SOURCE_TREE = loadSourceTree();

function sourceRecord(relativePath: string): SourceRecord {
  const record = SOURCE_TREE.get(join(SRC_ROOT, relativePath));
  if (record === undefined) {
    throw new Error(`expected source file ${relativePath}`);
  }
  return record;
}

function readSrc(relativePath: string): string {
  return sourceRecord(relativePath).source;
}

function readCode(relativePath: string): string {
  return sourceRecord(relativePath).code;
}

function filesContainingCode(needle: string): string[] {
  const hits: string[] = [];
  for (const record of SOURCE_TREE.values()) {
    if (record.code.includes(needle)) {
      hits.push(record.relative);
    }
  }
  return hits;
}

function hasUseClientDirective(source: string): boolean {
  const trimmed = source.trimStart();
  return trimmed.startsWith('"use client"') || trimmed.startsWith("'use client'");
}

function expectRsc(relativePath: string, rsc: RscStatus): void {
  const source = readSrc(relativePath);
  if (rsc === "client") {
    expect(hasUseClientDirective(source), relativePath).toBe(true);
    return;
  }
  expect(source, relativePath).not.toContain('"use client"');
  expect(source, relativePath).not.toContain("'use client'");
}

/** Every name a module exports, with type-only exports prefixed `type `. */
function exportedNames(relativePath: string): string[] {
  const parsed = parseSync(relativePath, readSrc(relativePath));
  expect(parsed.errors, relativePath).toEqual([]);
  return parsed.module.staticExports.flatMap(({ entries }) =>
    entries.map(({ exportName, isType }) => `${isType ? "type " : ""}${exportName.name ?? "default"}`)
  );
}

describe("RSC classification", () => {
  // Why not a lint rule: server/client compatibility is a reviewed per-component
  // decision. Package-check checks packed directives against source; this independent
  // expectation catches an unintended source-boundary change.
  it.each(CLIENT_COMPONENTS)("%s is client", (_component, files) => {
    for (const file of files) {
      expectRsc(file, "client");
    }
  });

  it.each(SERVER_COMPONENTS)("%s is server", (_component, files) => {
    for (const file of files) {
      expectRsc(file, "server");
    }
  });

  it.each(CLIENT_ISLANDS)("%s client islands are client", (_component, files) => {
    for (const file of files) {
      expectRsc(file, "client");
    }
  });

  it.each(CLIENT_HOOKS)("%s is a client hook", (file) => {
    expectRsc(file, "client");
  });

  // Why not a lint rule: "does this module own client state?" and whether a hook-free
  // module may run on the server are judgments the reviewed table answers per module, not a
  // syntactic pattern.
  it.each([
    // The shared overlay close button resolves its own label from the overlay dictionary, so it
    // owns client state and carries the directive; Dialog, Sheet and Sidebar were already
    // client modules.
    ["components/overlay/overlay-close-button.tsx", "client"],
    // FieldFrame holds no state. Its other consumers are client modules already, and SelectField,
    // AutocompleteField and ComboboxField are server components that run it, so a directive would
    // only widen the client graph.
    ["components/field/field-frame.tsx", "server"],
    // Alert's documented server render uses the Item markup. Item.Root stays in the client
    // module because it calls useRender.
    ["components/item/item-markup.tsx", "server"],
    // Attachment's media, content, text, actions and aspect ratio hold no state and read no
    // context, so a server tree renders them inside the client root.
    ["components/attachment/attachment-markup.tsx", "server"],
    // A directive on these files makes `CheckboxItem.Title` throw on the server and moves
    // SubSection partitioning back to the client, where it cannot work.
    ["components/checkbox/checkbox-item.tsx", "server"],
    ["components/radio-group/radio-item.tsx", "server"],
    ["components/selection-item/partition-sub-sections.ts", "server"],
    // selectColumn and actionsColumn build a column definition and call no hook; the parts they render are
    // client modules of their own.
    ["components/data-table/select-column.tsx", "server"],
    ["components/data-table/actions-column.tsx", "server"],
    // Command's footer, hint and shortcut hold no state and read no context, so a server tree
    // renders them inside the client palette. The presets that read the dictionary stay in
    // client modules.
    ["components/command/command-markup.tsx", "server"],
    // The data table filter's model holds no state and imports no React or TanStack runtime, so
    // a server parses request input and filters rows with the same predicates the client runs.
    ["components/data-table-filter/filter-model.ts", "server"],
    ["components/data-table-filter/filter-match.ts", "server"],
    ["components/data-table-filter/filter-fields.ts", "server"],
    ["components/data-table-filter/filter-parse.ts", "server"],
    ["components/data-table-filter/filter-fn.ts", "server"],
    ["components/data-table-filter/filter-summary.ts", "server"],
    ["components/data-table-filter/option-list.ts", "server"],
    ["components/data-table-filter/date-presets.ts", "server"],
    ["components/data-table-filter/data-table-filter-error.ts", "server"],
  ] as const)("keeps the shared module %s %s", (file, rsc) => {
    expectRsc(file, rsc);
  });

  // Why not a lint rule: these files are the server-visible namespace. A directive
  // here would make `Dialog.Root` a client reference again, which lint cannot see.
  // Each index also exports nothing but its namespace object: which module owns a
  // hook, constant or prop type is a per-file ownership decision, not a syntax
  // pattern, so the facade imports those from the implementation module directly.
  it.each([
    ["accordion", "Accordion"],
    ["alert-dialog", "AlertDialog"],
    ["attachment", "Attachment"],
    ["autocomplete", "Autocomplete"],
    ["avatar", "Avatar"],
    ["breadcrumb", "Breadcrumb"],
    ["button-group", "ButtonGroup"],
    ["collapsible", "Collapsible"],
    ["combobox", "Combobox"],
    ["command", "Command"],
    ["command-virtual", "CommandVirtual"],
    ["data-table", "DataTable"],
    ["data-table-filter", "DataTableFilter"],
    ["dialog", "Dialog"],
    ["dropdown-menu", "DropdownMenu"],
    ["field", "Field"],
    ["file-upload", "FileUpload"],
    ["input-group", "InputGroup"],
    ["item", "Item"],
    ["navigation-menu", "NavigationMenu"],
    ["pagination", "Pagination"],
    ["popover", "Popover"],
    ["scroll-area", "ScrollArea"],
    ["select", "Select"],
    ["selection-item", "SelectionItem"],
    ["sheet", "Sheet"],
    ["sidebar", "Sidebar"],
    ["tabs", "Tabs"],
    ["toast", "Toast"],
    ["toggle-group", "ToggleGroup"],
    ["toolbar", "Toolbar"],
    ["tooltip", "Tooltip"],
  ])("%s namespace index stays directive-free and exports only %s", (slug, namespace) => {
    const file = `components/${slug}/index.ts`;
    expectRsc(file, "server");
    expect(exportedNames(file), file).toEqual([namespace]);
  });
});

describe("chart module directives", () => {
  // Why not a lint rule: which chart module a server component may evaluate is a per-module
  // placement decision. A `"use client"` namespace makes `Chart.Root` an opaque client reference,
  // and a part without the directive breaks the server build at its first hook, and lint sees
  // neither module graph.
  const CHART_DIR = "components/chart/";
  const SERVER_CHART_MODULES = [
    "components/chart/chart-namespace.ts",
    "components/chart/pie-chart-namespace.ts",
    "components/chart/radial-chart-namespace.ts",
    "components/chart/radar-chart-namespace.ts",
    "components/chart/scatter-chart-namespace.ts",
    // Each namespace is an ES module namespace over its parts module, so the parts modules stay
    // directive-free too, and a server component still dots into client references.
    "components/chart/chart-parts.ts",
    "components/chart/area-chart-parts.ts",
    "components/chart/bar-chart-parts.ts",
    "components/chart/line-chart-parts.ts",
    "components/chart/pie-chart-parts.ts",
    "components/chart/radial-chart-parts.ts",
    "components/chart/radar-chart-parts.ts",
    "components/chart/scatter-chart-parts.ts",
    "components/chart/sparkline.tsx",
    "components/chart/chart-types.ts",
    "components/chart/chart-format.ts",
    // The paint model is pure, so a directive-free module may read it on the server too.
    "components/chart/chart-paint.ts",
    // The animation loop takes its clock and its frame scheduler from its host and touches no
    // browser API itself, so it needs no directive.
    "components/chart/chart-motion.ts",
  ];
  const chartModules = [...SOURCE_TREE.values()]
    .map((record) => record.relative)
    .filter((file) => file.startsWith(CHART_DIR))
    .sort();

  // The table derives from the folder, so a new chart module is classified the moment it exists.
  const cases = chartModules.map((file): readonly [string, "client" | "server"] => [
    file,
    SERVER_CHART_MODULES.includes(file) ||
    file.startsWith(`${CHART_DIR}format/`) ||
    file.startsWith(`${CHART_DIR}layout/`)
      ? "server"
      : "client",
  ]);

  it("classifies the folder's own modules, the Roots among the client ones", () => {
    expect(cases).toContainEqual(["components/chart/chart-root.tsx", "client"]);
    expect(cases).toContainEqual(["components/chart/format/time-format.ts", "server"]);
    // Layer 06's directive-free Sparkline calls the same scales on the server, so layout/ stays pure.
    expect(cases).toContainEqual(["components/chart/layout/band-scale.ts", "server"]);
  });

  it.each(cases)("keeps %s %s", (file, rsc) => {
    expectRsc(file, rsc);
  });

  it.each([
    ["chart-namespace.ts", ["Chart", "AreaChart", "BarChart", "LineChart"]],
    ["pie-chart-namespace.ts", ["PieChart"]],
    ["radial-chart-namespace.ts", ["RadialChart"]],
    ["radar-chart-namespace.ts", ["RadarChart"]],
    ["scatter-chart-namespace.ts", ["ScatterChart"]],
  ] as const)("%s exports only its namespace objects", (file, names) => {
    expect(exportedNames(`${CHART_DIR}${file}`)).toEqual(names);
  });
});

describe("chart plot marks", () => {
  // Why not a lint rule: the floor oracle is a browser test, which cannot read the source, and lint
  // cannot compare the SVG a module renders with the marks a test walks. This reads every chart
  // part's JSX and holds the oracle's list to it. Chart.Background is left out: it paints a pattern
  // behind the plot and draws no reading. Sparkline is left out too: it draws in a stretched
  // viewBox outside any plot, with no pixel grid to hold its marks to.
  // ScatterChart's parts draw over two value axes with no slot grid, so their own floor oracle,
  // scatter-chart-floor.browser.test.tsx, walks them against the device pixel grid alone.
  const isScatter = (relative: string): boolean => relative.startsWith("components/chart/scatter-chart-");
  const parts = [...SOURCE_TREE.values()].filter(
    (record) =>
      record.relative.startsWith("components/chart/") &&
      record.relative.endsWith(".tsx") &&
      !record.relative.includes(".test.") &&
      record.relative !== "components/chart/chart-background.tsx" &&
      record.relative !== "components/chart/sparkline.tsx"
  );
  const marksOf = (records: readonly (typeof parts)[number][]) =>
    records.flatMap((record) =>
      svgMarks(record.relative, record.source)
        .filter(({ internal }) => !internal)
        .map(({ slot, at }) => ({ file: record.relative, slot, at }))
    );
  const marks = marksOf(parts.filter((record) => !isScatter(record.relative)));
  const scatterMarks = marksOf(parts.filter((record) => isScatter(record.relative)));

  it("names every SVG mark a chart part draws with a data-slot", () => {
    expect(marks.length).toBeGreaterThan(0);
    expect(
      marks.filter(({ slot }) => slot === undefined).map(({ file, at }) => `${file}@${String(at)}`)
    ).toEqual([]);
  });

  it("walks every one of those marks in the floor oracle, and no other", () => {
    const drawn = [...new Set(marks.flatMap(({ slot }) => (slot === undefined ? [] : [slot])))].toSorted();
    expect(drawn).toEqual([...FLOOR_MARKS].toSorted());
  });

  it("names every ScatterChart mark and walks each in the scatter floor oracle, and no other", () => {
    expect(
      scatterMarks.filter(({ slot }) => slot === undefined).map(({ file, at }) => `${file}@${String(at)}`)
    ).toEqual([]);
    const drawn = [
      ...new Set(scatterMarks.flatMap(({ slot }) => (slot === undefined ? [] : [slot]))),
    ].toSorted();
    expect(drawn).toEqual([...SCATTER_FLOOR_MARKS].toSorted());
  });
});

describe("chart colour namespace", () => {
  // Why not a lint rule: oxlint reads no CSS, and one pattern judges chart.css and the chart
  // modules alike; a lint copy for the modules would split the pattern in two. `--color-*` is
  // Tailwind 4's theme namespace, so a chart that wrote `--color-<key>` for a config
  // key named `primary` would repaint every Fuse component inside it. Charts read
  // `--chart-color-<key>` instead.
  const WRITES_THEME_COLOR = /--color-[\w${}.-]*["'`]?\]?\s*:/u;

  it("recognizes a written theme colour property and not a read one", () => {
    expect(WRITES_THEME_COLOR.test('style={{ "--color-price": "red" }}')).toBe(true);
    expect(WRITES_THEME_COLOR.test("[`--color-${key}`]: value")).toBe(true);
    expect(WRITES_THEME_COLOR.test("[data-slot=chart] { --color-primary: red; }")).toBe(true);
    expect(WRITES_THEME_COLOR.test("fill: var(--color-primary);")).toBe(false);
    expect(WRITES_THEME_COLOR.test('style={{ "--chart-color-price": "red" }}')).toBe(false);
  });

  it("writes no --color- custom property from a chart module or chart.css", () => {
    const writers = [...SOURCE_TREE.values()]
      .filter((record) => record.relative.startsWith("components/chart/"))
      .filter((record) => WRITES_THEME_COLOR.test(record.code))
      .map((record) => record.relative);
    const css = readFileSync(join(SRC_ROOT, "components/chart/chart.css"), "utf8").replace(
      /\/\*[\s\S]*?\*\//gu,
      ""
    );
    expect(writers).toEqual([]);
    expect(WRITES_THEME_COLOR.test(css)).toBe(false);
  });
});

describe("chart motion tokens", () => {
  // Why not a lint rule: the tokens live in two languages. chart.css transitions the bars, and the
  // path tween of later layers reads layout/motion.ts, so the two must name one curve and one
  // duration. Unit under test: chart.css's Root declarations. Oracle: layout/motion.ts.
  const css = readFileSync(join(SRC_ROOT, "components/chart/chart.css"), "utf8");
  const declared = (name: string): string | undefined =>
    new RegExp(`${name}:\\s*([^;]+);`, "u").exec(css)?.[1]?.trim();

  it("declares the update duration and the easing that layout/motion.ts exports", () => {
    expect(declared("--chart-update")).toBe(`${String(CHART_UPDATE_MS)}ms`);
    expect(declared("--chart-ease")).toBe(CHART_UPDATE_EASE);
  });

  // The tooltip's glide plays its spring's curve over --chart-glide, so the token is the time the
  // spring takes to settle. Unit under test: chart.css's --chart-glide. Oracle: springEasing of
  // layout/motion.ts's tooltip spring.
  it("declares the tooltip glide as long as its spring takes to settle", () => {
    expect(declared("--chart-glide")).toBe(`${String(springEasing(CHART_SPRINGS.glide).duration)}ms`);
  });
});

describe("chart styles a user can override", () => {
  // Why not a lint rule: oxlint reads no CSS. Chartability heuristic 43 in CONTRACT.md section 9.11
  // asks that a user style sheet and forced colours reach every mark, so chart.css holds no
  // !important; `fuse/no-chart-colour-literal` keeps colour literals out of the chart modules.
  it("keeps !important out of chart.css", () => {
    const css = readFileSync(join(SRC_ROOT, "components/chart/chart.css"), "utf8");
    expect(css.match(/!important/gu) ?? []).toEqual([]);
  });
});

describe("optional peers and the root barrel", () => {
  // Why not a lint rule: the root-barrel boundary is a module graph, not a specifier. A lint ban
  // on the peer would miss an indirect import through a file the root barrel reaches.
  const reached = walkImportedSourceFiles(PACKAGE_ROOT, ["src/index.ts"]).map((file) =>
    file.replace(/^src\//, "")
  );

  it.each(Object.values(OPTIONAL_PEER_ENTRIES))(
    "keeps %s out of everything the root barrel reaches",
    (peer) => {
      expect(reached.filter((file) => readCode(file).includes(peer))).toEqual([]);
    }
  );
});

describe("deleted user-agent and @elmeragroup/lib APIs", () => {
  // Why not a lint rule: oxlint reads no package manifest. `fuse/no-retired-user-agent-api` keeps
  // the retired surface out of package source; this keeps it out of package.json.
  it("does not declare userAgent, UserAgentParserResult, or @elmeragroup/lib in the manifest", () => {
    const manifest = readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8");
    expect(manifest).not.toMatch(/\buserAgent\b/);
    expect(manifest).not.toMatch(/\bUserAgentParserResult\b/);
    expect(manifest).not.toMatch(/@elmeragroup\/lib/);
  });
});

describe("density stays out of subtree theming", () => {
  // Why not a lint rule: the boundary is a module graph, not a specifier. Density is a
  // document-root stamp the host owns, so nothing ThemeProvider or ThemeScope pulls in may
  // reach the density owners or write `data-density`; a specifier ban would miss the
  // attribute and any indirect import.
  const DENSITY_OWNERS = ["theme/density.ts", "theme/tokens/density-metrics.ts"];

  it("keeps the density owners and the data-density stamp off the ThemeProvider and ThemeScope graph", () => {
    const graph = walkImportedSourceFiles(PACKAGE_ROOT, [
      "src/theme/theme-provider.tsx",
      "src/theme/theme-scope.tsx",
    ]).map((file) => file.replace(/^src\//, ""));
    // Neither entry imports validate-theme.ts directly, so reaching it proves the walk is
    // transitive. Re-pin a depth-2-only file if an entry ever imports it.
    expect(graph).toEqual(expect.arrayContaining(["theme/theme-attributes.ts", "theme/validate-theme.ts"]));
    expect(graph.filter((file) => DENSITY_OWNERS.includes(file))).toEqual([]);
    expect(graph.filter((file) => readCode(file).includes("data-density"))).toEqual([]);
  });
});

describe("density roles", () => {
  // Why not a lint rule: the oracle is the part table in theme/tokens/density-roles.ts, and a
  // per-file lint rule cannot see the slot inventory across files. The docs coverage test checks
  // the rendered parts, but demos do not render every part, so the source must declare them all.
  it("recognizes a slot written as an attribute, a prop key or useRender state, and not a React Aria slot", () => {
    expect(
      writtenSlots(
        "probe.tsx",
        'const props = { "data-slot": "a" }; useRender({ state: { slot: "b" } }); <P data-slot="c" dataSlot={"d"} slot="title" data-slot={name} />'
      )
    ).toEqual(["a", "b", "c", "d"]);
  });

  // Parsed once: both directions of the inventory read the same slots.
  const slotsByFile = [...SOURCE_TREE.values()].map(
    (record) => [record.relative, writtenSlots(record.relative, record.source)] as const
  );

  it("declares a density role for every data-slot the package writes", () => {
    const undeclared = slotsByFile.flatMap(([file, slots]) =>
      slots.filter((slot) => !Object.hasOwn(PART_DENSITY, slot)).map((slot) => `${file}: ${slot}`)
    );
    expect(undeclared).toEqual([]);
  });

  it("declares no part the package does not write", () => {
    const written = new Set(slotsByFile.flatMap(([, slots]) => slots));
    const stale = Object.keys(PART_DENSITY).filter(
      (part) => !written.has(/^[a-z0-9-]+/u.exec(part)?.[0] ?? part)
    );
    expect(stale).toEqual([]);
  });

  it("keys every override as its slot plus a selector suffix the coverage test can match", () => {
    // The docs coverage test splits an override key at the first `[` or `:` into the slot and a
    // suffix it appends to `[data-slot="slot"]`; any other key would match no part there.
    const malformed = Object.keys(PART_DENSITY).filter((part) => !/^[a-z0-9-]+(?:[[:].*)?$/u.test(part));
    expect(malformed).toEqual([]);
  });
});

describe("Twemoji artwork fidelity", () => {
  // Why not a lint rule: the contract is that the bundled third-party artwork
  // is a verbatim lift of the Twemoji path data the NOTICE file attributes.
  // A lint rule cannot know which literal is the licensed
  // original; the path data itself is the contract, so it is pinned here.
  it("keeps the lifted Twemoji path data and fills verbatim", () => {
    const source = readSrc("components/emoji/emoji.tsx");
    expect(source).toContain('d="M25.485 27.379C25.44 27.2 24.317 23 18 23c-6.318 0-7.44 4.2-7.485 4.379');
    expect(source).toContain('d="M10.515 23.621C10.56 23.8 11.683 28 18 28c6.318 0 7.44-4.2 7.485-4.379');
    expect(source).toContain('fill="#5DADEC"');
    expect(source).toContain('fill="#269"');
  });
});

describe("runtime listeners and layout motion", () => {
  // Why not a lint rule: both are closed lists of reviewed owners across the tree. A rule
  // banning the call or the class would need an exemption per owner and still could not
  // say the list is complete. Each owner's browser test covers its own cleanup.
  it("installs event listeners only from the reviewed owners", () => {
    expect(filesContainingCode(".addEventListener(").toSorted()).toEqual([
      // Root's figure `animationend`: the first entrance wipe to end drops `data-entrance`, so no
      // layer wipes again once hidden and shown. A React `onAnimationEnd` on Root would sit beside
      // a consumer's own handler, which Root's spread props replace. The same owner listens on
      // the window for `beforeprint`, and for `scroll` and `resize` only while a plot waits.
      "components/chart/chart-entrance.ts",
      // `document.fonts` `loadingdone`: a web font that loads after the pill measured its label
      // widths changes them, and React has no FontFaceSet handler.
      "components/chart/chart-slot-label.tsx",
      // Window `scroll`, in the capture phase, and `resize`: a scroll anywhere in the page or a
      // resize of the window moves the tooltip's positioner, which stops its glide at once. A
      // scroll in a container does not bubble, and React has no window listener.
      "components/chart/chart-tooltip-glide.ts",
      // Native non-passive `wheel` on the chip strip: React's `onWheel` is passive, so it cannot
      // keep the page from scrolling while a vertical wheel scrolls the strip sideways.
      "components/data-table-filter/strip-wheel.ts",
      // Document `dragover` and `drop`, ref-counted across Roots: a file dropped outside every
      // zone would otherwise open in the tab and replace the page.
      "components/file-upload/document-drop-guard.ts",
      // Document `paste` and `beforepaste`: Firefox targets `<body>` for a paste while a button has
      // focus, so a listener on the Root would miss it.
      "components/file-upload/file-upload.tsx",
      // Native `beforeinput`: React's `onBeforeInput` is a `textInput`/`keypress` polyfill that misses
      // paste in Firefox. The numeric filter strips a paste before maxlength.
      "components/input/input.tsx",
      "components/sidebar/sidebar.tsx",
      "hooks/use-form-reset.ts",
      "hooks/use-media-query.ts",
      "hooks/use-predicted-events.ts",
      // Window `resize`: a fixed-height clipping scope taller than the viewport never resizes,
      // yet a shorter viewport still takes room from the popover's side.
      "react-aria/internal/popover.tsx",
      "theme/color-scheme-browser-platform.ts",
    ]);
  });

  // Why not a lint rule: the rule is "the adapter is the only owner", a closed list that a
  // ban-with-exemptions rule cannot state as complete. The closed bootstrap is the one
  // exception, because it is serialized into the page and runs before the bundle. Outside
  // theme/, use-media-query owns every query.
  it("touches matchMedia, localStorage and data-theme in theme/ only through the browser adapter", () => {
    const inTheme = (needle: string) =>
      filesContainingCode(needle)
        .filter((file) => file.startsWith("theme/"))
        .toSorted();
    const owners = ["theme/color-scheme-browser-platform.ts", "theme/color-scheme-script.tsx"];
    expect(inTheme("matchMedia")).toEqual(owners);
    expect(inTheme("localStorage")).toEqual(owners);
    // The closing quote keeps `data-theme-variant` and the other data-theme-* attributes out.
    expect(inTheme('"data-theme"')).toEqual(owners);
  });

  it("transitions layout properties only in the reviewed places", () => {
    // Everything else animates transform, opacity and colour. The central reduced-motion
    // rule in fuse.css also disables these.
    const layoutTransition =
      /transition-(?:all|\[[^\]]*(?:height|width|padding|margin|inset|top|right|bottom|left|grid)[^\]]*\])/u;
    const owners = [...SOURCE_TREE.values()]
      .filter((record) => layoutTransition.test(record.code))
      .map((record) => record.relative);
    expect(owners.toSorted()).toEqual([
      // The data table filter's value popover follows Base UI's --popup-height and glides its
      // positioner from chip to chip, and its add menu morphs its height between the field list
      // and an editor drilled into in place.
      "components/data-table-filter/data-table-filter-variants.ts",
      // Item.Footer, and so every SelectionItem.SubSection, tweens its grid row and top padding
      // between `hidden` and `visible`.
      "components/item/item-footer-variants.ts",
      "components/meter/meter-variants.ts",
      // Base UI sizes and places the shared popup through its --popup-* and --positioner-* variables.
      "components/navigation-menu/navigation-menu-variants.ts",
      // The panel's gap and container tween their width as the rail collapses.
      "components/sidebar/sidebar-variants.ts",
      "styles/panel-height.ts",
    ]);
  });
});

/** A variant that reads another element's state (`group-*`, `peer-*`, `in-*`) styles a part. */
function readsAnotherElement(variant: string): boolean {
  return /^(?:group|peer|in)-/u.test(variant);
}

/**
 * A disabled dim or pointer-events drop the control writes on itself, rather than taking
 * it from the state face.
 */
function isLocalDisabledDim(token: string): boolean {
  const { variants, utility } = splitVariants(token);
  if (!/^(?:opacity-\d+|pointer-events-none)$/u.test(utility)) return false;
  if (variants.some(readsAnotherElement)) return false;
  return variants.some(
    (variant) =>
      /^(?:disabled|data-disabled|aria-disabled|has-disabled|disabled-state)$/u.test(variant) ||
      (/^(?:data|aria|has)-\[/u.test(variant) && variant.includes("disabled"))
  );
}

/**
 * A `hover:` or `active:` face with no `enabled-*` gate in front of it. A token with no
 * utility after its last colon is an object key such as ScrollArea's `hover:` type, not a class.
 */
function isUngatedPointerFace(token: string): boolean {
  const { variants, utility } = splitVariants(token);
  return utility.length > 0 && (variants.includes("hover") || variants.includes("active"));
}

const BARE_DISABLED_DIM = /^(?:opacity-\d+|pointer-events-none)$/u;

/**
 * The bare dims a `tv` map writes inside a disabled-named variant arm (`isDisabled: { … }`
 * or `disabled: { … }`). The arm, not a selector, carries the state there, so the dim has
 * no `disabled:` variant for {@link isLocalDisabledDim} to see.
 */
function disabledArmDims(code: string): string[] {
  const dims: string[] = [];
  for (const match of code.matchAll(/\b(?:isDisabled|disabled)\s*:\s*\{/gu)) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    let close = open;
    for (; close < code.length; close += 1) {
      if (code[close] === "{") depth += 1;
      if (code[close] === "}") depth -= 1;
      if (depth === 0) break;
    }
    dims.push(...classTokens(code.slice(open + 1, close)).filter((token) => BARE_DISABLED_DIM.test(token)));
  }
  return dims;
}

/**
 * The bare dims a component adds behind a disabled-named prop condition
 * (`isVisuallyDisabled && "opacity-70"` or `isDisabled ? "opacity-50" : …`). The condition,
 * not a selector or a `tv` arm, carries the state there.
 */
function disabledConditionDims(code: string): string[] {
  const dims: string[] = [];
  for (const match of code.matchAll(/\b\w*[Dd]isabled\w*\s*(?:&&|\?)\s*(["'`])([^"'`]*)\1/gu)) {
    dims.push(...classTokens(match[2] ?? "").filter((token) => BARE_DISABLED_DIM.test(token)));
  }
  return dims;
}

/** Every flagged token per file, deduplicated and sorted, for files with at least one. */
function flaggedTokensByFile(flagged: (code: string) => string[]) {
  return Object.fromEntries(
    [...SOURCE_TREE.values()]
      .map((record) => [record.relative, [...new Set(flagged(record.code))].toSorted()] as const)
      .filter(([, tokens]) => tokens.length > 0)
      .toSorted(([a], [b]) => a.localeCompare(b))
  );
}

function localDisabledDims(code: string): string[] {
  return [
    ...classTokens(code).filter(isLocalDisabledDim),
    ...disabledArmDims(code),
    ...disabledConditionDims(code),
  ];
}

function ungatedPointerFaces(code: string): string[] {
  return classTokens(code).filter(isUngatedPointerFace);
}

function allowedPaints(role: ColorTokenName): readonly TokenPaint[] {
  return TOKEN_PAINTS[role];
}

describe("token paints", () => {
  // Why not a lint rule: the oracle is the paint table in theme/tokens/contract.ts, and a route
  // into a token takes the paints that token is drawn with anywhere in the tree, which no per-file
  // rule sees. The unit under test is TOKEN_PAINTS. The oracle is where the library's
  // own classes paint each role, so a role the Figma sync hides from a picker is never one a
  // component paints there. A role routed into a color token's own property, such as `--ring`,
  // takes every paint the scan finds that token drawn with anywhere in the tree, never the paints
  // TOKEN_PAINTS gives it. That goes one hop: `drawn` holds only the paints classes draw, so a
  // token that is itself routed into a second token does not pass on the second token's paints.
  // `test/class-tokens.ts` owns the class parsing and names the routes it cannot follow.
  it("paints every color role only where its paints allow", () => {
    // Scanned once per file: the drawn table and the per-file check read the same paints.
    const paintsByCode = new Map(
      [...SOURCE_TREE.values()].map(({ code }) => [code, colorRolePaints(code)] as const)
    );
    const paintsOf = (code: string) => paintsByCode.get(code) ?? [];
    const drawn = new Map<ColorTokenName, Set<TokenPaint>>();
    for (const paints of paintsByCode.values()) {
      for (const { role, paint } of paints) {
        drawn.set(role, new Set([...(drawn.get(role) ?? []), paint]));
      }
    }
    const outside = (code: string) => [
      ...paintsOf(code)
        .filter(({ role, paint }) => !allowedPaints(role).includes(paint))
        .map(({ role, paint, token }) => `${token} paints ${role} as ${paint}`),
      ...tokenAssignments(code).flatMap(({ target, role, token }) =>
        [...(drawn.get(target) ?? [])]
          .filter((paint) => !allowedPaints(role).includes(paint))
          .map((paint) => `${token} routes ${role} into ${target}, drawn as ${paint}`)
      ),
    ];
    expect(flaggedTokensByFile(outside)).toEqual({});
  });
});

describe("state faces", () => {
  // Why not a lint rule: the exceptions are a reviewed inventory keyed by file and exact token,
  // so a new token in a listed file and a stale exception both fail, and the class parsing is
  // test/class-tokens.ts, which the token-paints oracle shares. The upstream proposal is the
  // `elmera` rule `no-local-state-face` (see the open-work list). Until it ships, this walk is
  // the gate: `styles/state-face.ts` owns the disabled dim, and hover and press faces sit
  // behind the `enabled-hover:` / `enabled-active:` variants from fuse.css.
  it("recognizes a local disabled dim and an ungated pointer face, and not the gated forms", () => {
    for (const token of [
      "disabled:opacity-50",
      "data-disabled:opacity-50",
      "aria-disabled:pointer-events-none",
      "has-disabled:opacity-50",
      "has-[[data-slot=input-group-control]:disabled]:opacity-50",
      "data-open:disabled:opacity-70",
      "disabled-state:opacity-50",
    ]) {
      expect(isLocalDisabledDim(token), token).toBe(true);
    }
    for (const token of [
      "group-data-disabled/field:opacity-50",
      "peer-data-disabled:opacity-50",
      "disabled:bg-muted",
      "opacity-50",
      "data-[hovering]:pointer-events-auto",
    ]) {
      expect(isLocalDisabledDim(token), token).toBe(false);
    }
    for (const token of [
      "hover:bg-muted",
      "active:scale-[0.96]",
      "data-open:hover:bg-muted",
      "*:[a]:hover:x",
    ]) {
      expect(isUngatedPointerFace(token), token).toBe(true);
    }
    for (const token of ["enabled-hover:bg-muted", "enabled-active:scale-[0.96]", "group-hover:bg-muted"]) {
      expect(isUngatedPointerFace(token), token).toBe(false);
    }
    expect(disabledArmDims('isDisabled: { true: "opacity-75" }')).toEqual(["opacity-75"]);
    expect(disabledArmDims('disabled: { true: { root: "cursor-not-allowed pointer-events-none" } }')).toEqual(
      ["pointer-events-none"]
    );
    expect(disabledArmDims("isDisabled: { true: racDisabledStateFaceClass }")).toEqual([]);
    expect(
      disabledArmDims('variant: { muted: "opacity-50" }, isDisabled: { true: "cursor-not-allowed" }')
    ).toEqual([]);
    // Button's old dim, added behind its prop rather than a selector or a `tv` arm.
    expect(localDisabledDims('cn(base, isVisuallyDisabled && "opacity-70")')).toEqual(["opacity-70"]);
    expect(disabledConditionDims('isDisabled ? "pointer-events-none" : "cursor-pointer"')).toEqual([
      "pointer-events-none",
    ]);
    expect(localDisabledDims('isVisuallyDisabled && "cursor-not-allowed"')).toEqual([]);
    expect(disabledConditionDims('isOpen && "opacity-0"')).toEqual([]);
    expect(disabledConditionDims("isDisabled && racDisabledStateFaceClass")).toEqual([]);
  });

  it("dims a disabled control only through the state face", () => {
    // Reviewed exceptions, keyed by file and exact token so a new dim in a listed file still
    // fails: option rows inside a popup list are parts, not whole controls. They keep
    // `pointer-events-none` so the pointer never highlights a disabled option. The slider
    // thumb cancels the dim instead of adding one: it is drawn over the track and indicator,
    // and a translucent thumb lets them show through its centre.
    const { "styles/state-face.ts": _owner, ...copies } = flaggedTokensByFile(localDisabledDims);
    expect(copies).toEqual({
      "components/overlay/menu-row-classes.ts": [
        "data-disabled:opacity-50",
        "data-disabled:pointer-events-none",
      ],
      "components/slider/slider-variants.ts": ["aria-disabled:opacity-100", "data-disabled:opacity-100"],
      "react-aria/internal/picker-presets.tsx": ["data-disabled:pointer-events-none"],
    });
  });

  it("gates every hover and press face on a control that can be disabled", () => {
    // Reviewed exceptions, keyed by file and exact token, none of which paints a control
    // that can be disabled. A new ungated token in a listed file still fails.
    expect(flaggedTokensByFile(ungatedPointerFaces)).toEqual({
      // The action Button's fill override; the action has no disabled state.
      "components/alert/alert-variants.ts": [
        "hover:bg-error/90",
        "hover:bg-info/90",
        "hover:bg-success/90",
        "hover:bg-warning/90",
      ],
      // Links, which have no disabled state.
      "components/breadcrumb/breadcrumb-variants.ts": ["hover:text-foreground"],
      "components/dialog/dialog-variants.ts": ["*:[a]:hover:text-foreground"],
      "components/navigation-menu/navigation-menu-variants.ts": [
        "hover:**:text-accent-foreground",
        "hover:bg-accent",
        "hover:bg-muted",
        "hover:text-accent-foreground",
      ],
      // The country trigger adds its hover and press faces only while the field is editable.
      "components/phone-number-field/phone-number-field.tsx": ["active:scale-[0.97]", "hover:bg-muted"],
      // The rail, an aria-hidden resize handle that is never disabled.
      "components/sidebar/sidebar-class.ts": [
        "hover:after:bg-sidebar-border",
        "hover:group-data-[collapsible=offcanvas]:bg-sidebar",
      ],
      // Rows, which are not controls.
      "components/table/table.tsx": [
        "framed-table:*:[tr]:hover:*:[td]:bg-transparent",
        "framed-table:*:[tr]:hover:bg-transparent",
        "framed-table:hover:bg-transparent",
        "hover:bg-muted/72",
        "hover:bg-transparent",
      ],
      // Day cells and list rows, parts whose disabled face is muted text.
      "styles/calendar.ts": ["hover:bg-muted", "hover:bg-transparent"],
      "styles/grid-list.ts": ["hover:bg-muted", "hover:bg-muted/80"],
    });
  });
});

/** A JSX tag as written, such as `ComboboxPrimitive.Input`. */
function tagName(name: JSXElementName): string {
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXNamespacedName") return `${name.namespace.name}:${name.name.name}`;
  return `${tagName(name.object)}.${name.property.name}`;
}

function openingElements(relativePath: string, source: string): JSXOpeningElement[] {
  const parsed = parseSync(relativePath, source);
  expect(parsed.errors, relativePath).toEqual([]);
  const elements: JSXOpeningElement[] = [];
  new Visitor({ JSXOpeningElement: (element) => void elements.push(element) }).visit(parsed.program);
  return elements;
}

function isDefinedPropsCall(expression: Expression): boolean {
  return (
    expression.type === "CallExpression" &&
    expression.callee.type === "Identifier" &&
    expression.callee.name === "definedProps"
  );
}

/** Each listed part in the source, with `raw` for every spread that skips `definedProps(…)`. */
function wiringPartSpreads(relativePath: string, source: string, parts: ReadonlySet<string>): string[] {
  return openingElements(relativePath, source).flatMap((element) => {
    const tag = tagName(element.name);
    if (!parts.has(tag)) return [];
    const raw = element.attributes.filter(
      (attribute) => attribute.type === "JSXSpreadAttribute" && !isDefinedPropsCall(attribute.argument)
    );
    return [raw.length === 0 ? tag : `${tag} raw`];
  });
}

/**
 * The Base UI parts that read Field or Labelable context, plus Button (aria-disabled) and
 * the Sheet and Command.Content popups (dialog ARIA), keyed by the module that renders each one.
 */
const WIRING_PARTS = {
  "components/autocomplete/autocomplete.tsx": [
    "AutocompletePrimitive.Trigger",
    "AutocompletePrimitive.Clear",
    "AutocompletePrimitive.Input",
  ],
  "components/button/button.tsx": ["ButtonPrimitive"],
  "components/checkbox-card/checkbox-card.tsx": ["FieldPrimitive.Label", "CheckboxPrimitive.Root"],
  "components/checkbox/checkbox.tsx": ["CheckboxPrimitive.Root", "CheckboxGroupPrimitive"],
  "components/combobox/combobox.tsx": [
    "ComboboxPrimitive.Trigger",
    "ComboboxPrimitive.Clear",
    "ComboboxPrimitive.Input",
  ],
  "components/command/command.tsx": ["AutocompletePrimitive.Input", "DialogPrimitive.Popup"],
  "components/field/field.tsx": [
    "FieldsetPrimitive.Root",
    "FieldsetPrimitive.Legend",
    "FieldPrimitive.Label",
    "FieldPrimitive.Control",
    "FieldPrimitive.Description",
    "FieldPrimitive.Error",
  ],
  "components/input/input.tsx": ["InputPrimitive"],
  "components/number-field/number-field.tsx": [
    "NumberFieldPrimitive.Root",
    "NumberFieldPrimitive.Input",
    "NumberFieldPrimitive.Decrement",
    "NumberFieldPrimitive.Increment",
  ],
  "components/phone-number-field/phone-number-field.tsx": [
    "ComboboxPrimitive.Trigger",
    "ComboboxPrimitive.Input",
  ],
  "components/radio-group/radio-group.tsx": [
    "RadioPrimitive.Root",
    "RadioGroupPrimitive",
    "FieldPrimitive.Label",
  ],
  "components/selection-item/selection-item.tsx": ["FieldPrimitive.Label", "FieldItem"],
  "components/sheet/sheet.tsx": ["SheetPrimitive.Popup"],
  "components/slider/slider.tsx": ["SliderPrimitive.Root", "SliderPrimitive.Thumb"],
  "components/switch/switch.tsx": ["SwitchPrimitive.Root"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

describe("Base UI prop wiring", () => {
  // Why not a lint rule: the table is a reviewed inventory. Each listed module must still render
  // every part it names, through definedProps, so a renamed or dropped part fails here; a per-file
  // rule cannot know which parts a module must render. `fuse/render-element-wiring` keeps state and
  // wiring off inline render elements.
  it("recognizes a raw spread on a wiring part and the definedProps spread", () => {
    const parts = new Set(["S.Root"]);
    expect(wiringPartSpreads("probe.tsx", "<S.Root {...props} />", parts)).toEqual(["S.Root raw"]);
    expect(wiringPartSpreads("probe.tsx", "<S.Root {...definedProps(props)} />", parts)).toEqual(["S.Root"]);
    expect(wiringPartSpreads("probe.tsx", "<S.Thumb {...props} />", parts)).toEqual([]);
  });

  it.each(Object.entries(WIRING_PARTS))(
    "%s spreads consumer props onto its wiring parts only through definedProps",
    (file, parts) => {
      // Base UI's mergeProps copies a present undefined over the part's own value, so a
      // forwarded `aria-labelledby={undefined}` erased Field's label (#62). The module that
      // renders the part filters; the wrappers above it spread raw.
      const found = wiringPartSpreads(file, readSrc(file), new Set(parts));
      expect(found.filter((site) => site.endsWith(" raw"))).toEqual([]);
      expect(new Set(found)).toEqual(new Set(parts));
    }
  );
});
