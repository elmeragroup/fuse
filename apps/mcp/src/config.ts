/**
 * The server's settings. The server reads them from the environment once, at startup. A missing or
 * malformed value fails startup with a `ConfigError` that names the variable.
 */

import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import type * as TokenBucket from "./token-bucket.ts";

/** A positive, finite number of tokens per second. */
const PositiveFinite = Schema.FiniteFromString.check(Schema.isGreaterThan(0));

/**
 * A positive whole number of tokens. A call takes a whole token, so a burst below one would refuse
 * every call, and a fraction above one admits no more calls than its whole part.
 */
const PositiveInt = Schema.FiniteFromString.check(Schema.isInt(), Schema.isGreaterThan(0));

/** The settings, as `Config` reads them from the environment. */
const settings = Config.all({
  port: Config.Port("PORT").pipe(Config.withDefault(8080)),
  catalogFile: Config.NonEmptyString("FUSE_CATALOG_FILE").pipe(Config.withDefault("catalog.json")),
  skillsDirectory: Config.NonEmptyString("FUSE_SKILLS_DIR").pipe(Config.withDefault("skills")),
  commit: Config.NonEmptyString("FUSE_COMMIT").pipe(Config.withDefault("development")),
  docsOrigin: Config.URL("FUSE_DOCS_ORIGIN").pipe(Config.withDefault(new URL("https://fuse.elmeragroup.no"))),
  toolCalls: Config.all({
    // token-bucket.ts gives the reasons for these defaults.
    refillPerSecond: Config.schema(PositiveFinite, "FUSE_TOOL_CALLS_PER_SECOND").pipe(Config.withDefault(50)),
    burst: Config.schema(PositiveInt, "FUSE_TOOL_CALL_BURST").pipe(Config.withDefault(200)),
  }),
});

/** The server's settings. */
export class ServerConfig extends Context.Service<
  ServerConfig,
  {
    /** The port the HTTP server listens on. */
    readonly port: number;
    /** The path of the docs catalog the docs generation pass writes. */
    readonly catalogFile: string;
    /** The folder that holds one folder per skill, each with its `SKILL.md`. */
    readonly skillsDirectory: string;
    /** The commit the server was built from, which `GET /healthz` answers and the server reports as its version. */
    readonly commit: string;
    /** The docs site's origin, which `read_doc` strips from an href and puts in the URL it answers with. */
    readonly docsOrigin: URL;
    /** The token bucket every tool call on this replica draws from. */
    readonly toolCalls: TokenBucket.Limits;
  }
>()("mcp/ServerConfig") {
  /**
   * The settings from the environment: `PORT`, `FUSE_CATALOG_FILE`, `FUSE_SKILLS_DIR`,
   * `FUSE_COMMIT`, `FUSE_DOCS_ORIGIN`, `FUSE_TOOL_CALLS_PER_SECOND` and `FUSE_TOOL_CALL_BURST`.
   * Each has a default, so the bundle starts with no variables set beside `catalog.json` and
   * `skills/` in the working directory.
   */
  static readonly layer = Layer.effect(ServerConfig, settings);
}
