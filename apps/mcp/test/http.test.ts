import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { connect } from "node:net";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { ServerConfig } from "../src/config.ts";
import { RoutesLive } from "../src/server.ts";
import { writeFixtures } from "./fixtures.ts";
import type { FixtureFiles } from "./fixtures.ts";

// Unit under test: the composed HTTP routes, through raw JSON-RPC on the web handler. Oracles: the
// fixture skill folders and their bytes, the skill names fixed at launch for the shipped skills
// folder, the MCP Skills extension (a manifest digest is the SHA-256 of the bytes `resources/read`
// serves), the transport limits of the server plan (a POST over 64 KiB is rejected, and tool
// calls past the burst get 429), and RFC 9110 §10.1.1 (a server that answers a request with a
// final status need not send 100 Continue, and the client then sends no body).

/** Settings for a server over the fixture files, with its own token bucket. */
function configFor(files: FixtureFiles, burst: number) {
  return Layer.succeed(
    ServerConfig,
    ServerConfig.of({
      port: 0,
      catalogFile: files.catalogFile,
      skillsDirectory: files.skillsDirectory,
      commit: "abc123",
      docsOrigin: new URL("https://fuse.elmeragroup.no"),
      // Refills one token in about 30 years, so a run never sees one return.
      toolCalls: { refillPerSecond: 1e-9, burst },
    })
  );
}

/** A web handler over the routes, with its own settings and so its own token bucket. */
function serve(files: FixtureFiles, burst: number) {
  const app = HttpRouter.toWebHandler(
    RoutesLive.pipe(Layer.provide(configFor(files, burst)), Layer.provide(NodeServices.layer)),
    { disableLogger: true }
  );
  afterAll(app.dispose);
  return app.handler;
}

/** The headers every 2026-07-28 POST carries. */
function postHeaders(method: string) {
  return {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": "2026-07-28",
    "mcp-method": method,
  };
}

let nextId = 1;

/** A 2026-07-28 request, with its routing headers and its client metadata. */
function rpc(method: string, params: Schema.JsonObject = {}, name?: string): Request {
  const meta = {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {},
    "io.modelcontextprotocol/clientInfo": { name: "test", version: "1" },
  };
  const headers = new Headers(postHeaders(method));
  if (name !== undefined) headers.set("mcp-name", name);
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: nextId++,
      method,
      params: Object.fromEntries([...Object.entries(params), ["_meta", meta]]),
    }),
  });
}

/**
 * The JSON-RPC result of a response, decoded with `schema`. A non-200 status, a JSON-RPC error or
 * a result of another shape fails the test.
 */
async function resultOf<A, I>(response: Response, schema: Schema.Codec<A, I>): Promise<A> {
  expect(response.status).toBe(200);
  return Schema.decodeUnknownSync(Schema.Struct({ result: schema }))(await response.json()).result;
}

const Instructions = Schema.Struct({ instructions: Schema.String });

