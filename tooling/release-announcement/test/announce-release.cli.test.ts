import { assert } from "@effect/vitest";
import { Clock, DateTime, Effect, FileSystem, Option, Path, Schema } from "effect";
import { Headers } from "effect/http";
import { pathToFileURL } from "node:url";

import {
  announceStep as announce,
  fakeSlack,
  inScratchRepository,
  releaseJson,
  ScratchRepository,
  SLACK_TOKEN,
} from "./cli-harness.ts";
import { changelog, notes020 } from "./fixtures.ts";

// Unit under test: src/announce-release.ts, run as the notify job runs it, in a git checkout,
// against a local stand-in for Slack's Web API that stores what is posted to it. Oracles: Slack's
// history as the delivery receipt (a re-run must find the message the first run posted, even when
// the first run never saw Slack's answer), chat.postMessage's and conversations.history's
// arguments and paging (`has_more` with `next_cursor`), Slack's rate limits (a read before the
// asked-for wait is limited again) and GitHub's workflow commands.

/** What the probe records of a Node process it ran in. */
const ProbeRecord = Schema.Struct({ script: Schema.String, keys: Schema.Array(Schema.String) });

/** The publish job's `release` output for the stable release 0.2.0 of `commit`. */
const stableRelease = (commit: string) => releaseJson("Stable", commit, "0.2.0");

/** The publish job's `release` output for a canary of `commit`. */
const canaryRelease = (commit: string) => releaseJson("Canary", commit, "0.2.1-canary.0");

/** The version commit of 0.2.0, whose changelog holds its notes. */
const versionCommit = Effect.gen(function* () {
  const repo = yield* ScratchRepository;
  return yield* repo.commit("Version Packages (#460)", Option.some(changelog));
});

const posts = (calls: readonly string[]) => calls.filter((call) => call === "chat.postMessage").length;

/** `count` history reads' worth of the same answer. */
const history = (count: number) => Array.from({ length: count }, () => "conversations.history");

