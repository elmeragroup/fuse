/**
 * The docs catalog the server answers from. The layer reads and decodes the file once at startup
 * and builds the search index over it. A catalog that does not read or decode fails startup, so
 * `/healthz` never answers for a server without docs.
 */

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { Catalog as CatalogSchema } from "@elmeragroup/docs-catalog";

import { ServerConfig } from "./config.ts";
import * as ReadDoc from "./read-doc.ts";
import * as Search from "./search.ts";

/** Reading the catalog file failed. */
export class CatalogUnreadable extends Schema.TaggedError<CatalogUnreadable>()("CatalogUnreadable", {
  message: Schema.String,
  file: Schema.String,
  cause: Schema.Defect(),
}) {}

/** The catalog file is not a catalog the schema decodes. */
export class CatalogInvalid extends Schema.TaggedError<CatalogInvalid>()("CatalogInvalid", {
  message: Schema.String,
  file: Schema.String,
}) {}

const decodeCatalog = Schema.decodeEffect(Schema.fromJsonString(CatalogSchema));

/** The decoded docs catalog and the search index over it. */
export class Catalog extends Context.Service<
  Catalog,
  {
    /** The documents and the index, indexed for `read_doc`. */
    readonly library: ReadDoc.Library;
    /** The search index, for `search_docs`. */
    readonly search: Search.SearchIndex;
  }
>()("mcp/Catalog") {
  /** Reads `FUSE_CATALOG_FILE`, decodes it and builds the search index. */
  static readonly layer = Layer.effect(
    Catalog,
    Effect.gen(function* () {
      const { catalogFile, docsOrigin } = yield* ServerConfig;
      const fs = yield* FileSystem.FileSystem;
      const text = yield* fs.readFileString(catalogFile).pipe(
        Effect.mapError(
          (cause) =>
            new CatalogUnreadable({
              message: `Reading the docs catalog ${catalogFile} failed.`,
              file: catalogFile,
              cause,
            })
        )
      );
      const catalog = yield* decodeCatalog(text).pipe(
        Effect.mapError(
          (error) =>
            new CatalogInvalid({
              message: `The docs catalog ${catalogFile} does not match its schema: ${error.message}`,
              file: catalogFile,
            })
        )
      );
      return Catalog.of({
        library: ReadDoc.buildLibrary(catalog.documents, catalog.index, docsOrigin),
        search: Search.buildIndex(catalog.documents),
      });
    }).pipe(Effect.withSpan("Catalog.load"))
  );
}
