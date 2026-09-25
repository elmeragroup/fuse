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

/**
 * Awaits every task, then throws `combinedFailure` of the rejections, so no task is still
 * running when the error propagates. Resolves with the values in task order otherwise.
 */
export async function settleAll<T>(tasks: readonly Promise<T>[]): Promise<T[]> {
  const results = await Promise.allSettled(tasks);
  const failure = combinedFailure(
    results.flatMap((result): unknown[] => (result.status === "rejected" ? [result.reason] : []))
  );
  if (failure !== undefined) {
    throw failure;
  }
  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

/**
 * Deletes `directory` from a detached process that outlives this one, so the deletion also
 * finishes when the caller exits through `fail`. For npm-installed consumers only: each holds
 * about 28k files, and the React pairs finish together, so awaiting three such removals put
 * about 12.6s of disk time on the critical path of a result that no longer depends on them.
 */
export function removeDetached(directory: string): void {
  spawn(
    process.execPath,
    ["-e", "require('node:fs').rmSync(process.argv[1], { recursive: true, force: true })", directory],
    { detached: true, stdio: "ignore" }
  ).unref();
}

export type CommandOutput = { readonly stdout: string; readonly stderr: string };

export type RunCommandAsyncOptions = {
  readonly cwd: string;
  /** Kills the child with SIGTERM once exceeded; the rejection says `timed out after <n>ms`. */
  readonly timeoutMs?: number;
  /**
   * Aborting kills the child with SIGTERM, so a failed sibling check stops this one. The promise
   * rejects with `CommandAbortedError` once the child has closed, not when the abort fires.
   */
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
    // Node reports an abort as an 'error' right after signalling the child, before it exits,
    // so an aborted command settles only on 'close': a caller that removes the command's cwd once
    // the promise settles cannot race writes the dying child still makes. Any other 'error' is a
    // spawn failure, after which Node does not promise a 'close', so it rejects at once.
    let aborted: CommandAbortedError | undefined;
    child.on("error", (error) => {
      clearTimeout(timer);
      if (error.name === "AbortError") {
        aborted = new CommandAbortedError(`${invocation} was aborted`, { cause: error });
        return;
      }
      reject(new Error(`${invocation} failed to spawn`, { cause: error }));
    });
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      if (aborted !== undefined) {
        reject(aborted);
        return;
      }
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
