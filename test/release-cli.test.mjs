import { describe, expect, it } from "vitest";

import { USAGE, parseReleaseCommand } from "../scripts/release.ts";

const commit = "53d7c332e91b6755b2b3f546ed3a39320acf914f";

describe("parseReleaseCommand", () => {
  it("parses the check-pr, publish and retry forms", () => {
    expect(parseReleaseCommand(["check-pr"])).toEqual({ mode: "check-pr" });
    expect(parseReleaseCommand(["publish", commit])).toEqual({ mode: "publish", commit });
    expect(parseReleaseCommand(["retry", "canary-1234"])).toEqual({ mode: "retry", tag: "canary-1234" });
  });

  it("rejects a missing, empty, extra, or unknown target", () => {
    for (const argv of [
      [],
      ["publish"],
      ["publish", ""],
      ["publish", commit, "junk"],
      ["check-pr", "junk"],
      ["promote", "v1.0.0"],
    ]) {
      expect(() => parseReleaseCommand(argv)).toThrow(USAGE);
    }
  });
});
