import childProcess from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { resolve } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

import type { DetachableCloseCallback as DetachableCloseCallbackType } from "../src/backend/ts7/session.ts";

const nativeChildren: ChildProcess[] = [];
const originalSpawn = childProcess.spawn;

// SAFETY: the wrapper preserves the original overloaded spawn function and only records children
// whose arguments contain the TypeScript API marker.
childProcess.spawn = ((...args: Parameters<typeof originalSpawn>) => {
  const child = originalSpawn(...args);
  const spawnArguments = args[1];
  if (Array.isArray(spawnArguments) && spawnArguments.includes("--api")) {
    nativeChildren.push(child);
  }
  return child;
}) as typeof originalSpawn;
syncBuiltinESMExports();

const { Effect } = await import("effect");
const { ProjectExtractor } = await import("../src/index.ts");
const { DetachableCloseCallback: DetachableCloseCallbackRuntime } =
  await import("../src/backend/ts7/session.ts");
const { openTsgoProject } = await import("../src/backend/ts7/project.ts");

const fixtureDirectory = resolve(import.meta.dirname, "fixtures/basic");
const tsconfigPath = resolve(fixtureDirectory, "tsconfig.json");
const inputPath = resolve(fixtureDirectory, "input.ts");
const missingPath = resolve(fixtureDirectory, "missing.ts");

afterAll(() => {
  childProcess.spawn = originalSpawn;
  syncBuiltinESMExports();
});

function nativeChildSince(startIndex: number): ChildProcess {
  const child = nativeChildren.slice(startIndex).find((candidate) => candidate.pid !== undefined);
  if (child?.pid === undefined) {
    throw new Error("The TypeScript native compiler child was not observed");
  }
  return child;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (cause) {
    // SAFETY: process.kill reports an ESRCH ErrnoException when the observed PID has exited.
    if ((cause as NodeJS.ErrnoException).code === "ESRCH") {
      return false;
    }
    throw cause;
  }
}

function nativeChildPid(child: ChildProcess): number {
  if (child.pid === undefined) {
    throw new Error("The TypeScript native compiler child did not expose a PID");
  }
  return child.pid;
}

function waitForChildExit(child: ChildProcess): Promise<void> {
  return new Promise((resolveExit, rejectExit) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolveExit();
      return;
    }
    const onExit = () => {
      child.removeListener("error", onError);
      resolveExit();
    };
    const onError = (error: Error) => {
      child.removeListener("exit", onExit);
      rejectExit(error);
    };
    child.once("exit", onExit);
    child.once("error", onError);
  });
}

async function waitForProcessExit(child: ChildProcess): Promise<void> {
  const pid = nativeChildPid(child);
  await waitForChildExit(child);
  const deadline = Date.now() + 5_000;
  while (isProcessAlive(pid)) {
    if (Date.now() >= deadline) {
      throw new Error(`The TypeScript native compiler process ${pid} is still alive`);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 10));
  }
}

describe("ProjectExtractor native compiler lifecycle", () => {
  it("detaches the retained close callback before notifying the project", () => {
    const notifications: string[] = [];
    let callback: DetachableCloseCallbackType<string>;
    callback = new DetachableCloseCallbackRuntime((value: string) => {
      notifications.push(value);
      callback.invoke("reentrant");
    });

    callback.invoke("closed");

    expect(notifications).toEqual(["closed"]);
  });

  it("unregisters closed sessions while retaining active project cleanup", () => {
    const project = openTsgoProject({ tsconfigPath });
    const closedSessionSpies = [];
    try {
      for (let index = 0; index < 100; index += 1) {
        const session = project.openExtraction();
        const closeSpy = vi.spyOn(session, "close");
        session.close();
        closedSessionSpies.push(closeSpy);
      }

      const activeSession = project.openExtraction();
      const activeCloseSpy = vi.spyOn(activeSession, "close");
      project.close();
      project.close();

      expect(closedSessionSpies.every((spy) => spy.mock.calls.length === 1)).toBe(true);
      expect(activeCloseSpy).toHaveBeenCalledTimes(1);
    } finally {
      project.close();
    }
  });

  it("closes the compiler child after successful extraction when the Scope ends", async () => {
    const startIndex = nativeChildren.length;
    const { child, result } = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const extractor = yield* ProjectExtractor;
          const child = yield* Effect.sync(() => nativeChildSince(startIndex));
          const result = yield* extractor.extractModule(inputPath);
          return { child, result };
        }).pipe(Effect.provide(ProjectExtractor.live({ tsconfigPath })))
      )
    );

    expect(result.module.name).toBe("input");
    await waitForProcessExit(child);
    expect(isProcessAlive(nativeChildPid(child))).toBe(false);
  });

  it("closes the compiler child after failed extraction when the Scope ends", async () => {
    const startIndex = nativeChildren.length;
    const { child, exit } = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const extractor = yield* ProjectExtractor;
          const child = yield* Effect.sync(() => nativeChildSince(startIndex));
          const exit = yield* Effect.exit(extractor.extractModule(missingPath));
          return { child, exit };
        }).pipe(Effect.provide(ProjectExtractor.live({ tsconfigPath })))
      )
    );

    expect(exit._tag).toBe("Failure");
    await waitForProcessExit(child);
    expect(isProcessAlive(nativeChildPid(child))).toBe(false);
  });
});
