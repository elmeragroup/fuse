import { NodeHttpServer, NodeHttpServerRequest, NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Config, Context, Effect, FileSystem, Layer, Path, Stream } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import type { HttpServerRequest } from "effect/http";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { createServer, ServerResponse } from "node:http";

// Unit under test: src/canary-opt-out.ts, run as the merge workflow's `canary-opt-out` job runs it:
// a Node process with the job's environment, a push payload file, a GITHUB_OUTPUT file and GitHub's
// API at GITHUB_API_URL, here a local stand-in on a real socket. Its contract with the workflow is
// the `skip` output and the exit code. Fixtures follow GitHub's documented shapes: a push payload's
// `commits[].id`, and `GET /repos/{owner}/{repo}/commits/{sha}/pulls` entries. Oracle: the opt-out
// rule in scripts/RELEASE.md: a push skips its canary only when every PR it merged carries
// `no-canary`, and the bot's release PR always publishes.

const LOWER = "a".repeat(40);
const TOP = "b".repeat(40);
const DIRECT = "c".repeat(40);
// GitHub fills an open PR's merge_commit_sha with its test merge commit, never with a pushed SHA.
const TEST_MERGE = "d".repeat(40);
const TOKEN = "test-token";

/** A GitHub associated-PR entry. */
const pull = (
  number: number,
  mergeCommitSha: string | null,
  labels: ReadonlyArray<string>,
  headRef?: string
) => ({
  number,
  merge_commit_sha: mergeCommitSha,
  head: { ref: headRef ?? `feature-${String(number)}` },
  labels: labels.map((name) => ({ name })),
});

/**
 * How the stand-in answers one request for a commit: a PR list, a status with headers and no
 * body, a JSON body, or a PR list's headers and first byte and then a dropped connection.
 */
type Reply =
  | ReadonlyArray<unknown>
  | { readonly status: number; readonly headers?: Readonly<Record<string, string>> }
  | { readonly body: unknown }
  | { readonly cutOff: true };

/** How the stand-in answers a commit: one reply every time, or replies in turn, the last repeated. */
type Answer = Reply | { readonly inTurn: ReadonlyArray<Reply> };

/**
 * Sends a reply. A cut-off reply writes a PR list's headers, promising a 64-byte body, and its
 * first byte straight to the socket; once that byte is flushed, the socket is closed, so the client
 * holds a whole set of headers and loses the rest of the body.
 */
const reply = (request: HttpServerRequest.HttpServerRequest, answer: Reply) =>
  Effect.gen(function* () {
    if ("status" in answer)
      return HttpServerResponse.empty({ status: answer.status, headers: answer.headers ?? {} });
    if (!("cutOff" in answer)) return HttpServerResponse.jsonUnsafe("body" in answer ? answer.body : answer);
    const response = NodeHttpServerRequest.toServerResponse(request);
    if (!(response instanceof ServerResponse)) return yield* Effect.die("the stand-in serves HTTP/1.1");
    response.writeHead(200, { "content-type": "application/json", "content-length": "64" });
    response.write("[", () => response.destroy());
    // The raw response is the answer, so the handler never completes; the test's scope ends it.
    return yield* Effect.never;
  });

/**
 * GitHub's commit-to-PRs endpoint for `elmeragroup/fuse`, answering from `answers` by SHA (`[]`
 * for any other) to a request with the test token, and 401 to any other. It counts the requests
 * for each SHA.
 */
const fakeGitHub = (answers: Readonly<Record<string, Answer>>) =>
  Effect.gen(function* () {
    const requests = new Map<string, number>();
    const route = HttpRouter.add("GET", "/repos/elmeragroup/fuse/commits/:sha/pulls", (request) =>
      Effect.gen(function* () {
        if (request.headers.authorization !== `Bearer ${TOKEN}`)
          return HttpServerResponse.empty({ status: 401 });
        const { sha = "" } = yield* HttpRouter.params;
        const seen = requests.get(sha) ?? 0;
        requests.set(sha, seen + 1);
        const answer = answers[sha] ?? [];
        if ("inTurn" in answer)
          return yield* reply(request, answer.inTurn[Math.min(seen, answer.inTurn.length - 1)] ?? []);
        return yield* reply(request, answer);
      })
    );
    const context = yield* Layer.build(
      HttpRouter.serve(route, { disableLogger: true, disableListenLog: true }).pipe(
        Layer.provideMerge(NodeHttpServer.layer(() => createServer(), { port: 0, host: "127.0.0.1" }))
      )
    );
    return { url: HttpServer.formatAddress(Context.get(context, HttpServer.HttpServer).address), requests };
  });

