/**
 * The size report `size-limit.ts` writes and the merge workflow's PR comment reads.
 *
 * It imports nothing outside Node's standard library, so the comment job runs `size-comment.ts`
 * with plain `node` and no install.
 */

/** What a measured row covers, which decides how `size-limit.ts` built it. */
export type SizeEntryKind = "entry" | "named-import" | "css";

/** One measured row of a size report. */
export type SizeEntry = {
  /** The row's budget key, such as `button`, `Button from the root barrel` or `styles.css`. */
  readonly name: string;
  readonly kind: SizeEntryKind;
  /** The gzip size of the minified consumer bundle, or of the CSS file. */
  readonly gzipBytes: number;
  /** The row's ceiling from `size-budgets.ts`, or `null` when the row has no budget yet. */
  readonly ceilingBytes: number | null;
};

/** Every row one `size-limit` run measured, in measurement order. */
export type SizeReport = {
  readonly schema: typeof SIZE_REPORT_SCHEMA;
  readonly entries: readonly SizeEntry[];
};

/** The report format version. A reader rejects any other version instead of misreading it. */
export const SIZE_REPORT_SCHEMA = 1;

/** A report file that is not a version-1 size report. */
export class InvalidSizeReport extends Error {
  readonly _tag = "InvalidSizeReport" as const;
  /** Where the report came from, such as its file path. */
  readonly source: string;
  /** What about the report failed to parse. */
  readonly reason: string;

  /**
   * @param source - Where the report came from, such as its file path.
   * @param reason - What about the report failed to parse.
   */
  constructor(source: string, reason: string) {
    super(`${source} is not a size report: ${reason}`);
    this.source = source;
    this.reason = reason;
  }
}

/** A parse outcome: the report, or why the input is not one. */
export type ParseSizeReportResult =
  | { readonly _tag: "ok"; readonly value: SizeReport }
  | { readonly _tag: "err"; readonly error: InvalidSizeReport };

const ENTRY_KINDS: readonly SizeEntryKind[] = ["entry", "named-import", "css"];

type ParsedEntry =
  | { readonly _tag: "ok"; readonly value: SizeEntry }
  | { readonly _tag: "err"; readonly reason: string };

// Report-file I/O boundary: these read what `JSON.parse` returns. The comment job runs this module
// with plain `node` and no install, so no schema library is available to it.
/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type, anti-slop/no-runtime-typeof -- report-file I/O boundary, parsed without a schema library */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isByteCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseEntry(value: unknown): ParsedEntry {
  const err = (reason: string): ParsedEntry => ({ _tag: "err", reason });
  if (!isRecord(value)) {
    return err("an entry is not an object");
  }
  const { name, kind, gzipBytes, ceilingBytes } = value;
  if (typeof name !== "string" || name === "") {
    return err("an entry has no name");
  }
  const parsedKind = ENTRY_KINDS.find((candidate) => candidate === kind);
  if (parsedKind === undefined) {
    return err(`${name} has an unknown kind`);
  }
  if (!isByteCount(gzipBytes)) {
    return err(`${name} has no byte count`);
  }
  if (ceilingBytes !== null && !isByteCount(ceilingBytes)) {
    return err(`${name} has an invalid ceiling`);
  }
  return { _tag: "ok", value: { name, kind: parsedKind, gzipBytes, ceilingBytes } };
}
/* oxlint-enable anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type, anti-slop/no-runtime-typeof */

/**
 * Parse a size report from JSON a `size-limit` run wrote, possibly on another commit.
 *
 * @param source - Where the JSON came from, for the error message.
 * @param json - The report file's text.
 * @returns The report, or `InvalidSizeReport` when the text is not a version-1 report.
 */
export function parseSizeReport(source: string, json: string): ParseSizeReportResult {
  const err = (reason: string): ParseSizeReportResult => ({
    _tag: "err",
    error: new InvalidSizeReport(source, reason),
  });
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return err("invalid JSON");
  }
  if (!isRecord(value) || value.schema !== SIZE_REPORT_SCHEMA || !Array.isArray(value.entries)) {
    return err(`expected { schema: ${String(SIZE_REPORT_SCHEMA)}, entries: [...] }`);
  }
  const entries: SizeEntry[] = [];
  const names = new Set<string>();
  for (const candidate of value.entries) {
    const parsed = parseEntry(candidate);
    if (parsed._tag === "err") {
      return err(parsed.reason);
    }
    const entry = parsed.value;
    if (names.has(entry.name)) {
      return err(`${entry.name} appears twice`);
    }
    names.add(entry.name);
    entries.push(entry);
  }
  return { _tag: "ok", value: { schema: SIZE_REPORT_SCHEMA, entries } };
}

/** Whether a row fails its budget: over its ceiling, or measured with no ceiling at all. */
export function isBreach(entry: SizeEntry): boolean {
  return entry.ceilingBytes === null || entry.gzipBytes > entry.ceilingBytes;
}

