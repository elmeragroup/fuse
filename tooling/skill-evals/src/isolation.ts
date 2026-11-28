/**
 * What keeps a cell's agent from reaching the checkout or another cell by accident: a path test
 * by segment, and the environment the agent starts with.
 */

import path from "node:path";

/**
 * Whether a path is a folder or lies inside it, comparing whole segments. Both paths must be
 * absolute and canonical, with links resolved, so a link into the folder counts as inside.
 *
 * @param folder - The folder.
 * @param target - The path to test.
 * @returns `true` for the folder itself and every path below it; `false` for a sibling such as
 *   `..name`, whose first segment only starts with `..`.
 */
export function isInside(folder: string, target: string): boolean {
  const relative = path.relative(folder, target);
  if (relative === "") return true;
  if (path.isAbsolute(relative)) return false;
  return relative.split(path.sep)[0] !== "..";
}

/** A program's whole environment, by variable name. */
export type Environment = Readonly<Record<string, string>>;

/** Variables a package manager sets for the script it runs, which name the checkout or the script. */
const SCRIPT_CONTEXT = /^(?:npm_|PNPM_|pnpm_|INIT_CWD$|PWD$|OLDPWD$)/u;

/**
 * The environment a cell's programs start with: the runner's own, without the variables a
 * package manager sets for its scripts, without any variable whose value names a forbidden path,
 * and with each `PATH` entry inside a forbidden path removed, so `claude`, `pnpm` and `node`
 * still resolve.
 *
 * @param env - The runner's environment.
 * @param forbidden - Canonical and as-written forms of the checkout and the run's folder.
 * @returns The scrubbed environment.
 */
export function scrubEnvironment(
  env: Readonly<Record<string, string | undefined>>,
  forbidden: readonly string[]
): Environment {
  const names = (value: string) => forbidden.some((folder) => value.includes(folder));
  const keepPath = (entry: string) => entry !== "" && !forbidden.some((folder) => isInside(folder, entry));
  return Object.fromEntries(
    Object.entries(env).flatMap(([key, value]): ReadonlyArray<readonly [string, string]> => {
      if (value === undefined || SCRIPT_CONTEXT.test(key)) return [];
      if (key === "PATH") return [[key, value.split(path.delimiter).filter(keepPath).join(path.delimiter)]];
      return names(value) ? [] : [[key, value]];
    })
  );
}
