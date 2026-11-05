/**
 * Runs the step entrypoints as the workflow runs them: as Node processes in a git checkout, with
 * the step's environment, against local stand-ins for GitHub's and Slack's HTTP APIs listening on
 * real sockets. Every resource is scoped: temporary directories, servers and processes end with
 * the test that made them.
 */

import { NodeHttpServer, NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import {
  Clock,
  Config,
  Context,
  DateTime,
  Effect,
  FileSystem,
  Layer,
  Option,
  Path,
  Schema,
  Stream,
} from "effect";
import { Headers, HttpRouter, HttpServer, HttpServerResponse, UrlParams } from "effect/http";
import type { HttpServerRequest } from "effect/http";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { createServer } from "node:http";

/** A step entrypoint. */
type Entrypoint = "find-release" | "announce-release";

/** The path of an entrypoint's source. */
const entrypointPath = (entrypoint: Entrypoint) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    return yield* path.fromFileUrl(new URL(`../src/${entrypoint}.ts`, import.meta.url));
  });

/** A finished command: its exit code and what it wrote. */
type CommandRun = { readonly exitCode: number; readonly stdout: string; readonly stderr: string };

/** Runs a command to its end, reading both of its outputs. */
const run = (command: string, args: readonly string[], options: ChildProcess.CommandOptions) =>
  Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      // A step blocked in a synchronous parse cannot act on SIGTERM, so it is killed outright
      // when the test that started it ends.
      const handle = yield* spawner.spawn(
        ChildProcess.make(command, args, { stdin: "ignore", forceKillAfter: "1 second", ...options })
      );
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [
          handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
          handle.stderr.pipe(Stream.decodeText(), Stream.mkString),
          handle.exitCode,
        ],
        { concurrency: "unbounded" }
      );
      return { exitCode, stdout, stderr } satisfies CommandRun;
    })
  );

/** A scratch git repository the cases commit a package's changelog and manifest into. */
export class ScratchRepository extends Context.Service<
  ScratchRepository,
  {
    readonly dir: string;
    /**
     * Commits the package's changelog, or its removal for none, and its manifest at `version`,
     * and returns the commit's SHA.
     */
    readonly commit: (
      subject: string,
      changelog: Option.Option<string>,
      version?: string
    ) => Effect.Effect<string, Error>;
  }
>()("test/ScratchRepository") {
  /** A fresh repository in a temporary directory, removed with the layer's scope. */
  static readonly layer = Layer.effect(
    ScratchRepository,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "release-announcement-" });
      const git = Effect.fnUntraced(function* (...args: string[]) {
        const result = yield* run("git", args, { cwd: dir }).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
        );
        if (result.exitCode !== 0)
          return yield* Effect.fail(new Error(`git ${args.join(" ")} failed: ${result.stderr}`));
        return result.stdout.trim();
      });
      yield* git("init", "--quiet");
      yield* git("config", "user.email", "ci@example.com");
      yield* git("config", "user.name", "CI");
      yield* fs.makeDirectory(path.join(dir, "packages/fuse"), { recursive: true });
      const commit = (subject: string, changelog: Option.Option<string>, version = "0.2.0") =>
        Effect.gen(function* () {
          const changelogPath = path.join(dir, "packages/fuse/CHANGELOG.md");
          yield* Option.match(changelog, {
            onNone: () => fs.remove(changelogPath, { force: true }),
            onSome: (text) => fs.writeFileString(changelogPath, text),
          });
          yield* fs.writeFileString(
            path.join(dir, "packages/fuse/package.json"),
            JSON.stringify({ name: "@elmeragroup/fuse", version })
          );
          yield* git("add", "--all");
          yield* git("commit", "--quiet", "--allow-empty", "-m", subject);
          return yield* git("rev-parse", "HEAD");
        });
      return ScratchRepository.of({ dir, commit });
    })
  );
}

/** Runs a suite's cases each in a fresh scratch repository, on the real clock and platform. */
export const inScratchRepository = layer(
  ScratchRepository.layer.pipe(Layer.provideMerge(NodeServices.layer)),
  {
    excludeTestServices: true,
  }
);

/**
 * The publish job's `release` output for a release of `commit`, published a minute ago.
 *
 * @param kind - Stable or canary.
 * @param commit - The release's commit.
 * @param version - Its version.
 * @returns The release as JSON.
 */
