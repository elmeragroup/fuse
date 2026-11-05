/**
 * A published release of `@elmeragroup/fuse`, as the release engine (`@elmeragroup/internal/release`)
 * records it. The engine keeps each release as a GitHub release whose tag names it and whose body is
 * a small JSON intent; the record turns from draft to published as the engine's last step.
 *
 * A record's tag is derived from its release: `v<version>` for a stable release and
 * `canary-<commit>` for a canary. A `Release` therefore holds no tag of its own, so a tag that
 * disagrees with its record cannot be represented; `parse` rejects a record whose body does not
 * name the release its tag does.
 */

import { Result, Schema } from "effect";
import { Url } from "effect/http";

/** A full, lower-case git commit SHA. */
export const CommitSha = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[0-9a-f]{40}$/u, { message: "a full commit SHA" })),
  Schema.brand("CommitSha")
);

/** A parsed commit SHA. */
export type CommitSha = typeof CommitSha.Type;

/** A stable version such as `1.2.3`, as Changesets writes it into the package manifest. */
export const StableVersion = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u, {
      message: "a stable version such as 1.2.3",
    })
  ),
  Schema.brand("StableVersion")
);

/** A parsed stable version. */
export type StableVersion = typeof StableVersion.Type;

/** A canary version such as `1.2.3-canary.4`, as the engine computes it. */
export const CanaryVersion = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-canary\.(?:0|[1-9]\d*)$/u, {
      message: "a canary version such as 1.2.3-canary.4",
    })
  ),
  Schema.brand("CanaryVersion")
);

/** A parsed canary version. */
export type CanaryVersion = typeof CanaryVersion.Type;

/** A record's tag: `v<stable version>` or `canary-<full commit SHA>`. */
export const RecordTag = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^(?:v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)|canary-[0-9a-f]{40})$/u, {
      message: "a v<version> or canary-<commit> tag",
    })
  ),
  Schema.brand("RecordTag")
);

/** A parsed record tag. */
export type RecordTag = typeof RecordTag.Type;

/**
 * The GitHub page of a release: an https URL of a lower-case host, an optional port and plain path
 * segments, written as the URL parser writes it back, so nothing in it is normalised away before
 * Slack links it.
 */
const ReleaseUrl = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*(?::\d+)?(?:\/[\w~@-][\w.~@-]*)+$/u, {
      message: "an https URL",
    }),
    Schema.makeFilter(
      (text) =>
        Result.match(Url.fromString(text), { onFailure: () => false, onSuccess: (url) => url.href === text }),
      { message: "an https URL as the URL parser writes it" }
    )
  ),
  Schema.brand("ReleaseUrl")
);

/** A parsed release page URL. */
type ReleaseUrl = typeof ReleaseUrl.Type;

/** A published stable release, recorded as `v<version>`. */
export const Stable = Schema.TaggedStruct("Stable", {
  version: StableVersion,
  commit: CommitSha,
  url: ReleaseUrl,
  /** When GitHub published the record, which is when the engine finished the release. */
  publishedAt: Schema.DateTimeUtcFromString,
});

/** A published stable release. */
export type Stable = typeof Stable.Type;

/** A published canary release, recorded as `canary-<commit>`. */
export const Canary = Schema.TaggedStruct("Canary", {
  version: CanaryVersion,
  commit: CommitSha,
  url: ReleaseUrl,
  /** When GitHub published the record, which is when the engine finished the release. */
  publishedAt: Schema.DateTimeUtcFromString,
});

/** A published canary release. */
export type Canary = typeof Canary.Type;

/**
 * A published release. Its JSON encoding carries a release between workflow jobs: the publish job
 * writes it and the notify job reads it back with this schema.
 */
export const Release = Schema.Union([Stable, Canary]);

/** A published release, stable or canary. */
export type Release = typeof Release.Type;

/** What the publish job hands the notify job: the release it published, as JSON. */
export const ReleaseJson = Schema.fromJsonString(Release);

/** A record that GitHub publishes but that does not read as the release its tag names. */
export class DamagedRecord extends Schema.TaggedError<DamagedRecord>()("DamagedRecord", {
  message: Schema.String,
}) {}

/**
 * The tag the engine records a stable release under.
 *
 * @param version - The stable version.
 * @returns `v<version>`.
 */
export function stableTag(version: StableVersion): RecordTag {
  // A StableVersion matches RecordTag's version pattern, so this never fails.
  return RecordTag.make(`v${version}`);
}

/**
 * The tag the engine records a canary of `commit` under.
 *
 * @param commit - The commit the canary was built from.
 * @returns `canary-<commit>`.
 */
export function canaryTag(commit: CommitSha): RecordTag {
  // A CommitSha matches RecordTag's commit pattern, so this never fails.
  return RecordTag.make(`canary-${commit}`);
}

/**
 * The tag a release is recorded under.
 *
 * @param release - The release.
 * @returns Its record tag.
 */
export function tagOf(release: Release): RecordTag {
  return release._tag === "Stable" ? stableTag(release.version) : canaryTag(release.commit);
}

/** The engine's JSON intent in a record's release body. */
const RecordBody = Schema.fromJsonString(
  Schema.Struct({
    schema: Schema.Literal(1),
    owner: Schema.Literal("elmera-release"),
    channel: Schema.Literals(["stable", "canary"]),
    version: Schema.String,
    commit: Schema.String,
  })
);

/** The fields of a published record, as GitHub lists them for its release. */
type PublishedRecord = {
  /** The tag GitHub was asked for and answered with. */
  readonly tag: RecordTag;
  /** The release's page. */
  readonly url: string;
  /** When GitHub published the release, in ISO 8601. */
  readonly publishedAt: string;
  /** The release body, the engine's JSON intent. */
  readonly body: string;
};

/**
 * Parses a published record into the release it records. The record must name the release its tag
 * does: a canary body must name the tag's commit, and a stable body the tag's version.
 *
 * @param record - The record's tag, page, publication time and body.
 * @returns The release, or `DamagedRecord` naming what does not read.
 */
export function parse(record: PublishedRecord): Result.Result<Release, DamagedRecord> {
  const damaged = (reason: string): Result.Result<never, DamagedRecord> =>
    Result.fail(new DamagedRecord({ message: `Release record ${record.tag} ${reason}` }));
  const body = Schema.decodeUnknownResult(RecordBody)(record.body);
  if (Result.isFailure(body)) return damaged(`has an unreadable body: ${oneLine(body.failure)}`);
  const fields = {
    version: body.success.version,
    commit: body.success.commit,
    url: record.url,
    publishedAt: record.publishedAt,
  };
  const decoded = Schema.decodeUnknownResult(Release)({
    _tag: body.success.channel === "stable" ? "Stable" : "Canary",
    ...fields,
  });
  if (Result.isFailure(decoded)) return damaged(`is damaged: ${oneLine(decoded.failure)}`);
  const release = decoded.success;
  if (tagOf(release) !== record.tag) return damaged(`records ${tagOf(release)}`);
  return Result.succeed(release);
}

/**
 * A Schema failure as one line naming what was expected and where.
 *
 * @param error - The failure.
 * @returns Its message without line breaks.
 */
function oneLine(error: Schema.SchemaError): string {
  return error.message.replaceAll(/\s*\n\s*/gu, " ");
}
