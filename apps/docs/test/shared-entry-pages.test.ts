/**
 * Unit under test: the slug-to-entry resolver for pages that share one entry, and the `sameAs`
 * dedupe over their parts. Oracle: CONTRACT.md section 13, which fixes each chart page's entry and
 * implementation file, and the docs rule that a part on a later page is an earlier page's part
 * exactly when its member name and declaring module match. The expected values are written by
 * hand from that rule.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveComponentPaths } from "../scripts/lib/components.ts";
import { markdownOutDir, repoRoot } from "../scripts/lib/paths.ts";
import { aliasOf, sameAsLinks } from "../src/lib/api-same-as";
import { fetchText } from "./docs-server";

const CHART_SOURCE = "packages/fuse/src/components/chart";

function relative(file: string): string {
  return path.relative(repoRoot, file);
}

describe("pages that share the chart entry", () => {
  it.each([
    ["chart", "chart-root.tsx", ["Chart", "useChartPoint", "formatChartValue", "formatChartSlot"]],
    ["bar-chart", "chart-root.tsx", ["BarChart"]],
    ["pie-chart", "pie-chart-root.tsx", ["PieChart"]],
    ["radial-chart", "radial-chart-root.tsx", ["RadialChart"]],
    ["radar-chart", "radar-chart-root.tsx", ["RadarChart"]],
    ["sparkline", "sparkline.tsx", ["Sparkline"]],
  ])("resolve %s to @elmeragroup/fuse/chart and %s", (slug, source, exportNames) => {
    const paths = resolveComponentPaths(slug);
    expect(paths.entry).toBe("@elmeragroup/fuse/chart");
    expect(relative(paths.entryFile)).toBe("packages/fuse/src/chart.ts");
    expect(relative(paths.sourceFile)).toBe(`${CHART_SOURCE}/${source}`);
    expect(relative(paths.componentDir)).toBe(CHART_SOURCE);
    expect(paths.apiExportNames).toEqual(exportNames);
  });

  it("leaves a page with its own entry on the slug convention", () => {
    const paths = resolveComponentPaths("toggle-group");
    expect(paths.entry).toBe("@elmeragroup/fuse/toggle-group");
    expect(relative(paths.sourceFile)).toBe("packages/fuse/src/components/toggle-group/toggle-group.tsx");
  });
});

describe("sameAs links", () => {
  const pages = [
    {
      slug: "chart",
      parts: [
        { name: "Chart.Root", sourcePath: `${CHART_SOURCE}/chart-root.tsx` },
        { name: "Chart.Tooltip", sourcePath: `${CHART_SOURCE}/chart-tooltip.tsx` },
        { name: "Chart.Glow", sourcePath: `${CHART_SOURCE}/chart-effects.tsx` },
      ],
    },
    {
      slug: "bar-chart",
      parts: [
        { name: "BarChart.Root", sourcePath: `${CHART_SOURCE}/chart-root.tsx` },
        { name: "BarChart.Tooltip", sourcePath: `${CHART_SOURCE}/chart-tooltip.tsx` },
        { name: "BarChart.Glow", sourcePath: `${CHART_SOURCE}/chart-effects.tsx` },
      ],
    },
    {
      slug: "pie-chart",
      parts: [
        { name: "PieChart.Root", sourcePath: `${CHART_SOURCE}/pie-chart-root.tsx` },
        { name: "PieChart.Tooltip", sourcePath: `${CHART_SOURCE}/chart-tooltip.tsx` },
        { name: "PieChart.Center", sourcePath: `${CHART_SOURCE}/pie-chart-center.tsx` },
      ],
    },
    {
      slug: "radial-chart",
      parts: [
        { name: "RadialChart.Root", sourcePath: `${CHART_SOURCE}/radial-chart-root.tsx` },
        { name: "RadialChart.Center", sourcePath: `${CHART_SOURCE}/pie-chart-center.tsx` },
      ],
    },
    {
      slug: "radar-chart",
      parts: [{ name: "RadarChart.Glow", sourcePath: `${CHART_SOURCE}/radar-chart-marks.tsx` }],
    },
  ];
  const links = sameAsLinks(pages);

  it("links each repeated part to the first page that declares it", () => {
    expect(Object.fromEntries([...links].map(([slug, parts]) => [slug, Object.fromEntries(parts)]))).toEqual({
      "bar-chart": {
        "BarChart.Root": { slug: "chart", name: "Chart.Root" },
        "BarChart.Tooltip": { slug: "chart", name: "Chart.Tooltip" },
        "BarChart.Glow": { slug: "chart", name: "Chart.Glow" },
      },
      "pie-chart": { "PieChart.Tooltip": { slug: "chart", name: "Chart.Tooltip" } },
      "radial-chart": { "RadialChart.Center": { slug: "pie-chart", name: "PieChart.Center" } },
    });
  });

  it("reads a page as an alias only when every part repeats one other page", () => {
    expect(aliasOf(["BarChart.Root", "BarChart.Tooltip", "BarChart.Glow"], links.get("bar-chart"))).toBe(
      "chart"
    );
    expect(aliasOf(["PieChart.Root", "PieChart.Tooltip", "PieChart.Center"], links.get("pie-chart"))).toBe(
      undefined
    );
    expect(aliasOf(["RadarChart.Glow"], links.get("radar-chart"))).toBe(undefined);
    expect(aliasOf([], links.get("bar-chart"))).toBe(undefined);
  });
});

describe("the generated chart references", () => {
  function endpoint(slug: string): string {
    return readFileSync(path.join(markdownOutDir, `${slug}.md`), "utf8");
  }

  it("names the chart stylesheet on every chart endpoint and on no other page", () => {
    const line = '- Stylesheet: `import "@elmeragroup/fuse/chart.css";`, once, beside Fuse\'s own';
    for (const slug of ["chart", "bar-chart", "pie-chart", "radial-chart", "radar-chart", "sparkline"]) {
      expect(endpoint(slug), slug).toContain(line);
    }
    expect(endpoint("badge")).not.toContain("- Stylesheet:");
  });

  it("writes one sentence for an alias page and one line per repeated part", () => {
    expect(endpoint("bar-chart")).toContain(
      "`BarChart` is [`Chart`](/components/chart.md) under another name."
    );
    expect(endpoint("bar-chart")).not.toContain("### BarChart.Root");
    expect(endpoint("pie-chart")).toContain("`PieChart.Tooltip` is [`Chart.Tooltip`](/components/chart.md).");
    expect(endpoint("radial-chart")).toContain(
      "`RadialChart.Center` is [`PieChart.Center`](/components/pie-chart.md)."
    );
    expect(endpoint("chart")).toMatch(/### Chart\.Tooltip · RSC: client/u);
    expect(endpoint("chart")).not.toContain("under another name");
  });

  it("documents a function by its signature, parameters and return value, not as a component", () => {
    const markdown = endpoint("chart");
    expect(markdown).toContain("### useChartPoint · RSC: client");
    expect(markdown).toContain("```ts\nuseChartPoint(): ChartPoint | null\n```");
    expect(markdown).toContain("| `value` | `number` | The value to print. |");
    expect(markdown).toContain(
      "Returns `FormattedText`. The visual and spoken label, with canonical spaces."
    );
    expect(markdown).not.toMatch(/### formatChartValue · RSC: server\n\nSource: [^\n]*\n\nNo own props/u);
    expect(markdown).not.toContain("forwarded props from `typescript`");
  });

  it("puts the page intro under the lede and says a Server Component can render a client part", () => {
    const markdown = endpoint("chart");
    expect(markdown).toContain("The chart entry is a preview.");
    expect(markdown.indexOf("The chart entry is a preview.")).toBeLessThan(markdown.indexOf("## Demos"));
    expect(markdown).toContain(
      "- RSC: client. A Server Component can still render it and pass it serialisable props."
    );
    expect(endpoint("sparkline")).toContain("- RSC: server\n");
  });

  it("renders the alias sentence and the owner links on the pages", async () => {
    const bar = await fetchText("/components/bar-chart");
    expect(bar).toMatch(
      /<code>BarChart<\/code> is <a href="\/components\/chart#api-reference"><code>Chart<\/code><\/a> under another name\./u
    );
    const pie = await fetchText("/components/pie-chart");
    expect(pie).toContain('href="/components/chart#api-chart-tooltip"><code>Chart.Tooltip</code></a>');
    expect(pie).toMatch(/id="api-piechart-pie"/u);
    const chart = await fetchText("/components/chart");
    expect(chart).toMatch(
      /<h3[^>]*id="api-formatchartvalue"[^>]*><code[^>]*>formatChartValue<\/code><\/h3>/u
    );
    expect(chart).toContain("<dd>The value to print.</dd>");
  });
});
