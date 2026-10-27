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
 * @param kit - The kit, the Button kit unless the case names another.
 * @returns The error.
 */
const failureOn = (figma: PluginAPI, kit = KIT) =>
  reconcile(false).pipe(
    Effect.provideService(FigmaPlugin, figma),
    Effect.provideService(Kit, kit),
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

  it.effect("fails with KitContradiction on a kit that lists a page key twice", () =>
    Effect.gen(function* () {
      const error = yield* failureOn(fixture("Roboto").file.figma, {
        ...KIT,
        pages: [...KIT.pages, ...KIT.pages],
      });
      assert.deepStrictEqual(
        { tag: error._tag, message: error.message },
        { tag: "KitContradiction", message: "The kit lists the page key page twice." }
      );
    })
  );

  it.effect("fails with FileNotSynced when a new label's family aliases a variable the file lacks", () =>
    Effect.gen(function* () {
      // The kit check finds `font-sans` by name. Its alias target is gone when the run follows it to
      // require the font of a set it creates, as after a designer deletes the brand variable.
      const { file } = fixture("Roboto", false);
      const gone = file.variable("Fuse brand", "light/external/private/font-sans").id;
      const variables: Pick<VariablesAPI, "getVariableByIdAsync"> = {
        getVariableByIdAsync: (id) =>
          id === gone ? Promise.resolve(null) : file.figma.variables.getVariableByIdAsync(id),
      };
      Reflect.setPrototypeOf(variables, file.figma.variables);
      const figma = { variables };
      Reflect.setPrototypeOf(figma, file.figma);
      // SAFETY: the object holds every member of the fake file through its prototype, with one
      // variables call that reports the brand variable gone.
      const error = yield* failureOn(figma as PluginAPI);
      if (error._tag !== "FileNotSynced") {
        return assert.fail(`expected FileNotSynced, got ${error._tag}`);
      }
      assert.deepStrictEqual(
        { collection: error.collection, message: error.message },
        { collection: "Fuse tokens", message: "font-sans aliases a variable the file does not hold." }
      );
    })
  );
});
