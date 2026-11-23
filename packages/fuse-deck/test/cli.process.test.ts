import * as Schema from "effect/Schema";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/** The built bin, the file the packed tarball ships. Turbo builds it before this suite runs. */
const BIN = fileURLToPath(new URL("../dist/bin.mjs", import.meta.url));

/** What one run of the bin printed and how it exited. */
type Run = { readonly status: number | null; readonly stdout: string; readonly stderr: string };

function fuseDeck(cwd: string, args: readonly string[]): Run {
  if (!existsSync(BIN)) {
    throw new Error(`${BIN} is missing. Run \`pnpm --filter @elmeragroup/fuse-deck build\` first.`);
  }
  const result = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** A document's tag and message, the fields every failure document carries. */
const Tagged = Schema.Struct({ _tag: Schema.String, message: Schema.optionalKey(Schema.String) });

/**
 * The run's stdout decoded as exactly one JSON document of `schema`. `JSON.parse` fails on a second
 * document or any other text.
 */
function oneDocument<S extends Schema.Decoder<unknown>>(run: Run, schema: S): S["Type"] {
  return Schema.decodeSync(Schema.fromJsonString(schema))(run.stdout);
}

const Problem = Schema.Struct({
  _tag: Schema.String,
  id: Schema.optionalKey(Schema.String),
  path: Schema.optionalKey(Schema.String),
});

const CheckFailed = Schema.TaggedStruct("DeckCheckFailed", { problems: Schema.Array(Problem) });

const SlideList = Schema.TaggedStruct("SlideList", {
  slides: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      path: Schema.String,
      title: Schema.NullOr(Schema.String),
      layout: Schema.NullOr(Schema.String),
    })
  ),
});

let workspace = "";

beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), "fuse-deck-cli-"));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

function createDeck(): string {
  const run = fuseDeck(workspace, ["create", "talk", "--brief", "Show Fuse.", "--json"]);
  expect(run.status, run.stderr).toBe(0);
  return path.join(workspace, "talk");
}

describe("fuse-deck --json", () => {
  it.each([
    { name: "an unknown flag", args: ["describe", "--bogus", "--json"], where: "deck" },
    { name: "a command without its subcommand, outside a deck", args: ["slides", "--json"], where: "empty" },
    { name: "an invalid slide id", args: ["--json", "slides", "add", "Not/Safe"], where: "deck" },
    { name: "a move without an anchor", args: ["slides", "move", "cover", "--json"], where: "deck" },
  ])("answers $name with one InvalidInvocation document and exit 2", ({ args, where }) => {
    const run = fuseDeck(where === "deck" ? createDeck() : workspace, args);
    expect(run.status).toBe(2);
    const document = oneDocument(run, Schema.Struct({ _tag: Schema.String, message: Schema.NonEmptyString }));
    expect(document._tag).toBe("InvalidInvocation");
  });

  it("answers a broken deck with one DeckCheckFailed document naming each problem, and exit 1", async () => {
    const deck = createDeck();
    expect(fuseDeck(deck, ["slides", "add", "intro", "--json"]).status).toBe(0);
    await unlink(path.join(deck, "slides", "intro.mdx"));
    await writeFile(path.join(deck, "slides", "stray.mdx"), "# Stray\n");
    await writeFile(path.join(deck, "slides", "cover.mdx"), "---\ntransition: fade\n---\n# Talk\n");

    const run = fuseDeck(deck, ["check", "--json"]);
    expect(run.status).toBe(1);
    expect(oneDocument(run, CheckFailed).problems).toEqual([
      { _tag: "DanglingSlide", id: "intro" },
      { _tag: "OrphanSlide", path: "slides/stray.mdx" },
      { _tag: "InvalidFrontmatter", id: "cover" },
    ]);
  });

  it("answers a domain failure outside a deck with one document and exit 1", () => {
    const run = fuseDeck(workspace, ["slides", "list", "--json"]);
    expect(run.status).toBe(1);
    const document = oneDocument(
      run,
      Schema.Struct({ _tag: Schema.String, message: Schema.NonEmptyString, hint: Schema.NonEmptyString })
    );
    expect(document._tag).toBe("DeckNotFound");
  });

  it("answers each edit with one document and exit 0, and the order reflects every edit", () => {
    const deck = createDeck();
    const runs = [
      fuseDeck(deck, ["slides", "add", "intro", "--title", "Why Fuse", "--json"]),
      fuseDeck(deck, ["slides", "add", "tools", "--after", "cover", "--layout", "section", "--json"]),
      fuseDeck(deck, ["slides", "move", "intro", "--before", "tools", "--json"]),
      fuseDeck(deck, ["slides", "remove", "tools", "--json"]),
      fuseDeck(deck, ["check", "--json"]),
    ];
    expect(runs.map((run) => run.status)).toEqual([0, 0, 0, 0, 0]);
    expect(runs.map((run) => oneDocument(run, Tagged)._tag)).toEqual([
      "SlideAdded",
      "SlideAdded",
      "SlideMoved",
      "SlideRemoved",
      "DeckChecked",
    ]);
    // The second add and the move, each with the order it left.
    const Ordered = Schema.Struct({ order: Schema.Array(Schema.String) });
    expect(runs.slice(1, 3).map((run) => oneDocument(run, Ordered).order)).toEqual([
      ["cover", "tools", "intro"],
      ["cover", "intro", "tools"],
    ]);
    expect(oneDocument(fuseDeck(deck, ["slides", "list", "--json"]), SlideList).slides).toEqual([
      { id: "cover", path: "slides/cover.mdx", title: "Talk", layout: "cover" },
      { id: "intro", path: "slides/intro.mdx", title: "Why Fuse", layout: "content" },
    ]);
  });

  it("describes every layout that a slide can then use", () => {
    // Unit under test: `describe --json`. Oracle: the layout parser `slides add --layout` and `check` apply.
    const deck = createDeck();
    const vocabulary = Schema.decodeSync(
      Schema.fromJsonString(
        Schema.TaggedStruct("DeckVocabulary", {
          layouts: Schema.Array(Schema.Struct({ name: Schema.String, summary: Schema.String })),
        })
      )
    )(fuseDeck(deck, ["describe", "--json"]).stdout);
    expect(vocabulary.layouts.length).toBeGreaterThan(0);
    for (const { name } of vocabulary.layouts) {
      expect(fuseDeck(deck, ["slides", "add", `uses-${name}`, "--layout", name, "--json"]).status).toBe(0);
    }
    expect(fuseDeck(deck, ["slides", "add", "uses-unknown", "--layout", "hero", "--json"]).status).toBe(2);
    expect(oneDocument(fuseDeck(deck, ["check", "--json"]), Tagged)._tag).toBe("DeckChecked");
  });

  it("prints a failure document larger than a pipe's buffer whole before it exits", async () => {
    const deck = createDeck();
    // Each orphan adds a problem of about 250 bytes, so the document passes 64 KiB.
    for (let index = 0; index < 400; index += 1) {
      await writeFile(path.join(deck, "slides", `orphan-${String(index)}.mdx`), "# Orphan\n");
    }
    const run = fuseDeck(deck, ["check", "--json"]);
    expect(run.status).toBe(1);
    expect(run.stdout.length).toBeGreaterThan(64 * 1024);
    expect(oneDocument(run, CheckFailed).problems).toHaveLength(400);
  });

  it("keeps --help as text with exit 0", () => {
    const run = fuseDeck(workspace, ["--help", "--json"]);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("USAGE");
  });
});
