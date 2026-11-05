/**
 * Packed checks of the preview chart entry that need no consumer install: tree shaking per
 * family and the growth rule in the published declarations.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "playwright";
import { rolldown } from "rolldown";

/**
 * The computed `display` of the two `Chart.Root` figures a packed consumer page renders, the
 * default one and the one with `className="block"`, in that order. Under CSS Cascade 5 they read
 * `grid` and `block` whichever order the stylesheets load in.
 *
 * @param page - The consumer page, with its stylesheets loaded.
 * @returns The two display values.
 */
export async function readChartDisplays(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    ["#chart-default", "#chart-block"].map((selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`);
      return getComputedStyle(element).display;
    })
  );
}

/**
 * The growth rule, verbatim from CONTRACT.md section 1. A consumer reads the preview label and
 * this rule in the namespace JSDoc, so the published declarations must carry it.
 */
const GROWTH_RULE =
  "Every later chart change follows the growth rule. A new capability becomes a new part, a variant or datum-selector value, a `config` field, a Root prop that describes the data's shape or a Panel prop that mirrors one, Root state or a data attribute. It never becomes a boolean or mode prop on a part below Root.";

const PREVIEW_LABEL = "Preview: names and props can change until Fuse's first stable release.";

/** The namespace declarations `chart.d.ts` re-exports, which carry the rule in their JSDoc. */
const NAMESPACE_DECLARATIONS = [
  "components/chart/chart-namespace.d.ts",
  "components/chart/pie-chart-namespace.d.ts",
  "components/chart/radial-chart-namespace.d.ts",
  "components/chart/radar-chart-namespace.d.ts",
  "components/chart/scatter-chart-namespace.d.ts",
] as const;

/** A declaration file's comment text with the JSDoc line prefixes removed and spaces collapsed. */
function commentProse(source: string): string {
  return source
    .split("\n")
    .map((line) => line.replace(/^\s*\/?\*+\/?\s?/u, ""))
    .join(" ")
    .replace(/\s+/gu, " ");
}

/**
 * The preview label and the growth rule appear once per namespace constant in the packed
 * declarations. tsdown drops the facade's `@packageDocumentation` block from `chart.d.ts`, which
 * is why each namespace constant repeats both.
 *
 * @param extracted - The extracted tarball's `package/` directory.
 * @throws When a namespace declaration lacks the label or the rule, or `chart.d.ts` stops
 * re-exporting it.
 */
export function checkPackedGrowthRule(extracted: string): void {
  const facade = readFileSync(join(extracted, "chart.d.ts"), "utf8");
  for (const file of NAMESPACE_DECLARATIONS) {
    const specifier = `./${file.replace(/\.d\.ts$/u, ".js")}`;
    if (!facade.includes(specifier)) {
      throw new Error(`chart.d.ts does not re-export ${specifier}`);
    }
    const prose = commentProse(readFileSync(join(extracted, file), "utf8"));
    for (const [name, text] of [
      ["preview label", PREVIEW_LABEL],
      ["growth rule", GROWTH_RULE],
    ] as const) {
      if (!prose.includes(text)) {
        throw new Error(`${file} lacks the ${name} in its JSDoc`);
      }
    }
  }
}

/** One bundled route: its output code, the packed modules it pulled in and its package imports. */
type Route = {
  readonly code: string;
  readonly modules: readonly string[];
  readonly imports: readonly string[];
};

async function bundleRoute(extracted: string, work: string, name: string, source: string): Promise<Route> {
  const input = join(work, `${name}.js`);
  writeFileSync(input, source.replace("<chart>", JSON.stringify(join(extracted, "chart.js"))));
  const bundle = await rolldown({
    input,
    platform: "browser",
    // Only Fuse's own modules are under test, so every package import stays external.
    external: (id) => !id.startsWith(".") && !id.startsWith("/"),
  });
  try {
    const { output } = await bundle.generate({ format: "esm", minify: true });
    const [chunk, ...rest] = output.filter((file) => file.type === "chunk");
    if (chunk === undefined || rest.length > 0) {
      throw new Error(`the ${name} route did not bundle to one chunk`);
    }
    return {
      code: chunk.code,
      modules: chunk.moduleIds.map((id) => id.replaceAll("\\", "/")),
      imports: chunk.imports,
    };
  } finally {
    await bundle.close();
  }
}

function modulesMatching(route: Route, pattern: RegExp): string[] {
  return route.modules.filter((id) => pattern.test(id.split("/").at(-1) ?? id));
}

/**
 * What a route must not ship: Fuse modules by file name, and package imports by specifier. Every
 * package import stays external in these bundles, so Base UI's tooltip and toggle group, which
 * carry its floating-ui code, show as imports.
 */
type Forbidden = {
  readonly label: string;
  readonly module?: RegExp;
  readonly external?: RegExp;
  /** A string the code of a part carries, such as its `data-slot`, in whichever quotes minifying picks. */
  readonly text?: RegExp;
};

/** The parts a bar route of Root, Grid, both axes and Bar must not ship, with their libraries. */
const BAR_ROUTE_FORBIDDEN: readonly Forbidden[] = [
  { label: "Tooltip", module: /^chart-tooltip\./u, external: /^@base-ui\/react\/tooltip(\/|$)/u },
  { label: "Table", module: /^chart-table\./u },
  {
    label: "LegendToggleGroup",
    module: /^chart-legend\./u,
    external: /^@base-ui\/react\/toggle-group(\/|$)/u,
  },
  { label: "floating-ui", external: /^@floating-ui\/|^@base-ui\/react\/(popover|tooltip|menu)(\/|$)/u },
];

/** The cartesian series model and its readout, which the radar and clock reuse and items never read. */
const SERIES_MODEL: readonly Forbidden[] = [
  { label: "cartesian model", module: /^cartesian-model\./u },
  { label: "series readout", module: /^chart-series-readout\./u },
];

/** The cartesian Root's own modules: its context, Root, surface, pick and measured plot. */
const CARTESIAN_ROOT: readonly Forbidden[] = [
  { label: "cartesian context", module: /^chart-context\./u },
  { label: "cartesian Root", module: /^chart-root\./u },
  { label: "cartesian surface", module: /^chart-surface\./u },
  { label: "cartesian plot", module: /^chart-plot\./u },
];

/**
 * The cartesian code `ScatterChart.Root` must not ship: the cartesian store, readout and model, and
 * the cartesian Root's modules. A scatter Root measures its plot through `chart-plot-measure` and
 * owns a store of its own.
 */
const SCATTER_ROUTE_FORBIDDEN: readonly Forbidden[] = [
  { label: "cartesian store", module: /^chart-store\./u },
  { label: "readout", module: /^chart-readout\./u },
  { label: "cartesian model", module: /^cartesian-model\./u },
  ...CARTESIAN_ROOT,
];

/**
 * The cartesian geometry no polar route ships (S15): the cartesian Root's modules, its plot frame,
 * the bar geometry, the cartesian readout and tooltip anchor with its roof, and the cartesian
 * Tooltip and Table, whose shared parts a polar namespace reads from their neutral modules. A polar
 * Root shares the store, the readout hooks, the listbox and the motion loop.
 */
const POLAR_ROUTE_FORBIDDEN: readonly Forbidden[] = [
  ...CARTESIAN_ROOT,
  { label: "cartesian pick", module: /^chart-pick\./u },
  { label: "plot frame", module: /^plot-frame\./u },
  { label: "bar geometry", module: /^(chart-bar(-[a-z]+)?|bar-geometry)\./u },
  { label: "cartesian readout", module: /^chart-readout-cartesian\./u },
  { label: "cartesian tooltip anchor", module: /^chart-tooltip-(anchor|roof)\./u },
  { label: "cartesian Tooltip", module: /^chart-tooltip\./u },
  { label: "cartesian Table", module: /^chart-table\./u },
];

/**
 * What a clock route must not ship: the polar rule, the cartesian plot geometry and the cartesian
 * path code. A clock reads the series model, which it may ship, and draws its own dial (S15).
 */
const CLOCK_ROUTE_FORBIDDEN: readonly Forbidden[] = [
  ...POLAR_ROUTE_FORBIDDEN,
  { label: "plot geometry", module: /^plot-geometry\./u },
  { label: "cartesian paths", module: /^(chart-path-draw|chart-series-path|line-path)\./u },
];

/** A rule that a route must not ship a part, found by the `data-slot` its code writes. */
function slotRule(label: string, slot: string): Forbidden {
  return { label, text: new RegExp(`["'\`]${slot}["'\`]`, "u") };
}

/**
 * A route of one polar part alone, what it must not ship, and the parts whose route ships all of
 * that, its control. Each part module keeps its display name beside its component, so a bundler
 * drops the parts a route never names (Q1).
 */
type PartRoute = {
  readonly part: string;
  readonly forbidden: readonly Forbidden[];
  readonly control: string;
};

/** The single-part routes: each must ship none of its rules, and its control must trip all of them. */
const PART_ROUTES: readonly PartRoute[] = [
  {
    // The stack floors and M4 decimation are what only a Column reads.
    part: "ClockChart.Line",
    forbidden: [
      slotRule("Column", "clock-chart-column"),
      slotRule("Marker", "clock-chart-marker"),
      slotRule("ValueLabel", "clock-chart-value-label"),
      slotRule("ActiveDot", "clock-chart-active-dot"),
      { label: "useStackSeat", module: /^chart-stack-floors\./u },
      { label: "m4Indexes", module: /^decimate\./u },
    ],
    control: "ClockChart.Column, ClockChart.Marker, ClockChart.ValueLabel, ClockChart.ActiveDot",
  },
  {
    // The label fitting is what only the axes and Now read.
    part: "ClockChart.Grid",
    forbidden: [
      slotRule("AngleAxis", "clock-chart-angle-axis"),
      slotRule("RadiusAxis", "clock-chart-radius-axis"),
      slotRule("ReferenceLine", "clock-chart-reference-line"),
      slotRule("ReferenceArea", "clock-chart-reference-area"),
      slotRule("Scrubber", "clock-chart-scrubber"),
      slotRule("Now", "clock-chart-now"),
      { label: "label fitting", module: /^ring-labels\./u },
    ],
    control:
      "ClockChart.AngleAxis, ClockChart.RadiusAxis, ClockChart.ReferenceLine, ClockChart.ReferenceArea, ClockChart.Scrubber, ClockChart.Now",
  },
  {
    part: "ClockChart.Center",
    forbidden: [slotRule("TooltipTotal", "chart-tooltip-total")],
    control: "ClockChart.TooltipTotal",
  },
  {
    part: "RadarChart.Grid",
    forbidden: [
      slotRule("AngleAxis", "radar-chart-angle-axis"),
      slotRule("RadiusAxis", "radar-chart-radius-axis"),
      { label: "label fitting", module: /^ring-labels\./u },
    ],
    control: "RadarChart.AngleAxis, RadarChart.RadiusAxis",
  },
  {
    part: "RadarChart.Line",
    forbidden: [slotRule("ActiveDot", "radar-chart-active-dot"), slotRule("Glow", "radar-chart-glow")],
    control: "RadarChart.ActiveDot, RadarChart.Glow",
  },
  {
    // The digit roll is what only the centre's numbers read.
    part: "PieChart.Center",
    forbidden: [
      slotRule("CenterValue", "pie-chart-center-value"),
      slotRule("CenterShare", "pie-chart-center-share"),
      slotRule("CenterMax", "pie-chart-center-max"),
      { label: "digit roll", module: /^chart-digit-roll\./u },
    ],
    control: "PieChart.CenterValue, PieChart.CenterShare, PieChart.CenterMax",
  },
];

/** A route that exports the named parts of the chart entry. */
function partsSource(parts: string): string {
  const families = [...new Set(parts.split(", ").map((part) => part.split(".")[0]))];
  return `import { ${families.join(", ")} } from <chart>;\nexport const parts = [${parts}];\n`;
}

/** The cartesian parts whose route ships everything the clock rule names, its control. */
const CLOCK_CONTROL_PARTS = "Chart.Root, Chart.Line, Chart.Bar, Chart.Tooltip, Chart.Table";

/** What an item route, Pie or Radial, must not ship: the polar rule and the series model. */
const ITEM_ROUTE_FORBIDDEN: readonly Forbidden[] = [...POLAR_ROUTE_FORBIDDEN, ...SERIES_MODEL];

/** The polar families whose Root and namespace routes the rules bundle. */
const POLAR_FAMILIES = [
  { name: "PieChart", forbidden: ITEM_ROUTE_FORBIDDEN },
  { name: "RadialChart", forbidden: ITEM_ROUTE_FORBIDDEN },
  { name: "RadarChart", forbidden: POLAR_ROUTE_FORBIDDEN },
  { name: "ClockChart", forbidden: CLOCK_ROUTE_FORBIDDEN },
] as const;

/** The labels of the forbidden code a route ships, each with what it matched. */
function shipped(route: Route, forbidden: readonly Forbidden[]): string[] {
  return forbidden.flatMap(({ label, module, external, text }) => {
    const matched = [
      ...(module === undefined ? [] : modulesMatching(route, module)),
      ...(external === undefined ? [] : route.imports.filter((id) => external.test(id))),
      ...(text?.exec(route.code)?.slice(0, 1) ?? []),
    ];
    return matched.length > 0
      ? [`${label} (${matched.map((id) => id.split("/").at(-1) ?? id).join(", ")})`]
      : [];
  });
}

/** The rules of a list that a control route trips none of, so their detector would pass anything. */
function blindRules(control: Route, forbidden: readonly Forbidden[]): string[] {
  const tripped = new Set(shipped(control, forbidden).map((entry) => entry.split(" (")[0]));
  return forbidden.map(({ label }) => label).filter((label) => !tripped.has(label));
}

const BAR_PARTS = "Chart.Root, Chart.Grid, Chart.XAxis, Chart.YAxis, Chart.Bar";

/**
 * Bundles the chart routes against the packed `chart.js`. An alias route and a `Chart` route emit
 * the same bytes, no cartesian route reaches a polar module, the pie route reaches no bar module,
 * a bar route of Root, Grid, both axes and Bar ships no Tooltip, Table, LegendToggleGroup or
 * floating-ui code, and `ScatterChart.Root` ships no cartesian store, readout or model. Each polar
 * Root, and each polar namespace with its Tooltip, Legend and Table, ships no cartesian geometry,
 * and Pie's and Radial's ship no series model either (S15). A control route that adds Tooltip,
 * Table and LegendToggleGroup to the bar route must trip each of the bar route's rules, the
 * scatter rules and the polar rules, so a detector that stops seeing them fails too. A clock route
 * also ships no cartesian plot geometry or path code, which a route of Chart's Line, Bar, Tooltip
 * and Table must trip. The radar namespace, which reads the series model, is the control for the
 * item rules' series model. A route of one polar part alone ships none of its siblings, and the
 * siblings' route trips each of its rules (Q1). The oracle is rolldown's module and import lists
 * per chunk and the package's `sideEffects` field, which lets a bundler drop every module a route
 * does not reach.
 *
 * @param extracted - The extracted tarball's `package/` directory.
 * @returns A summary line.
 * @throws When a route breaks one of the rules or the control route trips none.
 */
export async function checkPackedChartBundles(extracted: string): Promise<string> {
  const work = mkdtempSync(join(tmpdir(), "fuse-chart-routes-"));
  try {
    const polarRoutes = Promise.all(
      POLAR_FAMILIES.flatMap(({ name, forbidden }) => [
        bundleRoute(
          extracted,
          work,
          `${name}-root`,
          `import { ${name} } from <chart>;\nexport const Root = ${name}.Root;\n`
        ).then((route) => ({ name: `${name}.Root`, route, forbidden })),
        bundleRoute(
          extracted,
          work,
          `${name}-namespace`,
          `import { ${name} } from <chart>;\nexport const parts = [${name}.Root, ${name}.Tooltip, ${name}.Legend, ${name}.Table];\n`
        ).then((route) => ({ name: `${name} with Tooltip, Legend and Table`, route, forbidden })),
      ])
    );
    const partRoutes = Promise.all(
      PART_ROUTES.map(async (rule, index) => {
        const [alone, control] = await Promise.all([
          bundleRoute(extracted, work, `part-${String(index)}`, partsSource(rule.part)),
          bundleRoute(extracted, work, `part-${String(index)}-control`, partsSource(rule.control)),
        ]);
        return { rule, alone, control };
      })
    );
    const [[chart, alias, bars, control, pie, scatter, clockControl], polar, parts] = await Promise.all([
      Promise.all([
        bundleRoute(
          extracted,
          work,
          "chart",
          "import { Chart } from <chart>;\nexport const Root = Chart.Root;\n"
        ),
        bundleRoute(
          extracted,
          work,
          "bar-chart",
          "import { BarChart } from <chart>;\nexport const Root = BarChart.Root;\n"
        ),
        bundleRoute(
          extracted,
          work,
          "bar-route",
          `import { Chart } from <chart>;\nexport const parts = [${BAR_PARTS}];\n`
        ),
        bundleRoute(
          extracted,
          work,
          "bar-route-control",
          `import { Chart } from <chart>;\nexport const parts = [${BAR_PARTS}, Chart.Tooltip, Chart.Table, Chart.LegendToggleGroup];\n`
        ),
        bundleRoute(
          extracted,
          work,
          "pie-chart",
          "import { PieChart } from <chart>;\nexport const Root = PieChart.Root;\n"
        ),
        bundleRoute(
          extracted,
          work,
          "scatter-chart",
          "import { ScatterChart } from <chart>;\nexport const Root = ScatterChart.Root;\n"
        ),
        bundleRoute(
          extracted,
          work,
          "clock-control",
          `import { Chart } from <chart>;\nexport const parts = [${CLOCK_CONTROL_PARTS}];\n`
        ),
      ]),
      polarRoutes,
      partRoutes,
    ]);
    if (chart.code !== alias.code) {
      throw new Error("the BarChart.Root route emits different bytes from the Chart.Root route");
    }
    const polarModule = /^(pie|radial|radar|clock)-chart-/u;
    for (const [name, route] of [
      ["Chart.Root", chart],
      ["BarChart.Root", alias],
      ["bar", bars],
    ] as const) {
      const reached = modulesMatching(route, polarModule);
      if (reached.length > 0) {
        throw new Error(`the ${name} route includes polar modules: ${reached.join(", ")}`);
      }
    }
    const barLeaks = shipped(bars, BAR_ROUTE_FORBIDDEN);
    if (barLeaks.length > 0) {
      throw new Error(`the bar route of ${BAR_PARTS} ships ${barLeaks.join("; ")}`);
    }
    const blind = blindRules(control, BAR_ROUTE_FORBIDDEN);
    if (blind.length > 0) {
      throw new Error(
        `the control route with Tooltip, Table and LegendToggleGroup trips no rule for ${blind.join(", ")}`
      );
    }
    const scatterLeaks = shipped(scatter, SCATTER_ROUTE_FORBIDDEN);
    if (scatterLeaks.length > 0) {
      throw new Error(`the ScatterChart.Root route ships ${scatterLeaks.join("; ")}`);
    }
    // A detector that stops seeing modules would pass any route, so the bar control route, whose
    // Root and Tooltip ship every cartesian module the scatter rule names, must trip each of them.
    const scatterBlind = blindRules(control, SCATTER_ROUTE_FORBIDDEN);
    if (scatterBlind.length > 0) {
      throw new Error(`the bar control route trips no scatter rule for ${scatterBlind.join(", ")}`);
    }
    for (const { name, route, forbidden } of polar) {
      const leaks = shipped(route, forbidden);
      if (leaks.length > 0) throw new Error(`the ${name} route ships ${leaks.join("; ")}`);
    }
    // The bar control route ships every cartesian geometry module the polar rule names.
    const polarBlind = blindRules(control, POLAR_ROUTE_FORBIDDEN);
    if (polarBlind.length > 0) {
      throw new Error(`the bar control route trips no polar rule for ${polarBlind.join(", ")}`);
    }
    // A cartesian route with a Line, a Bar, the Tooltip and the Table ships every module the clock
    // rule names, so it must trip each of them.
    const clockBlind = blindRules(clockControl, CLOCK_ROUTE_FORBIDDEN);
    if (clockBlind.length > 0) {
      throw new Error(`the clock control route trips no clock rule for ${clockBlind.join(", ")}`);
    }
    // Every single-part route reports at once, so one run names each part module that needs a split.
    const partFailures = parts.flatMap(({ rule, alone, control: partControl }) => {
      const leaks = shipped(alone, rule.forbidden);
      const blindParts = blindRules(partControl, rule.forbidden);
      return [
        ...(leaks.length > 0 ? [`the ${rule.part} route ships ${leaks.join("; ")}`] : []),
        ...(blindParts.length > 0
          ? [`the control route of ${rule.control} trips no ${rule.part} rule for ${blindParts.join(", ")}`]
          : []),
      ];
    });
    if (partFailures.length > 0) throw new Error(partFailures.join("\n"));
    // The radar namespace reads the series model, so it trips the rules that keep it off items.
    const radar = polar.find(({ name }) => name.startsWith("RadarChart with"));
    const seriesBlind =
      radar === undefined ? SERIES_MODEL.map(({ label }) => label) : blindRules(radar.route, SERIES_MODEL);
    if (seriesBlind.length > 0) {
      throw new Error(`the radar namespace route trips no item rule for ${seriesBlind.join(", ")}`);
    }
    return `Packed chart routes: Chart.Root and BarChart.Root emit ${String(chart.code.length)} identical bytes from ${String(chart.modules.length)} modules, the bar route reaches ${String(bars.modules.length)} modules with no Tooltip, Table, LegendToggleGroup or floating-ui code, its control trips all ${String(BAR_ROUTE_FORBIDDEN.length)} rules, PieChart.Root reaches ${String(pie.modules.length)} modules, ScatterChart.Root reaches ${String(scatter.modules.length)} modules and no cartesian code, ${String(polar.length)} polar routes ship no cartesian geometry, and ${String(PART_ROUTES.length)} single-part routes (${PART_ROUTES.map(({ part }) => part).join(", ")}) ship no other part, each rule tripped by its control`;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
