import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as McpProtocol from "effect/ai/McpProtocol";
import * as McpTest from "effect/ai/McpTest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Schema from "effect/Schema";

import { Catalog } from "../src/catalog.ts";
import { ServerConfig } from "../src/config.ts";
import { ToolsLive } from "../src/tools.ts";
import {
  blockLength,
  manyCases,
  ORIGIN,
  SECTIONS,
  sizedSection,
  TINY_BLOCK_LENGTH,
  writeFixtures,
} from "./fixtures.ts";

// Unit under test: the search_docs and read_doc tools, through an MCP client. Oracles: the
// fixture catalog's hand-written sections, the read_doc rules of the server plan (a fragment
// returns its section and every section under it, #overview the lead section alone, at most
// 100,000 characters a call, a size line with child hrefs for what does not fit), the format of a
// returned block (`Source:` line, blank line, markdown, and for a section the page's `Sections:`
// line), and the input bounds each tool advertises.

const files = writeFixtures([]);

const ConfigLive = Layer.succeed(
  ServerConfig,
  ServerConfig.of({
    port: 0,
    catalogFile: files.catalogFile,
    skillsDirectory: files.skillsDirectory,
    commit: "test",
    docsOrigin: new URL(ORIGIN),
    toolCalls: { refillPerSecond: 1, burst: 1 },
  })
);

const Registrations = ToolsLive.pipe(
  Layer.provide(Catalog.layer),
  Layer.provide(ConfigLive),
  Layer.provide(NodeServices.layer)
);

const client = McpTest.makeClient(Registrations, { protocols: [McpProtocol.v2026_07_28] });

/** Calls a tool and returns each text block, failing on a non-text block. */
const call = Effect.fn("call")(function* (name: string, args: Schema.JsonObject) {
  const mcp = yield* client;
  const result = yield* mcp.callTool({ name, arguments: args });
  assert.isUndefined(result.structuredContent);
  const blocks = result.content.map((block) => (block.type === "text" ? block.text : `<${block.type}>`));
  return { isError: result.isError === true, blocks };
});

const readDoc = (...hrefs: string[]) => call("read_doc", { hrefs });

/** The hrefs an over-budget answer lists, one per `- ` line. */
function listedHrefs(block: string): readonly string[] {
  return [...block.matchAll(/^- (\S+) \([\d,]+ characters\)$/gmu)].map(([, href = ""]) => href);
}

/** The size and the room an over-budget answer reports. */
function sizes(block: string) {
  const [, size = "", room = ""] =
    /takes ([\d,]+) characters, more than the ([\d,]+) left/u.exec(block) ?? [];
  return { size: Number(size.replaceAll(",", "")), room: Number(room.replaceAll(",", "")) };
}

