import { assert } from "@effect/vitest";
import { Clock, Effect, Option } from "effect";

import { fakeGitHub, inScratchRepository, runStep, ScratchRepository } from "./cli-harness.ts";
import type { GitHubFailure } from "./cli-harness.ts";
import { olderCommit } from "./fixtures.ts";

// Unit under test: src/find-release.ts, run as the publish job's lookup step runs it, in a git
// checkout, against a local stand-in for GitHub's release-by-tag endpoint. Oracles: GitHub's
// answers (a published release's JSON; 404 for a draft or a missing tag, checked against
// elmeragroup/fuse's draft record canary-81d9b003… and published canary-699f103f…; 429, or 403
// with a spent rate limit, with the wait it asks for), the engine's record tags and bodies, and
// GitHub's multi-line step output form.

/** The published canary release of `commit`, as GitHub returns it, trimmed to the fields read. */
function canaryRelease(commit: string) {
  return {
    tag_name: `canary-${commit}`,
    html_url: `https://github.com/elmeragroup/fuse/releases/tag/canary-${commit}`,
    draft: false,
    prerelease: true,
    published_at: "2026-11-05T09:15:14Z",
    body: JSON.stringify({
      schema: 1,
      owner: "elmera-release",
      channel: "canary",
      version: "0.1.0-canary.151",
      commit,
    }),
  };
}

/** A published stable release recording `commit`. */
function stableRelease(commit: string) {
  return {
    tag_name: "v0.2.0",
    html_url: "https://github.com/elmeragroup/fuse/releases/tag/v0.2.0",
    draft: false,
    prerelease: false,
    published_at: "2026-11-06T12:00:00Z",
    body: JSON.stringify({ schema: 1, owner: "elmera-release", channel: "stable", version: "0.2.0", commit }),
  };
}

/** A commit whose package manifest names 0.2.0, in the shared scratch repository. */
const versionCommit = Effect.gen(function* () {
  const repo = yield* ScratchRepository;
  return yield* repo.commit(
    "Keep A Device Pixel For Small Non-Zero Bar Values (#456)",
    Option.some("## 0.2.0\n")
  );
});

/**
 * Runs the lookup against a GitHub that publishes `published` and answers `failures` first, with
 * its API at `base` on the server.
 */
const lookUp = (
  trigger: { readonly SOURCE_COMMIT?: string; readonly RECORD_TAG?: string },
  published: ReadonlyMap<string, unknown>,
  failures: ReadonlyMap<string, readonly GitHubFailure[]> = new Map(),
  extra: Readonly<Record<string, string>> = {},
  base: "" | `/${string}` = ""
) =>
  Effect.gen(function* () {
    const repo = yield* ScratchRepository;
    const github = yield* fakeGitHub(published, failures, base);
    const run = yield* runStep("find-release", repo.dir, {
      GITHUB_API_URL: github.url,
      GITHUB_REPOSITORY: "elmeragroup/fuse",
      GH_TOKEN: "test-token",
      SOURCE_COMMIT: "",
      RECORD_TAG: "",
      ...trigger,
      ...extra,
    });
    return { ...run, requests: github.requests, early: github.early };
  });

/** `count` copies of a failure, enough to outlast every retry. */
const always = (failure: GitHubFailure, count = 6): readonly GitHubFailure[] =>
  Array.from({ length: count }, () => failure);

