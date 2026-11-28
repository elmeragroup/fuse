/**
 * The Fuse MCP server from `apps/mcp`, started from its bundle on a free port for one cell and
 * stopped, with its whole process group, when the cell's scope closes.
 */

import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { createServer } from "node:net";

import { encodeJsonText } from "./json-text.ts";

/** The server did not start, or did not answer a listing. */
export class FuseServerFailed extends Schema.TaggedError<FuseServerFailed>()("FuseServerFailed", {
  message: Schema.String,
}) {}

/** What a server needs to start. */
export type FuseServerOptions = {
  /** The server bundle, `apps/mcp/dist/main.mjs`. */
  readonly bundle: string;
  /** The docs catalog the docs generation pass writes. */
  readonly catalogFile: string;
  /** The folder of skill folders the server serves. An empty folder serves none. */
  readonly skillsDirectory: string;
  /** The commit the server reports as its version. */
  readonly commit: string;
};

/** What `skills/list` answers. */
export type SkillListing =
  | { readonly _tag: "listed"; readonly uris: readonly string[] }
  | { readonly _tag: "method-not-found" };

/** A running server, and what it lists. */
export type RunningFuseServer = {
  /** The MCP endpoint. */
  readonly url: URL;
  /** The server's process id, which owns its process group. */
  readonly pid: number;
  /**
   * What `skills/list` answers: the skill URIs, or `method-not-found` from a server that serves no
   * skill and so offers no Skills extension.
   */
  readonly skills: SkillListing;
  /** The URIs `resources/list` answers. */
  readonly resources: readonly string[];
};

const READY_TIMEOUT = Duration.seconds(30);

const decodeAddress = Schema.decodeUnknownOption(Schema.Struct({ port: Schema.Int }));

/** A port nothing on this machine listens on now. */
const freePort = Effect.callback<number, FuseServerFailed>((resume) => {
  const server = createServer();
  server.once("error", (cause) =>
    resume(Effect.fail(new FuseServerFailed({ message: `No free port: ${cause.message}` })))
  );
  server.listen(0, "127.0.0.1", () => {
    const address = decodeAddress(server.address());
    server.close(() =>
      resume(
        Option.isSome(address)
          ? Effect.succeed(address.value.port)
          : Effect.fail(new FuseServerFailed({ message: "No free port: the probe socket has no port." }))
      )
    );
  });
});

/**
 * Starts a server and waits until it answers `GET /healthz`, then reads its skill and resource
 * listings. Closing the scope stops the server's process group.
 *
 * @param options - The bundle, the catalog, the skills folder and the commit.
 * @returns The running server.
 */
export const startFuseServer = Effect.fn("FuseServer.start")(function* (options: FuseServerOptions) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const port = yield* freePort;
  const origin = new URL(`http://127.0.0.1:${String(port)}`);
  const handle = yield* spawner
    .spawn(
      ChildProcess.make(process.execPath, [options.bundle], {
        env: {
          PORT: String(port),
          FUSE_CATALOG_FILE: options.catalogFile,
          FUSE_SKILLS_DIR: options.skillsDirectory,
          FUSE_COMMIT: options.commit,
        },
        extendEnv: true,
        stdin: "ignore",
        forceKillAfter: Duration.seconds(3),
      })
    )
    .pipe(
      Effect.mapError(
        (cause) => new FuseServerFailed({ message: `The server did not start: ${cause.message}` })
      )
    );

  // Draining the output keeps a full pipe from blocking the server, and keeps its log for a failure.
  const output: string[] = [];
  yield* handle.all.pipe(
    Stream.decodeText(),
    Stream.runForEach((chunk) => Effect.sync(() => output.push(chunk))),
    Effect.ignore,
    Effect.forkScoped
  );
  const failed = (reason: string) =>
    new FuseServerFailed({ message: `${reason}\n${output.join("").split("\n").slice(-20).join("\n")}` });

  const exited = handle.exitCode.pipe(
    Effect.flatMap((code) =>
      Effect.fail(failed(`The server exited with code ${String(code)} before it was ready.`))
    ),
    Effect.catchTag("PlatformError", (cause) => Effect.fail(failed(cause.message)))
  );
  const last = { answer: "no answer" };
  yield* Effect.raceFirst(pollHealth(new URL("/healthz", origin), last), exited).pipe(
    Effect.timeoutOrElse({
      duration: READY_TIMEOUT,
      orElse: () =>
        Effect.fail(
          failed(
            `The server did not answer /healthz within ${Duration.format(READY_TIMEOUT)} (${last.answer}).`
          )
        ),
    })
  );

  const url = new URL("/mcp", origin);
  const skills = yield* rpc(url, "skills/list").pipe(
    Effect.flatMap((answer): Effect.Effect<SkillListing, FuseServerFailed> =>
      isMethodNotFound(answer)
        ? Effect.succeed({ _tag: "method-not-found" })
        : decodeAnswer(answer, SkillsAnswer).pipe(
            Effect.map(({ result }) => ({ _tag: "listed", uris: result.skills.map((entry) => entry.uri) }))
          )
    )
  );
  const resources = yield* rpc(url, "resources/list").pipe(
    Effect.flatMap((answer) => decodeAnswer(answer, ResourcesAnswer)),
    Effect.map(({ result }) => result.resources.map((entry) => entry.uri))
  );
  return { url, pid: handle.pid, skills, resources } satisfies RunningFuseServer;
});

