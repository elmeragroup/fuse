/**
 * Where the steps read, post and link. Each base URL is parsed once, where its setting is read,
 * and every URL under a base is built from path segments that cannot leave it: a segment is never
 * `.` or `..` and holds no `/`, `\`, `%`, `?` or `#`, so the URL parser has nothing to normalise
 * and a token sent to a built URL goes only where its base points.
 */

import { Config, Effect, Result, Schema } from "effect";
import { Url } from "effect/http";

/** A base URL, repository or path segment that does not parse, naming the setting it came from. */
export class InvalidAddress extends Schema.TaggedError<InvalidAddress>()("InvalidAddress", {
  message: Schema.String,
}) {}

/** The hosts a test server listens on, which alone may be reached over plain http. */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);

/**
 * Parses a base URL setting. It must be https, or http to a loopback host as a local stand-in
 * is, with no credentials, query or fragment and a usable port. The value is never repeated in
 * the error, since a URL with credentials in it would leak them into the log.
 *
 * @param name - The setting's name, for the error.
 * @param value - The setting's value.
 * @returns The base URL, or `InvalidAddress`.
 */
export function parseBaseUrl(name: string, value: string): Result.Result<URL, InvalidAddress> {
  const invalid = (reason: string) => Result.fail(new InvalidAddress({ message: `${name} ${reason}` }));
  const parsed = Url.fromString(value);
  // The parser refuses a port past 65535 along with anything else that is not a URL.
  if (Result.isFailure(parsed)) return invalid("is not a valid URL");
  const url = parsed.success;
  const loopback = url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !loopback) {
    return invalid("must be an https URL (plain http is accepted only for a loopback host)");
  }
  if (url.username !== "" || url.password !== "") return invalid("must not carry credentials");
  if (url.port === "0") return invalid("must not name port 0");
  // What remains past the path is a query or a fragment, even an empty one.
  if (url.href !== `${url.origin}${url.pathname}`) return invalid("must not carry a query or fragment");
  return Result.succeed(url);
}

/**
 * Reads a base URL setting, or `fallback` while it is unset.
 *
 * @param name - The setting's name.
 * @param fallback - The value an unset setting takes, if it may be unset.
 * @returns The base URL; fails with `InvalidAddress`, or a `ConfigError` when it is unset without
 *   a fallback.
 */
export const baseUrlSetting = (name: string, fallback?: string) =>
  Effect.gen(function* () {
    const setting = Config.String(name);
    const value = yield* fallback === undefined ? setting : setting.pipe(Config.withDefault(fallback));
    return yield* Effect.fromResult(parseBaseUrl(name, value));
  });

/** One segment of a URL path that the parser keeps as written. */
export const PathSegment = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^(?!\.{1,2}$)[\w.@~-]+$/u, {
      message: "a URL path segment of letters, digits and _ . @ ~ -, other than . or ..",
    })
  ),
  Schema.brand("PathSegment")
);

/** A path segment that cannot leave the path it is put in. */
export type PathSegment = typeof PathSegment.Type;

/**
 * The URL `segments` below `base`'s path. Since no segment can be `.` or `..` or hold a separator,
 * the result always lies under `base`, on its origin.
 *
 * @param base - A parsed base URL.
 * @param segments - The segments to add to its path.
 * @returns The URL, with `base`'s path and then the segments.
 */
export function under(base: URL, segments: readonly PathSegment[]): URL {
  return Url.mutate(base, (url) => {
    url.pathname = `${base.pathname.replace(/\/+$/u, "")}/${segments.join("/")}`;
  });
}

/** A GitHub repository, as `GITHUB_REPOSITORY` names it: an owner and a name. */
type Repository = { readonly owner: PathSegment; readonly name: PathSegment };

/**
 * Parses an `owner/name` repository, such as `elmeragroup/fuse`. Neither part may be `.` or `..`.
 *
 * @param name - The setting's name, for the error.
 * @param value - The setting's value.
 * @returns The repository, or `InvalidAddress`.
 */
export function parseRepository(name: string, value: string): Result.Result<Repository, InvalidAddress> {
  const parts = value.split("/");
  const owner = Schema.decodeUnknownOption(PathSegment)(parts[0]);
  const repository = Schema.decodeUnknownOption(PathSegment)(parts[1]);
  if (parts.length !== 2 || owner._tag === "None" || repository._tag === "None") {
    return Result.fail(new InvalidAddress({ message: `${name} must be an owner/name repository` }));
  }
  return Result.succeed({ owner: owner.value, name: repository.value });
}

/**
 * Reads a repository setting.
 *
 * @param name - The setting's name.
 * @returns The repository; fails with `InvalidAddress`, or a `ConfigError` when it is unset.
 */
export const repositorySetting = (name: string) =>
  Effect.gen(function* () {
    return yield* Effect.fromResult(parseRepository(name, yield* Config.String(name)));
  });
