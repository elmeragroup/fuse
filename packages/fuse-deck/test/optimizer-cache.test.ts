import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { optimizerCache } from "../src/bundler/optimizer-cache.ts";

/**
 * A deck and an install in a temporary parent. The install holds `react` 19.2.1 and fuse-deck, and
 * `lockfile`, when given, at its top.
 */
const fixture = (lockfile: Option.Option<string>) =>
  Effect.acquireRelease(
    Effect.promise(async () => {
      const parent = await mkdtemp(path.join(tmpdir(), "fuse-deck-cache-"));
      const deck = path.join(parent, "talk");
      const install = path.join(parent, "install");
      const root = path.join(install, "node_modules", "react");
      const fuseDeck = path.join(install, "node_modules", "@elmeragroup", "fuse-deck");
      await mkdir(deck, { recursive: true });
      await mkdir(root, { recursive: true });
      await mkdir(fuseDeck, { recursive: true });
      await writeFile(path.join(root, "package.json"), '{"name":"react","version":"19.2.1"}');
      await writeFile(path.join(root, "index.js"), "module.exports = require('./cjs/react.js');\n");
      if (Option.isSome(lockfile)) {
        await writeFile(path.join(install, lockfile.value), "scheduler@0.27.0\n");
      }
      return {
        parent,
        deck,
        root,
        install,
        fuseDeck,
        packages: [{ root, entry: path.join(root, "index.js") }],
      };
    }),
    ({ parent }) => Effect.promise(() => rm(parent, { recursive: true, force: true }))
  );

/** Write `text` to `file` and give it back the times it had, as an installer that normalizes them does. */
async function rewriteKeepingTimes(file: string, text: string): Promise<void> {
  const before = await stat(file);
  await writeFile(file, text);
  await utimes(file, before.atime, before.mtime);
}

describe("optimizerCache", () => {
  it.effect("names one directory in the deck while the install is unchanged", () =>
    Effect.gen(function* () {
      const { deck, fuseDeck, install, packages } = yield* fixture(Option.some("package-lock.json"));
      const first = yield* optimizerCache(deck, packages, fuseDeck);
      assert.strictEqual((yield* optimizerCache(deck, packages, fuseDeck)).directory, first.directory);
      assert.strictEqual(path.dirname(first.directory), path.join(deck, ".fuse-deck", "vite"));
      assert.deepStrictEqual(first.lockfile, Option.some(path.join(install, "package-lock.json")));
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect.each([
    {
      name: "an upgrade that keeps package.json's size and times",
      lockfile: "package-lock.json",
      change: ({ root }: { root: string }) =>
        rewriteKeepingTimes(path.join(root, "package.json"), '{"name":"react","version":"19.2.2"}'),
    },
    {
      name: "a reinstall that changes the entry",
      lockfile: "package-lock.json",
      change: ({ root }: { root: string }) =>
        writeFile(path.join(root, "index.js"), "module.exports = require('./cjs/react.production.js');\n"),
    },
    ...["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock"].map((lockfile) => ({
      name: `an update of a dependency's dependency that only ${lockfile} records`,
      lockfile,
      change: ({ install }: { install: string }) =>
        rewriteKeepingTimes(path.join(install, lockfile), "scheduler@0.27.1\n"),
    })),
  ])("names another directory after $name", ({ change, lockfile }) =>
    Effect.gen(function* () {
      // Oracle: Vite must not reuse what it optimized from the old files.
      const installed = yield* fixture(Option.some(lockfile));
      const { deck, fuseDeck, packages } = installed;
      const before = yield* optimizerCache(deck, packages, fuseDeck);
      yield* Effect.promise(() => change(installed));
      assert.notStrictEqual((yield* optimizerCache(deck, packages, fuseDeck)).directory, before.directory);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("finds no lockfile for an install without one, so the start re-optimizes", () =>
    Effect.gen(function* () {
      const { deck, fuseDeck, packages } = yield* fixture(Option.none());
      assert.isTrue(Option.isNone((yield* optimizerCache(deck, packages, fuseDeck)).lockfile));
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );
});
