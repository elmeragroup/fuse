/**
 * PR titles become squash commit subjects on `main`, so CI holds them to the Title Case rule in
 * CONTRIBUTING.md#pr-title. Commit messages on a branch are not checked.
 *
 * Usage: node scripts/check-pr-title.ts "<title>"
 */

/** A conventional commit prefix, such as `fix(select):` or `feat!:`. */
const CONVENTIONAL_PREFIX = /^[a-z]+(?:\([^)]*\))?!?:/u;

/** A code span, whose casing is the code's own. */
const CODE_SPAN = /`[^`]*`/gu;

/** A hyphen-separated part that starts lowercase and has no uppercase letter to mark own casing. */
function isLowercasePart(part: string): boolean {
  const letters = part.replace(/^[^\p{L}\p{N}]+/u, "");
  return /^\p{Ll}/u.test(letters) && !/\p{Lu}/u.test(letters);
}

/**
 * Lists what keeps `title` from Title Case. A word, or each part of a hyphenated word, starts
 * uppercase. A part with an uppercase letter elsewhere keeps its own casing (`iOS`,
 * `currentColor`); wrap all-lowercase code or brand names in backticks.
 */
export function prTitleProblems(title: string): string[] {
  const trimmed = title.trim();
  if (trimmed.length === 0) return ["The title is empty."];
  if (CONVENTIONAL_PREFIX.test(trimmed)) {
    return ["Drop the conventional commit prefix; commit messages keep it, PR titles do not."];
  }
  const lowercase = trimmed
    .replace(CODE_SPAN, " ")
    .split(/\s+/u)
    .filter((word) => word.split("-").some(isLowercasePart));
  return lowercase.length === 0 ? [] : [`Capitalize: ${lowercase.join(", ")}.`];
}

function main(args: readonly string[]): void {
  const [title] = args;
  if (title === undefined || args.length !== 1) {
    throw new Error('Usage: node scripts/check-pr-title.ts "<title>"');
  }
  const problems = prTitleProblems(title);
  if (problems.length > 0) {
    console.error(`PR title "${title}" is not Title Case (CONTRIBUTING.md#pr-title).`);
    for (const problem of problems) console.error(problem);
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  main(process.argv.slice(2));
}
