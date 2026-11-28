import * as Schema from "effect/Schema";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

import { Catalog } from "@elmeragroup/docs-catalog";

import { buildLibrary, CALL_BUDGET, HREFS_PER_CALL } from "../src/read-doc.ts";

// Unit under test: the room `read_doc` holds back for each href, on the catalog that
// `docs#generate` writes. Oracle: the call budget. A call may repeat an href, and each position
// holds its own reserve, so the worst call is the largest reserve at every position. When that
// fits, every href of any call gets its text or its over-budget answer whole, and `readDocs` never
// cuts a block short.

const catalogFile = join(import.meta.dirname, "..", "..", "docs", "src", "generated", "catalog.json");
const catalog = Schema.decodeSync(Schema.fromJsonString(Catalog))(readFileSync(catalogFile, "utf8"));

it("fits a full call of the largest reserve in the call budget", () => {
  const library = buildLibrary(catalog.documents, catalog.index, new URL("https://fuse.invalid"));
  const reserves = [
    library.llms.reserve,
    ...[...library.documents.values()].flatMap((entry) => [
      entry.whole.reserve,
      ...[...entry.sections.values()].map((selection) => selection.reserve),
    ]),
  ];

  expect(HREFS_PER_CALL * Math.max(...reserves)).toBeLessThanOrEqual(CALL_BUDGET);
});
