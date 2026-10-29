/**
 * Packed checks of the preview chart entry that need no consumer install: tree shaking per
 * family, the growth rule in the published declarations, and the evilcharts notice.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

/** The notice `Chart.Background` owes evilcharts, at the root of the published package. */
const EVILCHARTS_NOTICE = "LICENSE-evilcharts";

/**
 * The SHA-256 of the frozen evilcharts MIT notice at
 * `.scratch/charts-v1/ground-truth/evilcharts-live/LICENSE.evilcharts`, which the docs demo copy
 * also matches.
 */
const EVILCHARTS_NOTICE_SHA256 = "7b6baf25f6caa0de061a2c99a47205d6651cdefc6e636910bc51bb3853ed056e";

/**
 * The packed tarball carries the evilcharts MIT notice byte for byte.
 *
 * @param extracted - The extracted tarball's `package/` directory.
 * @throws When the notice is missing or its bytes differ from the frozen notice.
 */
export function checkPackedEvilchartsNotice(extracted: string): void {
  const path = join(extracted, EVILCHARTS_NOTICE);
  if (!existsSync(path)) {
    throw new Error(`Packed tarball is missing ${EVILCHARTS_NOTICE}`);
  }
  const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
  if (digest !== EVILCHARTS_NOTICE_SHA256) {
    throw new Error(
      `Packed ${EVILCHARTS_NOTICE} has SHA-256 ${digest}, expected ${EVILCHARTS_NOTICE_SHA256}`
    );
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

/** The cartesian code `PieChart.Root` must not ship. */
const PIE_ROUTE_FORBIDDEN: readonly Forbidden[] = [
  { label: "cartesian store", module: /^chart-store\./u },
  { label: "readout", module: /^chart-readout\./u },
  { label: "cartesian model", module: /^cartesian-model\./u },
];

/** The labels of the forbidden code a route ships, each with what it matched. */
function shipped(route: Route, forbidden: readonly Forbidden[]): string[] {
  return forbidden.flatMap(({ label, module, external }) => {
    const matched = [
      ...(module === undefined ? [] : modulesMatching(route, module)),
      ...(external === undefined ? [] : route.imports.filter((id) => external.test(id))),
    ];
    return matched.length > 0
      ? [`${label} (${matched.map((id) => id.split("/").at(-1) ?? id).join(", ")})`]
      : [];
  });
}

const BAR_PARTS = "Chart.Root, Chart.Grid, Chart.XAxis, Chart.YAxis, Chart.Bar";

/**
 * Bundles the chart routes against the packed `chart.js`. An alias route and a `Chart` route emit
 * the same bytes, no cartesian route reaches a polar module, the pie route reaches no bar module,
 * a bar route of Root, Grid, both axes and Bar ships no Tooltip, Table, LegendToggleGroup or
 * floating-ui code, and `PieChart.Root` ships no cartesian store, readout or model. A control
 * route that adds Tooltip, Table and LegendToggleGroup to the bar route must trip each of the bar
 * route's rules, so a detector that stops seeing them fails too. The oracle is rolldown's module
 * and import lists per chunk and the package's `sideEffects` field, which lets a bundler drop
 * every module a route does not reach.
 *
 * @param extracted - The extracted tarball's `package/` directory.
 * @returns A summary line.
 * @throws When a route breaks one of the rules or the control route trips none.
 */
export async function checkPackedChartBundles(extracted: string): Promise<string> {
  const work = mkdtempSync(join(tmpdir(), "fuse-chart-routes-"));
  try {
    const [chart, alias, bars, control, pie] = await Promise.all([
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
    ]);
    if (chart.code !== alias.code) {
      throw new Error("the BarChart.Root route emits different bytes from the Chart.Root route");
    }
    const polar = /^(pie|radial|radar)-chart-/u;
    for (const [name, route] of [
      ["Chart.Root", chart],
      ["BarChart.Root", alias],
      ["bar", bars],
    ] as const) {
      const reached = modulesMatching(route, polar);
      if (reached.length > 0) {
        throw new Error(`the ${name} route includes polar modules: ${reached.join(", ")}`);
      }
    }
    const pieBars = modulesMatching(pie, /^chart-bar\./u);
    if (pieBars.length > 0) {
      throw new Error(`the PieChart.Root route includes the bar module: ${pieBars.join(", ")}`);
    }
    const barLeaks = shipped(bars, BAR_ROUTE_FORBIDDEN);
    if (barLeaks.length > 0) {
      throw new Error(`the bar route of ${BAR_PARTS} ships ${barLeaks.join("; ")}`);
    }
    const tripped = shipped(control, BAR_ROUTE_FORBIDDEN).map((entry) => entry.split(" (")[0]);
    const blind = BAR_ROUTE_FORBIDDEN.map(({ label }) => label).filter((label) => !tripped.includes(label));
    if (blind.length > 0) {
      throw new Error(
        `the control route with Tooltip, Table and LegendToggleGroup trips no rule for ${blind.join(", ")}`
      );
    }
    const pieLeaks = shipped(pie, PIE_ROUTE_FORBIDDEN);
    if (pieLeaks.length > 0) {
      throw new Error(`the PieChart.Root route ships ${pieLeaks.join("; ")}`);
    }
    return `Packed chart routes: Chart.Root and BarChart.Root emit ${String(chart.code.length)} identical bytes from ${String(chart.modules.length)} modules, the bar route reaches ${String(bars.modules.length)} modules with no Tooltip, Table, LegendToggleGroup or floating-ui code, its control trips all ${String(BAR_ROUTE_FORBIDDEN.length)} rules, and PieChart.Root reaches ${String(pie.modules.length)} modules and no cartesian code`;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
