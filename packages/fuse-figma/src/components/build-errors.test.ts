/**
 * Unit under test: how `runTool` reports what a tool rejected with. Oracle: the rule in
 * `build-errors.ts`. A `KitSourceInvalid` a tool's callback threw keeps its tag and message, and any
 * other rejection becomes `KitToolFailed` with the tool's message.
 */
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { KitSourceInvalid, runTool } from "./build-errors.ts";

describe("runTool", () => {
  it.effect("keeps a build error the tool's callback threw, and wraps any other rejection", () =>
    Effect.gen(function* () {
      const kept = yield* Effect.flip(
        runTool("tailwindcss", () =>
          Promise.reject(new KitSourceInvalid({ message: "fuse.css imports no stylesheet named x.css" }))
        )
      );
      const wrapped = yield* Effect.flip(
        runTool("rolldown", () => Promise.reject(new Error("Could not resolve ./missing")))
      );
      assert.deepStrictEqual(
        [kept._tag, kept.message, wrapped._tag, wrapped.message],
        [
          "KitSourceInvalid",
          "fuse.css imports no stylesheet named x.css",
          "KitToolFailed",
          "Could not resolve ./missing",
        ]
      );
    })
  );
});
