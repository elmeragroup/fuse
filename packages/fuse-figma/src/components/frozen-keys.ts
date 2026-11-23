/**
 * The kit's frozen keys: what a published library's instances follow, which `oracles/keys.json`
 * holds. Plan and Apply find each node and local style the kit owns by its key: a variant or an
 * icon among its parent's children, a set or the icon library frame among the kit pages' top-level
 * nodes. A changed key on any of those makes Apply delete the old node and create a new one, and
 * every instance of a main it held, in any file, loses that main. So the freeze holds each key a
 * main's identity depends on: its set's or the icon library frame's, and its own. It also holds
 * the pages' keys, the text styles' keys, since a designer's text links a published style by its
 * key, and each set's component properties by type and name.
 *
 * Layer keys inside a variant are not frozen: a renamed sublayer loses the overrides a designer put
 * on it, which costs less than a lost variant, and the kit still needs to restructure layers. Doc
 * keys (`docs/…`) and preview keys draw nothing a designer instances, so they are not frozen either.
 */

import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import type { KitSpec } from "./kit-spec";

const FrozenKeysSchema = Schema.Struct({
  pages: Schema.Array(Schema.String),
  sets: Schema.Array(Schema.String),
  variants: Schema.Array(Schema.String),
  /** The icon library frame's key, which every icon component's identity sits under. */
  iconLibraries: Schema.Array(Schema.String),
  icons: Schema.Array(Schema.String),
  textStyles: Schema.Array(Schema.String),
  /** Each component property as `<set key> <TEXT | BOOLEAN | INSTANCE_SWAP> <name>`. */
  properties: Schema.Array(Schema.String),
});

/** The frozen keys, each list sorted, as `oracles/keys.json` holds them. */
export type FrozenKeys = typeof FrozenKeysSchema.Type;

/** The lists of {@link FrozenKeys}, in the order the file holds them. */
const LISTS = ["pages", "sets", "variants", "iconLibraries", "icons", "textStyles", "properties"] as const;

const sorted = (keys: Iterable<string>): readonly string[] => [...new Set(keys)].sort();

/**
 * The keys a kit holds that the freeze covers.
 *
 * @param kit - The kit.
 * @returns The keys, each list sorted.
 */
export function frozenKeys(kit: KitSpec): FrozenKeys {
  return {
    pages: sorted(kit.pages.map((page) => page.key)),
    sets: sorted(kit.componentSets.map((set) => set.key)),
    variants: sorted(kit.componentSets.flatMap((set) => set.variants.map((variant) => variant.key))),
    iconLibraries: [kit.icons.key],
    icons: sorted(kit.icons.icons.map((icon) => icon.key)),
    textStyles: sorted(kit.textStyles.map((style) => style.key)),
    properties: sorted(
      kit.componentSets.flatMap((set) => [
        ...set.textProperties.map((property) => `${set.key} TEXT ${property.name}`),
        ...(set.booleanProperties ?? []).map((property) => `${set.key} BOOLEAN ${property.name}`),
        ...set.swapProperties.map((property) => `${set.key} INSTANCE_SWAP ${property.name}`),
      ])
    ),
  };
}

/** How a build's keys differ from the frozen ones: what it lost and what it adds, each list sorted. */
export type KeyDrift = {
  /** Frozen keys the build no longer holds, removed or renamed. */
  readonly missing: readonly string[];
  /** Keys the build holds that the freeze does not list yet. */
  readonly added: readonly string[];
};

/**
 * Compare a build's keys with the frozen ones.
 *
 * @param frozen - The keys `oracles/keys.json` holds.
 * @param built - The build's keys.
 * @returns The keys the build lost and the ones it adds, across every list.
 */
export function keyDrift(frozen: FrozenKeys, built: FrozenKeys): KeyDrift {
  const missing = LISTS.flatMap((list) => {
    const held = new Set(built[list]);
    return frozen[list].filter((key) => !held.has(key));
  });
  const added = LISTS.flatMap((list) => {
    const held = new Set(frozen[list]);
    return built[list].filter((key) => !held.has(key));
  });
  return { missing: sorted(missing), added: sorted(added) };
}

/**
 * Append a build's new keys to the frozen ones. It never drops a frozen key, so a key the build
 * lost stays listed, and the test that compares them keeps failing until the build holds it again
 * or a reviewed change removes it by hand.
 *
 * @param frozen - The keys `oracles/keys.json` holds.
 * @param built - The build's keys.
 * @returns Every frozen key and every key the build adds, each list sorted.
 */
export function appendKeys(frozen: FrozenKeys, built: FrozenKeys): FrozenKeys {
  return {
    pages: sorted([...frozen.pages, ...built.pages]),
    sets: sorted([...frozen.sets, ...built.sets]),
    variants: sorted([...frozen.variants, ...built.variants]),
    iconLibraries: sorted([...frozen.iconLibraries, ...built.iconLibraries]),
    icons: sorted([...frozen.icons, ...built.icons]),
    textStyles: sorted([...frozen.textStyles, ...built.textStyles]),
    properties: sorted([...frozen.properties, ...built.properties]),
  };
}

/** No keys, the freeze before its first write. */
export const NO_KEYS: FrozenKeys = {
  pages: [],
  sets: [],
  variants: [],
  iconLibraries: [],
  icons: [],
  textStyles: [],
  properties: [],
};

/** `oracles/keys.json` does not parse as the frozen keys. */
export class FrozenKeysUnreadable extends Schema.TaggedError<FrozenKeysUnreadable>()("FrozenKeysUnreadable", {
  message: Schema.String,
}) {}

/**
 * Parse the text of `oracles/keys.json`.
 *
 * @param text - The file's text.
 * @returns The frozen keys, or `FrozenKeysUnreadable` with the schema's account of what is wrong.
 */
export function parseFrozenKeys(text: string): Result.Result<FrozenKeys, FrozenKeysUnreadable> {
  return Result.mapError(
    Schema.decodeResult(Schema.fromJsonString(FrozenKeysSchema))(text),
    (error) =>
      new FrozenKeysUnreadable({ message: `oracles/keys.json is no frozen keys file: ${error.message}` })
  );
}

/**
 * The text `oracles/keys.json` holds: one key per line, so a diff names each key added or lost.
 *
 * @param keys - The frozen keys.
 * @returns The file's text.
 */
export function formatFrozenKeys(keys: FrozenKeys): string {
  return `${JSON.stringify(keys, null, 2)}\n`;
}
