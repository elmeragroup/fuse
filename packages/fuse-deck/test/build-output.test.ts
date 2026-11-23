import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { BUILD_MARKER, resolveBuildOutput } from "../src/bundler/build-output.ts";

/**
 * A deck directory with sources, a stale `dist` without a marker, a foreign directory, an earlier
 * build's directory, and an alias of the deck, inside a temporary parent.
 */
const fixture = Effect.acquireRelease(
  Effect.promise(async () => {
    const parent = await realpath(await mkdtemp(path.join(tmpdir(), "fuse-deck-out-")));
    const deck = path.join(parent, "talk");
    await mkdir(path.join(deck, "slides"), { recursive: true });
    await writeFile(path.join(deck, "deck.json"), "{}");
    await writeFile(path.join(deck, "slides", "cover.mdx"), "# Talk\n");
    await mkdir(path.join(deck, "dist"));
    await writeFile(path.join(deck, "dist", "index.html"), "");
    await mkdir(path.join(parent, "notes"));
    await writeFile(path.join(parent, "notes", "draft.md"), "");
    await mkdir(path.join(parent, "site"));
    await writeFile(path.join(parent, "site", BUILD_MARKER), "");
    await writeFile(path.join(parent, "site", "index.html"), "");
    await mkdir(path.join(parent, "empty"));
    await symlink(deck, path.join(parent, "alias"));
    // A deck whose slides/ links into a directory an earlier build wrote, and a deck whose name
    // starts with "..", alone in such a directory. The markers leave only the source check to refuse.
    const linked = path.join(parent, "linked");
    await mkdir(path.join(parent, "sources", "slides"), { recursive: true });
    await writeFile(path.join(parent, "sources", "slides", "cover.mdx"), "# Talk\n");
    await writeFile(path.join(parent, "sources", BUILD_MARKER), "");
    await mkdir(linked);
    await writeFile(path.join(linked, "deck.json"), "{}");
    await symlink(path.join(parent, "sources", "slides"), path.join(linked, "slides"));
    await mkdir(path.join(parent, "built", "..talk", "slides"), { recursive: true });
    await writeFile(path.join(parent, "built", BUILD_MARKER), "");
    return { parent, deck, decks: { talk: deck, linked, dotted: path.join(parent, "built", "..talk") } };
  }),
  ({ parent }) => Effect.promise(() => rm(parent, { recursive: true, force: true }))
);

/** Whether the temporary directory's volume ignores case, as macOS's default APFS does. */
const caseInsensitive = (() => {
  const probe = mkdtempSync(path.join(tmpdir(), "fuse-deck-case-"));
  const ignores = existsSync(probe.toUpperCase()) && existsSync(probe.toLowerCase());
  rmSync(probe, { recursive: true });
  return ignores;
})();

describe("resolveBuildOutput", () => {
  it.effect.each([
    { name: "the deck itself", out: ".", reason: "it holds the deck" },
    { name: "a new directory in slides named ..draft", out: "slides/..draft", reason: "inside slides/" },
    {
      name: "the directory above a deck named ..talk",
      deck: "dotted" as const,
      out: "..",
      reason: "it holds the deck",
    },
    {
      name: "a directory inside a linked slides/",
      deck: "linked" as const,
      out: "../sources/slides/out",
      reason: "inside slides/",
    },
    {
      name: "a directory that holds a linked slides/",
      deck: "linked" as const,
      out: "../sources",
      reason: "holds slides/",
    },
    { name: "a directory above the deck", out: "..", reason: "it holds the deck" },
    { name: "the slides directory", out: "slides", reason: "inside slides/" },
    { name: "a directory inside slides", out: "slides/out", reason: "inside slides/" },
    { name: "an alias of the deck", out: "../alias", reason: "it holds the deck" },
    { name: "a new directory in an alias's slides", out: "../alias/slides/out", reason: "inside slides/" },
    {
      name: "a non-empty directory no build wrote",
      out: "../notes",
      reason: "an earlier build did not write",
    },
  ])("refuses $name", ({ deck = "talk" as const, out, reason }) =>
    Effect.gen(function* () {
      const { decks } = yield* fixture;
      const resolved = yield* Effect.result(resolveBuildOutput(decks[deck], out));
      assert.strictEqual(Result.isFailure(resolved) && resolved.failure._tag, "BuildOutputRefused");
      assert.include(Result.isFailure(resolved) ? resolved.failure.message : "", reason);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect.each([
    { name: "the deck's dist, which holds files but no marker", out: "dist", expected: "talk/dist" },
    { name: "the deck's dist through an alias", out: "../alias/dist", expected: "talk/dist" },
    { name: "a new directory inside the deck", out: "site/public", expected: "talk/site/public" },
    { name: "a directory an earlier build wrote", out: "../site", expected: "site" },
    { name: "an empty directory", out: "../empty", expected: "empty" },
    { name: "a new directory beside the deck", out: "../fresh", expected: "fresh" },
  ])("accepts $name", ({ out, expected }) =>
    Effect.gen(function* () {
      const { parent, deck } = yield* fixture;
      const resolved = yield* resolveBuildOutput(deck, out);
      assert.strictEqual(resolved.directory, path.join(parent, expected));
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  // A case-sensitive volume, such as Linux CI's, has no other spelling of the same directory.
  describe.skipIf(!caseInsensitive)("on a volume that ignores case", () => {
    it.effect.each([
      { name: "slides/ spelled in capitals", out: "SLIDES", reason: "inside slides/" },
      { name: "a new directory in slides/ spelled Slides", out: "Slides/out", reason: "inside slides/" },
      { name: "the deck spelled in capitals", out: "../TALK", reason: "it holds the deck" },
      {
        name: "a directory that holds a linked slides/, spelled in capitals",
        deck: "linked" as const,
        out: "../SOURCES",
        reason: "holds slides/",
      },
    ])("refuses $name", ({ deck = "talk" as const, out, reason }) =>
      Effect.gen(function* () {
        const { decks } = yield* fixture;
        const resolved = yield* Effect.result(resolveBuildOutput(decks[deck], out));
        assert.strictEqual(Result.isFailure(resolved) && resolved.failure._tag, "BuildOutputRefused");
        assert.include(Result.isFailure(resolved) ? resolved.failure.message : "", reason);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
    );
  });
});
