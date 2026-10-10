import { STUDIO_TOKEN_NAMES } from "./tokens";
import type { TokenName } from "./tokens";

/**
 * Each `data-slot`'s owning component, and the tokens each component's recipe reads, as
 * `--name`. The docs generation pass writes Fuse's (`scripts/lib/slot-tokens.ts`).
 */
export type SlotTokenIndex = {
  readonly slots: Readonly<Record<string, string>>;
  readonly components: Readonly<Record<string, readonly string[]>>;
};

/** The part a press selects: its slot and how far up the chain it sits. */
export type NearestSlot = { readonly index: number; readonly slot: string };

/**
 * The nearest part at or above a pressed element.
 *
 * @param chain - The `data-slot` of the pressed element, then of each ancestor in turn,
 *   `undefined` or empty where an element has none.
 * @returns The first slot in the chain and its position, or `undefined` when none has one.
 */
export function nearestSlot(chain: readonly (string | undefined)[]): NearestSlot | undefined {
  const index = chain.findIndex((slot) => slot !== undefined && slot !== "");
  const slot = chain[index];
  return slot === undefined ? undefined : { index, slot };
}

/** A part's component and the role tokens it reads. */
export type PartTokens = { readonly component: string; readonly tokens: readonly TokenName[] };

/**
 * The role tokens a part reads: those of its slot's component that the studio edits, in the
 * contract's order. Metrics and other custom properties have no knob, so they are left out.
 *
 * @returns `undefined` for a slot no documented component declares.
 */
export function partTokens(index: SlotTokenIndex, slot: string): PartTokens | undefined {
  const component = index.slots[slot];
  const read = component === undefined ? undefined : index.components[component];
  if (component === undefined || read === undefined) {
    return undefined;
  }
  const names = new Set(read.map((name) => name.replace(/^--/u, "")));
  return { component, tokens: STUDIO_TOKEN_NAMES.filter((name) => names.has(name)) };
}