export const releaseJson = (kind: "Stable" | "Canary", commit: string, version: string) =>
  Effect.map(Clock.currentTimeMillis, (now) =>
    JSON.stringify({
      _tag: kind,
      version,
      commit,
      url: `https://github.com/elmeragroup/fuse/releases/tag/${kind === "Stable" ? `v${version}` : `canary-${commit}`}`,
      publishedAt: DateTime.formatIso(DateTime.makeUnsafe(now - 60_000)),
    })
  );

/**
 * How long the notify step's notes renderer may take in these runs, unless a test sets its own.
 * Production allows 10 seconds, and on a loaded `ci:checks` runner starting the renderer and
 * parsing 6 KB of nested lists has taken longer, which made the step link notes a test expected
 * shown. The production limit is isolated-notes.test.ts's; a run that tests it sets it. This one
 * stays under Vitest's 60-second test timeout, so a renderer that never answers still ends the step.
 */
const NOTES_TIME_LIMIT = "45 seconds";

/**
 * Runs the notify step in the scratch repository for `release` against Slack at `url`, with both
 * channels and the token set, and the notes renderer given `NOTES_TIME_LIMIT`.
 *
 * @param url - Slack's API URL.
 * @param release - The publish job's `release` output.
 * @param overrides - Settings to change or add.
 * @returns How the step ended.
 */
export const announceStep = (
  url: string,
  release: string,
  overrides: Readonly<Record<string, string>> = {}
) =>
  Effect.gen(function* () {
    const repo = yield* ScratchRepository;
    return yield* runStep("announce-release", repo.dir, {
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "elmeragroup/fuse",
      SLACK_API_URL: url,
      SLACK_RELEASES_CHANNEL: "C0RELEASES",
      SLACK_CANARY_CHANNEL: "C0CANARY",
      SLACK_BOT_TOKEN: SLACK_TOKEN,
      RELEASE: release,
      NOTES_TIME_LIMIT,
      ...overrides,
    });
  });

/** A finished step run. */
type StepRun = CommandRun & {
  /** The outputs the step wrote to GITHUB_OUTPUT, by name. */
  readonly outputs: ReadonlyMap<string, string>;
};

/**
 * Runs an entrypoint in `cwd` with exactly `env`, besides the runner's PATH and HOME and a fresh
 * GITHUB_OUTPUT file. `env` may replace PATH.
 *
 * @param entrypoint - The step.
 * @param cwd - The checkout.
 * @param env - The step's environment.
 * @returns How the run ended and what it wrote.
 */
export const runStep = (entrypoint: Entrypoint, cwd: string, env: Readonly<Record<string, string>>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "release-announcement-step-" });
      const output = path.join(dir, "output");
      yield* fs.writeFileString(output, "");
      const runner = yield* Config.all({ PATH: Config.String("PATH"), HOME: Config.String("HOME") });
      const result = yield* run(process.execPath, [yield* entrypointPath(entrypoint)], {
        cwd,
        env: { ...runner, GITHUB_OUTPUT: output, ...env },
        extendEnv: false,
      });
      return { ...result, outputs: parseOutputs(yield* fs.readFileString(output)) } satisfies StepRun;
    })
  );

/**
 * The runner's PATH with `dir` first.
 *
 * @param dir - The directory to search first.
 * @returns The PATH value.
 */
export const pathWith = (dir: string) => Config.String("PATH").pipe(Effect.map((path) => `${dir}:${path}`));

/** Parses GitHub's `name<<delimiter` output form, the only form the steps write. */
function parseOutputs(text: string): ReadonlyMap<string, string> {
  const outputs = new Map<string, string>();
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const heredoc = /^([\w-]+)<<(.+)$/u.exec(lines[index] ?? "");
    if (heredoc === null) {
      if (lines[index] !== "") throw new Error(`unexpected output line ${JSON.stringify(lines[index])}`);
      continue;
    }
    const [, name = "", delimiter = ""] = heredoc;
    const value: string[] = [];
    for (index += 1; index < lines.length && lines[index] !== delimiter; index += 1)
      value.push(lines[index] ?? "");
    if (index === lines.length) throw new Error(`output ${name} is not closed`);
    outputs.set(name, value.join("\n"));
  }
  return outputs;
}

