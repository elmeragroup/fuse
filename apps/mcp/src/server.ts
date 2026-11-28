/**
 * The composed server, which serves the MCP endpoint at `/mcp` with its transport limits, and
 * `GET /healthz`.
 *
 * The endpoint speaks protocol 2026-07-28 alone, which holds no session, so any replica answers
 * any request. Subscriptions are off, because the tools and skills never change while the process
 * runs. `allowedOrigins` stays unset, so a request with an `Origin` header, which a browser page
 * sends, gets 403.
 */

import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as McpProtocol from "effect/ai/McpProtocol";
import * as McpServer from "effect/ai/McpServer";
import * as ByteSize from "effect/ByteSize";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as HttpIncomingMessage from "effect/http/HttpIncomingMessage";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import { createServer } from "node:http";

import { Catalog } from "./catalog.ts";
import { ServerConfig } from "./config.ts";
import { instructions } from "./instructions.ts";
import { loadSkills, skillsLayer } from "./skills.ts";
import * as TokenBucket from "./token-bucket.ts";
import { ToolsLive } from "./tools.ts";

/** The largest request body the endpoint reads. The largest valid call, eight hrefs, is under 4 KiB. */
export const MAX_BODY_BYTES = 64 * 1024;

/** A JSON-RPC error with no request id, for an HTTP status the endpoint answers before MCP reads the body. */
function rejection(status: number, message: string, headers: Record<string, string> = {}) {
  return HttpServerResponse.jsonUnsafe(
    { jsonrpc: "2.0", id: null, error: { code: -32_000, message } },
    { status, headers }
  );
}

/** Whether a request's `Content-Length` declares a body over {@link MAX_BODY_BYTES}. */
function declaresOversizeBody(contentLength: string | undefined): boolean {
  return contentLength !== undefined && Number(contentLength) > MAX_BODY_BYTES;
}

/**
 * Admits a POST to `/mcp` only when its body is at most {@link MAX_BODY_BYTES} and, for a tool
 * call, when the replica's token bucket holds a token.
 *
 * A `Content-Length` over the limit gets 413 before the body is read. The Node adapter answers
 * `Expect: 100-continue` only when a handler opens the body, so such a client never sends it.
 * Otherwise the middleware reads the body under the limit, and the endpoint reuses what it read.
 * The read stops at the limit, so a chunked body that streams past it also gets 413.
 *
 * The middleware tells a tool call apart by its `Mcp-Method` header. Protocol 2026-07-28 rejects a request
 * whose header differs from the method in its body, so a client cannot skip the bucket by
 * mislabelling a call.
 */
const TransportLimits = HttpRouter.middleware(
  Effect.gen(function* () {
    const { toolCalls } = yield* ServerConfig;
    const bucket = yield* Ref.make(TokenBucket.full(toolCalls, yield* Clock.currentTimeMillis));
    const tooLarge = rejection(413, `The request body is over ${String(MAX_BODY_BYTES)} bytes.`);
    return (httpEffect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        if (request.method !== "POST") return yield* httpEffect;
        if (declaresOversizeBody(request.headers["content-length"])) return tooLarge;
        const read = yield* Effect.result(
          request.arrayBuffer.pipe(
            Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(MAX_BODY_BYTES))
          )
        );
        if (read._tag === "Failure" && read.failure.reason._tag === "RequestParseError") {
          if (read.failure.reason.reason === "BodyTooLarge") return tooLarge;
        }
        if (request.headers["mcp-method"] === "tools/call") {
          const now = yield* Clock.currentTimeMillis;
          const outcome = yield* Ref.modify(bucket, (current) => {
            const next = TokenBucket.take(current, toolCalls, now);
            return [next, next.bucket];
          });
          if (!outcome.admitted) {
            const seconds = TokenBucket.secondsUntilToken(outcome.bucket, toolCalls);
            return rejection(
              429,
              `Too many tool calls on this server. Retry in ${String(seconds)} seconds.`,
              {
                "retry-after": String(seconds),
              }
            );
          }
        }
        return yield* httpEffect;
      });
  })
);

/** `GET /healthz` answers the commit the server was built from, once the catalog has decoded and the skills have registered. */
const HealthLive = Layer.unwrap(
  Effect.gen(function* () {
    const { commit } = yield* ServerConfig;
    return HttpRouter.add("GET", "/healthz", HttpServerResponse.text(commit));
  })
);

/** The MCP endpoint, with the tools over the catalog and the skills from the skills directory. */
const McpLive = Layer.unwrap(
  Effect.gen(function* () {
    const { commit, docsOrigin } = yield* ServerConfig;
    const skills = yield* loadSkills;
    return McpServer.layerHttp({
      name: "fuse",
      version: commit,
      instructions: instructions(
        skills.map((skill) => skill.uri),
        docsOrigin
      ),
      websiteUrl: docsOrigin.origin,
      path: "/mcp",
      protocols: [McpProtocol.v2026_07_28],
      allowSubscriptions: false,
      registrations: Layer.mergeAll(ToolsLive, skillsLayer(skills)),
    }).pipe(Layer.provide(TransportLimits.layer));
  })
);

/**
 * Every route of the server. It needs an `HttpRouter`, which `HttpRouter.serve` or
 * `HttpRouter.toWebHandler` provides, the settings, and a file system to read the catalog and
 * the skills from.
 */
export const RoutesLive = Layer.mergeAll(McpLive, HealthLive).pipe(Layer.provide(Catalog.layer));

/** The server on Node, listening on `PORT`, with its settings from the environment. */
export const ServerLive = Layer.unwrap(
  Effect.gen(function* () {
    const { port } = yield* ServerConfig;
    return HttpRouter.serve(RoutesLive).pipe(Layer.provide(NodeHttpServer.layer(createServer, { port })));
  })
).pipe(Layer.provide(ServerConfig.layer));
