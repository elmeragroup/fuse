/**
 * The two tools, `search_docs` and `read_doc`. Each tool defines its input as one schema. The
 * server generates the advertised input schema from it, and the handler decodes the call's
 * arguments with it, so a client cannot pass what the advertised schema rules out. Both tools
 * answer in plain text, with no `structuredContent`, so the agent reads markdown rather than
 * escaped JSON.
 */

import * as McpSchema from "effect/ai/McpSchema";
import * as McpServer from "effect/ai/McpServer";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { Catalog } from "./catalog.ts";
import * as ReadDoc from "./read-doc.ts";
import * as Search from "./search.ts";

/** The `search_docs` arguments. */
const SearchDocsInput = Schema.Struct({
  query: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)).annotate({
    description: "A component, a prop, a task or a description of the UI, in 1 to 200 characters.",
  }),
  limit: Schema.optionalKey(
    Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 20 })).annotate({
      description: "The most results to return, 1 to 20. Defaults to 8.",
    })
  ),
});

/** The `read_doc` arguments. */
const ReadDocInput = Schema.Struct({
  // The longest real href, with the origin, .md and the longest fragment, is under 110 characters.
  hrefs: Schema.Array(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)))
    .check(Schema.isMinLength(1), Schema.isMaxLength(ReadDoc.HREFS_PER_CALL))
    .annotate({
      description: `1 to ${String(ReadDoc.HREFS_PER_CALL)} docs hrefs of at most 200 characters each, such as /components/button or /components/button#api-reference, with or without the docs origin and .md. /llms.txt returns the index of every page.`,
    }),
});

/** The input schema a tool advertises, generated from the schema its handler decodes with. */
function inputSchemaOf(schema: Schema.Top): McpSchema.ToolJson {
  const document = Schema.toJsonSchemaDocument(schema);
  return { ...document.schema, type: "object" };
}

/** Both tools read the catalog and change nothing, so a client may call them freely and repeat them. */
const READ_ONLY: McpSchema.ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

/** A result that holds text blocks and nothing else. */
function textResult(blocks: readonly string[]): McpSchema.CallToolResult {
  return new McpSchema.CallToolResult({ content: blocks.map((text) => ({ type: "text", text })) });
}

/**
 * Decodes a call's arguments, then answers with `answer`. When the schema rejects the arguments,
 * the handler answers with a tool result that sets `isError`, which the agent reads and corrects,
 * rather than a protocol error.
 */
function handler<S extends Schema.Top & { readonly DecodingServices: never }>(
  name: string,
  schema: S,
  answer: (input: S["Type"]) => readonly string[]
) {
  const decode = Schema.decodeUnknownEffect(schema);
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- this is the parse step: addTool hands over the call's arguments unchecked, and the schema decodes them here
  return (payload: unknown) =>
    decode(payload).pipe(
      Effect.map((input) => textResult(answer(input))),
      Effect.catchTag("SchemaError", (error) =>
        Effect.succeed(
          new McpSchema.CallToolResult({
            isError: true,
            content: [{ type: "text", text: `Invalid ${name} arguments: ${error.message}` }],
          })
        )
      ),
      Effect.withSpan(`tool.${name}`)
    );
}

/** The line under a hit's href that names the query words it lacks, or nothing for a full match. */
function missingLine(hit: Search.Hit): string {
  if (hit.missing.length === 0) return "";
  return `\n   Missing: ${hit.missing.map((word) => `"${word}"`).join(", ")}`;
}

/**
 * The lines `search_docs` answers with. When the best hit lacks a word and no page holds every
 * word, the answer opens by saying so, because then the docs do not cover the query.
 */
function searchAnswer(index: Search.SearchIndex, query: string, limit: number): string {
  const hits = Search.search(index, query, limit);
  if (hits.length === 0) {
    return `Nothing matches "${query}". Try other words, or read /llms.txt for the list of every page.`;
  }
  const list = hits
    .map(
      (hit, rank) => `${String(rank + 1)}. ${hit.title}\n   ${hit.href}${missingLine(hit)}\n   ${hit.excerpt}`
    )
    .join("\n\n");
  const uncovered = (hits[0]?.missing.length ?? 0) > 0 && !Search.somePageHoldsAll(index, query);
  return uncovered ? `No page matches every word of "${query}".\n\n${list}` : list;
}

/** Registers `search_docs` and `read_doc` on the server, over the decoded catalog. */
export const ToolsLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    const { library, search } = yield* Catalog;
    yield* server.addTool({
      tool: new McpSchema.Tool({
        name: "search_docs",
        title: "Search the Fuse docs",
        description:
          'Searches the Fuse docs, which hold a page per component with its API reference and examples, and the handbook. Each result is a page title, an href to the best-matching section, and an excerpt. A result that lacks some of the query\'s words has a Missing line that names them, and an answer that opens with "No page matches every word" found no page that holds them all, so the docs may not cover what you asked. Pass the href to read_doc.',
        inputSchema: inputSchemaOf(SearchDocsInput),
        annotations: READ_ONLY,
      }),
      annotations: Context.empty(),
      handle: handler("search_docs", SearchDocsInput, ({ query, limit }) => [
        searchAnswer(search, query, limit ?? 8),
      ]),
    });
    yield* server.addTool({
      tool: new McpSchema.Tool({
        name: "read_doc",
        title: "Read Fuse docs pages",
        description: `Reads Fuse docs pages or sections as markdown, one text block per href in request order. An href with a fragment returns that section and every section under it, ending on a Sections: line that lists the page's second-level sections. #overview is the title and lede, #api-reference the whole API reference, and #api-<part> one part. One call returns at most ${String(ReadDoc.CALL_BUDGET)} characters. A page or section that does not fit comes back as its size and the hrefs of the sections under it, to read in later calls.`,
        inputSchema: inputSchemaOf(ReadDocInput),
        annotations: READ_ONLY,
        // Claude Code saves a text result over 50,000 characters to a file unless the tool declares a larger size.
        _meta: { "anthropic/maxResultSizeChars": ReadDoc.CALL_BUDGET },
      }),
      annotations: Context.empty(),
      handle: handler("read_doc", ReadDocInput, ({ hrefs }) => ReadDoc.readDocs(library, hrefs)),
    });
  })
);
