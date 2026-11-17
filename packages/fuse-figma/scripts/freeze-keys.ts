/**
 * `figma:keys`: append the built kit's new keys to `oracles/keys.json`, the frozen keys a published
 * library's instances follow. It only appends: a frozen key the build lost stays listed, and the
 * script names it, so the keys test keeps failing until the build holds it again or a reviewed change
 * removes it by hand.
 *
 *     pnpm --filter @elmeragroup/fuse-figma figma:keys
 */

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, FileSystem } from "effect";
import { fileURLToPath } from "node:url";

import { buildKit } from "../src/components/build-kit.ts";
import {
  appendKeys,
  formatFrozenKeys,
  frozenKeys,
  keyDrift,
  NO_KEYS,
  parseFrozenKeys,
} from "../src/components/frozen-keys.ts";

const KEYS = fileURLToPath(new URL("../oracles/keys.json", import.meta.url));

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const held = (yield* fs.exists(KEYS))
    ? yield* Effect.fromResult(parseFrozenKeys(yield* fs.readFileString(KEYS)))
    : NO_KEYS;
  const built = frozenKeys((yield* buildKit()).spec);
  const { missing, added } = keyDrift(held, built);
  yield* fs.writeFileString(KEYS, formatFrozenKeys(appendKeys(held, built)));
  yield* Console.log(`Appended ${String(added.length)} keys to ${KEYS}.`);
  if (missing.length > 0) {
    yield* Console.log(`The build lost ${String(missing.length)} frozen keys, which stay listed:`);
    for (const key of missing) {
      yield* Console.log(`  ${key}`);
    }
  }
});

program.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
