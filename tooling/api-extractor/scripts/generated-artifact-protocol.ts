import type { spawn } from "node:child_process";
import { readSync, writeSync } from "node:fs";

/* oxlint-disable anti-slop/no-unknown-parameters -- private IPC values cross a JSON process boundary. */
/* oxlint-disable anti-slop/no-runtime-typeof -- runtime guards validate private pipe values before use. */
/* oxlint-disable anti-slop/require-safety-comment-for-type-assertion -- private IPC values are constrained at the process boundary. */

export type WorkerChild = ReturnType<typeof spawn>;

export type WorkerCommand =
  | { readonly id: number; readonly kind: "continue" }
  | { readonly id: number; readonly kind: "fail"; readonly message: string };

export type WorkerError = {
  readonly message: string;
  readonly cleanup?: string;
};

type WorkerEventEnvelope = {
  readonly kind?: unknown;
  readonly id?: unknown;
  readonly index?: unknown;
  readonly stagingPath?: unknown;
  readonly destinationPath?: unknown;
  readonly temporaryPath?: unknown;
  readonly error?: unknown;
};

type WorkerErrorEnvelope = {
  readonly message?: unknown;
  readonly cleanup?: unknown;
};

export type WorkerEvent =
  | { readonly kind: "staging-ready"; readonly id: number; readonly stagingPath: string }
  | {
      readonly kind: "before-rename";
      readonly id: number;
      readonly index: number;
      readonly destinationPath: string;
      readonly temporaryPath: string;
    }
  | { readonly kind: "done"; readonly id: number }
  | { readonly kind: "error"; readonly id: number; readonly error: WorkerError };

export type WorkerEventReader = {
  buffer: string;
};

type WorkerPipe = {
  readonly on: unknown;
  readonly _handle?: {
    readonly fd?: number;
  };
};

const workerSleepBuffer = new Int32Array(new SharedArrayBuffer(4));
const closedWorkerInputs = new WeakSet<WorkerChild>();

function workerPipeFd(pipe: WorkerPipe, label: string): number {
  const fd = pipe._handle?.fd;
  if (typeof fd !== "number") throw new Error(`Generated artifact worker ${label} pipe has no descriptor.`);
  return fd;
}

function workerStdin(child: WorkerChild): WorkerPipe {
  if (child.stdin === null) throw new Error("Generated artifact worker stdin is unavailable.");
  return child.stdin;
}

function workerStdout(child: WorkerChild): WorkerPipe {
  if (child.stdout === null) throw new Error("Generated artifact worker stdout is unavailable.");
  return child.stdout;
}

function isWouldBlock(error: Error): error is Error & { readonly code: string } {
  return "code" in error && (error.code === "EAGAIN" || error.code === "EWOULDBLOCK");
}

export function writeWorkerMessage(child: WorkerChild, value: unknown): void {
  const fd = workerPipeFd(workerStdin(child), "stdin");
  const data = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
  const deadline = Date.now() + 30_000;
  let offset = 0;
  while (offset < data.byteLength) {
    try {
      const written = writeSync(fd, data, offset, data.byteLength - offset, null);
      if (written <= 0) throw new Error("Generated artifact worker pipe write made no progress.");
      offset += written;
    } catch (error) {
      if (!(error instanceof Error && isWouldBlock(error))) throw error;
      if (!workerIsAlive(child.pid))
        throw new Error("Generated artifact worker exited while receiving a request.");
      if (Date.now() >= deadline) throw new Error("Generated artifact worker request timed out.");
      Atomics.wait(workerSleepBuffer, 0, 0, 2);
    }
  }
}

export function closeWorkerInput(child: WorkerChild): void {
  if (child.stdin === null) return;
  if (closedWorkerInputs.has(child)) return;
  closedWorkerInputs.add(child);
  // Use the managed half-close so the worker's line reader receives EOF. The
  // caller still waits for stdout EOF below, so no exit event is required for
  // reaping or lifecycle completion.
  child.stdin.end();
}