/**
 * A `git` that answers for the package changelog with output that never ends, written by a Node
 * script so it behaves alike on GNU and BSD systems, and runs the real git for everything else.
 *
 * @returns The directory holding it, to put first on PATH.
 */
export const endlessChangelogGit = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = yield* fs.makeTempDirectoryScoped({ prefix: "release-announcement-git-" });
  const realGit = (yield* run("sh", ["-c", "command -v git"], {})).stdout.trim();
  const script = path.join(dir, "git");
  yield* fs.writeFileString(
    script,
    [
      `#!${process.execPath}`,
      'const { spawnSync } = require("node:child_process");',
      "const [command] = process.argv.slice(2);",
      'if (command === "ls-tree") {',
      '  process.stdout.write("packages/fuse/CHANGELOG.md\\n");',
      '} else if (command === "show") {',
      '  process.stdout.on("error", () => process.exit(0));',
      '  process.stdout.write("## 1.0.0\\n\\n- Endless notes.\\n\\n");',
      '  const more = "- abc1234: More notes, as long as a Changesets entry usually is, so the changelog reads like one.\\n".repeat(512);',
      "  const write = () => {",
      "    while (process.stdout.write(more));",
      '    process.stdout.once("drain", write);',
      "  };",
      "  write();",
      "} else {",
      `  const result = spawnSync(${JSON.stringify(realGit)}, process.argv.slice(2), { stdio: "inherit" });`,
      "  process.exit(result.status ?? 1);",
      "}",
      "",
    ].join("\n")
  );
  yield* fs.chmod(script, 0o755);
  return dir;
});

/**
 * Serves `routes` on a free local port for the rest of the scope.
 *
 * @param routes - The routes.
 * @returns The server's base URL.
 */
const serve = <E, R>(routes: Layer.Layer<never, E, R>) =>
  Effect.gen(function* () {
    const context = yield* Layer.build(
      HttpRouter.serve(routes, { disableLogger: true, disableListenLog: true }).pipe(
        Layer.provideMerge(NodeHttpServer.layer(() => createServer(), { port: 0, host: "127.0.0.1" }))
      )
    );
    return HttpServer.formatAddress(Context.get(context, HttpServer.HttpServer).address);
  });

/** Headers, then a body that never ends: an answer that stalls after it began. */
function stalled(): HttpServerResponse.HttpServerResponse {
  return HttpServerResponse.stream(Stream.make("{").pipe(Stream.encodeText, Stream.concat(Stream.never)), {
    status: 200,
    contentType: "application/json",
  });
}

/** A request GitHub's stand-in received. */
type GitHubRequest = {
  readonly tag: string;
  readonly authorization: string | undefined;
  readonly userAgent: string | undefined;
};

/** A GitHub answer other than the release or 404. */
export type GitHubFailure =
  | { readonly _tag: "Status"; readonly status: number; readonly headers?: Readonly<Record<string, string>> }
  | { readonly _tag: "Stall" };

/**
 * GitHub's release-by-tag endpoint for elmeragroup/fuse: published releases answer with their
 * JSON and anything else with 404, as drafts and missing tags do. `failures` holds, per tag, the
 * answers its first requests get instead, in order. A request that comes before the wait such an
 * answer asked for is answered 429 again and counted in `early`, as GitHub would rate limit it.
 * A request without a User-Agent is answered 403, as GitHub's administrative rules answer it.
 *
 * @param published - The published releases, by tag.
 * @param failures - The answers to give instead, by tag.
 * @param base - The API's path on the server: empty as on github.com, `/api/v3` as on GHES.
 * @returns The API's URL and the requests it received.
 */
