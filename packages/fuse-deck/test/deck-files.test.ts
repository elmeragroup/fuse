import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as fc from "fast-check";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { DeckFiles } from "../src/deck/deck-files.ts";
import { formatManifest, parseManifest } from "../src/deck/deck-manifest.ts";
import type { DeckManifest, OrderPosition } from "../src/deck/deck-manifest.ts";
import { scaffoldDeck } from "../src/deck/scaffold.ts";
import { SlideId } from "../src/deck/slide-id.ts";

const id = (text: string) => SlideId.make(text);

const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

const tempDir = Effect.acquireRelease(
  Effect.promise(() => mkdtemp(path.join(tmpdir(), "fuse-deck-files-"))),
  (dir) => Effect.promise(() => rm(dir, { recursive: true, force: true }))
);

/**
 * The real file system, except that a write to a path ending in `failing`, through `writeFile` or an
 * open handle, puts the first half of the bytes on disk and then fails, as a full disk does.
 */
function failingWriteTo(failing: string) {
  return Layer.effect(
    FileSystem.FileSystem,
    Effect.map(FileSystem.FileSystem, (real) => {
      const full = PlatformError.systemError({
        _tag: "Unknown",
        module: "FileSystem",
        method: "write",
        description: "no space left on device",
        pathOrDescriptor: failing,
      });
      const half = (data: Uint8Array) => data.subarray(0, Math.ceil(data.length / 2));
      return FileSystem.make({
        ...real,
        writeFile: (target, data, options) =>
          target.endsWith(failing)
            ? Effect.andThen(real.writeFile(target, half(data), options), Effect.fail(full))
            : real.writeFile(target, data, options),
        open: (target, options) =>
          target.endsWith(failing)
            ? Effect.map(real.open(target, options), (file): FileSystem.File => ({
                ...file,
                writeAll: (data) => Effect.andThen(file.writeAll(half(data)), Effect.fail(full)),
              }))
            : real.open(target, options),
      });
    })
  ).pipe(Layer.provide(NodeServices.layer));
}

/** A new deck from `create`, with the given slides added after its cover, in order. */
const deckWith = Effect.fnUntraced(function* (ids: readonly string[]) {
  const root = path.join(yield* tempDir, "deck");
  yield* scaffoldDeck({ directory: root, brief: Option.none(), theme: "neutral-elma-private" });
  const deck = yield* Effect.service(DeckFiles).pipe(Effect.provide(DeckFiles.layerFrom(root)));
  for (const each of ids) {
    yield* deck.addSlide(id(each), { _tag: "End" }, `# ${each}\n`);
  }
  return deck;
});

/** The order in `deck.json` on disk, as plain strings to compare with the expected order. */
function orderOnDisk(root: string) {
  return manifestOnDisk(root).pipe(Effect.map((manifest): string[] => [...manifest.order]));
}

/** `deck.json` as it is on disk, decoded. */
function manifestOnDisk(root: string) {
  return Effect.promise(() => readFile(path.join(root, "deck.json"), "utf8")).pipe(
    Effect.map((text) => Result.getOrThrow(parseManifest(text)))
  );
}

function slideFiles(root: string) {
  return Effect.promise(() => readdir(path.join(root, "slides"))).pipe(
    Effect.map((names) => [...names].sort())
  );
}

