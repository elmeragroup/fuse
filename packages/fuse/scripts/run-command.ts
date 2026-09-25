import { spawn, spawnSync } from "node:child_process";

/**
 * Runs a command to completion with inherited stdio. A missing executable or a non-zero
 * exit throws. `runCommandAsync` runs commands beside each other with captured output; callers
 * that need output synchronously (`tar` extraction) keep their own `spawnSync`.
 */
export function runCommand(command: string, args: readonly string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  const invocation = renderInvocation(command, args);
  if (result.error !== undefined) {
    throw new Error(`${invocation} failed to spawn`, { cause: result.error });
  }
  if (result.status !== 0) {
    throw new Error(exitFailure(invocation, result.status, result.signal));
  }
}

// Quote only the diagnostic rendering; the spawn gets the raw tokens.
function renderInvocation(command: string, args: readonly string[]): string {
  return [command, ...args].map((token) => (/\s/.test(token) ? JSON.stringify(token) : token)).join(" ");
}

function exitFailure(invocation: string, status: number | null, signal: NodeJS.Signals | null): string {
  const reason = signal === null ? "" : ` (signal ${signal})`;
  return `${invocation} failed with status ${String(status ?? "null")}${reason}`;
}

/** A command killed through its `signal`: an echo of whichever sibling failure aborted it. */
export class CommandAbortedError extends Error {}

/**
 * One error for failures that settled side by side, embedding every message since `fail`
 * prints only `.message`. Aborted commands merely echo a sibling's failure, so they drop out
 * unless nothing else failed. Undefined when there were no failures.
 */
export function combinedFailure(failures: readonly unknown[]): Error | undefined {
  const genuine = failures.filter((failure) => !(failure instanceof CommandAbortedError));
  const reported = genuine.length === 0 ? failures.slice(0, 1) : genuine;
  const [only] = reported;
  if (reported.length === 1 && only instanceof Error) {
    return only;
  }
  if (reported.length === 0) {
    return undefined;
  }
  return new Error(
    reported.map((failure) => (failure instanceof Error ? failure.message : String(failure))).join("\n\n")
  );
}

export type CommandOutput = { readonly stdout: string; readonly stderr: string };

export type RunCommandAsyncOptions = {
  readonly cwd: string;
  /** Kills the child with SIGTERM once exceeded; the rejection says `timed out after <n>ms`. */
  readonly timeoutMs?: number;
  /** Aborting kills the child with SIGTERM and rejects, so a failed sibling check stops this one. */
  readonly signal?: AbortSignal;
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
    const child = spawn(command, args, {
      cwd: options.cwd,
      signal: options.signal,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let timedOut = false;
    const timer =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
          }, options.timeoutMs);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(
        options.signal?.aborted === true
          ? new CommandAbortedError(`${invocation} was aborted`, { cause: error })
          : new Error(`${invocation} failed to spawn`, { cause: error })
      );
    });
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      if (status === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const failure = timedOut
        ? `${invocation} timed out after ${String(options.timeoutMs)}ms`
        : exitFailure(invocation, status, signal);
      reject(new Error(`${failure}:\n${stderr || stdout}`));
    });
  });
}