/** The HTML comment that marks the sticky PR comment, so each run edits the same one. */
export const SIZE_COMMENT_MARKER = "<!-- fuse-size-limit -->";

/** The longest body the comment posts, under GitHub's 65,536-character limit on a comment. */
export const SIZE_COMMENT_MAX_LENGTH = 65_000;

const TRUNCATED_NOTE =
  "\n\n**Truncated to fit a GitHub comment.** The full report is in the `checks` job log and its `size-report` artifact.\n";

type ComparedRow = {
  readonly name: string;
  readonly base: number | undefined;
  readonly head: SizeEntry | undefined;
};

const bytes = new Intl.NumberFormat("en-US");

function formatBytes(value: number | undefined): string {
  return value === undefined ? "—" : `${bytes.format(value)} B`;
}

function formatDelta(row: ComparedRow, compared: boolean): string {
  if (!compared) {
    return "—";
  }
  if (row.head === undefined) {
    return "removed";
  }
  if (row.base === undefined) {
    return "new";
  }
  const delta = row.head.gzipBytes - row.base;
  if (delta === 0) {
    return "0";
  }
  const sign = delta > 0 ? "+" : "−";
  const percent = row.base === 0 ? "" : ` (${sign}${((Math.abs(delta) / row.base) * 100).toFixed(1)}%)`;
  return `${sign}${bytes.format(Math.abs(delta))} B${percent}`;
}

function formatStatus(head: SizeEntry | undefined): string {
  if (head === undefined) {
    return "";
  }
  if (head.ceilingBytes === null) {
    return "❌ no budget";
  }
  return head.gzipBytes > head.ceilingBytes ? "❌ over" : "✅";
}

function tableRows(rows: readonly ComparedRow[], compared: boolean): string[] {
  return [
    "| Entry | Base | PR | Δ | Ceiling | Status |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
    ...rows.map(
      (row) =>
        `| \`${row.name}\` | ${formatBytes(row.base)} | ${formatBytes(row.head?.gzipBytes)} | ${formatDelta(row, compared)} | ${formatBytes(row.head?.ceilingBytes ?? undefined)} | ${formatStatus(row.head)} |`
    ),
  ];
}

/**
 * Render the sticky PR comment that compares a PR's size report with `main`'s.
 *
 * The visible table lists the rows whose size changed, appeared or disappeared, plus every
 * breach; the full table is collapsed below it.
 *
 * @param head - The PR's report.
 * @param base - The latest `main` report, or `undefined` when none exists yet.
 * @returns The comment body in GitHub Markdown, starting with `SIZE_COMMENT_MARKER`.
 */
export function renderSizeComment(head: SizeReport, base: SizeReport | undefined): string {
  const baseBytes = new Map(base?.entries.map((entry) => [entry.name, entry.gzipBytes]));
  const rows: ComparedRow[] = head.entries.map((entry) => ({
    name: entry.name,
    base: baseBytes.get(entry.name),
    head: entry,
  }));
  if (base !== undefined) {
    const headNames = new Set(head.entries.map((entry) => entry.name));
    for (const entry of base.entries) {
      if (!headNames.has(entry.name)) {
        rows.push({ name: entry.name, base: entry.gzipBytes, head: undefined });
      }
    }
  }
  const breaches = rows.filter((row) => row.head !== undefined && isBreach(row.head));
  const notable = rows.filter(
    (row) =>
      (row.head !== undefined && isBreach(row.head)) ||
      (base !== undefined && row.base !== row.head?.gzipBytes)
  );

  const lines = [SIZE_COMMENT_MARKER, "## Bundle size", ""];
  if (base === undefined) {
    lines.push("No `main` size report exists yet, so this shows the PR's sizes without a comparison.", "");
  }
  lines.push(
    breaches.length === 0
      ? "Every entry is within its ceiling."
      : `${String(breaches.length)} ${breaches.length === 1 ? "entry breaks its" : "entries break their"} ceiling. See CONTRIBUTING.md, “Raise a size ceiling”.`,
    ""
  );
  if (notable.length > 0) {
    lines.push(...tableRows(notable, base !== undefined), "");
  } else if (base !== undefined) {
    lines.push("No entry changed size against `main`.", "");
  }
  const summary = lines.join("\n");
  const full = [
    summary,
    `<details><summary>All ${String(rows.length)} entries</summary>`,
    "",
    ...tableRows(rows, base !== undefined),
    "",
    "</details>",
    "",
  ].join("\n");
  if (full.length <= SIZE_COMMENT_MAX_LENGTH) {
    return full;
  }
  // GitHub rejects a longer body, which would leave the sticky comment stale. Drop the full
  // table first, then cut the visible one.
  const fitted = summary.slice(0, SIZE_COMMENT_MAX_LENGTH - TRUNCATED_NOTE.length);
  return `${fitted}${TRUNCATED_NOTE}`;
}
