import { PART_DENSITY } from "../src/theme/tokens/density-roles";

/**
 * A rendered part's `PART_DENSITY` role: the first override key of its slot, in table order, that
 * the part matches (the slot followed by a selector suffix starting with `[` or `:`), else the
 * slot's own key.
 */
export function declaredRole(element: Element): string | undefined {
  const slot = element.getAttribute("data-slot") ?? "";
  const entries = Object.entries(PART_DENSITY);
  const override = entries.find(([key]) => {
    const suffix = key.slice(slot.length);
    return key.startsWith(slot) && /^[[:]/u.test(suffix) && element.matches(`[data-slot="${slot}"]${suffix}`);
  });
  return (override ?? entries.find(([key]) => key === slot))?.[1];
}
