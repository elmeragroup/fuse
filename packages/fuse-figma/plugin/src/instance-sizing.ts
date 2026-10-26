/**
 * How an instance sizes in its parent's auto layout: an instance layer inside a variant, and a preview
 * instance on a preview frame, share one sequence, so both write an axis the spec fixes FIXED before
 * its length (N4, G19).
 */

import type { SizingSpec } from "../../src/components/kit-spec.ts";
import { heldSizing, LAYOUT_SIZING, SIZING_MEMBERS } from "./fields.ts";
import type { Held, Run } from "./fields.ts";
import { change, changeTogether } from "./plan.ts";
import { planLength } from "./root-layer.ts";

/**
 * Plan how an instance sizes in its parent's auto layout, as one operation: an instance layer inside
 * a variant, or a preview instance. An axis the spec fixes is written FIXED first, since a real file
 * kept a hugging instance's height when its height bound a variable (N4), and a HUG dropped an
 * instance's width binding (G19). The lengths follow, written whatever they read on an axis that turns
 * FIXED, then the other axes' sizing, since a resize turns a filling axis fixed (P2).
 *
 * @param run - The run.
 * @param instance - The instance.
 * @param label - The instance's label, for change lines.
 * @param sizing - The sizing the spec gives the instance.
 * @param held - `unknown` when the run moves the instance's fill to the other axis or points it at
 *   another component, so the sizing and lengths are written whatever they read now.
 */
export function planInstanceSizing(
  run: Run,
  instance: InstanceNode,
  label: string,
  sizing: SizingSpec,
  held: Held
): void {
  const desired = {
    horizontal: LAYOUT_SIZING[sizing.horizontal.kind],
    vertical: LAYOUT_SIZING[sizing.vertical.kind],
  };
  const reads = held === "read" ? heldSizing(instance) : undefined;
  const writeSizing = (): void => {
    instance.layoutSizingHorizontal = desired.horizontal;
    instance.layoutSizingVertical = desired.vertical;
  };
  changeTogether(
    run.plan,
    label,
    (plan) => {
      const group = { ...run, plan };
      for (const [axis, member] of SIZING_MEMBERS) {
        if (sizing[axis].kind === "fixed" && reads?.[axis] !== "FIXED") {
          change(plan, label, `${member} → FIXED`, () => {
            instance[member] = "FIXED";
          });
        }
      }
      // An axis that turns FIXED holds the length it hugged or filled, a binding included (N4), so
      // its length is written whatever it reads now.
      const lengths = (axis: keyof SizingSpec): Held => (reads?.[axis] === "FIXED" ? "read" : "unknown");
      planLength(group, instance, label, "width", sizing.horizontal, lengths("horizontal"), (value) =>
        instance.resize(value, instance.height)
      );
      planLength(group, instance, label, "height", sizing.vertical, lengths("vertical"), (value) =>
        instance.resize(instance.width, value)
      );
      for (const [axis, member] of SIZING_MEMBERS) {
        if (sizing[axis].kind !== "fixed" && reads?.[axis] !== desired[axis]) {
          change(plan, label, `${member} → ${desired[axis]}`, writeSizing);
        }
      }
    },
    writeSizing
  );
}
