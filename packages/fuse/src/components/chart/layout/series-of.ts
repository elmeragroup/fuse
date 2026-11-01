/**
 * A model's series by config key, indexed once per model, so a part or a per-slot loop that names a
 * series by key finds it without a scan.
 */
import type { CartesianModel, SeriesModel } from "./cartesian-model";

/** Each model's series by key. */
const byKey = new WeakMap<CartesianModel["series"], ReadonlyMap<string, SeriesModel>>();

/**
 * The series a config key names.
 *
 * @param model - Root's model, or anything that holds its series.
 * @param key - The config key.
 * @returns The series, or undefined for a key the model lacks.
 */
export function seriesOf(model: Pick<CartesianModel, "series">, key: string): SeriesModel | undefined {
  let index = byKey.get(model.series);
  if (index === undefined) {
    index = new Map(model.series.map((series) => [series.key, series]));
    byKey.set(model.series, index);
  }
  return index.get(key);
}
