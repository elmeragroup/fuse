/**
 * The theme studio's slot-to-tokens index: which component owns each `data-slot`, and the
 * tokens each component's recipe reads (the same list its Tokens-consumed section shows). The
 * studio's selection inspector reads it to list the tokens a clicked part reads. It is a small
 * module of its own, so the studio's client bundle never carries the component-page manifest.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { writtenSlots } from "../../../../../packages/fuse/test/written-slots.ts";
import { collectRecipeSources } from "../../../scripts/lib/sources.ts";
import type { TokenRef } from "../../lib/docs-model.ts";

/**
 * Every literal `data-slot` a module writes, once each in first-seen order. Fuse's own
 * `writtenSlots` owns the slot syntax, the same scan its source contracts run, so the index and
 * the package's density contract cannot read different slots out of one source.
 *
 * @param file - The module's path, which picks the parser's dialect and names a parse failure.
 * @param source - The module's source.
 * @throws Error when the module does not parse, a defect in package source.
 */
export function declaredSlots(file: string, source: string): readonly string[] {
  return [...new Set(writtenSlots(file, source))];
}

/** One module of a component's recipe surface. */
export type SlotSourceModule = { readonly path: string; readonly text: string };

/**
 * A component's recipe surface as modules: each TS source the docs pass reads for its tokens,
 * with its path, so a slot's owner is decided by where the module lives.
 *
 * @param dir - The component's directory.
 */
export function recipeModules(dir: string): readonly SlotSourceModule[] {
  return collectRecipeSources(dir)
    .files.filter((file) => !file.endsWith(".css"))
    .map((file) => ({ path: file, text: readFileSync(file, "utf8") }));
}

/** One documented component, as the index reads it. */
export type SlotTokenComponent = {
  readonly slug: string;
  /** Its own directory: a module inside it is the component's own, any other is imported. */
  readonly dir: string;
  /** Its recipe surface: its own modules and the package modules they import. */
  readonly modules: readonly SlotSourceModule[];
  /** The tokens its recipe reads. */
  readonly tokens: readonly TokenRef[];
};

/** Each slot's owning component, and each component's tokens. */
export type SlotTokenIndex = {
  readonly slots: Readonly<Record<string, string>>;
  readonly components: Readonly<Record<string, readonly string[]>>;
};

/** Whether `slug` names `slot`'s component: the slot is the slug or starts with `slug-`. */
function prefixes(slug: string, slot: string): boolean {
  return slot === slug || slot.startsWith(`${slug}-`);
}

function isInside(dir: string, file: string): boolean {
  const relative = path.relative(dir, file);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

/**
 * The owner among a slot's declaring components: the longest slug that prefixes the slot,
 * else the alphabetically first, so the input order never decides.
 */
function pickOwner(slot: string, slugs: readonly string[]): string | undefined {
  const named = slugs.filter((slug) => prefixes(slug, slot));
  if (named.length > 0) {
    return named.toSorted((left, right) => right.length - left.length || left.localeCompare(right))[0];
  }
  return slugs.toSorted((left, right) => left.localeCompare(right))[0];
}

/**
 * Indexes every slot under the component that owns it. A component's recipe surface includes
 * the parts it composes, so DataTable's surface declares Table's `vertical-table` too. A
 * component that declares the slot in its own directory owns it over components that only
 * import the declaring module; among equals, `pickOwner` decides.
 *
 * @param components - Every documented component.
 */
export function buildSlotTokenIndex(components: readonly SlotTokenComponent[]): SlotTokenIndex {
  const own = new Map<string, string[]>();
  const imported = new Map<string, string[]>();
  const slotsByPath = new Map<string, readonly string[]>();
  for (const { slug, dir, modules } of components) {
    for (const { path: file, text } of modules) {
      const declared = slotsByPath.get(file) ?? declaredSlots(file, text);
      slotsByPath.set(file, declared);
      const into = isInside(dir, file) ? own : imported;
      for (const slot of declared) {
        const slugs = into.get(slot) ?? [];
        if (!slugs.includes(slug)) into.set(slot, [...slugs, slug]);
      }
    }
  }
  const slots: Record<string, string> = {};
  for (const slot of new Set([...own.keys(), ...imported.keys()])) {
    const owner = pickOwner(slot, own.get(slot) ?? imported.get(slot) ?? []);
    if (owner !== undefined) slots[slot] = owner;
  }
  return {
    slots,
    components: Object.fromEntries(
      components.map(({ slug, tokens }) => [slug, tokens.map((token) => token.name)])
    ),
  };
}

/** The generated module the studio imports. */
export function renderSlotTokenIndex(index: SlotTokenIndex): string {
  return `import type { SlotTokenIndex } from "../studio/lib/slot-tokens";

/** Each \`data-slot\`'s owning component, and the tokens each component's recipe reads. */
export const STUDIO_SLOT_TOKENS: SlotTokenIndex = ${JSON.stringify(index)};
`;
}
