import type { DensityRole } from "@elmeragroup/fuse/theme-catalog";

import { DENSITY_CATALOG } from "../../generated/density-catalog";

/** A part's resolved role, with the `PART_DENSITY` key it came from. */
export type PartRole = { readonly key: string; readonly role: DensityRole };

type Override = { readonly key: string; readonly suffix: string; readonly role: DensityRole };

/** `PART_DENSITY` indexed by slot: each slot's own role and its override keys in table order. */
export type PartRoleTable = {
  readonly slots: ReadonlyMap<string, DensityRole>;
  readonly overrides: ReadonlyMap<string, readonly Override[]>;
};

/** A key's slot and selector suffix: the suffix starts at the first `[` or `:`. */
const OVERRIDE_KEY = /^(?<slot>[a-z0-9-]+)(?<suffix>[[:].*)$/u;

/**
 * Indexes part keys and roles for {@link resolvePartRole}.
 *
 * @param entries - Each `PART_DENSITY` key with its role, in table order.
 */
export function partRoleTable(entries: readonly (readonly [string, DensityRole])[]): PartRoleTable {
  const slots = new Map<string, DensityRole>();
  const overrides = new Map<string, Override[]>();
  for (const [key, role] of entries) {
    const groups = OVERRIDE_KEY.exec(key)?.groups;
    const slot = groups?.slot;
    const suffix = groups?.suffix;
    if (slot === undefined || suffix === undefined) {
      slots.set(key, role);
    } else {
      overrides.set(slot, [...(overrides.get(slot) ?? []), { key, suffix, role }]);
    }
  }
  return { slots, overrides };
}

/**
 * The density role of one rendered part, as `PART_DENSITY` declares it: the first override key
 * of its slot, in table order, whose suffix the element matches, else the slot's own key.
 *
 * @param table - The indexed part keys.
 * @param slot - The element's `data-slot`.
 * @param matches - Whether the element matches a selector suffix, such as
 *   `element.matches(\`[data-slot="card"]${suffix}\`)`.
 * @returns The role and its key, or `undefined` for a slot the table does not declare.
 */
export function resolvePartRole(
  table: PartRoleTable,
  slot: string,
  matches: (suffix: string) => boolean
): PartRole | undefined {
  const override = table.overrides.get(slot)?.find(({ suffix }) => matches(suffix));
  if (override !== undefined) {
    return { key: override.key, role: override.role };
  }
  const role = table.slots.get(slot);
  return role === undefined ? undefined : { key: slot, role };
}

/**
 * Fuse's part table, from the generated density catalog. The catalog groups keys by role, so
 * overrides keep table order only within a role; no slot has overrides with different roles,
 * which keeps the first match the same one `PART_DENSITY` order gives.
 */
export const FUSE_PART_ROLES: PartRoleTable = partRoleTable(
  DENSITY_CATALOG.flatMap(({ role, parts }) => parts.map((part) => [part, role] as const))
);

/** A part the visitor points at or focuses in an artboard, as the inspector describes it. */
export type InspectedPart = PartRole & {
  /** The part's `data-slot`. */
  readonly slot: string;
  /**
   * The artboard it renders in. The inspector reads the artboard's density from its settings,
   * so a density change shows without pointing at the part again.
   */
  readonly artboard: string;
};

/**
 * The part to inspect next: `current` itself while the pointer stays on the same part, so
 * moving within one part does not update the inspector.
 */
export function keepInspected(current: InspectedPart | undefined, next: InspectedPart): InspectedPart {
  return current !== undefined &&
    current.slot === next.slot &&
    current.key === next.key &&
    current.role === next.role &&
    current.artboard === next.artboard
    ? current
    : next;
}
