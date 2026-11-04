/**
 * A uniform grid over a plot's points, for the pointer's nearest-point pick. The grid lies over
 * shares of the plot, 0 to 1 on each axis, so it survives any plot size, and a query measures in
 * pixels, so a point that looks nearer is nearer whatever the plot's aspect. The grid holds about
 * two points per cell, built in one counting pass, and a query reads only the cells under the hit
 * radius's box, so a move over 100 000 points reads a few hundred.
 */

/** Points as shares of the plot, y from the bottom, with each point's place in the walk. */
export type PointShares = {
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  /** Each point's place in the walk order, which breaks a tie in distance. */
  readonly rank: Uint32Array;
};

/** The built grid. */
export type PointIndex = {
  readonly points: PointShares;
  /** Cells along each axis. */
  readonly size: number;
  /** Where each cell's ids start in `ids`, with one more entry for the end. */
  readonly starts: Uint32Array;
  /** Point ids, cell by cell, row-major from the bottom left. */
  readonly ids: Uint32Array;
};

/** The pointer as shares of the plot, y from the bottom, and the plot's size in pixels. */
export type PointerShares = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * Two squared pixel distances this close are a tie. Shares of the plot round in their last bits,
 * so two points the same distance away measure a few ulps apart.
 */
const TIE = 1e-6;

/** The points one cell holds on average. */
const PER_CELL = 2;

/** The cell a share falls in, clamped to the grid, so a point on an edge or past it still lands. */
function cellOf(share: number, size: number): number {
  return Math.min(size - 1, Math.max(0, Math.floor(share * size)));
}

/**
 * Build the grid over a model's points.
 *
 * @param points - Every point as shares of the plot, with its walk rank.
 * @returns The index.
 */
export function buildPointIndex(points: PointShares): PointIndex {
  const count = points.xs.length;
  const size = Math.max(1, Math.ceil(Math.sqrt(count / PER_CELL)));
  const cells = new Uint32Array(count);
  const starts = new Uint32Array(size * size + 1);
  for (let id = 0; id < count; id += 1) {
    const cell = cellOf(points.ys[id] ?? 0, size) * size + cellOf(points.xs[id] ?? 0, size);
    cells[id] = cell;
    starts[cell + 1] = (starts[cell + 1] ?? 0) + 1;
  }
  for (let cell = 0; cell < size * size; cell += 1)
    starts[cell + 1] = (starts[cell + 1] ?? 0) + (starts[cell] ?? 0);
  const fill = starts.slice(0, size * size);
  const ids = new Uint32Array(count);
  for (let id = 0; id < count; id += 1) {
    const cell = cells[id] ?? 0;
    const at = fill[cell] ?? 0;
    ids[at] = id;
    fill[cell] = at + 1;
  }
  return { points, size, starts, ids };
}

/**
 * The point nearest the pointer, in pixels, within the hit radius. A tie in distance goes to the
 * point earlier in the walk.
 *
 * @param index - The grid.
 * @param pointer - The pointer as shares of the plot and the plot's size.
 * @param radius - The hit radius in pixels.
 * @returns The point id, or -1 when no point lies within the radius.
 */
export function nearestPoint(index: PointIndex, pointer: PointerShares, radius: number): number {
  const { points, size, starts, ids } = index;
  const { width, height } = pointer;
  if (ids.length === 0 || width <= 0 || height <= 0) return -1;
  const reachX = radius / width;
  const reachY = radius / height;
  const left = cellOf(pointer.x - reachX, size);
  const right = cellOf(pointer.x + reachX, size);
  const bottom = cellOf(pointer.y - reachY, size);
  const top = cellOf(pointer.y + reachY, size);
  // A box that lies wholly past the plot holds no cell.
  if (pointer.x + reachX < 0 || pointer.x - reachX > 1 || pointer.y + reachY < 0 || pointer.y - reachY > 1)
    return -1;
  let best = -1;
  let bestRank = 0;
  let bestDistance = radius * radius;
  for (let row = bottom; row <= top; row += 1) {
    for (let column = left; column <= right; column += 1) {
      const cell = row * size + column;
      const end = starts[cell + 1] ?? 0;
      for (let at = starts[cell] ?? 0; at < end; at += 1) {
        const id = ids[at] ?? 0;
        const dx = ((points.xs[id] ?? 0) - pointer.x) * width;
        const dy = ((points.ys[id] ?? 0) - pointer.y) * height;
        const distance = dx * dx + dy * dy;
        // Before any point, bestDistance is the radius, which a point on it reaches.
        if (distance > bestDistance + TIE) continue;
        const rank = points.rank[id] ?? 0;
        if (best !== -1 && distance >= bestDistance - TIE && rank > bestRank) continue;
        best = id;
        bestRank = rank;
        bestDistance = Math.min(distance, bestDistance);
      }
    }
  }
  return best;
}
