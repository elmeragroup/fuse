import { spawnSync } from "node:child_process";

/**
 * Runs a command to completion with inherited stdio. A missing executable or a non-zero
 * exit throws; callers that capture output (`tar` extraction) keep their own `spawnSync`.
 */
export function runCommand(
  command: string,
  args: readonly string[],
  cwd: string,
  env?: NodeJS.ProcessEnv
): void {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${String(result.status ?? "null")}`);
  }
}
