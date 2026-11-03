/**
 * Unit under test: the slug-to-entry resolver for pages that share one entry, and the `sameAs`
 * dedupe over their parts. Oracle: CONTRACT.md section 13, which fixes each chart page's entry and
 * implementation file, and the docs rule that a part on a later page is an earlier page's part
 * exactly when both resolve to one declaration. The expected values are written by hand from that
 * rule.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveComponentPaths } from "../scripts/lib/components.ts";
import { openFuseProgram } from "../scripts/lib/fuse-program.ts";
import { partIdentities } from "../scripts/lib/part-identity.ts";
import { markdownOutDir, repoRoot } from "../scripts/lib/paths.ts";
import { pageAliases, sameAsLinks } from "../src/lib/api-same-as";
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
  // Hand-written declarations: the numbers stand for the declarations the entry resolves to.
  const page = (slug: string, parts: Record<string, number>) => ({
    slug,
    parts: new Map(Object.entries(parts)),
  });
  const pages = [
    page("chart", { "Chart.Root": 1, "Chart.Tooltip": 2, "Chart.Glow": 3, useChartPoint: 7 }),
    page("bar-chart", { "BarChart.Root": 1, "BarChart.Tooltip": 2, "BarChart.Glow": 3 }),
    page("pie-chart", { "PieChart.Root": 4, "PieChart.Tooltip": 2, "PieChart.Center": 5 }),
    page("radial-chart", { "RadialChart.Root": 6, "RadialChart.Center": 5 }),
    // Same declarations under other keys, so a part repeats but the page is no alias.
    page("radar-chart", { "RadarChart.Root": 1, "RadarChart.Halo": 3, "RadarChart.Tooltip": 2 }),
  ];

  it("reads a page as an alias only when it holds an earlier page's declarations under the same keys", () => {
    expect(Object.fromEntries(pageAliases(pages))).toEqual({
      "bar-chart": { slug: "chart", name: "BarChart", owner: "Chart" },
    });
  });

  it("links each repeated part to the first page that declares it, by declaration alone", () => {
    const links = sameAsLinks(pages.filter(({ slug }) => slug !== "bar-chart"));
    expect(Object.fromEntries([...links].map(([slug, parts]) => [slug, Object.fromEntries(parts)]))).toEqual({
      "pie-chart": { "PieChart.Tooltip": { slug: "chart", name: "Chart.Tooltip" } },
      "radial-chart": { "RadialChart.Center": { slug: "pie-chart", name: "PieChart.Center" } },
      "radar-chart": {
        "RadarChart.Root": { slug: "chart", name: "Chart.Root" },
        "RadarChart.Halo": { slug: "chart", name: "Chart.Glow" },
        "RadarChart.Tooltip": { slug: "chart", name: "Chart.Tooltip" },
      },
    });
  });

  it("finds the cartesian aliases and the shared parts in the chart entry's own namespaces", () => {
    // Unit under test: the declaration pass over packages/fuse/src/chart.ts. Oracle: CONTRACT.md
    // section 3, which makes AreaChart, BarChart and LineChart Chart under other names, gives
    // every namespace Chart's Tooltip and gives RadialChart PieChart's Center.
    const slugs = [
      "chart",
      "area-chart",
      "bar-chart",
      "line-chart",
      "pie-chart",
      "radial-chart",
      "radar-chart",
    ];
    const { fuse, close } = openFuseProgram();
    const identities = (() => {
      try {
        return partIdentities(
          fuse,
          slugs.map((slug) => {
            const paths = resolveComponentPaths(slug);
            return { slug, entryFile: paths.entryFile, exportNames: paths.apiExportNames };
          })
        );
      } finally {
        close();
      }
    })();
    const real = [...identities].map(([slug, parts]) => ({ slug, parts }));
    const aliases = pageAliases(real);
    expect([...aliases.keys()]).toEqual(["area-chart", "bar-chart", "line-chart"]);
    expect(aliases.get("bar-chart")).toEqual({ slug: "chart", name: "BarChart", owner: "Chart" });
    const links = sameAsLinks(real.filter(({ slug }) => !aliases.has(slug)));
    expect(links.get("pie-chart")?.get("PieChart.Tooltip")).toEqual({ slug: "chart", name: "Chart.Tooltip" });
    expect(links.get("radial-chart")?.get("RadialChart.Center")).toEqual({
      slug: "pie-chart",
      name: "PieChart.Center",
    });
    expect(links.get("radial-chart")?.get("RadialChart.Root")).toBeUndefined();
    expect(links.get("chart")).toBeUndefined();
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
