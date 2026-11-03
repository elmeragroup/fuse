/**
 * Whether a data update relays the plot. A bar or a missing tick that a data update mounts draws at
 * its target at once, so a mark that stays and shares a coordinate with it must draw its target at
 * once too, or the two part for the length of the tween. That happens when the update switches the
 * bars between their element and path forms, which replaces every bar, when it mounts a mark while
 * its layout's value axis moves or a tween still glides that layout's marks from an earlier domain,
 * either of which moves the baseline the layout's bars stand on, or when it mounts a stacked segment in a slot where a segment of another series stays, whose
 * edges it shares. Such an update snaps every mark of the Root. Only element-form bars draw at their
 * target at once, so a model's series count only where a mounted Bar draws them, and only while
 * the bars draw as elements on both sides of the update. Path-form columns and the vertices of
 * lines and areas route every arrival, so they never relay but on a switch of form.
 */
import { barForm } from "./bar-geometry";
import type { CartesianModel } from "./cartesian-model";

/**
 * A model, the key each of its slots' marks render under, and the value domain of the layout each
 * config key draws in, Root's default layout or its Panel's.
 */
export type KeyedModel = {
  readonly model: CartesianModel;
  readonly keys: readonly string[];
  readonly domains: ReadonlyMap<string, readonly [number, number]>;
};

/** One drawn bar or missing tick: its series, its stack, its slot's key, and which it draws. */
type Mark = {
  readonly series: string;
  readonly stack: string | undefined;
  readonly slot: string;
  readonly kind: "reading" | "missing";
};

/** Each drawn bar and missing tick of a model, by series and slot key, for the series bars draw. */
function marksOf({ model, keys }: Omit<KeyedModel, "domains">, bars: ReadonlySet<string>): Map<string, Mark> {
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
 * @param gliding - The config keys whose layout's running tweens set out from another domain, so
 *   that layout's marks draw between two.
 * @param bars - The config keys a mounted Bar draws.
 * @returns Whether every mark of the Root snaps to the update.
 */
export function relaysPlot(
  previous: KeyedModel,
  next: KeyedModel,
  orientation: "vertical" | "horizontal",
  gliding: ReadonlySet<string>,
  bars: ReadonlySet<string>
): boolean {
  if (bars.size === 0) return false;
  const form = barForm(next.model, orientation);
  if (barForm(previous.model, orientation) !== form) return true;
  if (form === "path") return false;
  const moved = (key: string): boolean => {
    const [lowBefore, highBefore] = previous.domains.get(key) ?? [0, 1];
    const [low, high] = next.domains.get(key) ?? [0, 1];
    return lowBefore !== low || highBefore !== high;
  };
  const before = marksOf(previous, bars);
  const after = marksOf(next, bars);
  const mounted = [...after]
    .filter(([key, mark]) => before.get(key)?.kind !== mark.kind)
    .map(([, mark]) => mark);
  if (mounted.length === 0) return false;
  if (mounted.some((mark) => moved(mark.series) || gliding.has(mark.series))) return true;
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

/**
 * The series whose element-form bars or missing ticks a data update mounts, which draw at their
 * targets at once. A layout whose value domain the update moves, or whose marks still glide, relays
 * the plot when one of its series is among them. Path-form columns route every arrival, so a model
 * drawn as paths on either side mounts none.
 *
 * @param previous - The model the marks draw now, and its slot keys.
 * @param next - The update's model, and its slot keys.
 * @param orientation - Root's orientation, which decides the bars' form with the model.
 * @param bars - The config keys a mounted Bar draws.
 * @returns The series that mount a mark.
 */
export function mountedSeries(
  previous: Omit<KeyedModel, "domains">,
  next: Omit<KeyedModel, "domains">,
  orientation: "vertical" | "horizontal",
  bars: ReadonlySet<string>
): ReadonlySet<string> {
  if (bars.size === 0) return new Set();
  if (barForm(previous.model, orientation) === "path" || barForm(next.model, orientation) === "path") {
    return new Set();
  }
  const before = marksOf(previous, bars);
  return new Set(
    [...marksOf(next, bars)]
      .filter(([key, mark]) => before.get(key)?.kind !== mark.kind)
      .map(([, mark]) => mark.series)
  );
}
