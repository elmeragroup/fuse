import type { ShadowProblem } from "./api-shadow-types.ts";

/**
 * Reviewed diagnostic multiset for the selective Base UI extraction run.
 *
 * These are the known hybrid-adapter coverage gaps. Pinning component, source, code, and
 * count means a new warning or a newly unsupported component fails generation even when it
 * reuses an existing diagnostic category.
 */
const EXPECTED_BASE_UI_DIAGNOSTICS = {
  "accordion|docs-adapter:unsupported-component-shape": 1,
  "accordion|effect-extractor:unsupported-type-fallback": 10,
  "alert-dialog|docs-adapter:missing-description": 1,
  "alert-dialog|docs-adapter:partial-compound-export": 1,
  "alert-dialog|effect-extractor:unsupported-type-fallback": 1,
  "alert|docs-adapter:unsupported-component-shape": 1,
  "alert|effect-extractor:unsupported-type-fallback": 1,
  "avatar|docs-adapter:unsupported-component-shape": 1,
  "avatar|effect-extractor:unsupported-type-fallback": 1,
  "badge|effect-extractor:unsupported-type-fallback": 3,
  "breadcrumb|docs-adapter:unsupported-component-shape": 1,
  "breadcrumb|effect-extractor:unsupported-type-fallback": 1,
  "button-group|docs-adapter:partial-compound-export": 1,
  "button-group|effect-extractor:unsupported-type-fallback": 6,
  "button|docs-adapter:missing-description": 1,
  "button|effect-extractor:unsupported-type-fallback": 3,
  "card|docs-adapter:unsupported-component-shape": 1,
  "card|effect-extractor:unsupported-type-fallback": 7,
  "checkbox-card|docs-adapter:missing-description": 1,
  "collapsible|docs-adapter:unsupported-component-shape": 1,
  "collapsible|effect-extractor:unsupported-type-fallback": 1,
  "date-field|effect-extractor:unsupported-type-fallback": 6,
  "description-list|docs-adapter:partial-compound-export": 1,
  "description-list|effect-extractor:unsupported-type-fallback": 1,
  "dialog|docs-adapter:missing-description": 1,
  "dialog|docs-adapter:partial-compound-export": 1,
  "dialog|effect-extractor:unsupported-type-fallback": 1,
  "dropdown-menu|docs-adapter:partial-compound-export": 1,
  "dropdown-menu|effect-extractor:unsupported-type-fallback": 1,
  "emoji|docs-adapter:partial-compound-export": 1,
  "emoji|effect-extractor:unsupported-type-fallback": 1,
  "empty|docs-adapter:unsupported-component-shape": 1,
  "empty|effect-extractor:unsupported-type-fallback": 1,
  "field|docs-adapter:unsupported-component-shape": 1,
  "field|effect-extractor:unsupported-type-fallback": 1,
  "frame|docs-adapter:partial-compound-export": 1,
  "frame|effect-extractor:unsupported-type-fallback": 1,
  "heading|effect-extractor:unsupported-type-fallback": 9,
  "input-group|docs-adapter:partial-compound-export": 1,
  "input-group|effect-extractor:unsupported-type-fallback": 1,
  "item|docs-adapter:unsupported-component-shape": 1,
  "item|effect-extractor:unsupported-type-fallback": 4,
  "link|docs-adapter:missing-description": 5,
  "loader|effect-extractor:unsupported-type-fallback": 6,
  "meter|effect-extractor:unsupported-type-fallback": 1,
  "pagination|docs-adapter:unsupported-component-shape": 1,
  "pagination|effect-extractor:unsupported-type-fallback": 7,
  "popover|docs-adapter:partial-compound-export": 1,
  "popover|effect-extractor:unsupported-type-fallback": 1,
  "scroll-area|docs-adapter:unsupported-component-shape": 1,
  "scroll-area|effect-extractor:unsupported-type-fallback": 1,
  "select|docs-adapter:partial-compound-export": 1,
  "select|effect-extractor:unsupported-type-fallback": 1,
  "selection-item|docs-adapter:unsupported-component-shape": 1,
  "selection-item|effect-extractor:unsupported-type-fallback": 1,
  "sheet|docs-adapter:missing-description": 1,
  "sheet|docs-adapter:partial-compound-export": 1,
  "sheet|effect-extractor:unsupported-type-fallback": 1,
  "span|effect-extractor:unsupported-type-fallback": 4,
  "table|docs-adapter:partial-compound-export": 1,
  "table|docs-adapter:unsupported-component-shape": 1,
  "table|effect-extractor:unsupported-type-fallback": 2,
  "tabs|docs-adapter:unsupported-component-shape": 1,
  "tabs|effect-extractor:unsupported-type-fallback": 4,
  "text-field|effect-extractor:unsupported-type-fallback": 6,
  "text|effect-extractor:unsupported-type-fallback": 3,
  "timeline-list|docs-adapter:partial-compound-export": 1,
  "timeline-list|effect-extractor:unsupported-type-fallback": 5,
  "toggle|effect-extractor:unsupported-type-fallback": 3,
  "tooltip|docs-adapter:partial-compound-export": 1,
  "tooltip|effect-extractor:unsupported-type-fallback": 1,
} as const satisfies Readonly<Record<string, number>>;

const expectedCounts = new Map<string, number>(Object.entries(EXPECTED_BASE_UI_DIAGNOSTICS));

function diagnosticKey(problem: ShadowProblem): string {
  return `${problem.component}|${problem.source}:${problem.code}`;
}

/** Fails when the selective run's reviewed diagnostic multiset changes in either direction. */
export function assertExpectedBaseUiDiagnostics(problems: readonly ShadowProblem[]): void {
  const actual = new Map<string, number>();
  for (const problem of problems) {
    const key = diagnosticKey(problem);
    actual.set(key, (actual.get(key) ?? 0) + 1);
  }
  const keys = [...new Set([...expectedCounts.keys(), ...actual.keys()])].sort();
  const differences = keys.filter((key) => (actual.get(key) ?? 0) !== (expectedCounts.get(key) ?? 0));
  if (differences.length === 0) return;
  throw new Error(
    `Base UI API enrichment diagnostic drift:\n${differences
      .map(
        (key) =>
          `${key}: expected ${String(expectedCounts.get(key) ?? 0)}, received ${String(actual.get(key) ?? 0)}`
      )
      .join("\n")}`
  );
}