inScratchRepository("the release a Publish Release run published", (it) => {
  it.effect("writes the commit's published canary, asking GitHub with the job's token", () =>
    Effect.gen(function* () {
      const sha = yield* versionCommit;
      const run = yield* lookUp({ SOURCE_COMMIT: sha }, new Map([[`canary-${sha}`, canaryRelease(sha)]]));
      assert.strictEqual(run.exitCode, 0, run.stdout);
      assert.deepStrictEqual(
        run.outputs,
        new Map([
          ["tag", `canary-${sha}`],
          [
            "release",
            `{"_tag":"Canary","version":"0.1.0-canary.151","commit":"${sha}",` +
              `"url":"https://github.com/elmeragroup/fuse/releases/tag/canary-${sha}","publishedAt":"2026-11-05T09:15:14.000Z"}`,
          ],
        ])
      );
      assert.deepStrictEqual(
        run.requests.map(({ tag, authorization }) => ({ tag, authorization })),
        [
          { tag: `canary-${sha}`, authorization: "Bearer test-token" },
          { tag: "v0.2.0", authorization: "Bearer test-token" },
        ]
      );
      assert.notInclude(`${run.stdout}${run.stderr}`, "test-token");
    })
  );

  it.effect("sends the User-Agent GitHub requires", () =>
    Effect.gen(function* () {
      const sha = yield* versionCommit;
      const run = yield* lookUp({ SOURCE_COMMIT: sha }, new Map([[`canary-${sha}`, canaryRelease(sha)]]));
      assert.strictEqual(run.exitCode, 0, run.stdout);
      assert.isNotEmpty(run.requests);
      for (const { userAgent } of run.requests) assert.isNotEmpty(userAgent ?? "");
    })
  );

  it.effect("reads the records under an API URL with a path, as GitHub Enterprise Server's is", () =>
    Effect.gen(function* () {
      const sha = yield* versionCommit;
      const run = yield* lookUp(
        { SOURCE_COMMIT: sha },
        new Map([[`canary-${sha}`, canaryRelease(sha)]]),
        new Map(),
        {},
        "/api/v3"
      );
      assert.strictEqual(run.exitCode, 0, run.stdout);
      assert.strictEqual(run.outputs.get("tag"), `canary-${sha}`);
    })
  );

  it.effect("writes the stable release the version commit published, by the version in its manifest", () =>
    Effect.gen(function* () {
      const sha = yield* versionCommit;
      const run = yield* lookUp({ SOURCE_COMMIT: sha }, new Map([["v0.2.0", stableRelease(sha)]]));
      assert.strictEqual(run.exitCode, 0, run.stdout);
      assert.strictEqual(run.outputs.get("tag"), "v0.2.0");
      assert.deepStrictEqual(JSON.parse(run.outputs.get("release") ?? ""), {
        _tag: "Stable",
        version: "0.2.0",
        commit: sha,
        url: "https://github.com/elmeragroup/fuse/releases/tag/v0.2.0",
        publishedAt: "2026-11-06T12:00:00.000Z",
      });
    })
  );

  it.effect("writes nothing for a skipped canary whose version's stable release is an older commit's", () =>
    Effect.gen(function* () {
      const sha = yield* versionCommit;
      const run = yield* lookUp({ SOURCE_COMMIT: sha }, new Map([["v0.2.0", stableRelease(olderCommit)]]));
      assert.strictEqual(run.exitCode, 0, run.stdout);
      assert.deepStrictEqual(run.outputs, new Map());
      assert.include(run.stdout, "::notice::This run published no release, so there is nothing to announce.");
    })
  );

  it.effect("looks up exactly the record tag on the retry path", () =>
    Effect.gen(function* () {
      const sha = yield* versionCommit;
      const run = yield* lookUp(
        { RECORD_TAG: `canary-${sha}` },
        new Map<string, unknown>([
          [`canary-${sha}`, canaryRelease(sha)],
          ["v0.2.0", stableRelease(sha)],
        ])
      );
      assert.strictEqual(run.exitCode, 0, run.stdout);
      assert.strictEqual(run.outputs.get("tag"), `canary-${sha}`);
      assert.deepStrictEqual(
        run.requests.map(({ tag }) => tag),
        [`canary-${sha}`]
      );
    })
  );

  it.effect("rejects a canary record whose body names another commit", () =>
    Effect.gen(function* () {
      const sha = yield* versionCommit;
      const moved = { ...canaryRelease(sha), body: canaryRelease(olderCommit).body };
      const run = yield* lookUp({ SOURCE_COMMIT: sha }, new Map([[`canary-${sha}`, moved]]));
      assert.strictEqual(run.exitCode, 1);
      assert.include(run.stdout, `::error::Release record canary-${sha} records canary-${olderCommit}`);
      assert.deepStrictEqual(run.outputs, new Map());
    })
  );

  it.effect("fails at once on a rejected token rather than calling the record unpublished", () =>
    Effect.gen(function* () {
      const sha = yield* versionCommit;
      const run = yield* lookUp(
        { SOURCE_COMMIT: sha },
        new Map(),
        new Map([[`canary-${sha}`, always({ _tag: "Status", status: 401 })]])
      );
      assert.strictEqual(run.exitCode, 1);
      assert.include(run.stdout, `::error::GitHub answered 401 for canary-${sha}`);
      assert.strictEqual(run.requests.length, 1);
      assert.deepStrictEqual(run.outputs, new Map());
    })
  );

  it.effect("retries a server error three times, then fails without an answer", () =>
    Effect.gen(function* () {
      const sha = yield* versionCommit;
      const run = yield* lookUp(
        { SOURCE_COMMIT: sha },
        new Map(),
        new Map([[`canary-${sha}`, always({ _tag: "Status", status: 502 })]])
      );
      assert.strictEqual(run.exitCode, 1);
      assert.include(run.stdout, `::error::GitHub answered 502 for canary-${sha}`);
      assert.strictEqual(run.requests.length, 4);
      assert.deepStrictEqual(run.outputs, new Map());
    })
  );

  it.effect.each([
    {
      case: "a 429 with Retry-After",
      failure: (): GitHubFailure => ({ _tag: "Status", status: 429, headers: { "retry-after": "2" } }),
    },
    {
      case: "a 403 whose rate limit is spent until its reset",
      // GitHub sends the reset in whole epoch seconds.
      failure: (now: number): GitHubFailure => ({
        _tag: "Status",
        status: 403,
        headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(Math.floor(now / 1000) + 3) },
      }),
    },
  ])("waits out $case, then finds the release", ({ failure }) =>
    Effect.gen(function* () {
      const sha = yield* versionCommit;
      const now = yield* Clock.currentTimeMillis;
      const run = yield* lookUp(
        { RECORD_TAG: `canary-${sha}` },
        new Map([[`canary-${sha}`, canaryRelease(sha)]]),
        new Map([[`canary-${sha}`, [failure(now)]]])
      );
      assert.strictEqual(run.exitCode, 0, run.stdout);
      assert.strictEqual(run.outputs.get("tag"), `canary-${sha}`);
      // Each wait is longer than the first back-off, so a retry that ignored it came early.
      assert.deepStrictEqual(run.early, []);
      assert.strictEqual(run.requests.length, 2);
    })
  );

  it.effect("fails at once when GitHub asks for a wait longer than a minute", () =>
    Effect.gen(function* () {
      const sha = yield* versionCommit;
      const run = yield* lookUp(
        { RECORD_TAG: `canary-${sha}` },
        new Map([[`canary-${sha}`, canaryRelease(sha)]]),
        new Map([[`canary-${sha}`, [{ _tag: "Status", status: 429, headers: { "retry-after": "3600" } }]]])
      );
      assert.strictEqual(run.exitCode, 1);
      assert.include(
        run.stdout,
        `::error::GitHub answered 429 and asked to wait 1h, longer than the 1m it is waited for canary-${sha}`
      );
      assert.strictEqual(run.requests.length, 1);
    })
  );

  it.effect("gives up on a body that stalls after its headers, within the timeout of each read", () =>
    Effect.gen(function* () {
      const sha = yield* versionCommit;
      const run = yield* lookUp(
        { RECORD_TAG: `canary-${sha}` },
        new Map([[`canary-${sha}`, canaryRelease(sha)]]),
        new Map([[`canary-${sha}`, always({ _tag: "Stall" })]]),
        { HTTP_TIMEOUT: "500 millis" }
      );
      assert.strictEqual(run.exitCode, 1);
      assert.include(
        run.stdout,
        `::error::GitHub could not be read (no answer within 500ms) for canary-${sha}`
      );
      assert.strictEqual(run.requests.length, 4);
      assert.deepStrictEqual(run.outputs, new Map());
    })
  );

  it.effect.each([
    {
      case: "an API URL over plain http to a remote host",
      setting: { GITHUB_API_URL: "http://api.github.com" },
      error: "GITHUB_API_URL must be an https URL",
    },
    {
      case: "an API URL with a query",
      setting: { GITHUB_API_URL: "https://api.github.com/?per_page=1" },
      error: "GITHUB_API_URL must not carry a query or fragment",
    },
    {
      case: "an API URL with a port past 65535",
      setting: { GITHUB_API_URL: "https://api.github.com:99999" },
      error: "GITHUB_API_URL is not a valid URL",
    },
    {
      case: "a repository that climbs out of /repos",
      setting: { GITHUB_REPOSITORY: "elmeragroup/.." },
      error: "GITHUB_REPOSITORY must be an owner/name repository",
    },
  ])("asks GitHub nothing, with the token, for $case", ({ setting, error }) =>
    Effect.gen(function* () {
      const sha = yield* versionCommit;
      const run = yield* lookUp({ SOURCE_COMMIT: sha }, new Map(), new Map(), setting);
      assert.strictEqual(run.exitCode, 1);
      assert.include(run.stdout, `::error::${error}`);
      assert.deepStrictEqual(run.requests, []);
    })
  );

  it.effect("fails when neither the commit nor the record tag is set", () =>
    Effect.gen(function* () {
      const run = yield* lookUp({}, new Map());
      assert.strictEqual(run.exitCode, 1);
      assert.include(run.stdout, "::error::Set SOURCE_COMMIT or RECORD_TAG");
    })
  );
});
