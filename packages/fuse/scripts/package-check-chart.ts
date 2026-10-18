/**
 * Packed checks of the preview chart entry that need no consumer install: tree shaking per
 * family, and the growth rule in the published declarations.
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

/** One bundled route: its output code and the packed modules it pulled in. */
type Route = { readonly code: string; readonly modules: readonly string[] };

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
    return { code: chunk.code, modules: chunk.moduleIds.map((id) => id.replaceAll("\\", "/")) };
  } finally {
    await bundle.close();
  }
}

function modulesMatching(route: Route, pattern: RegExp): string[] {
  return route.modules.filter((id) => pattern.test(id.split("/").at(-1) ?? id));
}

/**
 * Bundles three routes against the packed `chart.js`. An alias route and a `Chart` route emit the
 * same bytes, no cartesian route reaches a polar module, and the pie route reaches no bar module.
 * The oracle is rolldown's module list per chunk and the package's `sideEffects` field, which lets
 * a bundler drop every module a route does not reach.
 *
 * @param extracted - The extracted tarball's `package/` directory.
 * @returns A summary line.
 * @throws When a route breaks one of the three rules.
 */
export async function checkPackedChartBundles(extracted: string): Promise<string> {
  const work = mkdtempSync(join(tmpdir(), "fuse-chart-routes-"));
  try {
    const [chart, bar, pie] = await Promise.all([
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
        "pie-chart",
        "import { PieChart } from <chart>;\nexport const Root = PieChart.Root;\n"
      ),
    ]);
    if (chart.code !== bar.code) {
      throw new Error("the BarChart.Root route emits different bytes from the Chart.Root route");
    }
    const polar = /^(pie|radial|radar)-chart-/u;
    for (const [name, route] of [
      ["Chart.Root", chart],
      ["BarChart.Root", bar],
    ] as const) {
      const reached = modulesMatching(route, polar);
      if (reached.length > 0) {
        throw new Error(`the ${name} route includes polar modules: ${reached.join(", ")}`);
      }
    }
    const bars = modulesMatching(pie, /^chart-bar\./u);
    if (bars.length > 0) {
      throw new Error(`the PieChart.Root route includes the bar module: ${bars.join(", ")}`);
    }
    return `Packed chart routes: Chart.Root and BarChart.Root emit ${String(chart.code.length)} identical bytes from ${String(chart.modules.length)} modules, PieChart.Root reaches ${String(pie.modules.length)} modules and no bar module`;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
