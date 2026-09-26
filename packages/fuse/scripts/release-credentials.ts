/** npm reads this variable through setup-node's `.npmrc`; named once so every access is computed. */
const NPM_TOKEN_ENV = "NODE_AUTH_TOKEN";

/**
 * Environment variables that hold publish credentials in the publish step: npm's token, the
 * GitHub token the engine uses, and the OIDC request pair a future `id-token: write` grant adds.
 */
export const RELEASE_CREDENTIAL_ENV = [
  NPM_TOKEN_ENV,
  "NPM_TOKEN",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  "ACTIONS_ID_TOKEN_REQUEST_URL",
] as const;

/**
 * The non-secret value actions/setup-node exports for `NODE_AUTH_TOKEN` when no token is set. Its
 * `.npmrc` interpolates the variable, so npm installs of public packages keep working with it.
 */
export const NPM_AUTH_PLACEHOLDER = "XXXXX-XXXXX-XXXXX-XXXXX";

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
  if (saved.has(NPM_TOKEN_ENV)) {
    process.env[NPM_TOKEN_ENV] = NPM_AUTH_PLACEHOLDER;
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
