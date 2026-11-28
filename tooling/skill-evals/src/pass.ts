/**
 * What a pass prepares once, before any cell: a snapshot of the server's inputs that both arms
 * read, and each fixture resolved once into a frozen lockfile, with the checks on its untouched
 * install.
 */

import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { createHash } from "node:crypto";

import type { FrozenFixture, PassInputs } from "./cell.ts";
import { TEMPORARY_PREFIX } from "./cell.ts";
import { checkApp } from "./check-app.ts";
import type { CheckResult } from "./checks.ts";
import { outputTail, runCommand, succeeded } from "./command.ts";
import type { Environment } from "./isolation.ts";
import type { InputDigest } from "./report.ts";
import type { FixtureName, Task } from "./task.ts";

/** A pass input could not be read, copied or resolved. */
export class PassUnprepared extends Schema.TaggedError<PassUnprepared>()("PassUnprepared", {
  message: Schema.String,
}) {}

/** Where the checkout keeps what the server reads. */
export type CheckoutInputs = {
  readonly serverBundle: string;
  readonly catalogFile: string;
  readonly skillsDirectory: string;
  readonly taskFile: string;
};

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/**
 * Copies the server bundle, the catalog, the skill folders and the task file into the run's
 * `inputs` folder, and hashes each file.
 *
 * @param from - The files in the checkout.
 * @param runDirectory - The run's folder.
 * @returns The snapshot both arms read, its task file and the digests.
 */
export const snapshotInputs = Effect.fn("pass.snapshotInputs")(function* (
  from: CheckoutInputs,
  runDirectory: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const failed = (cause: { readonly message: string }) =>
    new PassUnprepared({ message: `Snapshotting the inputs failed: ${cause.message}` });
  const directory = path.join(runDirectory, "inputs");
  const snapshot = {
    serverBundle: path.join(directory, "server/main.mjs"),
    catalogFile: path.join(directory, "catalog.json"),
    skillsDirectory: path.join(directory, "skills"),
    taskFile: path.join(directory, "tasks.json"),
  };
  yield* fs.makeDirectory(path.join(directory, "server"), { recursive: true }).pipe(Effect.mapError(failed));
  yield* fs.copyFile(from.serverBundle, snapshot.serverBundle).pipe(Effect.mapError(failed));
  yield* fs.copyFile(from.catalogFile, snapshot.catalogFile).pipe(Effect.mapError(failed));
  yield* fs.copyFile(from.taskFile, snapshot.taskFile).pipe(Effect.mapError(failed));
  yield* fs.copy(from.skillsDirectory, snapshot.skillsDirectory).pipe(Effect.mapError(failed));

  const digest = (name: string, file: string) =>
    fs.readFile(file).pipe(
      Effect.mapBoth({
        onSuccess: (bytes): InputDigest => ({ name, sha256: sha256(bytes) }),
        onFailure: failed,
      })
    );
  const skills = new Map<string, string>();
  const skillDigests: InputDigest[] = [];
  const folders = (yield* fs.readDirectory(snapshot.skillsDirectory).pipe(Effect.mapError(failed))).sort();
  for (const folder of folders) {
    const file = path.join(snapshot.skillsDirectory, folder, "SKILL.md");
    if (!(yield* fs.exists(file).pipe(Effect.orElseSucceed(() => false)))) continue;
    skills.set(`skill://${folder}/SKILL.md`, yield* fs.readFileString(file).pipe(Effect.mapError(failed)));
    skillDigests.push(yield* digest(`skills/${folder}/SKILL.md`, file));
  }
  const inputs: PassInputs = { ...snapshot, skills };
  return {
    inputs,
    taskFile: snapshot.taskFile,
    digests: [
      yield* digest("apps/mcp/dist/main.mjs", snapshot.serverBundle),
      yield* digest("catalog.json", snapshot.catalogFile),
      ...skillDigests,
      yield* digest("tasks.json", snapshot.taskFile),
    ],
  };
});

const INSTALL_TIMEOUT = Duration.minutes(5);

/**
 * Resolves each fixture the tasks use once, keeps its lockfile in the run's folder for every cell
 * to install from, and checks each task against its untouched install.
 *
 * @param tasks - The pass's tasks.
 * @param fixturesDirectory - `tooling/skill-evals/fixtures`.
 * @param runDirectory - The run's folder.
 * @param env - The environment the installs and checks start with.
 * @returns The frozen fixtures, each task's untouched checks and each lockfile's digest.
 */
export const freezeFixtures = Effect.fn("pass.freezeFixtures")(function* (
  tasks: readonly Task[],
  fixturesDirectory: string,
  runDirectory: string,
  env: Environment
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const fixtures = new Map<FixtureName, FrozenFixture>();
  const untouched: Record<string, readonly CheckResult[]> = {};
  const digests: InputDigest[] = [];
  for (const name of [...new Set(tasks.map((task) => task.fixture))]) {
    const failed = (cause: { readonly message: string }) =>
      new PassUnprepared({ message: `Resolving the ${name} fixture failed: ${cause.message}` });
    yield* Effect.scoped(
      Effect.gen(function* () {
        const root = yield* fs
          .makeTempDirectoryScoped({ prefix: `${TEMPORARY_PREFIX}fixture-` })
          .pipe(Effect.mapError(failed));
        const app = path.join(root, "app");
        const directory = path.join(fixturesDirectory, name);
        yield* fs.copy(directory, app).pipe(Effect.mapError(failed));
        const install = yield* runCommand({
          executable: "pnpm",
          args: ["install"],
          cwd: app,
          env,
          timeout: INSTALL_TIMEOUT,
        }).pipe(Effect.mapError(failed));
        if (!succeeded(install))
          return yield* failed({ message: `pnpm install failed:\n${outputTail(install, 20)}` });
        const lockfile = path.join(runDirectory, "inputs/fixtures", name, "pnpm-lock.yaml");
        yield* fs.makeDirectory(path.dirname(lockfile), { recursive: true }).pipe(Effect.mapError(failed));
        yield* fs.copyFile(path.join(app, "pnpm-lock.yaml"), lockfile).pipe(Effect.mapError(failed));
        const bytes = yield* fs.readFile(lockfile).pipe(Effect.mapError(failed));
        digests.push({ name: `fixtures/${name}/pnpm-lock.yaml`, sha256: sha256(bytes) });
        fixtures.set(name, { directory, lockfile });
        for (const task of tasks.filter((entry) => entry.fixture === name)) {
          untouched[task.id] = (yield* checkApp(app, task, env)).checks;
        }
      })
    );
  }
  return { fixtures, untouched, digests };
});
