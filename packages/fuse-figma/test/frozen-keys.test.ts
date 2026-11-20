/**
 * The kit's frozen keys. Unit under test: the built kit's page, set, variant, icon library, icon and
 * text style keys and its sets' component properties. Oracle: `oracles/keys.json`, the keys the kit
 * has frozen, which a published library's instances follow, written by `figma:keys` and reviewed in
 * each PR that adds to it.
 */
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import { readFileSync } from "node:fs";

import { buildKit } from "../src/components/build-kit.ts";
import { appendKeys, frozenKeys, keyDrift, NO_KEYS, parseFrozenKeys } from "../src/components/frozen-keys.ts";
import type { FrozenKeys } from "../src/components/frozen-keys.ts";
import type { KitSpec } from "../src/components/kit-spec.ts";

/** The keys `oracles/keys.json` holds. */
function frozen(): FrozenKeys {
  const parsed = parseFrozenKeys(readFileSync(new URL("../oracles/keys.json", import.meta.url), "utf8"));
  if (Result.isFailure(parsed)) {
    throw parsed.failure;
  }
  return parsed.success;
}

let built: Promise<KitSpec> | undefined;

/** The kit as `figma:plugin` builds it, built once for the file. */
async function kit(): Promise<KitSpec> {
  built ??= Effect.runPromise(buildKit().pipe(Effect.provide(NodeServices.layer))).then(({ spec }) => spec);
  return built;
}

describe("the kit's frozen keys", () => {
  it("are all in the build, and the build adds none oracles/keys.json lacks", async () => {
    const { missing, added } = keyDrift(frozen(), frozenKeys(await kit()));
    // A missing key was removed or renamed, which deletes what it named in a designer's file: build it
    // again, or remove it from the file in a change the owner approves, with a migration note. An added
    // key is new: append it with `pnpm figma:keys`.
    expect({ missing, added }).toEqual({ missing: [], added: [] });
  });

  // Apply finds an icon component among the library frame's children, so a renamed frame makes
  // it delete all 137 icons and create them anew, and every instance of one loses its main.
  it("lose a key when the build renames the icon library frame", async () => {
    const spec = await kit();
    const renamed = { ...spec, icons: { ...spec.icons, key: "icon-library" } };
    expect(keyDrift(frozen(), frozenKeys(renamed))).toEqual({
      missing: ["icons"],
      added: ["icon-library"],
    });
  });
});

describe("appending a build's keys", () => {
  it("adds the new keys and keeps every frozen one, a lost key included", () => {
    const held = {
      ...NO_KEYS,
      pages: ["page/a"],
      sets: ["a", "gone"],
      variants: ["a/x=1"],
      icons: ["icon/Gone"],
      properties: ["a TEXT Label"],
    };
    const build = {
      ...NO_KEYS,
      pages: ["page/a"],
      sets: ["a", "b"],
      variants: ["a/x=1", "b/x=1"],
      icons: ["icon/Plus"],
    };
    expect(appendKeys(held, build)).toEqual({
      ...NO_KEYS,
      pages: ["page/a"],
      sets: ["a", "b", "gone"],
      variants: ["a/x=1", "b/x=1"],
      icons: ["icon/Gone", "icon/Plus"],
      properties: ["a TEXT Label"],
    });
  });
});
