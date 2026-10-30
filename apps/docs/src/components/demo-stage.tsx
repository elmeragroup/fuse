"use client";

import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { defaultDensityForVariant, densityAttributes, ThemeScope } from "@elmeragroup/fuse/theme";

import { usePreviewTheme } from "./preview-theme";

type DemoStageProps = {
  children: ReactNode;
};

const demoStage = tv({
  // The stage lays its demo out in block flow, so the browser's own block/inline split decides
  // the demo's width: a block-level root (a Frame, Card, form, table or a stack) fills the stage
  // up to its own `max-w-*`, whatever state its content is in, and an inline-level root (a
  // Button, Badge or Switch) keeps its width on a centred line. The child rules weigh nothing,
  // so a demo's own margin, alignment or justification wins: a capped root centres, its text
  // starts at the start, and a block-level row keeps its controls centred. A root with a width of
  // its own, such as `w-96`, shrinks to the stage on a phone instead of running out of it, and a
  // smaller cap the demo sets still wins. Every stage is at least 256px tall, with a short demo
  // centred in it, so the frames on a page share a floor and the Code view has room to show code.
  base: "sm:px-8 text-base flow-root min-h-64 content-center bg-background px-0 py-11 text-center text-foreground min-[360px]:px-3 [:where(&>*)]:mx-auto [:where(&>*)]:max-w-full [:where(&>*)]:justify-center [:where(&>*)]:text-start",
});

/**
 * The theme-tinted stage of a frame, the one region that renders under the preview theme.
 *
 * A client component, because it consumes the docs-local preview context: driving the header
 * picker re-renders the stage while the frame chrome and the source stay server-rendered. The
 * stage's own theme attributes and `data-density` name the coordinate it renders under, for the
 * tests and tools that need it. Density is the *deployment default* for the previewed variant,
 * stamped on the stage so the demo-stage density re-scope in `globals.css` can take effect inside
 * the sandbox.
 */
export function DemoStage({ children }: DemoStageProps): ReactElement {
  const { theme } = usePreviewTheme();
  const density = defaultDensityForVariant(theme.variant);

  return (
    <ThemeScope theme={theme} className={demoStage()} data-demo-stage {...densityAttributes(density)}>
      {children}
    </ThemeScope>
  );
}