/** A push payload as a test writes it: GitHub's `commits[].id`, well formed or not. */
type PushPayload = { readonly commits: ReadonlyArray<{ readonly id: string }> };

/** A finished step: its exit code, what it wrote, and its GITHUB_OUTPUT file. */
type StepRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly output: string;
  /** The requests GitHub's stand-in received, by SHA. */
  readonly requests: ReadonlyMap<string, number>;
};

/**
 * Runs the step for a push `payload` against the stand-in answering `answers`, with exactly the
 * job's settings besides the runner's PATH and HOME.
 */
const runStep = (payload: PushPayload, answers: Readonly<Record<string, Answer>>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "canary-opt-out-" });
      const event = path.join(dir, "event.json");
      const output = path.join(dir, "output");
      yield* fs.writeFileString(event, JSON.stringify(payload));
      yield* fs.writeFileString(output, "");
      const api = yield* fakeGitHub(answers);
      const runner = yield* Config.all({ PATH: Config.String("PATH"), HOME: Config.String("HOME") });
      const entry = yield* path.fromFileUrl(new URL("../src/canary-opt-out.ts", import.meta.url));
      const handle = yield* (yield* ChildProcessSpawner.ChildProcessSpawner).spawn(
        ChildProcess.make(process.execPath, [entry], {
          stdin: "ignore",
          forceKillAfter: "1 second",
          extendEnv: false,
          env: {
            ...runner,
            GITHUB_API_URL: api.url,
            GITHUB_REPOSITORY: "elmeragroup/fuse",
            GITHUB_EVENT_PATH: event,
            GITHUB_OUTPUT: output,
            GH_TOKEN: TOKEN,
          },
        })
      );
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [
          handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
          handle.stderr.pipe(Stream.decodeText(), Stream.mkString),
          handle.exitCode,
        ],
        { concurrency: "unbounded" }
      );
      return {
        exitCode,
        stdout,
        stderr,
        output: yield* fs.readFileString(output),
        requests: api.requests,
      } satisfies StepRun;
    })
  );

const push = (shas: ReadonlyArray<string>): PushPayload => ({ commits: shas.map((id) => ({ id })) });

