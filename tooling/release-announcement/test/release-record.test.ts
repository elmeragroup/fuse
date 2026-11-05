import { assert, describe, expect, it } from "@effect/vitest";
import { Arbitrary, DateTime, Result, Schema } from "effect";

import * as ReleaseRecord from "../src/release-record.ts";
import { commit, olderCommit } from "./fixtures.ts";

// Unit under test: the ReleaseRecord domain module. Oracles: the engine's record tags
// (`v<version>`, `canary-<commit>`) and bodies (`{schema: 1, owner: "elmera-release", channel,
// version, commit}`), as the published canary-699f103f… record holds them.

const canaryTag = Schema.decodeUnknownSync(ReleaseRecord.RecordTag)(`canary-${commit}`);

/** The published canary record as GitHub answers for it, trimmed to the fields read. */
const canaryRecord = {
  tag: canaryTag,
  url: `https://github.com/elmeragroup/fuse/releases/tag/canary-${commit}`,
  publishedAt: "2026-11-05T09:15:14Z",
  body: JSON.stringify({
    schema: 1,
    owner: "elmera-release",
    channel: "canary",
    version: "0.1.0-canary.151",
    commit,
  }),
};

describe("a published record", () => {
  it("reads as the canary its tag names", () => {
    const release = Result.getOrThrow(ReleaseRecord.parse(canaryRecord));
    expect(release).toMatchObject({
      _tag: "Canary",
      version: "0.1.0-canary.151",
      commit,
      url: canaryRecord.url,
    });
    expect(DateTime.formatIso(release.publishedAt)).toBe("2026-11-05T09:15:14.000Z");
    expect(ReleaseRecord.tagOf(release)).toBe(`canary-${commit}`);
  });

  it("reads as the stable release its tag names", () => {
    const release = Result.getOrThrow(
      ReleaseRecord.parse({
        tag: Schema.decodeUnknownSync(ReleaseRecord.RecordTag)("v0.2.0"),
        url: "https://github.com/elmeragroup/fuse/releases/tag/v0.2.0",
        publishedAt: "2026-11-06T12:00:00Z",
        body: JSON.stringify({
          schema: 1,
          owner: "elmera-release",
          channel: "stable",
          version: "0.2.0",
          commit,
        }),
      })
    );
    expect(release).toMatchObject({ _tag: "Stable", version: "0.2.0", commit });
    expect(ReleaseRecord.tagOf(release)).toBe("v0.2.0");
  });

  it.each([
    {
      case: "a canary body naming another commit",
      body: { commit: olderCommit },
      message: `Release record canary-${commit} records canary-${olderCommit}`,
    },
    {
      case: "a stable body under a canary tag",
      body: { channel: "stable", version: "0.1.0" },
      message: `Release record canary-${commit} records v0.1.0`,
    },
    {
      case: "a canary version on the stable channel",
      body: { channel: "stable" },
      message: `Release record canary-${commit} is damaged: a stable version such as 1.2.3`,
    },
    {
      case: "a version that would write a further output line",
      body: { version: "0.1.0-canary.151\nchannel=stable" },
      message: `Release record canary-${commit} is damaged: a canary version such as 1.2.3-canary.4`,
    },
    {
      case: "a short commit",
      body: { commit: "699f103" },
      message: `Release record canary-${commit} is damaged: a full commit SHA`,
    },
    {
      case: "another owner",
      body: { owner: "someone-else" },
      message: `Release record canary-${commit} has an unreadable body`,
    },
  ])("is damaged for $case", ({ body, message }) => {
    const record = { ...canaryRecord, body: JSON.stringify({ ...JSON.parse(canaryRecord.body), ...body }) };
    const parsed = ReleaseRecord.parse(record);
    expect(Result.isFailure(parsed) && parsed.failure.message).toContain(message);
  });

  it.each([
    {
      case: "an http page",
      field: { url: "http://github.com/elmeragroup/fuse/releases" },
      message: "an https URL",
    },
    {
      case: "a page with credentials",
      field: { url: "https://bot:secret@github.com/elmeragroup/fuse/releases" },
      message: "an https URL",
    },
    {
      case: "a page the parser would rewrite",
      field: { url: "https://github.com/elmeragroup/fuse/../other/releases" },
      message: "an https URL",
    },
    {
      // The parser drops a scheme's default port, so the page would be linked as another text.
      case: "a page naming https's default port",
      field: { url: "https://github.com:443/elmeragroup/fuse/releases" },
      message: "an https URL as the URL parser writes it",
    },
    {
      case: "a page with a space",
      field: { url: "https://github.com/elmeragroup/fuse/releases x" },
      message: "an https URL",
    },
    { case: "a body that is not JSON", field: { body: "not json" }, message: "has an unreadable body" },
    { case: "a time that is not one", field: { publishedAt: "yesterday" }, message: "is damaged" },
  ])("is damaged for $case", ({ field, message }) => {
    const parsed = ReleaseRecord.parse({ ...canaryRecord, ...field });
    expect(Result.isFailure(parsed) && parsed.failure.message).toContain(message);
  });
});

describe("a release handed between jobs", () => {
  it.prop(
    "reads back as the release the publish job wrote, on one line",
    // Releases of every shape the record schemas admit, derived from the schemas themselves.
    { written: Arbitrary.schema(ReleaseRecord.Release) },
    ({ written }) => {
      const json = Schema.encodeSync(ReleaseRecord.ReleaseJson)(written);
      assert.notMatch(json, /[\r\n]/u);
      const read = Schema.decodeUnknownSync(ReleaseRecord.ReleaseJson)(json);
      assert.deepStrictEqual(read, written);
      assert.strictEqual(ReleaseRecord.tagOf(read), ReleaseRecord.tagOf(written));
    },
    { timeout: 120_000, arbitrary: { seed: 20_261_105, runs: 200, maxShrinks: 50 } }
  );
});
