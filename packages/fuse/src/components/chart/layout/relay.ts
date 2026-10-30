/**
 * Whether a data update relays the plot. A bar or a missing tick that a data update mounts draws at
 * its target at once, so a mark that stays and shares a coordinate with it must draw its target at
 * once too, or the two part for the length of the tween. That happens when the update switches the
 * bars between their element and path forms, which replaces every bar, when it mounts a mark while
 * the value axis moves or a tween still glides the marks from an earlier domain, either of which
 * moves the baseline every bar stands on, or when it mounts a stacked segment in a slot where a segment of another series stays, whose
 * edges it shares. Such an update snaps every mark of the Root. Only element-form bars draw at their
 * target at once, so a model's series count only where a mounted Bar draws them, and only while
 * the bars draw as elements on both sides of the update. Path-form columns and the vertices of
 * lines and areas route every arrival, so they never relay but on a switch of form.
 */
import { barForm } from "./bar-geometry";
import type { CartesianModel } from "./cartesian-model";

/** A model and the key each of its slots' marks render under. */
export type KeyedModel = { readonly model: CartesianModel; readonly keys: readonly string[] };

/** One drawn bar or missing tick: its series, its stack, its slot's key, and which it draws. */
type Mark = {
  readonly series: string;
  readonly stack: string | undefined;
  readonly slot: string;
  readonly kind: "reading" | "missing";
};

/** Each drawn bar and missing tick of a model, by series and slot key, for the series bars draw. */
function marksOf({ model, keys }: KeyedModel, bars: ReadonlySet<string>): Map<string, Mark> {
  const marks = new Map<string, Mark>();
  const window = model.window;
  if (window === null || model.empty) return marks;
  for (const series of model.series) {
    if (!bars.has(series.key)) continue;
    for (let index = window.first; index <= window.last; index += 1) {
      const kind = series.readings[index]?.kind;
      const slot = keys[index] ?? String(index);
      if (kind === "reading" || kind === "missing") {
        marks.set(`${series.key} ${slot}`, { series: series.key, stack: series.stack, slot, kind });
      }
    }
  }
  return marks;
}

/**
 * Decide whether a data update relays the plot.
 *
 * @param previous - The model the marks draw now, and its slot keys.
 * @param next - The update's model, and its slot keys.
 * @param orientation - Root's orientation, which decides the bars' form with the model.
 * @param gliding - Whether a running tween set out from another domain, so the marks draw between two.
 * @param bars - The config keys a mounted Bar draws.
 * @returns Whether every mark of the Root snaps to the update.
 */
export function relaysPlot(
  previous: KeyedModel,
  next: KeyedModel,
  orientation: "vertical" | "horizontal",
  gliding: boolean,
  bars: ReadonlySet<string>
): boolean {
  if (bars.size === 0) return false;
  const form = barForm(next.model, orientation);
  if (barForm(previous.model, orientation) !== form) return true;
  if (form === "path") return false;
  const [lowBefore, highBefore] = previous.model.y.domain;
  const [low, high] = next.model.y.domain;
  const moved = lowBefore !== low || highBefore !== high;
  const before = marksOf(previous, bars);
  const after = marksOf(next, bars);
  const mounted = [...after]
    .filter(([key, mark]) => before.get(key)?.kind !== mark.kind)
    .map(([, mark]) => mark);
  if (mounted.length === 0) return false;
  if (moved || gliding) return true;
  // A stacked segment that mounts beside one of another series that stays shares that one's edges.
  return mounted.some(
    (mark) =>
      mark.kind === "reading" &&
      mark.stack !== undefined &&
      [...after.values()].some(
        (other) =>
          other.slot === mark.slot &&
          other.series !== mark.series &&
          other.stack === mark.stack &&
          before.get(`${other.series} ${other.slot}`)?.kind === other.kind
      )
  );
}
