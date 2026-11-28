/**
 * The Fuse MCP server from `apps/mcp`, started from its bundle on a free port for one cell and
 * stopped, with its whole process group, when the cell's scope closes.
 */

import * as McpClient from "effect/ai/McpClient";
import * as McpProtocol from "effect/ai/McpProtocol";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";

import type { Environment } from "./isolation.ts";

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
  /** The server's whole environment, beside the variables that configure it. */
  readonly env: Environment;
};

/** What the server offers for skills. */
export type SkillListing =
  | {
      /** The server declares the Skills extension, and `skills/list` answered these URIs. */
      readonly _tag: "listed";
      readonly uris: readonly string[];
    }
  | {
      /** The server declares no Skills extension, so no client can list a skill from it. */
      readonly _tag: "no-extension";
    };

/** A running server, and what it lists. */
export type RunningFuseServer = {
  /** The MCP endpoint. */
  readonly url: URL;
  /** The server's process id, which owns its process group. */
  readonly pid: number;
  /** The skills it lists, or that it offers no Skills extension. */
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
 * The free-port probe releases its port before the server binds it, so another process can take
 * it in between. The server answers `/healthz` with its `FUSE_COMMIT`, so each start passes a new
 * value there and accepts only that answer, which comes from its own child.
 *
 * @param options - The bundle, the catalog, the skills folder and the environment.
 * @returns The running server.
 */
export const startFuseServer = Effect.fn("FuseServer.start")(function* (options: FuseServerOptions) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const port = yield* freePort;
  const nonce = `skill-evals-${randomUUID()}`;
  const origin = new URL(`http://127.0.0.1:${String(port)}`);
  const handle = yield* spawner
    .spawn(
      ChildProcess.make(process.execPath, [options.bundle], {
        env: {
          ...options.env,
          PORT: String(port),
          FUSE_CATALOG_FILE: options.catalogFile,
          FUSE_SKILLS_DIR: options.skillsDirectory,
          FUSE_COMMIT: nonce,
        },
        extendEnv: false,
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
  yield* Effect.raceFirst(pollHealth(new URL("/healthz", origin), nonce, last), exited).pipe(
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
  // The MCP client owns the protocol: the handshake, the Skills extension and the decoding.
  const listings = yield* Effect.gen(function* () {
    // @effect-diagnostics-next-line experimentalApiUsage:off -- the client the pinned Effect ships for MCP, as the brief for #1188 asks; the runner is a private tool that moves with Effect
    const client = yield* McpClient.McpClient;
    const declaresSkills = client.capabilities.extensions?.[SKILLS_EXTENSION] !== undefined;
    const skills: SkillListing = declaresSkills
      ? { _tag: "listed", uris: (yield* client.listSkills()).map((skill) => skill.uri) }
      : { _tag: "no-extension" };
    const resources = (yield* client.listResources()).map((resource) => resource.uri);
    return { skills, resources };
  }).pipe(
    Effect.provide(
      // @effect-diagnostics-next-line experimentalApiUsage:off -- the client the pinned Effect ships for MCP, as the brief for #1188 asks; the runner is a private tool that moves with Effect
      McpClient.layerHttp({
        name: "skill-evals",
        version: "0.0.0",
        timeout: Duration.seconds(10),
        url,
        protocol: McpProtocol.v2026_07_28,
        extensions: { skills: true },
      }).pipe(Layer.provide(FetchHttpClient.layer))
    ),
    Effect.mapError((cause) => failed(`Listing the server's skills and resources failed: ${cause.message}`))
  );
  return { url, pid: handle.pid, ...listings } satisfies RunningFuseServer;
});

/** The capability key under which a server declares the Skills extension. */
const SKILLS_EXTENSION = "io.modelcontextprotocol/skills";

/** How long one health request may take. */
const HEALTH_REQUEST_TIMEOUT = Duration.seconds(2);

/**
 * Polls the health route until it answers 200 with `nonce`, keeping the last answer for a timeout's
 * message. Each request has its own timeout, because a request that reaches the server as it binds
 * its port can stay unanswered.
 */
const pollHealth = Effect.fn("FuseServer.pollHealth")(function* (
  url: URL,
  nonce: string,
  last: { answer: string }
) {
  for (;;) {
    const status = yield* Effect.tryPromise({
      try: async (signal) => {
        // @effect-diagnostics-next-line globalFetchInEffect:off -- a readiness poll needs only a status and a short body, and each request needs its own abort
        const response = await fetch(url, { signal });
        return { status: response.status, body: await response.text() };
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
    if (status._tag === "Success" && status.success.status === 200 && status.success.body === nonce) return;
    last.answer =
      status._tag === "Failure"
        ? status.failure
        : status.success.status === 200
          ? "another process answered on the port"
          : `status ${String(status.success.status)}`;
    yield* Effect.sleep(Duration.millis(200));
  }
});