export const fakeGitHub = (
  published: ReadonlyMap<string, unknown>,
  failures: ReadonlyMap<string, readonly GitHubFailure[]> = new Map(),
  base: "" | `/${string}` = ""
) =>
  Effect.gen(function* () {
    const requests: GitHubRequest[] = [];
    const early: number[] = [];
    const pending = new Map([...failures].map(([tag, answers]) => [tag, [...answers]]));
    let notBefore = 0;
    const route = HttpRouter.add("GET", `${base}/repos/elmeragroup/fuse/releases/tags/:tag`, (request) =>
      Effect.gen(function* () {
        const { tag = "" } = yield* HttpRouter.params;
        const userAgent = request.headers["user-agent"];
        requests.push({ tag, authorization: request.headers.authorization, userAgent });
        if (userAgent === undefined || userAgent === "") {
          return HttpServerResponse.jsonUnsafe(
            {
              message:
                "Request forbidden by administrative rules. Please make sure your request has a User-Agent header",
            },
            { status: 403 }
          );
        }
        const now = yield* Clock.currentTimeMillis;
        if (now < notBefore) {
          // A read before the wait GitHub asked for meets the rate limit again.
          early.push(notBefore - now);
          return HttpServerResponse.jsonUnsafe(
            { message: "API rate limit exceeded" },
            { status: 429, headers: { "retry-after": String(Math.ceil((notBefore - now) / 1000)) } }
          );
        }
        const failure = pending.get(tag)?.shift();
        if (failure !== undefined) {
          if (failure._tag === "Stall") return stalled();
          const headers = failure.headers ?? {};
          const retryAfter = Number(headers["retry-after"] ?? "0");
          const reset =
            headers["x-ratelimit-remaining"] === "0" ? Number(headers["x-ratelimit-reset"] ?? "0") * 1000 : 0;
          notBefore = Math.max(now + retryAfter * 1000, reset);
          return HttpServerResponse.jsonUnsafe(
            { message: "Server Error" },
            { status: failure.status, headers }
          );
        }
        const release = published.get(tag);
        return release === undefined
          ? HttpServerResponse.jsonUnsafe({ message: "Not Found" }, { status: 404 })
          : HttpServerResponse.jsonUnsafe(release);
      })
    );
    const url = `${yield* serve(route)}${base}`;
    return { url, requests, early };
  });

/** A message Slack's stand-in holds. */
export type HeldMessage = {
  readonly ts: string;
  readonly channel: string;
  readonly metadata?: unknown;
  /** The `chat.postMessage` arguments, for messages the steps posted. */
  readonly payload?: unknown;
};

/**
 * A throttled history answer: a `Retry-After` value sent as given, with no wait enforced, or a
 * wait of `seconds` the stand-in names when it answers, in seconds or as an HTTP date, and
 * enforces. An HTTP date has whole seconds, so it names the first whole second at least `seconds`
 * after the answer.
 */
export type Throttle =
  | { readonly status: number; readonly retryAfter: string }
  | { readonly status: number; readonly wait: "seconds" | "date"; readonly seconds: number };

/** The `Retry-After` value a throttle sends at `now`, and the time before which a read is early. */
function throttleAnswer(throttle: Throttle, now: number) {
  if ("retryAfter" in throttle) return { retryAfter: throttle.retryAfter, notBefore: 0 };
  if (throttle.wait === "seconds")
    return { retryAfter: String(throttle.seconds), notBefore: now + throttle.seconds * 1000 };
  const until = Math.ceil(now / 1000) * 1000 + throttle.seconds * 1000;
  return { retryAfter: Headers.formatHttpDate(DateTime.makeUnsafe(until)), notBefore: until };
}

/** What Slack's stand-in does besides answering. */
type SlackBehaviour = {
  /** Store the next post, then end the connection without a whole answer. */
  loseNextPostAnswer: boolean;
  /** Send the headers of every post's answer, then stall, after storing the post. */
  stallPosts: boolean;
  /** Send the headers of every history answer, then stall. */
  stallHistory: boolean;
  /** Answer history reads with `ok: false` and this error. */
  historyError: string | undefined;
  /** Answer the next history reads with these statuses and `Retry-After` headers. */
  throttles: Throttle[];
  /** Answer history pages with `has_more: true` and no cursor. */
  loseCursor: boolean;
  /**
   * Answer history pages with `is_limited: true`, as Slack does for a free workspace past its
   * history limit, whose older messages it hides.
   */
  limitHistory: boolean;
};

/** The token Slack's stand-in accepts. */
export const SLACK_TOKEN = "xoxb-test-token";

/** The `chat.postMessage` arguments the stand-in reads. */
const PostArguments = Schema.Struct({ channel: Schema.String, metadata: Schema.optionalKey(Schema.Unknown) });

