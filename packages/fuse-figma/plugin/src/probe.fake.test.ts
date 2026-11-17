/**
 * The UX probe kit, `figma:plugin --sets`: Button, Text field, Alert and Select (open), and the sets
 * they instance. Unit under test: `buildProbe`, and the plugin's Apply and Plan over the probe it
 * builds. Oracles: the sets each named set instances, written out by hand from the kit's composites;
 * Apply, which writes the whole probe, so a Plan on the file it wrote lists nothing; and the rule that
 * a probe never deletes a set of the whole kit's file. `buildKit` already runs the kit check.
 */
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import type { FileSystem, Layer } from "effect";

import type { KitBuildError, ProbeSetUnknown } from "../../src/components/build-errors.ts";
import type { KitSpec } from "../../src/components/kit-spec.ts";
import { createFakeFigma } from "./fake-figma.ts";
import { appliedFile, kitFixture } from "./kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

/**
 * The spec builder's modules, which the test imports by path, as `capture-plan.fake.test.ts` does, so
 * the plugin's type check, whose library predates them, leaves them out.
 */
const PROBE = "../../src/components/probe-kit.ts";
const NODE_PLATFORM = "@effect/platform-node";

type Probe = {
  readonly buildProbe: (
    named: ReadonlySet<string>
  ) => Effect.Effect<{ readonly spec: KitSpec }, KitBuildError | ProbeSetUnknown, FileSystem.FileSystem>;
};
type NodePlatform = { readonly NodeFileSystem: { readonly layer: Layer.Layer<FileSystem.FileSystem> } };

/** The probe the owner publishes: four sets UX tries first. */
const NAMED = new Set(["button", "text-field", "alert", "select-open"]);

/** Build a probe of some sets. */
async function probeOf(
  named: ReadonlySet<string>
): Promise<Exit.Exit<KitSpec, KitBuildError | ProbeSetUnknown>> {
  // SAFETY: each path names the module whose exports the type above lists.
  const { buildProbe } = (await import(PROBE)) as Probe;
  // SAFETY: as above.
  const platform = (await import(NODE_PLATFORM)) as NodePlatform;
  return Effect.runPromiseExit(
    buildProbe(named).pipe(
      Effect.map(({ spec }) => spec),
      Effect.provide(platform.NodeFileSystem.layer)
    )
  );
}

let built: Promise<KitSpec> | undefined;

/** The probe of {@link NAMED}, built once for the file. */
function probe(): Promise<KitSpec> {
  built ??= probeOf(NAMED).then((exit) => {
    if (Exit.isFailure(exit)) {
      throw new Error(String(exit.cause));
    }
    return exit.value;
  });
  return built;
}

describe("the UX probe kit", () => {
  it("holds the named sets and every set they instance", async () => {
    const kit = await probe();
    // Button and Alert's action; Text field's label, input, description and error; and the open
    // Select's trigger, popup, rows, group label and separator.
    expect(kit.componentSets.map((set) => set.key).sort()).toEqual([
      "alert",
      "button",
      "field-description",
      "field-error",
      "input",
      "label",
      "menu-group-label",
      "menu-separator",
      "select-item",
      "select-open",
      "select-popup",
      "select-trigger",
      "text-field",
    ]);
    // The Field page's own example, Field, is no set the probe keeps, so it shows its first kept set.
    expect(kit.docs.find((record) => record.page === "page/field")?.example.componentSet).toBe("label");
  });

  it("names a set the kit does not build", async () => {
    const exit = await probeOf(new Set(["button", "no-such-set"]));
    expect(Exit.isFailure(exit) ? String(exit.cause) : "built").toContain(
      "The kit builds no set no-such-set to probe."
    );
  });

  it("lists nothing on a Plan after its Apply to a fresh file", async () => {
    const kit = await probe();
    const { collections } = await kitFixture();
    const file = createFakeFigma({ collections, unavailableFonts: [] });
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([]);
  });

  it("refuses a file the whole kit was applied to, where it would delete the sets it lacks", async () => {
    const kit = await probe();
    const file = await appliedFile();
    const plan = reconcileKit(file.figma, kit, false);
    await expect(plan).rejects.toMatchObject({ _tag: "ProbeOverKit" });
    await expect(plan).rejects.toThrow(/component sets the UX probe lacks, such as Accordion item/);
    await expect(plan).rejects.toThrow(/Apply the probe to a new file\./);
  });
});