function workerIsAlive(pid: number | undefined): boolean {
  if (pid === undefined) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function appendError(existing: Error | undefined, next: Error): Error {
  return existing === undefined
    ? next
    : new AggregateError([existing, next], existing.message, { cause: existing });
}

/**
 * Bound helper termination and report when the helper's cleanup finally path
 * could not be observed. Callers must not turn a killed helper into success.
 */
export function terminateWorker(child: WorkerChild): Error | undefined {
  if (!workerIsAlive(child.pid)) return undefined;
  const errors: Error[] = [];
  try {
    if (!child.kill("SIGTERM") && workerIsAlive(child.pid)) {
      errors.push(new Error("Generated artifact worker could not be terminated with SIGTERM."));
    }
  } catch (error) {
    errors.push(asError(error));
  }

  const termDeadline = Date.now() + 1_000;
  while (workerIsAlive(child.pid) && Date.now() < termDeadline) {
    Atomics.wait(workerSleepBuffer, 0, 0, 2);
  }
  if (workerIsAlive(child.pid)) {
    try {
      if (!child.kill("SIGKILL") && workerIsAlive(child.pid)) {
        errors.push(new Error("Generated artifact worker could not be terminated with SIGKILL."));
      }
    } catch (error) {
      errors.push(asError(error));
    }
    const killDeadline = Date.now() + 1_000;
    while (workerIsAlive(child.pid) && Date.now() < killDeadline) {
      Atomics.wait(workerSleepBuffer, 0, 0, 2);
    }
  }
  if (workerIsAlive(child.pid)) {
    errors.push(new Error("Generated artifact worker remained alive after forced termination."));
  }
  return errors.length === 0 ? undefined : errors.reduce((current, next) => appendError(current, next));
}

function parseWorkerEvent(line: string): WorkerEvent {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new Error("Generated artifact worker emitted invalid JSON.");
  }
  if (typeof value !== "object" || value === null) {
    throw new Error("Generated artifact worker emitted an invalid event.");
  }
  const event = value as WorkerEventEnvelope;
  if (
    event.kind === "staging-ready" &&
    isNonNegativeInteger(event.id) &&
    typeof event.stagingPath === "string"
  ) {
    return { kind: "staging-ready", id: event.id, stagingPath: event.stagingPath };
  }
  if (
    event.kind === "before-rename" &&
    isNonNegativeInteger(event.id) &&
    isNonNegativeInteger(event.index) &&
    typeof event.destinationPath === "string" &&
    typeof event.temporaryPath === "string"
  ) {
    return {
      kind: "before-rename",
      id: event.id,
      index: event.index,
      destinationPath: event.destinationPath,
      temporaryPath: event.temporaryPath,
    };
  }
  if (event.kind === "done" && isNonNegativeInteger(event.id)) {
    return { kind: "done", id: event.id };
  }
  if (event.kind === "error" && isNonNegativeInteger(event.id) && isWorkerError(event.error)) {
    return { kind: "error", id: event.id, error: event.error };
  }
  throw new Error("Generated artifact worker emitted an invalid event.");
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isWorkerError(value: unknown): value is WorkerError {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as WorkerErrorEnvelope;
  return (
    typeof candidate.message === "string" &&
    (candidate.cleanup === undefined || typeof candidate.cleanup === "string")
  );
}

export function waitForWorkerEvent(child: WorkerChild, reader: WorkerEventReader): WorkerEvent {
  const fd = workerPipeFd(workerStdout(child), "stdout");
  const deadline = Date.now() + 30_000;
  const bytes = Buffer.allocUnsafe(8192);
  while (Date.now() < deadline) {
    const newline = reader.buffer.indexOf("\n");
    if (newline >= 0) {
      const line = reader.buffer.slice(0, newline);
      reader.buffer = reader.buffer.slice(newline + 1);
      if (line.length === 0) continue;
      return parseWorkerEvent(line);
    }
    try {
      const read = readSync(fd, bytes, 0, bytes.byteLength, null);
      if (read === 0) {
        throw new Error("Generated artifact worker exited without a response.");
      }
      reader.buffer += bytes.subarray(0, read).toString("utf8");
    } catch (error) {
      if (!(error instanceof Error && isWouldBlock(error))) throw error;
      if (!workerIsAlive(child.pid)) throw new Error("Generated artifact worker exited without a response.");
    }
    Atomics.wait(workerSleepBuffer, 0, 0, 2);
  }
  throw new Error("Generated artifact worker timed out.");
}

export function waitForWorkerExit(child: WorkerChild, reader: WorkerEventReader): void {
  const fd = workerPipeFd(workerStdout(child), "stdout");
  const deadline = Date.now() + 30_000;
  const bytes = Buffer.allocUnsafe(8192);
  const drainedEvents: WorkerEvent[] = [];
  while (Date.now() < deadline) {
    let newline = reader.buffer.indexOf("\n");
    while (newline >= 0) {
      const line = reader.buffer.slice(0, newline);
      reader.buffer = reader.buffer.slice(newline + 1);
      if (line.length > 0) drainedEvents.push(parseWorkerEvent(line));
      newline = reader.buffer.indexOf("\n");
    }
    try {
      const read = readSync(fd, bytes, 0, bytes.byteLength, null);
      if (read === 0) {
        if (reader.buffer.length > 0) {
          throw new Error("Generated artifact worker closed its pipe with an incomplete response.");
        }
        for (const event of drainedEvents) {
          if (event.kind === "error") throw workerError(event.error);
          if (event.kind !== "done") {
            throw new Error("Generated artifact worker emitted an unexpected event while exiting.");
          }
        }
        return;
      }
      reader.buffer += bytes.subarray(0, read).toString("utf8");
    } catch (error) {
      if (!(error instanceof Error && isWouldBlock(error))) throw error;
      if (!workerIsAlive(child.pid)) {
        throw new Error("Generated artifact worker exited before its pipe closed.");
      }
    }
    Atomics.wait(workerSleepBuffer, 0, 0, 2);
  }
  throw new Error("Generated artifact worker did not exit.");
}

export function workerError(error: WorkerError): Error {
  const primary = new Error(error.message);
  if (error.cleanup === undefined) return primary;
  return new AggregateError([primary, new Error(error.cleanup)], primary.message, {
    cause: primary,
  });
}
