import { describe, expect, it } from "vitest";

import { parseReleaseCommand } from "../scripts/release-command.ts";

const commit = "53d7c332e91b6755b2b3f546ed3a39320acf914f";

describe("parseReleaseCommand", () => {
  it("parses the checked-commit and retry forms", () => {
    expect(parseReleaseCommand(["main", commit])).toEqual({ mode: "main", commit });
    expect(parseReleaseCommand(["retry", "canary-1234"])).toEqual({ mode: "retry", tag: "canary-1234" });
  });

  it("rejects a missing, empty, extra, or unknown target", () => {
    for (const argv of [[], ["main"], ["main", ""], ["main", commit, "junk"], ["promote", "v1.0.0"]]) {
      expect(() => parseReleaseCommand(argv)).toThrow(
        "Usage: pnpm release:run main <commit> | retry <record-tag>"
      );
    }
  });
});