describe("read_doc", () => {
  it.effect("returns a section as unescaped markdown, with or without the origin and .md", () =>
    Effect.gen(function* () {
      const expected =
        'Source: https://fuse.elmeragroup.no/components/button#pending\n\n### Pending\n\nA "pending" button shows a spinner while an action runs.\n\nSections: /components/button#overview, #usage, #examples, #api-reference, #tokens-consumed';
      const { isError, blocks } = yield* readDoc(
        "/components/button#pending",
        "https://fuse.elmeragroup.no/components/button.md#pending"
      );
      assert.isFalse(isError);
      assert.deepStrictEqual(blocks, [expected, expected]);
    }).pipe(Effect.scoped)
  );

  it.effect("returns a parent section with every section under it, and #overview alone", () =>
    Effect.gen(function* () {
      const { blocks } = yield* readDoc("/components/button#examples", "/components/button#overview");
      assert.deepStrictEqual(blocks, [
        `Source: https://fuse.elmeragroup.no/components/button#examples\n\n## Examples\n\n### Pending\n\nA "pending" button shows a spinner while an action runs.\n\n### Disabled\n\nA disabled button ignores presses.\n\n${SECTIONS.button}`,
        `Source: https://fuse.elmeragroup.no/components/button#overview\n\n# Button\n\nTriggers an action.\n\n${SECTIONS.button}`,
      ]);
    }).pipe(Effect.scoped)
  );

  it.effect("answers a page without sections with its URL, and /llms.txt with the index", () =>
    Effect.gen(function* () {
      const { blocks } = yield* readDoc("/quick-start", "/llms.txt");
      assert.deepStrictEqual(blocks, [
        "Quick start has no markdown on this server yet. Read it at https://fuse.elmeragroup.no/quick-start",
        "Source: https://fuse.elmeragroup.no/llms.txt\n\n# Fuse\n\n- [Button](/components/button): Triggers an action.\n",
      ]);
    }).pipe(Effect.scoped)
  );

  it.effect("answers an unknown page or section with an error line that names the nearest", () =>
    Effect.gen(function* () {
      const { isError, blocks } = yield* readDoc("/components/buton", "/components/button#pendng");
      assert.isFalse(isError);
      assert.deepStrictEqual(blocks, [
        "/components/buton is no docs page. Nearest: /components/button, /components/big, /components/tiny.",
        "/components/button has no section #pendng. Nearest: #pending, #usage, #overview.",
      ]);
    }).pipe(Effect.scoped)
  );

  it.effect("ends a section's block with the page's sections, and no other answer with them", () =>
    Effect.gen(function* () {
      const { blocks } = yield* readDoc(
        "/components/button#tokens-consumed",
        "/components/button",
        "/components/big",
        "/quick-start",
        "/components/buton"
      );
      assert.strictEqual(
        blocks[0],
        `Source: ${ORIGIN}/components/button#tokens-consumed\n\n## Tokens consumed\n\n- \`--primary\`\n\nSections: /components/button#overview, #usage, #examples, #api-reference, #tokens-consumed`
      );
      // A whole page, an answer over the budget, a URL answer and an error line.
      for (const block of blocks.slice(1)) assert.notInclude(block, "Sections:");
      assert.isTrue(blocks[1]?.startsWith(`Source: ${ORIGIN}/components/button\n\n`));
      assert.match(blocks[2] ?? "", /^\/components\/big takes /u);
      assert.match(blocks[3] ?? "", /has no markdown on this server yet/u);
      assert.match(blocks[4] ?? "", /is no docs page/u);
    }).pipe(Effect.scoped)
  );

  it.effect("answers a page over the budget with its size and the hrefs of its sections", () =>
    Effect.gen(function* () {
      const { blocks } = yield* readDoc("/components/big", "/components/big#examples");
      assert.match(blocks[0] ?? "", /^\/components\/big takes [\d,]+ characters, more than the [\d,]+ left/u);
      assert.deepStrictEqual(listedHrefs(blocks[0] ?? ""), [
        "/components/big#overview",
        "/components/big#examples",
      ]);
      assert.deepStrictEqual(listedHrefs(blocks[1] ?? ""), [
        "/components/big#first",
        "/components/big#second",
        "/components/big#third",
      ]);
      // Each listed size is the length of the block that its href returns, Sections line included.
      const listedSize =
        /^- \/components\/big#first \(([\d,]+) characters\)$/mu.exec(blocks[1] ?? "")?.[1] ?? "";
      assert.strictEqual(
        Number(listedSize.replaceAll(",", "")),
        blockLength("/components/big#first", 45_000, SECTIONS.big)
      );
    }).pipe(Effect.scoped)
  );

  it.effect("returns at most 100,000 characters in one call, and answers the rest with size lines", () =>
    Effect.gen(function* () {
      const hrefs = ["first", "second", "third", "first", "second", "third", "first", "second"].map(
        (id) => `/components/big#${id}`
      );
      const { blocks } = yield* readDoc(...hrefs);
      assert.strictEqual(blocks.length, 8);
      assert.isAtMost(blocks.join("").length, 100_000);
      // Two 45,000-character sections fit; the third would pass 100,000.
      assert.strictEqual(
        blocks[0],
        `Source: ${ORIGIN}/components/big#first\n\n${sizedSection("first", 3, "First", 45_000).markdown}\n\n${SECTIONS.big}`
      );
      assert.strictEqual(
        blocks[1],
        `Source: ${ORIGIN}/components/big#second\n\n${sizedSection("second", 3, "Second", 45_000).markdown}\n\n${SECTIONS.big}`
      );
      assert.deepStrictEqual(
        blocks.slice(2).map((block) => block.slice(0, block.indexOf(" takes"))),
        hrefs.slice(2)
      );
    }).pipe(Effect.scoped)
  );

  it.effect("keeps room for a later href's list of sections when earlier hrefs nearly fill the call", () =>
    Effect.gen(function* () {
      const { blocks } = yield* readDoc(
        "/components/big#first",
        "/components/big#second",
        "/components/filler#tail",
        "/components/many#examples"
      );
      assert.isAtMost(blocks.join("").length, 100_000);
      assert.deepStrictEqual(
        listedHrefs(blocks[3] ?? ""),
        manyCases.map((section) => `/components/many#${section.id}`)
      );
    }).pipe(Effect.scoped)
  );

  it.effect(
    "reports the size of the block it measured, Source and Sections lines included, above the room it reports",
    () =>
      Effect.gen(function* () {
        // After filler#first and filler#gap, big#first's markdown fits what is left, and its block is 20 characters over.
        const { blocks } = yield* readDoc(
          "/components/filler#first",
          "/components/filler#gap",
          "/components/big#first"
        );
        const expected = blockLength("/components/big#first", 45_000, SECTIONS.big);
        assert.deepStrictEqual(sizes(blocks[2] ?? ""), { size: expected, room: expected - 20 });
      }).pipe(Effect.scoped)
  );

  it.effect("answers in full a batch that takes exactly 100,000 characters", () =>
    Effect.gen(function* () {
      // A whole Tiny page is shorter than its list of sections, so the room held for each one is its block.
      const tiny = Array.from({ length: 6 }, () => "/components/tiny");
      const { blocks } = yield* readDoc("/components/filler#first", "/components/filler#second", ...tiny);
      assert.deepStrictEqual(
        blocks.map((block) => block.startsWith("Source: ")),
        Array.from({ length: 8 }, () => true)
      );
      assert.strictEqual(blocks.slice(2).join("").length, 6 * TINY_BLOCK_LENGTH);
      assert.strictEqual(blocks.join("").length, 100_000);
    }).pipe(Effect.scoped)
  );

  it.effect("answers a last section that does not fit with an href it answers in a call of its own", () =>
    Effect.gen(function* () {
      const { blocks } = yield* readDoc(
        "/components/filler#first",
        "/components/filler#second",
        "/components/big#first"
      );
      assert.isAtMost(blocks.join("").length, 100_000);
      assert.match(blocks[2] ?? "", /Ask for \/components\/big#first in a call of its own\.$/u);
      const alone = yield* readDoc("/components/big#first");
      assert.strictEqual(alone.blocks[0]?.length, blockLength("/components/big#first", 45_000, SECTIONS.big));
    }).pipe(Effect.scoped)
  );

  it.effect("answers eight long hrefs that name no section without suggestions", () =>
    Effect.gen(function* () {
      // 200 characters each, the most the schema admits, of a letter that URL encoding expands.
      const hrefs = Array.from(
        { length: 8 },
        (_, index) => `/components/button#${String(index)}${"ø".repeat(200 - "/components/button#0".length)}`
      );
      const { isError, blocks } = yield* readDoc(...hrefs);
      assert.isFalse(isError);
      for (const block of blocks) {
        assert.match(block, /^\/components\/button has no section #\dø+\.$/u);
      }
      const longer = yield* readDoc(`/components/button#${"ø".repeat(200)}`);
      assert.isTrue(longer.isError);
    }).pipe(Effect.scoped)
  );

  it.effect("answers arguments outside the bounds with an error result", () =>
    Effect.gen(function* () {
      const empty = yield* readDoc();
      const nine = yield* readDoc(...Array.from({ length: 9 }, () => "/components/button"));
      const notArray = yield* call("read_doc", { hrefs: "/components/button" });
      for (const { isError, blocks } of [empty, nine, notArray]) {
        assert.isTrue(isError);
        assert.match(blocks[0] ?? "", /^Invalid read_doc arguments: .*\n\s+at \["hrefs"\]/su);
      }
    }).pipe(Effect.scoped)
  );
});

describe("search_docs", () => {
  it.effect("answers with each hit's title, section href and excerpt", () =>
    Effect.gen(function* () {
      const { isError, blocks } = yield* call("search_docs", { query: "button pending prop", limit: 1 });
      assert.isFalse(isError);
      assert.deepStrictEqual(blocks, [
        "1. Button › Button\n   /components/button#api-button\n   Prop Type Description `isPending` `boolean` Whether an action is in flight. A pending button blocks presses.",
      ]);
    }).pipe(Effect.scoped)
  );

  it.effect("opens with a line that no page matches, and names the words a hit lacks", () =>
    Effect.gen(function* () {
      const { blocks } = yield* call("search_docs", { query: "button kanban", limit: 1 });
      assert.deepStrictEqual(blocks, [
        'No page matches every word of "button kanban".\n\n1. Button\n   /components/button#overview\n   Missing: "kanban"\n   Triggers an action.',
      ]);
    }).pipe(Effect.scoped)
  );

  it.effect("names the words a hit lacks without the opening line when one page holds them all", () =>
    Effect.gen(function* () {
      // The Button page holds "spinner" in #pending and "ignores" in #disabled.
      const { blocks } = yield* call("search_docs", { query: "spinner ignores", limit: 1 });
      assert.deepStrictEqual(blocks, [
        '1. Button › Disabled\n   /components/button#disabled\n   Missing: "spinner"\n   A disabled button ignores presses.',
      ]);
    }).pipe(Effect.scoped)
  );

  it.effect("answers arguments outside the bounds with an error result", () =>
    Effect.gen(function* () {
      const results = [
        yield* call("search_docs", { query: "" }),
        yield* call("search_docs", { query: "x".repeat(201) }),
        yield* call("search_docs", { query: "button", limit: 21 }),
        yield* call("search_docs", { query: "button", limit: 0 }),
      ];
      for (const { isError, blocks } of results) {
        assert.isTrue(isError);
        assert.match(blocks[0] ?? "", /^Invalid search_docs arguments: /u);
      }
    }).pipe(Effect.scoped)
  );
});

describe("tools/list", () => {
  it.effect(
    "marks both tools read-only and idempotent, and read_doc's result as up to 100,000 characters",
    () =>
      Effect.gen(function* () {
        const mcp = yield* client;
        const { tools } = yield* mcp.listTools();
        assert.deepStrictEqual(
          tools.map(({ name, annotations, _meta }) => ({
            name,
            readOnly: annotations?.readOnlyHint,
            idempotent: annotations?.idempotentHint,
            maxResultSizeChars: _meta?.["anthropic/maxResultSizeChars"],
          })),
          [
            { name: "search_docs", readOnly: true, idempotent: true, maxResultSizeChars: undefined },
            { name: "read_doc", readOnly: true, idempotent: true, maxResultSizeChars: 100_000 },
          ]
        );
      }).pipe(Effect.scoped)
  );
});
