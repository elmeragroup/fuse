import { assert } from "@effect/vitest";
import { Effect, Option } from "effect";

import {
  announceStep as announce,
  endlessChangelogGit,
  fakeSlack,
  inScratchRepository,
  pathWith,
  releaseJson,
  ScratchRepository,
} from "./cli-harness.ts";
import { bulk } from "./fixtures.ts";

// Unit under test: src/announce-release.ts, run as the notify job runs it, on stable releases whose
// changelogs are long, nested or hostile. Oracles: the bounded read (only a prefix of the changelog
// is read, and a heading past it is linked), the notes renderer's time limit (a parse it stops
// leaves the notes linked, never a failed step or a hang) and Slack's mrkdwn as the suite writes
// it out.

/** The publish job's `release` output for the stable release `version` of `commit`. */
const stableRelease = (commit: string, version: string) => releaseJson("Stable", commit, version);

inScratchRepository("announcing a release with a long changelog", (it) => {
  it.effect("posts the release's short notes from the top of a changelog over a megabyte", () =>
    Effect.gen(function* () {
      const repo = yield* ScratchRepository;
      const sha = yield* repo.commit(
        "Version Packages (#491)",
        Option.some(
          `# @elmeragroup/fuse\n\n## 0.3.0\n\n### Patch Changes\n\n- abc1234: Small fix.\n\n## 0.2.0\n\n${bulk}\n`
        ),
        "0.3.0"
      );
      const slack = yield* fakeSlack;
      const run = yield* announce(slack.url, yield* stableRelease(sha, "0.3.0"));
      assert.strictEqual(run.exitCode, 0, run.stdout);
      const payload = JSON.stringify(slack.held[0]?.payload);
      assert.include(payload, JSON.stringify("*Patch Changes*\n\n• abc1234: Small fix."));
      assert.notInclude(payload, "These notes are shortened.");
    })
  );

  it.effect("reads a changelog of any size only as far as the read limit", () =>
    Effect.gen(function* () {
      // The stand-in git writes the changelog without end, so only a bounded read finishes.
      const repo = yield* ScratchRepository;
      const sha = yield* repo.commit("Version Packages (#503)", Option.some("## 1.0.0\n"), "1.0.0");
      const gitDir = yield* endlessChangelogGit;
      const slack = yield* fakeSlack;
      const run = yield* announce(slack.url, yield* stableRelease(sha, "1.0.0"), {
        PATH: yield* pathWith(gitDir),
      });
      assert.strictEqual(run.exitCode, 0, run.stdout);
      const payload = JSON.stringify(slack.held[0]?.payload);
      assert.include(payload, "• Endless notes.");
      assert.include(payload, "These notes are shortened.");
    })
  );

  it.effect.each([
    // About 6 KB of quote markers once exhausted the call stack, and the step failed.
    { kind: "quotes", markdown: `${"> ".repeat(3000)}hello`, shown: `${"> ".repeat(32)}hello` },
    { kind: "lists", markdown: `${"- ".repeat(3000)}hello`, shown: `${"• ".repeat(32)}hello` },
    {
      kind: "emphasis inside a link",
      markdown: `[${"*a _b ".repeat(40)}x${"_ c* d".repeat(40)}](https://e.test/l)`,
      shown: "<https://e.test/l|a b a b ",
    },
  ])("posts notes holding deeply nested $kind, flattened and marked shortened", ({ markdown, shown }) =>
    Effect.gen(function* () {
      const repo = yield* ScratchRepository;
      const sha = yield* repo.commit(
        "Version Packages (#504)",
        Option.some(`## 1.0.0\n\n${markdown}\n`),
        "1.0.0"
      );
      const slack = yield* fakeSlack;
      const run = yield* announce(slack.url, yield* stableRelease(sha, "1.0.0"));
      assert.strictEqual(run.exitCode, 0, run.stdout);
      const payload = JSON.stringify(slack.held[0]?.payload);
      assert.include(payload, shown);
      assert.include(payload, "These notes are shortened.");
    })
  );

  /** Lines of `line`, filling the read limit after the section's first note. */
  const filled = (line: string) =>
    Array.from({ length: Math.ceil((512 * 1024) / (line.length + 1)) }, () => line).join("\n");

  /** The section a hostile changelog holds: a first note, then `body`. */
  const hostile = (body: string) => `## 1.0.0\n\n- First note.\n\n${body}\n`;

  /** A run nesting `open` and `close` around `mid`, about `size` characters long. */
  const nested = (open: string, close: string, size: number, mid = "x") => {
    const count = Math.floor((size - mid.length) / (open.length + close.length));
    return `${open.repeat(count)}${mid}${close.repeat(count)}`;
  };

  /** The production time limit. */
  const production = {};

  /**
   * A second's limit, for sections that keep micromark busy for minutes and so always meet the
   * limit, whatever it is; the production limit itself is isolated-notes.test.ts's.
   */
  const stopsParse = { NOTES_TIME_LIMIT: "1 second" };

  it.effect.each([
    // Read to the read limit; micromark parses these in seconds.
    {
      input: "unclosed brackets",
      body: filled(`${"[".repeat(8140)}](${"u".repeat(8140)} z)`),
      limit: production,
    },
    { input: "unpaired *", body: filled("*a ".repeat(5430)), limit: production },
    { input: "unpaired **", body: filled("**a ".repeat(4075)), limit: production },
    { input: "unpaired ~~", body: filled("~~a ".repeat(4075)), limit: production },
    { input: "backtick pairs", body: filled("`c` ".repeat(4075)), limit: production },
    { input: "a long line", body: "word ".repeat(100_000), limit: production },
    // These keep micromark busy for minutes.
    { input: "nested images", body: nested("![", "](x)", 500_000), limit: stopsParse },
    { input: "nested **", body: nested("**", "**", 500_000), limit: stopsParse },
    { input: "lines of nested **", body: filled(nested("**", "**", 16_000)), limit: stopsParse },
    { input: "nested quotes", body: `${"> ".repeat(250_000)}x`, limit: stopsParse },
    { input: "64 KiB of nested lists", body: `${"- ".repeat(32_768)}x`, limit: stopsParse },
  ])(
    "posts a section of $input with its first notes, or with them linked once the time limit stops the parse",
    ({ body, limit }) =>
      Effect.gen(function* () {
        const repo = yield* ScratchRepository;
        const sha = yield* repo.commit("Version Packages (#505)", Option.some(hostile(body)), "1.0.0");
        const slack = yield* fakeSlack;
        // Which outcome a section gets depends on how fast this machine parses it, so either is
        // right; a failed step or a hang never is. The renderer stopped by its time limit is
        // isolated-notes.test.ts's, and the post it then makes is release-announcement.test.ts's.
        const run = yield* announce(slack.url, yield* stableRelease(sha, "1.0.0"), limit);
        assert.strictEqual(run.exitCode, 0, run.stdout);
        const payload = JSON.stringify(slack.held[0]?.payload);
        assert.include(payload, '"text":"@elmeragroup/fuse 1.0.0"');
        assert.include(payload, "|GitHub release>");
        const shown =
          payload.includes('"text":"• First note.') && payload.includes("These notes are shortened.");
        const linked =
          payload.includes("The notes for 1.0.0 could not be shown here.") &&
          run.stdout.includes("The notes of 1.0.0 could not be shown: ");
        assert.isTrue(shown !== linked, `either the first notes or the link, not ${payload.slice(0, 400)}`);
      }),
    120_000
  );

  it.effect("links the notes instead when the version's heading lies past what is read", () =>
    Effect.gen(function* () {
      const repo = yield* ScratchRepository;
      const sha = yield* repo.commit(
        "Version Packages (#501)",
        Option.some(`# @elmeragroup/fuse\n\n## 0.0.1\n\n${bulk}\n\n## 1.0.0\n\n- Late notes.\n`),
        "1.0.0"
      );
      const slack = yield* fakeSlack;
      const run = yield* announce(slack.url, yield* stableRelease(sha, "1.0.0"));
      assert.strictEqual(run.exitCode, 0, run.stdout);
      assert.include(
        JSON.stringify(slack.held[0]?.payload),
        "The notes for 1.0.0 are too large to show here."
      );
    })
  );
});
