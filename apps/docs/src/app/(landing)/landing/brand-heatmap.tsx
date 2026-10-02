"use client";

import { useRef, useSyncExternalStore } from "react";
import type { ReactElement } from "react";

import { Heatmap } from "@paper-design/shaders-react";

import type { BrandCode } from "@elmeragroup/fuse/theme";

import { useHeat } from "./brand-heat";

/**
 * The landing's one shader look, fixed by design: only the ramp, the surface and the mark
 * change per brand and scheme. The page uses it as decoration; Fuse does not ship it.
 */
const HEATMAP = {
  contour: 0.5,
  angle: 0,
  noise: 0.75,
  innerGlow: 0.3,
  outerGlow: 0.3,
  scale: 0.75,
  frame: 3000,
} as const;

const SPEED = 0.5;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Reduced motion holds the shader still on its first frame; the server renders it still too. */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true
  );
}

export type BrandHeatmapProps = {
  brand: BrandCode;
  /** The surface under the shader; its colour becomes the shader's background. */
  surface: "background" | "card";
  className?: string;
};

export function BrandHeatmap({ brand, surface, className }: BrandHeatmapProps): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const heat = useHeat(host, brand, surface);
  const reduced = useReducedMotion();

  return (
    <div ref={host} aria-hidden className={className}>
      {heat === undefined || heat.colors.length === 0 ? null : (
        <Heatmap
          className="size-full"
          image={`/landing/marks/${brand}.svg`}
          colors={heat.colors}
          colorBack={heat.back}
          speed={reduced ? 0 : SPEED}
          fit="contain"
          {...HEATMAP}
        />
      )}
    </div>
  );
}
