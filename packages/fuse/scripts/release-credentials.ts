/**
 * Environment variables that hold publish credentials in the publish step: the GitHub token the
 * engine uses, and the OIDC request pair that the job's `id-token: write` grant adds. npm
 * exchanges that pair for its publish token, so the step holds no npm token.
 */
export const RELEASE_CREDENTIAL_ENV = [
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  "ACTIONS_ID_TOKEN_REQUEST_URL",
] as const;

/**
 * Runs `run` with the publish credentials removed from `process.env`, then restores them, also
 * when `run` throws. Child processes spawned inside `run` inherit the reduced environment.
 *
 * Defense in depth, not isolation: on Linux a same-user child can still read the initial
 * environment of any ancestor process (this node process, the `pnpm release` launcher, the step's
 * shell) from `/proc/<pid>/environ`. Full isolation needs a job that never builds (see
 * scripts/RELEASE.md).
 *
 * @template T - The value `run` returns.
 * @param run - The build-and-gate work that must not see publish credentials.
 * @returns The value `run` returns.
 */
export function withoutReleaseCredentials<T>(run: () => T): T {
  const saved = new Map<string, string>();
  for (const name of RELEASE_CREDENTIAL_ENV) {
    const value = process.env[name];
    if (value !== undefined) {
      saved.set(name, value);
      Reflect.deleteProperty(process.env, name);
    }
  }
  try {
    return run();
  } finally {
    for (const name of RELEASE_CREDENTIAL_ENV) {
      const value = saved.get(name);
      if (value === undefined) {
        Reflect.deleteProperty(process.env, name);
      } else {
        process.env[name] = value;
      }
    }
  }
}
