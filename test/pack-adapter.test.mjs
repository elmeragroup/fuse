import { describe, expect, it } from "vitest";

import { parseReleaseCommand } from "../scripts/lib/release-command.ts";
import { stampManifest } from "../scripts/pack-adapter.ts";
import { asRecord } from "./json-object.mjs";

const commit = "53d7c332e91b6755b2b3f546ed3a39320acf914f";
const intent = { channel: "canary", version: "0.2.0-canary.1", commit };

describe("parseReleaseCommand", () => {
  it("parses the checked-commit and retry forms", () => {
    expect(parseReleaseCommand(["main", commit])).toEqual({ mode: "main", commit });
    expect(parseReleaseCommand(["retry", "canary-1234"])).toEqual({ mode: "retry", tag: "canary-1234" });
  });

  it("rejects a missing target or an unknown mode", () => {
    for (const argv of [[], ["main"], ["promote", "v1.0.0"]]) {
      expect(() => parseReleaseCommand(argv)).toThrow(
        "Usage: pnpm release:run main <commit> | retry <record-tag>"
      );
    }
  });
});

describe("stampManifest", () => {
  it("stamps version and elmeraRelease while preserving unrelated manifest fields", () => {
    const original = `${JSON.stringify(
      {
        name: "@elmeragroup/ui",
        version: "0.0.0",
        exports: { ".": "./dist/index.js" },
      },
      null,
      2
    )}\n`;

    const stamped = asRecord(JSON.parse(stampManifest(original, intent)), "stamped manifest");
    expect(stamped).toEqual({
      name: "@elmeragroup/ui",
      version: intent.version,
      exports: { ".": "./dist/index.js" },
      elmeraRelease: { commit, channel: "canary" },
    });
  });

  it("rejects manifest text that is not valid JSON", () => {
    expect(() => stampManifest("{", intent)).toThrow("is not valid JSON");
  });

  it("rejects well-formed JSON that fails the manifest schema", () => {
    expect(() => stampManifest('"nope"', intent)).toThrow("is invalid");
  });
});
