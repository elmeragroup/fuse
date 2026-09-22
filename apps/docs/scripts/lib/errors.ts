/**
 * Generation failures are hard failures: an unresolvable type or a public prop
 * without JSDoc fails the docs build rather than rendering an empty cell
 */
export class DocsGenerationError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(
      [
        `Docs generation failed with ${String(problems.length)} problem${problems.length === 1 ? "" : "s"}:`,
        ...problems.map((problem) => `  • ${problem}`),
      ].join("\n")
    );
    this.name = "DocsGenerationError";
    this.problems = problems;
  }
}

/** Collects problems so one run reports every failure instead of only the first. */
export class ProblemLog {
  private readonly entries: string[] = [];

  add(problem: string): void {
    this.entries.push(problem);
  }

  get problems(): readonly string[] {
    return this.entries;
  }

  throwIfFailed(): void {
    if (this.entries.length > 0) {
      throw new DocsGenerationError(this.entries);
    }
  }
}
