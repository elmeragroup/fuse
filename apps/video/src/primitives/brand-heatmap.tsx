import { Suspense, useLayoutEffect, useRef } from "react";
import type { CSSProperties, ReactElement, RefObject } from "react";

import { Heatmap } from "@paper-design/shaders-react";
import type { PaperShaderElement } from "@paper-design/shaders-react";
import { staticFile, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";

import { useTheme } from "@elmeragroup/fuse/theme";
import type { ResolvedColorScheme } from "@elmeragroup/fuse/theme-catalog";

import { heatFor } from "../brand/heat-ramp";

/**
 * The landing's one shader look, fixed by design (see the landing's `brand-heatmap.tsx`): only
 * the ramp, the surface and the mark change per brand and scheme.
 */
const HEATMAP = {
  contour: 0.5,
  angle: 0,
  noise: 0.75,
  innerGlow: 0.3,
  outerGlow: 0.3,
  scale: 0.75,
} as const;

/** The landing starts the shader 3 s in and runs it at half speed. */
const ORIGIN_MS = 3000;
const SPEED = 0.5;

/** The outer glow reaches the canvas edge, where the box would cut it in a straight line. */
const EDGE_FADE: CSSProperties = {
  maskImage: "radial-gradient(ellipse 50% 50% at center, black 72%, transparent 100%)",
};

/** Keeps the drawn frame in the canvas buffer, so a screenshot taken after presenting still sees it. */
const GL_ATTRIBUTES: WebGLContextAttributes = { preserveDrawingBuffer: true };

/**
 * Draws the shader at a time and holds the render until it has. This is the only place that sets
 * the shader's time. The shader mounts after its image loads, so the first frames wait for the
 * mount. Each frame then sets the time, waits an animation frame for the canvas to present, and
 * releases only once the mount still reports that time.
 */
function useShaderTime(ref: RefObject<PaperShaderElement | null>, timeMs: number): void {
  const { delayRender, continueRender } = useDelayRender();
  useLayoutEffect(() => {
    const handle = delayRender(`Drawing the heatmap at ${String(Math.round(timeMs))} ms`);
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        continueRender(handle);
      }
    };
    let request = 0;
    const draw = () => {
      const mount = ref.current?.paperShaderMount;
      if (mount === undefined) {
        request = requestAnimationFrame(draw);
        return;
      }
      if (mount.getCurrentFrame() !== timeMs) {
        mount.setFrame(timeMs);
        request = requestAnimationFrame(draw);
        return;
      }
      release();
    };
    request = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(request);
      release();
    };
  }, [ref, timeMs, delayRender, continueRender]);
}

/**
 * The landing's brand heatmap: the brand's mark traced by `@paper-design/shaders-react`'s
 * Heatmap in the brand's role ramp. It takes its brand from the enclosing `ThemeScope`, and its
 * time follows the video frame, so every render of a frame draws the same pixels.
 *
 * @param props.scheme - The scheme the enclosing scope renders in.
 * @param props.className - Positions and sizes the shader's box.
 * @returns The shader, filling its box.
 */
export function BrandHeatmap({
  scheme,
  className,
}: {
  readonly scheme: ResolvedColorScheme;
  readonly className?: string;
}): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const ref = useRef<PaperShaderElement>(null);
  const heat = heatFor(theme, scheme);
  useShaderTime(ref, ORIGIN_MS + (frame / fps) * 1000 * SPEED);

  return (
    // While the mark is processed the Heatmap suspends and the boundary draws nothing. This
    // component still commits outside the boundary, so `useShaderTime` holds the frame until the
    // shader has mounted and drawn.
    <Suspense fallback={null}>
      <Heatmap
        ref={ref}
        className={className}
        style={EDGE_FADE}
        image={staticFile(`marks/${theme.brand}.svg`)}
        colors={heat.colors}
        colorBack={heat.back}
        speed={0}
        fit="contain"
        suspendWhenProcessingImage
        webGlContextAttributes={GL_ATTRIBUTES}
        {...HEATMAP}
      />
    </Suspense>
  );
}
