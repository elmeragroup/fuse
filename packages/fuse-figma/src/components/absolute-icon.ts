/**
 * Whether an absolute icon that `absolute-placement.ts` plans a place for keeps it. The capture must
 * hold the icon in the one shape the kit places (`capture/icon-acceptance.ts`), and the place the build
 * plans from the icon's declarations must be the place the capture measured, exactly: its size, and
 * on each axis the inset or centre offset the plan keeps, which the capture records only where it is
 * one length in every mode and as the box grows (`iconPlace`). Figma's MIN, MAX and CENTER then keep
 * the icon where CSS keeps it as the box resizes. Anywhere else the icon stays in its box's flow
 * with the reason.
 */
import type { PlacementPlan } from "./absolute-placement";
import type { IconAcceptance } from "./box-cascade";
import type { AxisPlacementSpec, NumberSpec } from "./kit-spec";

/** The measured values each kind of place on an axis keeps, and the edge or centre it names. */
const KEPT = {
  horizontal: {
    start: ["left", "left edge"],
    end: ["right", "right edge"],
    centre: ["across", "centre across"],
  },
  vertical: { start: ["top", "top edge"], end: ["bottom", "bottom edge"], centre: ["down", "centre down"] },
} as const;

/** The length a place on an axis keeps, in pixels, or undefined for a place that keeps a length. */
function keptLength(at: AxisPlacementSpec): number | undefined {
  switch (at.kind) {
    case "start":
      return at.start;
    case "end":
      return at.end;
    case "centre":
      return at.offset;
    case "stretch":
    case "scale":
      return undefined;
  }
}

/**
 * Why an absolute icon keeps no place, as the module says: the reason its shape is not the one the
 * kit places, which comes first, or the reason its planned place is not the one the capture
 * measured. Undefined where it keeps the plan, a refused plan included, whose own reason stands.
 *
 * @param acceptance - Whether the capture holds the icon in the shape the kit places (`IconCascade.acceptance`).
 * @param plan - The place `planPlacement` planned, or its refusal.
 * @param size - The icon's size, as its layer draws it.
 * @returns The reason, or undefined.
 */
export function iconPlaceRefusal(
  acceptance: IconAcceptance,
  plan: PlacementPlan,
  size: NumberSpec
): string | undefined {
  if (acceptance.kind === "refused") {
    return acceptance.why;
  }
  if (plan.kind === "refused") {
    return undefined;
  }
  const { place } = acceptance;
  if (size.kind !== "literal" || size.value !== place.width || size.value !== place.height) {
    const drawn = size.kind === "literal" ? `${String(size.value)}px` : "a variable";
    return `the kit draws the absolute icon at ${drawn}, where the capture measured it ${String(place.width)} × ${String(place.height)}px`;
  }
  for (const axis of ["horizontal", "vertical"] as const) {
    const { at } = plan[axis];
    const planned = keptLength(at);
    if (at.kind === "stretch" || at.kind === "scale" || planned === undefined) {
      return "the absolute icon's plan keeps a length of the box's, which an icon of its own size does not";
    }
    const [key, named] = KEPT[axis][at.kind];
    const measured = place[key];
    if (measured !== planned) {
      const found =
        measured === undefined ? "no one length in every mode and as the box grows" : `${String(measured)}px`;
      return `the build places the absolute icon's ${named} ${String(planned)}px from its box's, where the capture measured ${found}`;
    }
  }
  return undefined;
}
