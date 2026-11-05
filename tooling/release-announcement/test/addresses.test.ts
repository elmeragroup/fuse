import { Option, Result, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { parseBaseUrl, parseRepository, PathSegment, under } from "../src/addresses.ts";

// Unit under test: the addresses module. Oracles: the WHATWG URL standard as Node's URL implements
// it (what a parsed URL's parts read back as, and that `..` and `%2e%2e` path segments are dot
// segments it removes), and the policy for a base URL: https, or http to a loopback host, with no
// credentials, query or fragment and a port from 1 to 65535.

const segment = (text: string) => Schema.decodeUnknownSync(PathSegment)(text);

describe("a base URL setting", () => {
  it.each([
    { value: "https://api.github.com", href: "https://api.github.com/" },
    { value: "https://ghe.example/api/v3/", href: "https://ghe.example/api/v3/" },
    { value: "https://slack.com:8443/api", href: "https://slack.com:8443/api" },
    { value: "http://127.0.0.1:52011", href: "http://127.0.0.1:52011/" },
    { value: "http://[::1]:52011/api", href: "http://[::1]:52011/api" },
    { value: "http://localhost:52011", href: "http://localhost:52011/" },
  ])("accepts $value", ({ value, href }) => {
    expect(Result.map(parseBaseUrl("API", value), (url) => url.href)).toEqual(Result.succeed(href));
  });

  it.each([
    { case: "a remote host over plain http", value: "http://api.github.com", reason: "must be an https URL" },
    {
      case: "a host that only starts like a loopback one",
      value: "http://127.0.0.1.example",
      reason: "https",
    },
    { case: "another scheme", value: "ftp://api.github.com", reason: "must be an https URL" },
    { case: "a port past 65535", value: "https://api.github.com:99999", reason: "is not a valid URL" },
    { case: "port 0", value: "https://api.github.com:0", reason: "must not name port 0" },
    { case: "a query", value: "https://api.github.com/?per_page=1", reason: "query or fragment" },
    { case: "an empty query", value: "https://api.github.com/?", reason: "query or fragment" },
    { case: "a fragment", value: "https://slack.com/api#top", reason: "query or fragment" },
    { case: "something that is not a URL", value: "api.github.com", reason: "is not a valid URL" },
  ])("refuses $case", ({ value, reason }) => {
    const parsed = parseBaseUrl("GITHUB_API_URL", value);
    expect(Result.isFailure(parsed) && parsed.failure.message).toContain(reason);
    expect(Result.isFailure(parsed) && parsed.failure.message.startsWith("GITHUB_API_URL ")).toBe(true);
  });

  it("refuses credentials without repeating them", () => {
    const parsed = parseBaseUrl("SLACK_API_URL", "https://bot:xoxb-secret@slack.com/api");
    expect(Result.isFailure(parsed) && parsed.failure.message).toBe(
      "SLACK_API_URL must not carry credentials"
    );
  });
});

describe("a URL under a base", () => {
  it.each([
    {
      base: "https://api.github.com",
      segments: ["repos", "elmeragroup", "fuse", "releases", "tags", "v0.1.0"],
      href: "https://api.github.com/repos/elmeragroup/fuse/releases/tags/v0.1.0",
    },
    {
      base: "https://ghe.example/api/v3/",
      segments: ["repos", "elmeragroup", "fuse"],
      href: "https://ghe.example/api/v3/repos/elmeragroup/fuse",
    },
    {
      base: "https://www.npmjs.com",
      segments: ["package", "@elmeragroup", "fuse", "v", "0.1.0-canary.151"],
      href: "https://www.npmjs.com/package/@elmeragroup/fuse/v/0.1.0-canary.151",
    },
  ])("puts $segments below $base", ({ base, segments, href }) => {
    const url = under(Result.getOrThrow(parseBaseUrl("BASE", base)), segments.map(segment));
    expect(url.href).toBe(href);
    // Read back through the parser, the path ends in exactly the segments written.
    expect(url.pathname.split("/").slice(-segments.length)).toEqual(segments);
  });

  it("leaves its base as it was", () => {
    const base = Result.getOrThrow(parseBaseUrl("BASE", "https://slack.com/api"));
    under(base, [segment("chat.postMessage")]);
    expect(base.href).toBe("https://slack.com/api");
  });

  it.each(["..", ".", "%2e%2e", "%2E.", "a/b", "a\\b", "a?b", "a#b", "", "a b"])(
    "has no segment %j, which the parser would remove, split or end the path at",
    (text) => {
      expect(Option.isNone(Schema.decodeUnknownOption(PathSegment)(text))).toBe(true);
    }
  );
});

describe("a repository setting", () => {
  it("reads an owner and a name", () => {
    expect(parseRepository("GITHUB_REPOSITORY", "elmeragroup/fuse")).toEqual(
      Result.succeed({ owner: "elmeragroup", name: "fuse" })
    );
  });

  it.each([
    "../fuse",
    "elmeragroup/..",
    "elmeragroup/fuse/extra",
    "fuse",
    "elmeragroup/fuse; rm",
    "/fuse",
    "a/",
  ])("refuses %j", (value) => {
    const parsed = parseRepository("GITHUB_REPOSITORY", value);
    expect(Result.isFailure(parsed) && parsed.failure.message).toBe(
      "GITHUB_REPOSITORY must be an owner/name repository"
    );
  });
});