/**
 * Slack's `conversations.history` and `chat.postMessage` for a workspace with the bot in every
 * channel: history answers newest first from what the channels hold, newer than `oldest`, a page
 * of `limit` messages at a time with `next_cursor`; a post is stored with a timestamp of now. A
 * history read that comes before the wait its previous 429 or 503 asked for is answered 429
 * again and counted in `early`, as Slack would rate limit it.
 *
 * It answers under `/api`, as slack.com does.
 *
 * @returns The API's URL, the messages it holds, the calls it received, the reads that came too
 *   early, and its behaviour.
 */
export const fakeSlack = Effect.gen(function* () {
  const held: HeldMessage[] = [];
  const calls: string[] = [];
  const early: number[] = [];
  const behaviour: SlackBehaviour = {
    loseNextPostAnswer: false,
    stallPosts: false,
    stallHistory: false,
    historyError: undefined,
    throttles: [],
    loseCursor: false,
    limitHistory: false,
  };
  let notBefore = 0;
  let sequence = 0;
  const authorized = (request: HttpServerRequest.HttpServerRequest) =>
    request.headers.authorization === `Bearer ${SLACK_TOKEN}`;

  const history = HttpRouter.add("POST", "/api/conversations.history", (request) =>
    Effect.gen(function* () {
      calls.push("conversations.history");
      if (!authorized(request)) return HttpServerResponse.jsonUnsafe({ ok: false, error: "invalid_auth" });
      const now = yield* Clock.currentTimeMillis;
      if (now < notBefore) {
        early.push(notBefore - now);
        return HttpServerResponse.empty({ status: 429, headers: { "retry-after": "1" } });
      }
      const throttle = behaviour.throttles.shift();
      if (throttle !== undefined) {
        const { retryAfter, notBefore: until } = throttleAnswer(throttle, now);
        notBefore = until;
        return HttpServerResponse.empty({ status: throttle.status, headers: { "retry-after": retryAfter } });
      }
      if (behaviour.stallHistory) return stalled();
      if (behaviour.historyError !== undefined) {
        return HttpServerResponse.jsonUnsafe({ ok: false, error: behaviour.historyError });
      }
      const form = yield* request.urlParamsBody;
      const field = (name: string) => Option.getOrElse(UrlParams.getFirst(form, name), () => "");
      if (field("include_all_metadata") !== "true")
        return yield* Effect.die("a history read without metadata");
      const oldest = Number(field("oldest"));
      const limit = Number(field("limit"));
      const start = Number(field("cursor"));
      const visible = held
        .filter((message) => message.channel === field("channel") && Number(message.ts) > oldest)
        .reverse();
      const page = visible.slice(start, start + limit);
      const more = start + limit < visible.length;
      return HttpServerResponse.jsonUnsafe({
        ok: true,
        messages: page.map(({ ts, metadata }) => (metadata === undefined ? { ts } : { ts, metadata })),
        has_more: more,
        is_limited: behaviour.limitHistory,
        response_metadata: { next_cursor: more && !behaviour.loseCursor ? String(start + limit) : "" },
      });
    })
  );

  const post = HttpRouter.add("POST", "/api/chat.postMessage", (request) =>
    Effect.gen(function* () {
      calls.push("chat.postMessage");
      if (!authorized(request)) return HttpServerResponse.jsonUnsafe({ ok: false, error: "invalid_auth" });
      if (!(request.headers["content-type"] ?? "").startsWith("application/json")) {
        return yield* Effect.die("a post without JSON");
      }
      const payload = yield* request.json;
      const { channel, metadata } = yield* Schema.decodeUnknownEffect(PostArguments)(payload);
      sequence += 1;
      const ts = `${String(Math.floor((yield* Clock.currentTimeMillis) / 1000))}.${String(sequence).padStart(6, "0")}`;
      held.push({ ts, channel, metadata, payload });
      if (behaviour.loseNextPostAnswer) {
        behaviour.loseNextPostAnswer = false;
        // The answer begins and then breaks off, as a dropped connection leaves it.
        return HttpServerResponse.stream(Stream.fail("connection lost"), {
          status: 200,
          contentType: "application/json",
        });
      }
      if (behaviour.stallPosts) return stalled();
      return HttpServerResponse.jsonUnsafe({ ok: true, channel, ts });
    })
  );

  const url = `${yield* serve(Layer.mergeAll(history, post))}/api`;
  return { url, held, calls, early, behaviour };
});
