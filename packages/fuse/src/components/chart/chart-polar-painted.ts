"use client";

/**
 * The slice angles a polar frame last painted, by key, which a Root's pick reads so the pointer
 * picks the geometry the reader sees: floored, unpopped and with its seams. The pie's frame
 * shares its angles here as it paints, and a Root whose loop holds no frame picks its model's own.
 */
import type { ChartMotion } from "./chart-motion";
import type { SliceAngles } from "./layout/pie";

/** A slice's painted angles by its key: null where it draws no arc, undefined where none painted. */
export type PaintedAngles = (key: string) => SliceAngles | null | undefined;

const painted = new WeakMap<ChartMotion, PaintedAngles>();

/**
 * Share a frame's painted angles on its loop.
 *
 * @param motion - The Root's loop.
 * @param angles - The painted angles by key.
 */
export function sharePainted(motion: ChartMotion, angles: PaintedAngles): void {
  painted.set(motion, angles);
}

/**
 * The painted angles a frame shares on a loop.
 *
 * @param motion - The Root's loop.
 * @returns The angles by key, or undefined where no frame paints.
 */
export function paintedOf(motion: ChartMotion): PaintedAngles | undefined {
  return painted.get(motion);
}
