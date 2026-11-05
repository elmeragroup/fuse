/**
 * The engine's release records through GitHub's REST API. GitHub's release-by-tag endpoint
 * answers a published release with its JSON and a draft or missing tag with 404 (checked against
 * elmeragroup/fuse's draft record canary-81d9b003… and published canary-699f103f…), so a 404 is a
 * record that is not published. Any other answer fails, rather than calling the record unpublished.
 *
 * It asks for nothing but the record tags it is given, at a URL built under `GITHUB_API_URL`
 * (`addresses.ts`), so the token goes to no other path.
 *
 * A lookup is a read, so it is retried by `http-retry.ts`'s policy: after a failure in transit, a
 * server error, or a rate limit, which GitHub answers with 429, or with 403 and either
 * `Retry-After` or a spent `x-ratelimit-remaining`.
 */

import { Config, Effect, Layer, Option, Result, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import type { HttpClientResponse } from "effect/http";

import { baseUrlSetting, PathSegment, repositorySetting, under } from "./addresses.ts";
import { attemptTimeout, describe, readJson } from "./http-retry.ts";
import { RecordsUnavailable, ReleaseRecords } from "./release-announcement.ts";
import * as ReleaseRecord from "./release-record.ts";
import type { RecordTag } from "./release-record.ts";

/** The path segments of `GET /repos/{owner}/{repo}/releases/tags/{tag}`. */
const REPOS = PathSegment.make("repos");
const RELEASES = PathSegment.make("releases");
const TAGS = PathSegment.make("tags");

/**
 * The product name every request carries, since GitHub refuses a request without a User-Agent
 * (https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#user-agent-required).
 */
const USER_AGENT = "elmeragroup-fuse-release-announcement";

/** The fields of GitHub's release response that a record is read from. */
const GitHubRelease = Schema.Struct({
  tag_name: Schema.String,
  html_url: Schema.String,
  published_at: Schema.String,
  body: Schema.String,
});

/** Whether a response is a rate limit or a server error, which a later read may not meet. */
function isThrottled(response: HttpClientResponse.HttpClientResponse): boolean {
  if (response.status === 429 || response.status >= 500) return true;
  return (
    response.status === 403 &&
    (response.headers["retry-after"] !== undefined || response.headers["x-ratelimit-remaining"] === "0")
  );
}

/**
 * Reads records with `GH_TOKEN` from the repository the Actions defaults name, at
 * `GITHUB_API_URL` (`https://api.github.com` unless set).
 */
export const layer = Layer.effect(
  ReleaseRecords,
  Effect.gen(function* () {
    const api = yield* baseUrlSetting("GITHUB_API_URL", "https://api.github.com");
    const { owner, name } = yield* repositorySetting("GITHUB_REPOSITORY");
    const settings = yield* Config.all({ token: Config.Redacted("GH_TOKEN"), timeout: attemptTimeout });
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest((request) =>
        request.pipe(
          HttpClientRequest.bearerToken(settings.token),
          HttpClientRequest.setHeader("accept", "application/vnd.github+json"),
          HttpClientRequest.setHeader("x-github-api-version", "2022-11-28"),
          HttpClientRequest.setHeader("user-agent", USER_AGENT)
        )
      )
    );

    /** The JSON at `url`, or none for 404, which is not retried. */
    const read = (url: URL, what: string) =>
      readJson(client.get(url), { read: what, timeout: settings.timeout, throttled: isThrottled }).pipe(
        Effect.map(Option.some),
        Effect.catchIf(
          (failure) => failure._tag === "Rejected" && failure.status === 404,
          () => Effect.succeedNone
        )
      );

    const published = Effect.fn("GitHubReleases.published")(function* (tag: RecordTag) {
      yield* Effect.annotateCurrentSpan({ tag });
      const unavailable = (reason: string) =>
        new RecordsUnavailable({ message: `GitHub ${reason} for ${tag}` });
      // A record tag is letters, digits, dots and dashes, so it is a path segment as it stands.
      const url = under(api, [REPOS, owner, name, RELEASES, TAGS, PathSegment.make(tag)]);
      const answer = yield* read(url, `GitHub's release ${tag}`).pipe(
        Effect.mapError((failure) => unavailable(describe(failure)))
      );
      if (Option.isNone(answer)) return Option.none();
      const release = yield* Schema.decodeUnknownEffect(GitHubRelease)(answer.value).pipe(
        Effect.mapError(() => unavailable("answered with a body that is not a release"))
      );
      if (release.tag_name !== tag)
        return yield* unavailable(`answered with ${JSON.stringify(release.tag_name)}`);
      const parsed = ReleaseRecord.parse({
        tag,
        url: release.html_url,
        publishedAt: release.published_at,
        body: release.body,
      });
      if (Result.isFailure(parsed)) return yield* parsed.failure;
      return Option.some(parsed.success);
    });

    return ReleaseRecords.of({ published });
  })
);
