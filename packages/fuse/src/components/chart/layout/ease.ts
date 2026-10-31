/**
 * A CSS `cubic-bezier()` timing function in JS, so the chart's rAF tween moves on the same curve
 * that `chart.css` names. The curve's x runs from time, so a progress needs x inverted first.
 */

/** The four control values of a CSS `cubic-bezier(x1, y1, x2, y2)`. */
export type BezierCurve = readonly [x1: number, y1: number, x2: number, y2: number];

/** One coordinate of a cubic Bézier from (0, 0) to (1, 1) with inner controls `a` and `b`. */
function coordinate(a: number, b: number, t: number): number {
  return ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
}

/** The slope of one coordinate. */
function slope(a: number, b: number, t: number): number {
  return 3 * (1 - 3 * b + 3 * a) * t * t + 2 * (3 * b - 6 * a) * t + 3 * a;
}

/**
 * The easing function of a curve, as browsers evaluate `cubic-bezier()`. Newton steps find the
 * curve parameter for a time, and bisection takes over where the slope is too flat for them.
 *
 * @param curve - The control values, with both x values between 0 and 1.
 * @returns A function from time progress, 0 to 1, to eased progress.
 */
export function cubicBezier(curve: BezierCurve): (progress: number) => number {
  const [x1, y1, x2, y2] = curve;
  return (progress) => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    let t = progress;
    for (let step = 0; step < 8; step += 1) {
      const error = coordinate(x1, x2, t) - progress;
      if (Math.abs(error) < 1e-7) return coordinate(y1, y2, t);
      const gradient = slope(x1, x2, t);
      if (Math.abs(gradient) < 1e-6) break;
      t -= error / gradient;
    }
    let low = 0;
    let high = 1;
    t = progress;
    while (high - low > 1e-7) {
      if (coordinate(x1, x2, t) < progress) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return coordinate(y1, y2, t);
  };
}
