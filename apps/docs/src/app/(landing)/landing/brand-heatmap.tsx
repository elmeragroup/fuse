"use client";

import { Suspense, useRef, useSyncExternalStore } from "react";
import type { ReactElement } from "react";

import dynamic from "next/dynamic";

import type { BrandCode } from "@elmeragroup/fuse/theme";

import { useHeat } from "./brand-heat";
import { DecorationBoundary } from "./decoration-boundary";
import { REDUCED_MOTION } from "./landing-theme";

// The shader is decoration that only draws on the client, so its code stays out of the server
// render and the first-load bundle.
const Heatmap = dynamic(async () => (await import("./heatmap-shader")).Heatmap, { ssr: false });

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
  minPixelRatio: 1,
} as const;

const SPEED = 0.5;

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
};

/** The closing section's shader; the page background under it becomes its back colour. */
export function BrandHeatmap({ brand }: BrandHeatmapProps): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const heat = useHeat(host, brand);
  const reduced = useReducedMotion();

  return (
    <div ref={host} aria-hidden className="size-full">
      {heat === undefined || heat.colors.length === 0 ? null : (
        // Suspending caches the processed mark per image URL, so every tile and section that
        // shows a brand shares one pass instead of each blurring the same image again. A mark
        // that fails to load rejects that pass and throws here; the boundary drops the shader.
        <DecorationBoundary resetKey={brand}>
          <Suspense fallback={null}>
            <Heatmap
              className="size-full"
              image={`/landing/marks/${brand}.svg`}
              colors={heat.colors}
              colorBack={heat.back}
              speed={reduced ? 0 : SPEED}
              fit="contain"
              suspendWhenProcessingImage
              {...HEATMAP}
            />
          </Suspense>
        </DecorationBoundary>
      )}
    </div>
  );
}
