/**
 * The comparison report as one HTML file: a summary per preview, then every cell worst first
 * with its Figma, browser and diff pictures, and filters by preview and by each variant axis.
 * The pictures are PNG files next to the report, so the file opens straight from disk.
 */

import type { CompareReport, ReportRow } from "./run-compare.ts";

function escape(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function size(width: number, height: number): string {
  const round = (value: number) => String(Math.round(value * 1000) / 1000);
  return `${round(width)}×${round(height)}`;
}

function percent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function delta(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return rounded > 0 ? `+${String(rounded)}` : String(rounded);
}

/** The axes the report filters by, in the kit's order, then any other axis a row names. */
function filterAxes(rows: readonly ReportRow[]): string[] {
  const preferred = ["variant", "size", "state", "icon"];
  const found = new Set(rows.flatMap((row) => Object.keys(row.axes)));
  return [
    ...preferred.filter((axis) => found.has(axis)),
    ...[...found].filter((axis) => !preferred.includes(axis)),
  ];
}

function select(name: string, label: string, values: readonly string[]): string {
  const options = values
    .map((value) => `<option value="${escape(value)}">${escape(value)}</option>`)
    .join("");
  return `<label>${escape(label)} <select data-filter="${escape(name)}"><option value="">all</option>${options}</select></label>`;
}

function picture(path: string | null, caption: string, row: ReportRow): string {
  const style = `--w:${String(row.images.width / 2)}px`;
  const image =
    path === null
      ? `<div class="none" style="${style};--h:${String(row.images.height / 2)}px">nothing drawn</div>`
      : `<img src="${escape(path)}" alt="${escape(caption)}" loading="lazy" style="${style}">`;
  return `<figure>${image}<figcaption>${escape(caption)}</figcaption></figure>`;
}

function cellSection(row: ReportRow, rank: number): string {
  const { verdict } = row;
  const data = Object.entries(row.axes)
    .map(([axis, value]) => ` data-axis-${escape(axis)}="${escape(value)}"`)
    .join("");
  const flags =
    verdict.flags.length === 0
      ? ""
      : `<span class="flags">${verdict.flags.map((flag) => `<span class="flag">${escape(flag)}</span>`).join(" ")}</span>`;
  const facts = [
    escape(row.previewName),
    `Figma ${size(row.figmaBox.width, row.figmaBox.height)}`,
    `browser ${size(row.browserBox.width, row.browserBox.height)}`,
    `Δ ${delta(verdict.widthDelta)} × ${delta(verdict.heightDelta)}`,
    row.pixels === null
      ? "no Figma picture"
      : `tolerant ${percent(verdict.tolerantPercent)} (${String(row.pixels.tolerant)} px), raw ${percent(verdict.rawPercent)} (${String(row.pixels.raw)} px)`,
  ].join(" · ");
  return `<section class="cell" data-preview="${escape(row.preview)}" data-flagged="${verdict.flags.length > 0 ? "yes" : "no"}"${data}>
<h3><span class="rank">#${String(rank)}</span> ${escape(row.variant)} ${flags}</h3>
<p>${facts}</p>
<div class="pictures">${picture(row.images.figma, "Figma", row)}${picture(row.images.browser, "Browser", row)}${picture(row.images.diff, "Diff", row)}</div>
</section>`;
}

function summaryRows(report: CompareReport): string {
  return report.previews
    .map((preview) => {
      const rows = report.rows.filter((row) => row.preview === preview.key);
      const tolerant = rows.map((row) => row.verdict.tolerantPercent);
      const worst = tolerant.length === 0 ? 0 : Math.max(...tolerant);
      const mean =
        tolerant.length === 0 ? 0 : tolerant.reduce((sum, value) => sum + value, 0) / tolerant.length;
      const sized = rows.filter((row) => row.verdict.flags.includes("size")).length;
      const skipped = report.skipped.filter((entry) => entry.preview === preview.key).length;
      const theme =
        preview.theme === null
          ? "not rendered"
          : `${preview.theme.variant}-${preview.theme.brand}-${preview.theme.segment}, ${preview.theme.scheme}, ${preview.theme.density}`;
      return `<tr><td>${escape(preview.name)}</td><td>${escape(theme)}</td><td>${escape(preview.font ?? "")}</td><td>${String(rows.length)}</td><td>${String(sized)}</td><td>${percent(worst)}</td><td>${percent(mean)}</td><td>${String(skipped)}</td></tr>`;
    })
    .join("\n");
}

const STYLE = `
body{margin:24px;font:14px/1.5 system-ui,sans-serif;color:#1e1e1e;background:#fafafa}
h1{font-size:20px;margin:0 0 8px}h2{font-size:16px;margin:24px 0 8px}h3{font-size:13px;margin:0;font-family:ui-monospace,monospace}
table{border-collapse:collapse;background:#fff}td,th{border:1px solid #ddd;padding:4px 8px;text-align:left}
.warning{color:#b42318;font-weight:600}
.filters{position:sticky;top:0;z-index:1;display:flex;flex-wrap:wrap;gap:12px;padding:8px 0;background:#fafafa;border-bottom:1px solid #ddd}
.cell{margin:12px 0;padding:12px;background:#fff;border:1px solid #ddd;border-radius:6px}
.cell p{margin:4px 0 8px;color:#555;font-size:12px}
.rank{color:#888}.flag{display:inline-block;padding:0 6px;border-radius:4px;background:#fee4e2;color:#b42318;font-family:system-ui,sans-serif}
.pictures{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
figure{margin:0}figcaption{font-size:11px;color:#777}
img,.none{display:block;width:calc(var(--w) * var(--zoom,2));image-rendering:pixelated;outline:1px solid #ddd}
.none{height:calc(var(--h) * var(--zoom,2));display:grid;place-items:center;font-size:11px;color:#999}
`;

const SCRIPT = `
const sections = [...document.querySelectorAll("section.cell")];
const filters = [...document.querySelectorAll("[data-filter]")];
const flaggedOnly = document.getElementById("flagged");
const count = document.getElementById("count");
function apply() {
  let shown = 0;
  for (const section of sections) {
    const visible =
      filters.every((filter) => filter.value === "" || section.getAttribute(filter.dataset.filter) === filter.value) &&
      (!flaggedOnly.checked || section.dataset.flagged === "yes");
    section.hidden = !visible;
    shown += visible ? 1 : 0;
  }
  count.textContent = shown + " of " + sections.length + " cells";
}
for (const control of [...filters, flaggedOnly]) control.addEventListener("change", apply);
document.getElementById("zoom").addEventListener("change", (event) => {
  document.body.style.setProperty("--zoom", event.target.value);
});
apply();
`;

/**
 * Render the report.
 *
 * @param report - The comparison's findings, rows worst first.
 * @returns A complete HTML document that loads the cell pictures by relative path.
 */
export function renderReportHtml(report: CompareReport): string {
  const previewOptions = report.previews.map((preview) => preview.key);
  const axes = filterAxes(report.rows);
  const axisFilters = axes.map((axis) =>
    select(`data-axis-${axis}`, axis, [...new Set(report.rows.flatMap((row) => row.axes[axis] ?? []))])
  );
  const skipped =
    report.skipped.length === 0
      ? ""
      : `<h2>Skipped (${String(report.skipped.length)})</h2><ul>${report.skipped
          .map(
            (entry) =>
              `<li><code>${escape(entry.variant)}</code> in ${escape(entry.preview)}: ${escape(entry.reason)}</li>`
          )
          .join("")}</ul>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Fuse kit compared with the browser</title>
<style>${STYLE}</style>
</head>
<body>
<h1>Fuse kit compared with the browser</h1>
<p>Snapshot of <strong>${escape(report.snapshot.file)}</strong>, exported ${escape(report.snapshot.exportedAt)}, compared ${escape(report.generatedAt)}.
Each cell lays the Figma export and the browser's Fuse Button over the theme's background with their boxes' top-left corners aligned.
Mismatch is the share of the browser box's area at ${String(report.snapshot.scale)}x whose pixels differ past pixelmatch's threshold of ${String(report.threshold)}.
Tolerant leaves out the pixels pixelmatch takes for anti-aliasing; raw counts them. Δ is Figma's box minus the browser's, in pixels.
Font: ${escape(report.fontPackage)}.</p>
${report.fuseBuildStale ? `<p class="warning">Fuse's sources changed after its build. Rebuild it with pnpm --filter @elmeragroup/fuse build and compare again.</p>` : ""}
<h2>Summary</h2>
<table>
<tr><th>Preview</th><th>Theme</th><th>Font</th><th>Cells</th><th>Size differs</th><th>Worst tolerant</th><th>Mean tolerant</th><th>Skipped</th></tr>
${summaryRows(report)}
</table>
${skipped}
<h2>Cells, worst first</h2>
<div class="filters">
${select("data-preview", "preview", previewOptions)}
${axisFilters.join("\n")}
<label><input type="checkbox" id="flagged"> flagged only</label>
<label>zoom <select id="zoom"><option value="1">1x</option><option value="2" selected>2x</option><option value="4">4x</option></select></label>
<span id="count"></span>
</div>
${report.rows.map((row, index) => cellSection(row, index + 1)).join("\n")}
<script>${SCRIPT}</script>
</body>
</html>
`;
}
