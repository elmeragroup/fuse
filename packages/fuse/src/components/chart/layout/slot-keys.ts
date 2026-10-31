/**
 * The keys marks render under, one per domain slot, after `.scratch/charts-v1/reviews/motion-decision.md`
 * rule 2. A slot keeps the key it had, so a pan or an update that shares slots keeps every
 * surviving node. An update that shares no slot with the old domain at the same interval pairs
 * slots by position from the domain start instead, so the bar at each position keeps its node and
 * moves to the new geometry.
 */
import type { XDomain } from "./x-domain";

/** The keys of one domain, beside the domain they key. */
export type SlotKeys = {
  readonly domain: XDomain;
  /** One key per slot, by slot index. */
  readonly keys: readonly string[];
};

/**
 * One slot's identity, its start instant on a time axis or its name on a category axis.
 *
 * @param domain - The domain.
 * @param slot - The slot.
 * @returns The identity, the slot's index for a slot the domain lacks.
 */
export function slotId(domain: XDomain, slot: number): string {
  return domain.kind === "time" ? String(domain.starts[slot] ?? slot) : (domain.names[slot] ?? String(slot));
}

/** Every slot's identity, its start instant on a time axis or its name on a category axis. */
function slotIds(domain: XDomain): readonly string[] {
  return domain.kind === "time" ? domain.starts.map(String) : domain.names;
}

/** Whether two domains count slots alike, so position pairing applies between them. */
function sameGrid(previous: XDomain, next: XDomain): boolean {
  if (previous.kind === "category" || next.kind === "category") return previous.kind === next.kind;
  return previous.interval === next.interval && previous.timeZone === next.timeZone;
}

/**
 * Key every slot of a new domain against the keys of the previous one.
 *
 * @param previous - The keys the marks rendered under last, or null on the first render.
 * @param domain - The new domain.
 * @returns The new keys, one per slot and unique within the domain.
 */
export function pairSlotKeys(previous: SlotKeys | null, domain: XDomain): SlotKeys {
  const ids = slotIds(domain);
  if (previous === null) return { domain, keys: ids };
  const oldIds = slotIds(previous.domain);
  const keyOf = new Map(oldIds.map((id, index) => [id, previous.keys[index] ?? id]));
  const shares = ids.some((id) => keyOf.has(id));
  const byPosition = !shares && sameGrid(previous.domain, domain);
  const paired = ids.map((id, index) => (byPosition ? previous.keys[index] : keyOf.get(id)));
  // Paired slots keep their keys first, so a fresh id that equals one of them takes a suffix.
  const used = new Set(paired.filter((key) => key !== undefined));
  const keys = ids.map((id, index) => {
    const kept = paired[index];
    if (kept !== undefined) return kept;
    let key = id;
    for (let suffix = 1; used.has(key); suffix += 1) key = `${id}~${String(suffix)}`;
    used.add(key);
    return key;
  });
  return { domain, keys };
}