/** How long one health request may take. */
const HEALTH_REQUEST_TIMEOUT = Duration.seconds(2);

/**
 * Polls the health route until it answers 200, keeping the last answer for a timeout's message.
 * Each request has its own timeout, because a request that reaches the server as it binds its
 * port can stay unanswered.
 */
const pollHealth = Effect.fn("FuseServer.pollHealth")(function* (url: URL, last: { answer: string }) {
  for (;;) {
    const status = yield* Effect.tryPromise({
      try: async (signal) => {
        // @effect-diagnostics-next-line globalFetchInEffect:off -- the runner wires no HttpClient, and this readiness poll needs only a status
        const response = await fetch(url, { signal });
        await response.arrayBuffer();
        return response.status;
      },
      // fetch puts the network error, such as ECONNREFUSED, in its cause.
      catch: (cause) =>
        cause instanceof Error
          ? `${cause.message}${cause.cause instanceof Error ? `: ${cause.cause.message}` : ""}`
          : "fetch failed",
    }).pipe(
      Effect.timeoutOrElse({
        duration: HEALTH_REQUEST_TIMEOUT,
        orElse: () => Effect.fail(`no answer within ${Duration.format(HEALTH_REQUEST_TIMEOUT)}`),
      }),
      Effect.result
    );
    if (status._tag === "Success" && status.success === 200) return;
    last.answer = status._tag === "Success" ? `status ${String(status.success)}` : status.failure;
    yield* Effect.sleep(Duration.millis(200));
  }
});

const Entries = Schema.Array(Schema.Struct({ uri: Schema.String }));
const SkillsAnswer = Schema.Struct({ result: Schema.Struct({ skills: Entries }) });
const ResourcesAnswer = Schema.Struct({ result: Schema.Struct({ resources: Entries }) });

const MethodNotFound = Schema.Struct({ error: Schema.Struct({ code: Schema.Literal(-32601) }) });
const decodeMethodNotFound = Schema.decodeUnknownOption(MethodNotFound);

/** One JSON-RPC answer: its HTTP status and its body. */
type RpcAnswer = { readonly method: string; readonly status: number; readonly json: unknown };

/** Whether an answer is JSON-RPC's "Method not found". */
function isMethodNotFound(answer: RpcAnswer): boolean {
  return decodeMethodNotFound(answer.json)._tag === "Some";
}

/** Decodes a 200 answer with `schema`, failing on any other status or shape. */
function decodeAnswer<A, I>(
  answer: RpcAnswer,
  schema: Schema.Codec<A, I>
): Effect.Effect<A, FuseServerFailed> {
  if (answer.status !== 200) {
    return Effect.fail(
      new FuseServerFailed({ message: `${answer.method} answered status ${String(answer.status)}` })
    );
  }
  return Schema.decodeUnknownEffect(schema)(answer.json).pipe(
    Effect.mapError(
      (cause) =>
        new FuseServerFailed({ message: `${answer.method} answered an unexpected shape: ${cause.message}` })
    )
  );
}

/** One stateless 2026-07-28 JSON-RPC request, as `apps/mcp`'s HTTP suite sends it. */
const rpc = Effect.fn("FuseServer.rpc")(function* (url: URL, method: string) {
  const body = yield* encodeJsonText({
    jsonrpc: "2.0",
    id: 1,
    method,
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
        "io.modelcontextprotocol/clientInfo": { name: "skill-evals", version: "0.0.0" },
      },
    },
  }).pipe(Effect.mapError((cause) => new FuseServerFailed({ message: cause.message })));
  return yield* Effect.tryPromise({
    try: async (signal): Promise<RpcAnswer> => {
      // @effect-diagnostics-next-line globalFetchInEffect:off -- one JSON-RPC request needs no HttpClient
      const response = await fetch(url, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2026-07-28",
          "mcp-method": method,
        },
        body,
      });
      return { method, status: response.status, json: await response.json() };
    },
    catch: (cause) => new FuseServerFailed({ message: `${method} failed: ${String(cause)}` }),
  }).pipe(
    Effect.timeoutOrElse({
      duration: Duration.seconds(10),
      orElse: () => Effect.fail(new FuseServerFailed({ message: `${method} got no answer within 10s` })),
    })
  );
});
