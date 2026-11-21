/**
 * The values the synced variables give the kit's bound lengths, in the Figma modes a kit frame pins
 * for a page mode, for the suites that lay the built frames out as Figma does.
 */
import { Result } from "effect";

import { BRANDS } from "@elmeragroup/fuse/theme-catalog";

import type { PageMode } from "../src/capture/page-modes.ts";
import type { NumberSpec } from "../src/components/kit-spec.ts";
import { fuseVariableSet } from "../src/fuse-variable-set.ts";
import type { VariableSet } from "../src/variable-set.ts";

let synced: VariableSet | undefined;

/** The synced variable set, built on the first call and shared by every later one. */
function syncedVariables(): VariableSet {
  if (synced === undefined) {
    const result = fuseVariableSet();
    if (Result.isFailure(result)) {
      throw new Error(result.failure.message);
    }
    synced = result.success;
  }
  return synced;
}

/**
 * The Figma mode of each collection a kit frame pins for a page mode, by the names the sync gives
 * them. `Fuse brand` names each mode by the brand's display name, with the one segment a pinned brand
 * allows in parentheses.
 */
function figmaModes(mode: PageMode, variables: VariableSet): ReadonlyMap<string, string> {
  const brand = BRANDS[mode.body["data-theme-brand"]].displayName;
  const brandModes =
    variables.collections.find((collection) => collection.name === "Fuse brand")?.modes ?? [];
  const brandMode = brandModes.find((name) => name === brand || name.startsWith(`${brand} (`));
  if (brandMode === undefined) {
    throw new Error(`the synced variables hold no Fuse brand mode for ${brand}`);
  }
  return new Map([
    ["Fuse tokens", { light: "Light", dark: "Dark" }[mode.root["data-theme"]]],
    ["Fuse density", { dense: "Dense", comfortable: "Comfortable" }[mode.root["data-density"]]],
    ["Fuse identity", { neutral: "Neutral", branded: "Branded" }[mode.body["data-theme-identity"]]],
    ["Fuse segment", { private: "Private", company: "Company" }[mode.body["data-theme-segment"]]],
    ["Fuse brand", brandMode],
  ]);
}

/**
 * The pixels a number of the kit spec holds in a page mode: a literal's own, or the value the synced
 * variable it binds ends on, following each alias in the mode the frame pins for the alias's
 * collection, or in the collection's one mode, as Figma resolves it in a frame that pins the mode in
 * each collection.
 *
 * @param mode - The page mode.
 * @returns The resolver for that mode.
 * @throws When a bound variable holds no number the mode can resolve, or its aliases loop.
 */
export function lengthsIn(mode: PageMode): (spec: NumberSpec) => number {
  const variables = syncedVariables();
  const modes = figmaModes(mode, variables);
  const valueOf = (collection: string, name: string, seen: readonly string[]): number => {
    const owner = variables.collections.find((each) => each.name === collection);
    const variable = owner?.variables.find((each) => each.name === name);
    const [only, ...others] = owner?.modes ?? [];
    const modeName = modes.get(collection) ?? (others.length === 0 ? only : undefined);
    const value = modeName === undefined ? undefined : variable?.values.get(modeName);
    const at = `${collection}/${name}`;
    if (value === undefined || seen.includes(at)) {
      throw new Error(`${at} holds no value the test can resolve in ${JSON.stringify(mode)}`);
    }
    switch (value._tag) {
      case "Float":
        return value.value;
      case "Alias":
        return valueOf(value.target.collection, value.target.variable, [...seen, at]);
      default:
        throw new Error(`${at} holds a ${value._tag}, where a length binds a number`);
    }
  };
  return (spec) =>
    spec.kind === "literal" ? spec.value : valueOf(spec.variable.collection, spec.variable.name, []);
}
