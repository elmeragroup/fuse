/**
 * Unit under test: how `buildKit` reports what the builder threw or a tool rejected with. Oracle:
 * the rule in `build-errors.ts`. A build error keeps its tag and message, an unclassified tool
 * failure becomes `KitToolFailed` with the tool's message, and a plain `Error` from a mapping
 * function stays a defect.
 */
import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";

import { failOnThrownBuildErrors, KitSourceInvalid, KitUnmappable, runTool } from "./build-errors.ts";

describe("failOnThrownBuildErrors", () => {
  it.effect("reports a build error a mapping function threw as a failure with its message", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        failOnThrownBuildErrors(
          Effect.sync(() => {
            throw new KitUnmappable({ message: "Button: the label needs a font family" });
          })
        )
      );
      assert.deepStrictEqual(
        [error._tag, error.message],
        ["KitUnmappable", "Button: the label needs a font family"]
      );
    })
  );

  it.effect("leaves a plain Error a defect", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        failOnThrownBuildErrors(
          Effect.sync(() => {
            throw new Error("an unclosed parenthesis in calc(");
          })
        )
      );
      assert.isTrue(Exit.isFailure(exit) && Cause.hasDies(exit.cause) && !Cause.hasFails(exit.cause));
    })
  );
});

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
