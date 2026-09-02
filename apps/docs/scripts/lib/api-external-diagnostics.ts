import type { ShadowProblem } from "./api-shadow-types.ts";

/**
 * Diagnostic categories the selective Base UI extraction is known to produce.
 *
 * Counts are deliberately not pinned: they move with every library and
 * extractor change and are reviewed through the docs shadow snapshot instead.
 * A diagnostic from a category outside this set means the hybrid adapter hit a
 * gap nobody has reviewed, so generation stops.
 */
const KNOWN_BASE_UI_DIAGNOSTICS: ReadonlySet<string> = new Set([
  "docs-adapter:missing-description",
  "docs-adapter:missing-export",
  "docs-adapter:unsupported-component-shape",
  "effect-extractor:unsupported-type-fallback",
]);

function diagnosticCategory(problem: ShadowProblem): string {
  return `${problem.source}:${problem.code}`;
}

/** Fails when the selective run reports a diagnostic category that has not been reviewed. */
export function assertKnownBaseUiDiagnostics(problems: readonly ShadowProblem[]): void {
  const unknown = problems.filter((problem) => !KNOWN_BASE_UI_DIAGNOSTICS.has(diagnosticCategory(problem)));
  if (unknown.length === 0) return;
  throw new Error(
    `Base UI API enrichment reported unreviewed diagnostics:\n${unknown
      .map((problem) => `${problem.component}|${diagnosticCategory(problem)}: ${problem.message}`)
      .join("\n")}`
  );
}
