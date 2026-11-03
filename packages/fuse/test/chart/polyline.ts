/** A point in a plane, in whatever two coordinates a test reads, such as CSS pixels. */
export type PlanePoint = { readonly x: number; readonly y: number };

/**
 * How far a point lies from a polyline, the straight segments through a list of points in order: a
 * closed-form oracle for marks that ride a drawn line. A lone point is its own polyline.
 *
 * @param point - The point.
 * @param line - The polyline's points.
 * @returns The least distance to any of its segments, or infinity for an empty polyline.
 */
export function offPolyline(point: PlanePoint, line: readonly PlanePoint[]): number {
  let least = Number.POSITIVE_INFINITY;
  line.forEach((end, index) => {
    const start = line[index - 1] ?? end;
    const [dx, dy] = [end.x - start.x, end.y - start.y];
    const length = dx * dx + dy * dy;
    const share =
      length === 0
        ? 0
        : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length));
    least = Math.min(least, Math.hypot(point.x - start.x - dx * share, point.y - start.y - dy * share));
  });
  return least;
}
