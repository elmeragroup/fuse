/**
 * The failures `reconcile` reports in its error channel, with the one-variant kit of
 * `button-kit-fixture.ts` on the in-memory file in `fake-figma.ts`. A designer can fix each of
 * them, so each arrives as a tagged error rather than a defect. The oracles are the tags, the
 * context fields and the messages the plugin UI shows.
 */
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { fixture, KIT } from "./button-kit-fixture.ts";
import { createFakeFigma } from "./fake-figma.ts";
import { reconcile } from "./reconcile.ts";
import { FigmaPlugin, Kit } from "./services.ts";

/**
 * Plan the Button kit on a file and return the error that stopped the run.
 *
 * @param figma - The plugin API over the file.
 * @returns The error.
 */
const failureOn = (figma: PluginAPI) =>
  reconcile(false).pipe(
    Effect.provideService(FigmaPlugin, figma),
    Effect.provideService(Kit, KIT),
    Effect.flip
  );

describe("reconcile's failures", () => {
  it.effect("fails with FileNotSynced on a file the token sync never wrote", () =>
    Effect.gen(function* () {
      const error = yield* failureOn(createFakeFigma({ collections: [] }).figma);
      if (error._tag !== "FileNotSynced") {
        return assert.fail(`expected FileNotSynced, got ${error._tag}`);
      }
      assert.deepStrictEqual(
        { collection: error.collection, message: error.message },
        {
          collection: "Fuse tokens",
          message: "The file has no local collection named Fuse tokens. Run `figma:sync` on this file first.",
        }
      );
    })
  );

  it.effect("fails with FontUnavailable when the file's family cannot load", () =>
    Effect.gen(function* () {
      const error = yield* failureOn(fixture("Comic Sans").file.figma);
      if (error._tag !== "FontUnavailable") {
        return assert.fail(`expected FontUnavailable, got ${error._tag}`);
      }
      assert.deepStrictEqual(
        { font: error.font, message: error.message },
        {
          font: { family: "Comic Sans", style: "Medium" },
          message:
            "Button / Label needs the font Comic Sans Medium, which Figma cannot load. Install it, then run the plugin again.",
        }
      );
    })
  );
});