describe("DeckFiles", () => {
  type AddCase = {
    readonly name: string;
    readonly position: OrderPosition;
    readonly expected: readonly string[];
  };
  const addCases: readonly AddCase[] = [
    { name: "add c at the end of [a, b]", position: { _tag: "End" }, expected: ["cover", "a", "b", "c"] },
    {
      name: "add c after a in [a, b]",
      position: { _tag: "After", anchor: id("a") },
      expected: ["cover", "a", "c", "b"],
    },
    {
      name: "add c after b in [a, b]",
      position: { _tag: "After", anchor: id("b") },
      expected: ["cover", "a", "b", "c"],
    },
  ];
  for (const { name, position, expected } of addCases) {
    it.effect(`${name} writes the slide file and the order`, () =>
      Effect.gen(function* () {
        const deck = yield* deckWith(["a", "b"]);
        yield* deck.addSlide(id("c"), position, "# c\n");
        assert.deepStrictEqual(yield* orderOnDisk(deck.root), expected);
        assert.strictEqual(
          yield* Effect.promise(() => readFile(path.join(deck.root, "slides", "c.mdx"), "utf8")),
          "# c\n"
        );
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
    );
  }

  type MoveCase = {
    readonly move: string;
    readonly position: Exclude<OrderPosition, { readonly _tag: "End" }>;
    readonly expected: readonly string[];
  };
  const moveCases: readonly MoveCase[] = [
    { move: "c", position: { _tag: "After", anchor: id("a") }, expected: ["a", "c", "b"] },
    { move: "a", position: { _tag: "After", anchor: id("c") }, expected: ["b", "c", "a"] },
    { move: "c", position: { _tag: "Before", anchor: id("a") }, expected: ["c", "a", "b"] },
    { move: "a", position: { _tag: "Before", anchor: id("c") }, expected: ["b", "a", "c"] },
    { move: "b", position: { _tag: "After", anchor: id("a") }, expected: ["a", "b", "c"] },
  ];
  for (const { move, position, expected } of moveCases) {
    it.effect(
      `move ${move} ${position._tag.toLowerCase()} ${position.anchor} in [a, b, c] gives [${expected.join(", ")}]`,
      () =>
        Effect.gen(function* () {
          const deck = yield* deckWith(["a", "b", "c"]);
          yield* deck.removeSlide(id("cover"));
          yield* deck.moveSlide(id(move), position);
          assert.deepStrictEqual(yield* orderOnDisk(deck.root), expected);
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
    );
  }

  it.effect("remove takes the slide out of the order and deletes its file", () =>
    Effect.gen(function* () {
      const deck = yield* deckWith(["a", "b"]);
      yield* deck.removeSlide(id("a"));
      assert.deepStrictEqual(yield* orderOnDisk(deck.root), ["cover", "b"]);
      assert.deepStrictEqual(yield* slideFiles(deck.root), ["b.mdx", "cover.mdx"]);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("refuses edits that name the wrong slides, and leaves the deck as it was", () =>
    Effect.gen(function* () {
      const deck = yield* deckWith(["a", "b"]);
      const failures = [
        yield* Effect.flip(deck.addSlide(id("a"), { _tag: "End" }, "# a\n")),
        yield* Effect.flip(deck.addSlide(id("c"), { _tag: "After", anchor: id("zz") }, "# c\n")),
        yield* Effect.flip(deck.moveSlide(id("zz"), { _tag: "After", anchor: id("a") })),
        yield* Effect.flip(deck.moveSlide(id("a"), { _tag: "Before", anchor: id("a") })),
        yield* Effect.flip(deck.removeSlide(id("zz"))),
      ];
      assert.deepStrictEqual(
        failures.map((failure) => failure._tag),
        ["SlideIdTaken", "SlideNotInDeck", "SlideNotInDeck", "SlideAnchoredToItself", "SlideNotInDeck"]
      );
      assert.deepStrictEqual(yield* orderOnDisk(deck.root), ["cover", "a", "b"]);
      assert.deepStrictEqual(yield* slideFiles(deck.root), ["a.mdx", "b.mdx", "cover.mdx"]);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("add refuses to overwrite an orphan file and leaves the order alone", () =>
    Effect.gen(function* () {
      const deck = yield* deckWith([]);
      const orphan = path.join(deck.root, "slides", "notes.mdx");
      yield* Effect.promise(() => writeFile(orphan, "# Kept\n"));
      const failure = yield* Effect.flip(deck.addSlide(id("notes"), { _tag: "End" }, "# New\n"));
      assert.strictEqual(failure._tag, "SlideFileExists");
      assert.strictEqual(yield* Effect.promise(() => readFile(orphan, "utf8")), "# Kept\n");
      assert.deepStrictEqual(yield* orderOnDisk(deck.root), ["cover"]);
      assert.deepStrictEqual((yield* deck.load).orphans, ["slides/notes.mdx"]);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.live("keeps every edit when many run at once", () =>
    Effect.gen(function* () {
      const deck = yield* deckWith([]);
      const ids = Array.from({ length: 12 }, (_, index) => `s${String(index)}`);
      yield* Effect.forEach(ids, (each) => deck.addSlide(id(each), { _tag: "End" }, `# ${each}\n`), {
        concurrency: "unbounded",
      });
      assert.deepStrictEqual((yield* orderOnDisk(deck.root)).sort(), ["cover", ...ids].sort());
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.live("takes over a lock a crashed command left behind", () =>
    Effect.gen(function* () {
      const deck = yield* deckWith([]);
      const deadPid = spawnSync(process.execPath, ["-e", ""]).pid;
      const stale = yield* encodeJson({ pid: deadPid, token: "crashed" });
      yield* Effect.promise(() => writeFile(path.join(deck.root, ".fuse-deck.lock"), stale));
      yield* deck.addSlide(id("after-crash"), { _tag: "End" }, "# After\n");
      assert.deepStrictEqual(yield* orderOnDisk(deck.root), ["cover", "after-crash"]);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.live("add then remove gives back the manifest it started from", () =>
    Effect.gen(function* () {
      const deck = yield* deckWith([]);
      const pool = ["a", "b", "c", "d", "e", "f"];
      const scenario = fc.record({
        existing: fc.uniqueArray(fc.constantFrom(...pool), { maxLength: 5 }),
        added: fc.constantFrom(...pool, "g"),
        anchor: fc.option(fc.constantFrom(...pool, "cover"), { nil: undefined }),
      });
      const runPromise = Effect.runPromiseWith(yield* Effect.context<FileSystem.FileSystem>());
      yield* Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(scenario, async ({ existing, added, anchor }) => {
            fc.pre(!existing.includes(added));
            fc.pre(anchor === undefined || anchor === "cover" || existing.includes(anchor));
            const run = Effect.gen(function* () {
              const start: DeckManifest = {
                ...(yield* manifestOnDisk(deck.root)),
                order: [id("cover"), ...existing.map(id)],
              };
              yield* Effect.promise(() =>
                writeFile(path.join(deck.root, "deck.json"), formatManifest(start))
              );
              const position: OrderPosition =
                anchor === undefined ? { _tag: "End" } : { _tag: "After", anchor: id(anchor) };
              yield* deck.addSlide(id(added), position, "# x\n");
              yield* deck.removeSlide(id(added));
              assert.deepStrictEqual(yield* manifestOnDisk(deck.root), start);
            });
            await runPromise(run);
          }),
          { numRuns: 60 }
        )
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );
});

describe("scaffoldDeck", () => {
  it.live.each([
    { name: "a new directory", existing: false },
    { name: "an existing empty directory", existing: true },
  ])("puts one whole deck in $name when several creates race for it", ({ existing }) =>
    Effect.gen(function* () {
      const parent = yield* tempDir;
      const root = path.join(parent, "talk");
      if (existing) {
        yield* Effect.promise(() => mkdir(root));
      }
      const briefs = ["First brief", "Second brief", "Third brief", "Fourth brief"];
      const results = yield* Effect.forEach(
        briefs,
        (brief) =>
          Effect.result(
            scaffoldDeck({ directory: root, brief: Option.some(brief), theme: "neutral-elma-private" })
          ),
        { concurrency: "unbounded" }
      );
      const winner = results.findIndex(Result.isSuccess);
      const won = results[winner];
      assert.strictEqual(results.filter(Result.isSuccess).length, 1);
      assert.deepStrictEqual(
        results.filter(Result.isFailure).map((result) => result.failure._tag),
        ["DeckDirectoryNotEmpty", "DeckDirectoryNotEmpty", "DeckDirectoryNotEmpty"]
      );
      // Every file the winner reported is on disk, from the winner's brief, and nothing else is.
      const files = won !== undefined && Result.isSuccess(won) ? won.success.files : [];
      const onDisk = yield* Effect.promise(() => readdir(root, { recursive: true }));
      assert.sameMembers(onDisk, [...files, "slides"]);
      const brief = yield* Effect.promise(() => readFile(path.join(root, "BRIEF.md"), "utf8"));
      const cover = yield* Effect.promise(() => readFile(path.join(root, "slides", "cover.mdx"), "utf8"));
      assert.strictEqual(brief, briefs[winner]);
      assert.include(cover, brief);
      assert.deepStrictEqual(yield* Effect.promise(() => readdir(parent)), ["talk"]);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("keeps the brief byte for byte", () =>
    Effect.gen(function* () {
      const root = path.join(yield* tempDir, "talk");
      const brief = "Line one\r\n\r\nNo newline at the end";
      yield* scaffoldDeck({ directory: root, brief: Option.some(brief), theme: "neutral-elma-private" });
      assert.strictEqual(yield* Effect.promise(() => readFile(path.join(root, "BRIEF.md"), "utf8")), brief);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect(
    "leaves an empty directory empty when a write fails partway through a file, so a retry succeeds",
    () =>
      Effect.gen(function* () {
        // Oracle: a failed create removes what it wrote, and `create` accepts an empty directory.
        const root = path.join(yield* tempDir, "talk");
        yield* Effect.promise(() => mkdir(root));
        const input = { directory: root, brief: Option.none(), theme: "neutral-elma-private" };
        const failed = yield* Effect.result(
          scaffoldDeck(input).pipe(Effect.provide(failingWriteTo(path.join("slides", "cover.mdx"))))
        );
        assert.strictEqual(Result.isFailure(failed) && failed.failure._tag, "ScaffoldFailed");
        assert.deepStrictEqual(yield* Effect.promise(() => readdir(root)), []);
        yield* scaffoldDeck(input);
        assert.include(yield* Effect.promise(() => readdir(root)), "deck.json");
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );
});
