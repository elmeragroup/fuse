/** Mirrors `minimumReleaseAge` in pnpm-workspace.yaml (tooling.md §2). */
export const RELEASE_AGE_MINUTES = 4320;

/** UTC ISO instant exactly RELEASE_AGE_MINUTES before `now`, for npm's `--before`. */
export function releaseAgeCutoff(now: Date): string {
  return new Date(now.getTime() - RELEASE_AGE_MINUTES * 60_000).toISOString();
}

/** Arguments for `npm <args>` in a packed consumer: the existing flags plus the absolute cutoff. */
export function npmInstallArgs(cutoff: string): string[] {
  return [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--package-lock=false",
    `--before=${cutoff}`,
  ];
}
