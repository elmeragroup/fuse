import { spawn, spawnSync } from "node:child_process";

/**
 * Runs a command to completion with inherited stdio. A missing executable or a non-zero
 * exit throws; callers that capture output (`tar` extraction) keep their own `spawnSync`.
 */
export function runCommand(command: string, args: readonly string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  const invocation = renderInvocation(command, args);
  if (result.error !== undefined) {
    throw new Error(`${invocation} failed to spawn`, { cause: result.error });
  }
  if (result.status !== 0) {
    const signal = result.signal === null ? "" : ` (signal ${result.signal})`;
    throw new Error(`${invocation} failed with status ${String(result.status ?? "null")}${signal}`);
  }
}

// Quote only the diagnostic rendering; the spawn gets the raw tokens.
function renderInvocation(command: string, args: readonly string[]): string {
  return [command, ...args].map((token) => (/\s/.test(token) ? JSON.stringify(token) : token)).join(" ");
}

export type CommandOutput = { readonly stdout: string; readonly stderr: string };

export type RunCommandAsyncOptions = {
  readonly cwd: string;
  /** Kills the child with SIGTERM once exceeded; the rejection names the timeout. */
  readonly timeoutMs?: number;
};

/**
 * `runCommand` for checks that run beside each other. Output is captured rather than inherited
 * so concurrent commands cannot interleave; the caller prints it once the command settles, and a
 * failure's message carries it.
 */
export function runCommandAsync(
  command: string,
  args: readonly string[],
  options: RunCommandAsyncOptions
): Promise<CommandOutput> {
  const invocation = renderInvocation(command, args);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, timeout: options.timeoutMs });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      reject(new Error(`${invocation} failed to spawn`, { cause: error }));
    });
    child.on("close", (status, signal) => {
      if (status === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const reason = signal === null ? "" : ` (signal ${signal})`;
      reject(new Error(`${invocation} failed with status ${String(status)}${reason}:\n${stderr || stdout}`));
    });
  });
}
