import { describe, expect, it } from "vitest";

import { parseSizeReport, renderSizeComment, SIZE_COMMENT_MARKER } from "../scripts/size-report";
import type { SizeReport } from "../scripts/size-report";

/** The comment's visible part, above the collapsed full table. */
function visible(comment: string): string {
  const [summary = ""] = comment.split("<details>");
  return summary;
}

// Every expected row below is computed by hand from these two reports.
const base: SizeReport = {
  schema: 1,
  entries: [
    { name: "button", kind: "entry", gzipBytes: 1000, ceilingBytes: 1600 },
    { name: "badge", kind: "entry", gzipBytes: 500, ceilingBytes: 1100 },
    { name: "card", kind: "entry", gzipBytes: 2000, ceilingBytes: 1900 },
    { name: "link", kind: "entry", gzipBytes: 700, ceilingBytes: 1300 },
  ],
};
const head: SizeReport = {
  schema: 1,
  entries: [
    { name: "button", kind: "entry", gzipBytes: 1100, ceilingBytes: 1600 },
    { name: "badge", kind: "entry", gzipBytes: 500, ceilingBytes: 1100 },
    { name: "card", kind: "entry", gzipBytes: 2000, ceilingBytes: 1900 },
    { name: "kbd", kind: "entry", gzipBytes: 300, ceilingBytes: null },
    { name: "styles.css", kind: "css", gzipBytes: 1500, ceilingBytes: 2100 },
  ],
};
const styles = { name: "styles.css", kind: "css", ceilingBytes: 2100 } as const;

describe("size comment", () => {
  it("shows changed, new, removed and breaching entries, and hides unchanged ones above the fold", () => {
    const comment = renderSizeComment(head, base);
    expect(comment.startsWith(SIZE_COMMENT_MARKER)).toBe(true);
    const summary = visible(comment);
    expect(summary).toContain("2 entries break their ceiling.");
    expect(summary).toContain("| `button` | 1,000 B | 1,100 B | +100 B (+10.0%) | 1,600 B | ✅ |");
    expect(summary).toContain("| `card` | 2,000 B | 2,000 B | 0 | 1,900 B | ❌ over |");
    expect(summary).toContain("| `kbd` | — | 300 B | new | — | ❌ no budget |");
    expect(summary).toContain("| `link` | 700 B | — | removed | — |  |");
    expect(summary).not.toContain("`badge`");
    expect(comment).toContain("<summary>All 6 entries</summary>");
    expect(comment).toContain("| `badge` | 500 B | 500 B | 0 | 1,100 B | ✅ |");
  });

  it("signs a shrink as a negative delta", () => {
    const comment = renderSizeComment(
      { schema: 1, entries: [{ ...styles, gzipBytes: 1200 }] },
      { schema: 1, entries: [{ ...styles, gzipBytes: 1500 }] }
    );
    expect(visible(comment)).toContain(
      "| `styles.css` | 1,500 B | 1,200 B | −300 B (−20.0%) | 2,100 B | ✅ |"
    );
  });

  it("falls back to the PR's sizes alone when main has no report", () => {
    const summary = visible(renderSizeComment(head, undefined));
    expect(summary).toContain("No `main` size report exists yet");
    expect(summary).toContain("| `card` | — | 2,000 B | — | 1,900 B | ❌ over |");
    expect(summary).toContain("| `kbd` | — | 300 B | — | — | ❌ no budget |");
    expect(summary).not.toContain("`button`");
  });
});

describe("size comment length", () => {
  // Oracle: GitHub rejects an issue comment body over 65,536 characters.
  const GITHUB_COMMENT_LIMIT = 65_536;
  const NOTE = "The full report is in the `checks` job log and its `size-report` artifact.";
  const report = (count: number, gzipBytes: number, ceilingBytes: number | null): SizeReport => ({
    schema: 1,
    entries: Array.from({ length: count }, (_, index) => ({
      name: `entry-${String(index)}`,
      kind: "entry" as const,
      gzipBytes,
      ceilingBytes,
    })),
  });

  it("drops the full table when only it overflows, keeping the visible summary whole", () => {
    const sizes = report(1500, 1000, 2000);
    const comment = renderSizeComment(sizes, sizes);
    expect(comment.length).toBeLessThanOrEqual(GITHUB_COMMENT_LIMIT);
    expect(comment).toContain("No entry changed size against `main`.");
    expect(comment).not.toContain("<details>");
    expect(comment).toContain(NOTE);
  });

  it("cuts the visible table when breaches alone overflow", () => {
    const comment = renderSizeComment(report(3000, 1000, null), undefined);
    expect(comment.length).toBeLessThanOrEqual(GITHUB_COMMENT_LIMIT);
    expect(comment).toContain("3000 entries break their ceiling.");
    expect(comment).toContain(NOTE);
  });
});

describe("parseSizeReport", () => {
  it("reads back a report as JSON and rejects another schema version", () => {
    expect(parseSizeReport("head.json", JSON.stringify(head))).toEqual({ _tag: "ok", value: head });
    const other = parseSizeReport("base.json", JSON.stringify({ ...head, schema: 2 }));
    expect(other._tag).toBe("err");
  });
});
