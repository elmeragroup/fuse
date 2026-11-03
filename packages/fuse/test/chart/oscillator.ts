/**
 * The closed-form response of a damped oscillator of mass 1 released from rest at 0 towards 1,
 * x'' = k(1 - x) - c x', for each damping regime: the oracle for the chart's sampled springs.
 *
 * @param stiffness - The spring's stiffness, k.
 * @param damping - The spring's damping, c.
 * @param t - Seconds since release.
 * @returns The share of the way the oscillator has come.
 */
export function oscillator(stiffness: number, damping: number, t: number): number {
  const natural = Math.sqrt(stiffness);
  const ratio = damping / (2 * natural);
  if (ratio < 1) {
    const damped = natural * Math.sqrt(1 - ratio * ratio);
    const decay = Math.exp(-ratio * natural * t);
    return 1 - decay * (Math.cos(damped * t) + ((ratio * natural) / damped) * Math.sin(damped * t));
  }
  if (ratio === 1) return 1 - Math.exp(-natural * t) * (1 + natural * t);
  const root = natural * Math.sqrt(ratio * ratio - 1);
  const [fast, slow] = [-ratio * natural - root, -ratio * natural + root];
  return 1 - (fast * Math.exp(slow * t) - slow * Math.exp(fast * t)) / (fast - slow);
}

/**
 * The whole milliseconds until the oscillator stays within 0.1% of its target.
 *
 * @param stiffness - The spring's stiffness.
 * @param damping - The spring's damping.
 * @returns The milliseconds, searched up to 5 s.
 */
export function settling(stiffness: number, damping: number): number {
  let last = 0;
  for (let ms = 1; ms <= 5000; ms += 1) {
    if (Math.abs(1 - oscillator(stiffness, damping, ms / 1000)) >= 0.001) last = ms;
  }
  return last + 1;
}
