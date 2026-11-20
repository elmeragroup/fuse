/**
 * The kit check's hold on preview coverage of BOOLEAN properties.
 *
 * Unit under test: `checkKitSpec` over the built kit and over the kit with its Item previews edited.
 * Oracle: the rule that every BOOLEAN property is placed by some preview instance at `true` and by
 * some at `false`, each instance at the value it sets or else at the property's default, written out
 * here for Item's `Media`, which starts true.
 */
import { Result } from "effect";
import { describe, expect, it } from "vitest";

import { checkKitSpec } from "../../src/components/kit-check.ts";
import type { KitSpec } from "../../src/components/kit-spec.ts";
import { base64Decode } from "./fake/paints.ts";
import { kitFixture } from "./kit-fixture.ts";

/** The kit with every Item preview instance setting `Media` to one value. */
function withItemMedia(kit: KitSpec, value: boolean): KitSpec {
  return {
    ...kit,
    previews: kit.previews.map((preview) => ({
      ...preview,
      groups: preview.groups.map((group) =>
        group.componentSet !== "item"
          ? group
          : {
              ...group,
              instances: group.instances.map((instance) => ({
                ...instance,
                booleans: { ...instance.booleans, Media: value },
              })),
            }
      ),
    })),
  };
}

/** The check's verdict: `accepted`, or the contradiction's message. */
function verdict(kit: KitSpec): string {
  const checked = checkKitSpec(kit, base64Decode);
  return Result.isSuccess(checked) ? "accepted" : checked.failure.message;
}

describe("the kit check's preview coverage of BOOLEAN properties", () => {
  it("accepts the built kit", async () => {
    const { kit } = await kitFixture();
    expect(verdict(kit)).toBe("accepted");
  });

  it.each([
    [false, "Item: no preview places its Media property at true, so no comparison renders that state."],
    [true, "Item: no preview places its Media property at false, so no comparison renders that state."],
  ])("refuses a kit whose every Item preview sets Media to %s", async (value, message) => {
    const { kit } = await kitFixture();
    expect(verdict(withItemMedia(kit, value))).toBe(message);
  });
});