describe("with skills", () => {
  const files = writeFixtures(["fuse-setup", "fuse-theming"]);
  const handler = serve(files, 2);

  it("lists one skill per folder, by folder name", async () => {
    const Listed = Schema.Struct({ uri: Schema.String, frontmatter: Schema.Struct({ name: Schema.String }) });
    const { skills } = await resultOf(
      await handler(rpc("skills/list")),
      Schema.Struct({ skills: Schema.Array(Listed) })
    );
    expect(skills.map(({ uri, frontmatter }) => ({ name: frontmatter.name, uri }))).toEqual([
      { name: "fuse-setup", uri: "skill://fuse-setup/SKILL.md" },
      { name: "fuse-theming", uri: "skill://fuse-theming/SKILL.md" },
    ]);
  });

  it("serves each skill file with the bytes its manifest digest covers", async () => {
    const Manifest = Schema.Struct({
      resources: Schema.Array(Schema.Struct({ uri: Schema.String, digest: Schema.String, size: Schema.Int })),
    });
    const { skill } = await resultOf(
      await handler(rpc("skills/get", { uri: "skill://fuse-setup/SKILL.md" })),
      Schema.Struct({ skill: Manifest })
    );
    expect(skill.resources.map(({ uri }) => uri).sort()).toEqual([
      "skill://fuse-setup/SKILL.md",
      "skill://fuse-setup/references/notes.md",
    ]);
    for (const { uri, digest, size } of skill.resources) {
      const onDisk = readFileSync(join(files.skillsDirectory, uri.slice("skill://".length)));
      const { contents } = await resultOf(
        await handler(rpc("resources/read", { uri }, uri)),
        Schema.Struct({ contents: Schema.Tuple([Schema.Struct({ text: Schema.String })]) })
      );
      const served = Buffer.from(contents[0].text, "utf8");
      expect(served.equals(onDisk)).toBe(true);
      expect(size).toBe(onDisk.length);
      expect(digest).toBe(`sha256:${createHash("sha256").update(served).digest("hex")}`);
    }
  });

  it("names the skill URIs in the instructions", async () => {
    const { instructions } = await resultOf(await handler(rpc("server/discover")), Instructions);
    expect(instructions).toContain("- skill://fuse-setup/SKILL.md\n- skill://fuse-theming/SKILL.md");
  });

  it("rejects a POST over 64 KiB, with or without its length", async () => {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 0,
      method: "tools/list",
      params: { pad: "x".repeat(65_536) },
    });
    const sized = await handler(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { ...postHeaders("tools/list"), "content-length": String(Buffer.byteLength(body)) },
        body,
      })
    );
    const streamed = await handler(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: postHeaders("tools/list"),
        body: new Blob([body]).stream(),
        duplex: "half",
      } satisfies RequestInit & { readonly duplex: "half" })
    );
    expect([sized.status, streamed.status]).toEqual([413, 413]);
  });

  it("answers tool calls past the burst with 429, and other requests still", async () => {
    const search = () =>
      rpc("tools/call", { name: "search_docs", arguments: { query: "button" } }, "search_docs");
    const statuses = [];
    for (let call = 0; call < 3; call++) statuses.push((await handler(search())).status);
    expect(statuses).toEqual([200, 200, 429]);
    expect((await handler(rpc("tools/list"))).status).toBe(200);
  });

  it("answers /healthz with the commit", async () => {
    const response = await handler(new Request("http://localhost/healthz"));
    expect([response.status, await response.text()]).toEqual([200, "abc123"]);
  });
});

describe("without skills", () => {
  const handler = serve(writeFixtures([]), 2);

  it("starts, lists its tools, and names no skill in its instructions", async () => {
    const { tools } = await resultOf(
      await handler(rpc("tools/list")),
      Schema.Struct({ tools: Schema.Array(Schema.Struct({ name: Schema.String })) })
    );
    expect(tools.map(({ name }) => name)).toEqual(["search_docs", "read_doc"]);
    const { instructions } = await resultOf(await handler(rpc("server/discover")), Instructions);
    expect(instructions).not.toContain("skill://");
  });
});

describe("on the Node listener", () => {
  /** Sends raw request bytes and returns the first header block the server answers with. */
  function firstResponse(port: number, request: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = connect(port, "127.0.0.1", () => socket.write(request));
      let received = "";
      socket.on("data", (chunk) => {
        received += chunk.toString("latin1");
        const end = received.indexOf("\r\n\r\n");
        if (end === -1) return;
        socket.destroy();
        resolve(received.slice(0, end));
      });
      socket.on("error", reject);
    });
  }

  it("refuses a declared length over 64 KiB with 413 and never asks for the body", async () => {
    const received = await Effect.runPromise(
      Effect.gen(function* () {
        const { address } = yield* HttpServer.HttpServer;
        if (address._tag === "UnixPathAddress") return yield* Effect.die("The server listens on a TCP port.");
        const headers = Object.entries({ ...postHeaders("tools/list"), "content-length": String(65_537) })
          .map(([name, value]) => `${name}: ${value}\r\n`)
          .join("");
        return yield* Effect.promise(() =>
          firstResponse(
            address.port,
            `POST /mcp HTTP/1.1\r\nhost: localhost\r\nexpect: 100-continue\r\n${headers}\r\n`
          )
        );
      }).pipe(
        Effect.provide(
          HttpRouter.serve(RoutesLive, { disableLogger: true }).pipe(
            Layer.provideMerge(NodeHttpServer.layer(createServer, { port: 0 })),
            Layer.provide(configFor(writeFixtures([]), 2))
          )
        )
      )
    );
    // A 100 Continue would come first, and the client would then send the body.
    expect(received.split("\r\n", 1)[0]).toBe("HTTP/1.1 413 Payload Too Large");
  });
});