inScratchRepository("announcing a release in Slack", (it) => {
  it.effect("posts a stable release once to the releases channel, with its notes and receipt", () =>
    Effect.gen(function* () {
      const slack = yield* fakeSlack;
      const run = yield* announce(slack.url, yield* stableRelease(yield* versionCommit));
      assert.strictEqual(run.exitCode, 0, run.stdout);
      assert.deepStrictEqual(slack.calls, ["conversations.history", "chat.postMessage"]);
      assert.strictEqual(slack.held.length, 1);
      assert.deepInclude(slack.held[0]?.payload, {
        channel: "C0RELEASES",
        text: "@elmeragroup/fuse 0.2.0 is released",
        parse: "none",
        link_names: false,
        metadata: { event_type: "fuse_release_announced", event_payload: { tag: "v0.2.0" } },
      });
      assert.include(JSON.stringify(slack.held[0]?.payload), JSON.stringify(notes020));
      assert.include(
        run.stdout,
        `::notice::Announced v0.2.0 in Slack (C0RELEASES, message ${slack.held[0]?.ts ?? ""}).`
      );
      assert.notInclude(`${run.stdout}${run.stderr}`, SLACK_TOKEN);
    })
  );

  it.effect("posts a canary to the canary channel, linking its PR", () =>
    Effect.gen(function* () {
      const repo = yield* ScratchRepository;
      const sha = yield* repo.commit(
        "Keep A Device Pixel For Small Non-Zero Bar Values (#456)",
        Option.some(changelog)
      );
      const slack = yield* fakeSlack;
      const run = yield* announce(slack.url, yield* canaryRelease(sha));
      assert.strictEqual(run.exitCode, 0, run.stdout);
      assert.deepInclude(slack.held[0]?.payload, {
        channel: "C0CANARY",
        text: "@elmeragroup/fuse 0.2.1-canary.0: Keep A Device Pixel For Small Non-Zero Bar Values",
        metadata: { event_type: "fuse_release_announced", event_payload: { tag: `canary-${sha}` } },
      });
    })
  );

  it.effect("keeps the step's secrets and Node options from the process that reads the changelog", () =>
    Effect.gen(function* () {
      // NODE_OPTIONS loads a probe into every Node process that inherits it; the probe records
      // which script it ran in and what environment that script saw.
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped();
      const seen = path.join(dir, "seen.jsonl");
      const probe = path.join(dir, "probe.mjs");
      yield* fs.writeFileString(
        probe,
        `import { appendFileSync } from "node:fs";\nappendFileSync(${JSON.stringify(seen)}, JSON.stringify({ script: process.argv[1] ?? "", keys: Object.keys(process.env) }) + "\\n");\n`
      );
      const slack = yield* fakeSlack;
      const run = yield* announce(slack.url, yield* stableRelease(yield* versionCommit), {
        NODE_OPTIONS: `--import=${pathToFileURL(probe).href}`,
        GITHUB_TOKEN: "ghs-dummy-secret",
      });
      assert.strictEqual(run.exitCode, 0, run.stdout);
      assert.include(JSON.stringify(slack.held[0]?.payload), JSON.stringify(notes020));
      const records = (yield* fs.readFileString(seen))
        .trim()
        .split("\n")
        .map((line) => Schema.decodeUnknownSync(ProbeRecord)(JSON.parse(line)));
      // The step itself saw them, so the probe works; the renderer's process never loaded it.
      const step = records.find((record) => record.script.endsWith("announce-release.ts"));
      assert.includeMembers([...(step?.keys ?? [])], ["SLACK_BOT_TOKEN", "GITHUB_TOKEN", "NODE_OPTIONS"]);
      assert.deepStrictEqual(
        records.filter((record) => !record.script.endsWith("announce-release.ts")),
        []
      );
    })
  );

  it.effect("finds the first run's post when re-run, and posts nothing", () =>
    Effect.gen(function* () {
      const slack = yield* fakeSlack;
      const release = yield* stableRelease(yield* versionCommit);
      yield* announce(slack.url, release);
      const again = yield* announce(slack.url, release);
      assert.strictEqual(again.exitCode, 0, again.stdout);
      assert.include(
        again.stdout,
        `::notice::v0.2.0 is already announced in Slack (C0RELEASES, message ${slack.held[0]?.ts ?? ""}). ` +
          "Delete that message, then re-run this job to post it again."
      );
      assert.strictEqual(posts(slack.calls), 1);
      assert.strictEqual(slack.held.length, 1);
    })
  );

  it.effect.each([
    {
      case: "breaks off",
      set: (behaviour: { loseNextPostAnswer: boolean }) => (behaviour.loseNextPostAnswer = true),
    },
    {
      case: "stalls after its headers",
      set: (behaviour: { stallPosts: boolean }) => (behaviour.stallPosts = true),
    },
  ])("fails a post whose answer $case after Slack stored it, and the re-run posts nothing", ({ set }) =>
    Effect.gen(function* () {
      const slack = yield* fakeSlack;
      set(slack.behaviour);
      const release = yield* stableRelease(yield* versionCommit);
      const first = yield* announce(slack.url, release, { HTTP_TIMEOUT: "3 seconds" });
      assert.strictEqual(first.exitCode, 1);
      assert.include(first.stdout, "::error::Slack did not confirm the post");
      assert.include(first.stdout, "Re-run this job");
      assert.deepStrictEqual(slack.calls, ["conversations.history", "chat.postMessage"]);
      slack.behaviour.stallPosts = false;
      const again = yield* announce(slack.url, release);
      assert.strictEqual(again.exitCode, 0, again.stdout);
      assert.include(again.stdout, "::notice::v0.2.0 is already announced in Slack");
      assert.strictEqual(posts(slack.calls), 1);
      assert.strictEqual(slack.held.length, 1);
    })
  );

  it.effect.each([
    {
      case: "a Slack API over plain http to a remote host",
      setting: { SLACK_API_URL: "http://slack.com/api" },
      error: "SLACK_API_URL must be an https URL",
    },
    {
      case: "a server URL with a fragment",
      setting: { GITHUB_SERVER_URL: "https://github.com/#x" },
      error: "GITHUB_SERVER_URL must not carry a query or fragment",
    },
    {
      case: "a repository that climbs out of the server",
      setting: { GITHUB_REPOSITORY: "../fuse" },
      error: "GITHUB_REPOSITORY must be an owner/name repository",
    },
  ])("asks Slack nothing, with the token, for $case", ({ setting, error }) =>
    Effect.gen(function* () {
      const slack = yield* fakeSlack;
      const run = yield* announce(slack.url, yield* stableRelease(yield* versionCommit), setting);
      assert.strictEqual(run.exitCode, 1);
      assert.include(run.stdout, `::error::${error}`);
      assert.deepStrictEqual(slack.calls, []);
    })
  );

  it.effect("posts nothing when the history cannot be read", () =>
    Effect.gen(function* () {
      const slack = yield* fakeSlack;
      slack.behaviour.historyError = "not_in_channel";
      const run = yield* announce(slack.url, yield* stableRelease(yield* versionCommit));
      assert.strictEqual(run.exitCode, 1);
      assert.include(run.stdout, "::error::Slack conversations.history failed: not_in_channel");
      assert.deepStrictEqual(slack.calls, ["conversations.history"]);
      assert.deepStrictEqual(slack.held, []);
    })
  );

  it.effect("posts nothing when every history read stalls after its headers", () =>
    Effect.gen(function* () {
      const slack = yield* fakeSlack;
      slack.behaviour.stallHistory = true;
      const run = yield* announce(slack.url, yield* stableRelease(yield* versionCommit), {
        HTTP_TIMEOUT: "500 millis",
      });
      assert.strictEqual(run.exitCode, 1);
      assert.include(
        run.stdout,
        "::error::Slack conversations.history could not be read (no answer within 500ms)"
      );
      assert.deepStrictEqual(slack.calls, history(4));
      assert.deepStrictEqual(slack.held, []);
    })
  );

  it.effect.each([
    { case: "a rate limit's delay in seconds", status: 429, form: "seconds" },
    { case: "a server error's delay in seconds", status: 503, form: "seconds" },
    { case: "a server error's HTTP date", status: 503, form: "date" },
  ] as const)("waits out $case before reading the history again", ({ status, form }) =>
    Effect.gen(function* () {
      const slack = yield* fakeSlack;
      // Slack names the wait when it answers. Two seconds is longer than the first back-off, so a
      // retry that ignored it comes early.
      slack.behaviour.throttles.push({ status, wait: form, seconds: 2 });
      const run = yield* announce(slack.url, yield* stableRelease(yield* versionCommit));
      assert.strictEqual(run.exitCode, 0, run.stdout);
      assert.deepStrictEqual(slack.early, []);
      assert.deepStrictEqual(slack.calls, [...history(2), "chat.postMessage"]);
      assert.strictEqual(slack.held.length, 1);
    })
  );

  it.effect.each([
    { case: "a rate limit's delay", status: 429, form: "seconds" },
    { case: "a server error's delay", status: 503, form: "seconds" },
    // Two minutes ahead when written; however long the step takes to start, more than the cap.
    { case: "a server error's HTTP date", status: 503, form: "date" },
  ] as const)(
    "fails at once, posting nothing, when $case asks for a wait longer than a minute",
    ({ status, form }) =>
      Effect.gen(function* () {
        const slack = yield* fakeSlack;
        const now = yield* Clock.currentTimeMillis;
        const retryAfter =
          form === "seconds"
            ? "3600"
            : Headers.formatHttpDate(DateTime.makeUnsafe(Math.floor(now / 1000) * 1000 + 121_000));
        slack.behaviour.throttles.push({ status, retryAfter });
        const run = yield* announce(slack.url, yield* stableRelease(yield* versionCommit));
        assert.strictEqual(run.exitCode, 1);
        assert.include(
          run.stdout,
          `::error::Slack conversations.history answered ${String(status)} and asked to wait`
        );
        // The exact wait depends on when the step reads the date; the unit suite pins it.
        assert.include(run.stdout, "longer than the 1m it is waited");
        assert.deepStrictEqual(slack.calls, history(1));
      })
  );

  it.effect.each([
    // A date already past asks for no wait.
    { case: "an HTTP date already past", retryAfter: "Wed, 21 Oct 2015 07:28:00 GMT" },
    // Neither is a delay or a date, so the read backs off; taken as seconds, each would be a
    // wait longer than a minute and fail the read.
    { case: "a fractional delay", retryAfter: "3600.5" },
    { case: "an exponent delay", retryAfter: "1e4" },
    { case: "a malformed value", retryAfter: "soon" },
  ])("retries after $case without taking it as a wait", ({ retryAfter }) =>
    Effect.gen(function* () {
      const slack = yield* fakeSlack;
      slack.behaviour.throttles.push({ status: 503, retryAfter });
      const run = yield* announce(slack.url, yield* stableRelease(yield* versionCommit));
      assert.strictEqual(run.exitCode, 0, run.stdout);
      assert.deepStrictEqual(slack.calls, [...history(2), "chat.postMessage"]);
    })
  );

  it.effect("finds an earlier announcement on a later history page", () =>
    Effect.gen(function* () {
      const slack = yield* fakeSlack;
      const release = yield* stableRelease(yield* versionCommit);
      yield* announce(slack.url, release);
      const now = Math.floor((yield* Clock.currentTimeMillis) / 1000);
      for (let index = 0; index < 450; index += 1) {
        slack.held.push({ ts: `${String(now)}.${String(500_000 + index)}`, channel: "C0RELEASES" });
      }
      slack.calls.length = 0;
      const again = yield* announce(slack.url, release);
      assert.strictEqual(again.exitCode, 0, again.stdout);
      assert.include(again.stdout, "::notice::v0.2.0 is already announced in Slack");
      assert.deepStrictEqual(slack.calls, history(3));
    })
  );

  it.effect(
    "does not take another release's receipt, or its own in another channel, for its announcement",
    () =>
      Effect.gen(function* () {
        const slack = yield* fakeSlack;
        const now = Math.floor((yield* Clock.currentTimeMillis) / 1000);
        const receipt = (tag: string) => ({ event_type: "fuse_release_announced", event_payload: { tag } });
        slack.held.push(
          { ts: `${String(now)}.000001`, channel: "C0RELEASES", metadata: receipt("v0.1.0") },
          { ts: `${String(now)}.000002`, channel: "C0CANARY", metadata: receipt("v0.2.0") }
        );
        const run = yield* announce(slack.url, yield* stableRelease(yield* versionCommit));
        assert.strictEqual(run.exitCode, 0, run.stdout);
        assert.include(run.stdout, "::notice::Announced v0.2.0 in Slack (C0RELEASES");
        assert.strictEqual(posts(slack.calls), 1);
      })
  );

  it.effect("posts nothing when Slack says more history follows but gives no cursor", () =>
    Effect.gen(function* () {
      const slack = yield* fakeSlack;
      slack.behaviour.loseCursor = true;
      const now = Math.floor((yield* Clock.currentTimeMillis) / 1000);
      for (let index = 0; index < 250; index += 1) {
        slack.held.push({ ts: `${String(now)}.${String(100_000 + index)}`, channel: "C0RELEASES" });
      }
      const run = yield* announce(slack.url, yield* stableRelease(yield* versionCommit));
      assert.strictEqual(run.exitCode, 1);
      assert.include(
        run.stdout,
        "::error::Slack said more of the channel's history follows page 1 but gave no cursor"
      );
      assert.deepStrictEqual(slack.calls, history(1));
    })
  );

  it.effect("posts nothing when Slack hides older history past the free plan's limit", () =>
    Effect.gen(function* () {
      const slack = yield* fakeSlack;
      slack.behaviour.limitHistory = true;
      const run = yield* announce(slack.url, yield* stableRelease(yield* versionCommit));
      assert.strictEqual(run.exitCode, 1);
      assert.include(
        run.stdout,
        "::error::Slack hides the channel's older history past the free plan's history limit, so the announcement of v0.2.0 could not be ruled out"
      );
      assert.deepStrictEqual(slack.calls, history(1));
      assert.deepStrictEqual(slack.held, []);
    })
  );

  it.effect("finds an earlier announcement on a later page of a limited history", () =>
    Effect.gen(function* () {
      const slack = yield* fakeSlack;
      const release = yield* stableRelease(yield* versionCommit);
      yield* announce(slack.url, release);
      const now = Math.floor((yield* Clock.currentTimeMillis) / 1000);
      for (let index = 0; index < 250; index += 1) {
        slack.held.push({ ts: `${String(now)}.${String(500_000 + index)}`, channel: "C0RELEASES" });
      }
      slack.behaviour.limitHistory = true;
      slack.calls.length = 0;
      const again = yield* announce(slack.url, release);
      assert.strictEqual(again.exitCode, 0, again.stdout);
      assert.include(again.stdout, "::notice::v0.2.0 is already announced in Slack");
      assert.deepStrictEqual(slack.calls, history(2));
    })
  );

  it.effect("posts nothing when more messages followed the release than the check reads", () =>
    Effect.gen(function* () {
      const slack = yield* fakeSlack;
      const now = Math.floor((yield* Clock.currentTimeMillis) / 1000);
      for (let index = 0; index < 2001; index += 1) {
        slack.held.push({ ts: `${String(now)}.${String(100_000 + index)}`, channel: "C0RELEASES" });
      }
      const run = yield* announce(slack.url, yield* stableRelease(yield* versionCommit));
      assert.strictEqual(run.exitCode, 1);
      assert.include(
        run.stdout,
        "::error::The channel holds more than 2000 messages since v0.2.0 was published, so its announcement could not be ruled out"
      );
      assert.deepStrictEqual(slack.calls, history(10));
    })
  );

  it.effect.each([
    {
      case: "the token is not set",
      overrides: { SLACK_BOT_TOKEN: "" },
      notice: "The SLACK_BOT_TOKEN secret is not set, so the release is not announced.",
    },
    {
      case: "the releases channel is not set",
      overrides: { SLACK_RELEASES_CHANNEL: "" },
      notice: "The SLACK_RELEASES_CHANNEL variable is not set, so the stable release is not announced.",
    },
  ])("skips with a notice and asks Slack nothing when $case", ({ overrides, notice }) =>
    Effect.gen(function* () {
      const slack = yield* fakeSlack;
      const run = yield* announce(slack.url, yield* stableRelease(yield* versionCommit), overrides);
      assert.strictEqual(run.exitCode, 0, run.stdout);
      assert.include(run.stdout, `::notice::${notice}`);
      assert.deepStrictEqual(slack.calls, []);
    })
  );

  it.effect("fails on a channel variable that is not a channel ID, before asking Slack anything", () =>
    Effect.gen(function* () {
      const slack = yield* fakeSlack;
      const run = yield* announce(slack.url, yield* stableRelease(yield* versionCommit), {
        SLACK_CANARY_CHANNEL: "#canary",
      });
      assert.strictEqual(run.exitCode, 1);
      assert.include(
        run.stdout,
        '::error::SLACK_CANARY_CHANNEL: "#canary" is not a Slack channel ID such as C0123456789'
      );
      assert.deepStrictEqual(slack.calls, []);
    })
  );

  it.effect("fails on a release the publish job did not write, before asking Slack anything", () =>
    Effect.gen(function* () {
      const slack = yield* fakeSlack;
      const release = (yield* stableRelease(yield* versionCommit)).replace(
        '"version":"0.2.0"',
        '"version":"0.2.0-canary.1"'
      );
      const run = yield* announce(slack.url, release);
      assert.strictEqual(run.exitCode, 1);
      assert.include(run.stdout, "::error::A setting is missing or invalid: a stable version such as 1.2.3");
      assert.deepStrictEqual(slack.calls, []);
    })
  );

  it.effect("fails for a commit missing from the clone, before asking Slack anything", () =>
    Effect.gen(function* () {
      const slack = yield* fakeSlack;
      const missing = "0".repeat(40);
      const run = yield* announce(slack.url, yield* stableRelease(missing));
      assert.strictEqual(run.exitCode, 1);
      assert.include(
        run.stdout,
        `::error::git ls-tree --name-only ${missing} -- packages/fuse/CHANGELOG.md failed`
      );
      assert.deepStrictEqual(slack.calls, []);
    })
  );
});