layer(NodeServices.layer, { excludeTestServices: true })("the canary opt-out step", (it) => {
  it.effect.each([
    {
      name: "a stack whose top layer opts out but whose lower layer ships",
      shas: [LOWER, TOP],
      answers: { [LOWER]: [pull(658, LOWER, [])], [TOP]: [pull(661, TOP, ["no-canary"])] },
      skip: false,
    },
    {
      name: "a stack whose lower layer opts out but whose top layer ships",
      shas: [LOWER, TOP],
      answers: { [LOWER]: [pull(658, LOWER, ["no-canary"])], [TOP]: [pull(661, TOP, [])] },
      skip: false,
    },
    {
      name: "a stack whose every layer opts out",
      shas: [LOWER, TOP],
      answers: {
        [LOWER]: [pull(658, LOWER, ["no-canary", "no-preview"])],
        [TOP]: [pull(661, TOP, ["no-canary"])],
      },
      skip: true,
    },
    {
      name: "a single opted-out merge",
      shas: [TOP],
      answers: { [TOP]: [pull(661, TOP, ["no-canary"])] },
      skip: true,
    },
    {
      name: "the release PR, even labelled, beside an opted-out merge",
      shas: [LOWER, TOP],
      answers: {
        [LOWER]: [pull(658, LOWER, ["no-canary"])],
        [TOP]: [pull(700, TOP, ["no-canary"], "changeset-release/main")],
      },
      skip: false,
    },
    {
      name: "a direct push beside an opted-out merge",
      shas: [LOWER, DIRECT],
      // The open PR's branch contains the commit but did not merge as it.
      answers: {
        [LOWER]: [pull(658, LOWER, ["no-canary"])],
        [DIRECT]: [pull(702, TEST_MERGE, ["no-canary"])],
      },
      skip: false,
    },
    { name: "a push that lists no commits", shas: [], answers: {}, skip: false },
  ])("writes skip=$skip for $name", ({ shas, answers, skip }) =>
    Effect.gen(function* () {
      const run = yield* runStep(push(shas), answers);
      assert.strictEqual(run.exitCode, 0, run.stdout + run.stderr);
      assert.strictEqual(run.output, `skip=${String(skip)}\n`);
    })
  );

  it.effect("publishes a push at GitHub's 2048-commit payload cap, whose list may be cut short", () =>
    Effect.gen(function* () {
      const shas = Array.from({ length: 2048 }, (_, index) => index.toString(16).padStart(40, "0"));
      const optedOut = Object.fromEntries(
        shas.map((sha, index) => [sha, [pull(index + 1, sha, ["no-canary"])]])
      );
      const run = yield* runStep(push(shas), optedOut);
      assert.strictEqual(run.exitCode, 0, run.stdout + run.stderr);
      assert.strictEqual(run.output, "skip=false\n");
    })
  );

  // GitHub's 403 rate limit and a body cut off mid-read are worth another attempt; the backoff and
  // the wait asked for are real, about a second each, and only the outcome is asserted.
  it.effect.each([
    {
      name: "a 403 rate limit with Retry-After",
      first: { status: 403, headers: { "retry-after": "1" } },
    },
    {
      name: "a 403 rate limit with a spent x-ratelimit-remaining",
      first: { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "0" } },
    },
    { name: "a body cut off mid-read", first: { cutOff: true } },
  ] satisfies ReadonlyArray<{ name: string; first: Reply }>)(
    "recovers from $name on the next attempt",
    ({ first }) =>
      Effect.gen(function* () {
        const run = yield* runStep(push([TOP]), {
          [TOP]: { inTurn: [first, [pull(661, TOP, ["no-canary"])]] },
        });
        assert.strictEqual(run.exitCode, 0, run.stdout + run.stderr);
        assert.strictEqual(run.output, "skip=true\n");
        assert.strictEqual(run.requests.get(TOP), 2);
      })
  );

  it.effect("publishes without reading the rest once a commit ships", () =>
    Effect.gen(function* () {
      const run = yield* runStep(push([LOWER, TOP]), {
        [LOWER]: [pull(658, LOWER, [])],
        [TOP]: { status: 422 },
      });
      assert.strictEqual(run.exitCode, 0, run.stdout + run.stderr);
      assert.strictEqual(run.output, "skip=false\n");
      assert.isFalse(run.requests.has(TOP));
    })
  );

  it.effect("fails at once on a plain 403, which a repeat would not change", () =>
    Effect.gen(function* () {
      const run = yield* runStep(push([TOP]), {
        [TOP]: { inTurn: [{ status: 403 }, [pull(661, TOP, ["no-canary"])]] },
      });
      assert.notStrictEqual(run.exitCode, 0);
      assert.strictEqual(run.output, "");
      assert.match(run.stdout, /^::error::.*answered 403/mu);
      assert.strictEqual(run.requests.get(TOP), 1);
    })
  );

  it.effect.each([
    {
      name: "a commit's lookup is refused",
      payload: push([LOWER, TOP]),
      answers: { [LOWER]: [pull(658, LOWER, ["no-canary"])], [TOP]: { status: 422 } },
    },
    {
      name: "a lookup answers something other than a PR list",
      payload: push([TOP]),
      answers: { [TOP]: { body: { message: "Not Found" } } },
    },
    { name: "the payload lists no commit SHAs", payload: { commits: [{ id: "main" }] }, answers: {} },
  ])("fails with an error annotation and no output when $name", ({ payload, answers }) =>
    Effect.gen(function* () {
      const run = yield* runStep(payload, answers);
      assert.notStrictEqual(run.exitCode, 0);
      assert.strictEqual(run.output, "");
      assert.match(run.stdout, /^::error::/mu);
    })
  );
});
