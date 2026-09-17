import { spawnSync } from "node:child_process";

/**
 * Runs a command to completion with inherited stdio. A missing executable or a non-zero
 * exit throws; callers that capture output (`tar` extraction) keep their own `spawnSync`.
 */
export function runCommand(command: string, args: readonly string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  // Quote only the diagnostic rendering; spawnSync gets the raw tokens.
  const invocation = [command, ...args]
    .map((token) => (/\s/.test(token) ? JSON.stringify(token) : token))
    .join(" ");
  if (result.error !== undefined) {
    throw new Error(`${invocation} failed to spawn`, { cause: result.error });
  }
  if (result.status !== 0) {
    const signal = result.signal === null ? "" : ` (signal ${result.signal})`;
    throw new Error(`${invocation} failed with status ${String(result.status ?? "null")}${signal}`);
  }
}
