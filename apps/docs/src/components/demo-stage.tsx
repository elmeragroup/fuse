"use client";

import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { defaultDensityForVariant, densityAttributes, ThemeScope, themeSlug } from "@elmeragroup/ui/theme";

import { usePreviewTheme } from "./preview-theme";

export type DemoStageProps = {
  /** Repo-relative path of the demo file, printed at the end of the meta row. */
  sourcePath: string;
  children: ReactNode;
};

const demoStage = tv({
  slots: {
    stage: "flex flex-wrap items-center justify-center gap-3 bg-background p-[2.8rem_2rem] text-foreground",
    meta: "border-docs-line bg-docs-soft font-docs-mono text-docs-sub flex items-center border-t p-[0.45rem_0.9rem] text-[11.5px]",
    slug: "text-docs-ink",
    density: "text-docs-ink",
    spacer: "flex-auto",
    sourcePath: "text-docs-sub max-w-[290px] overflow-hidden text-ellipsis whitespace-nowrap",
  },
});

const {
  stage,
  meta,
  slug: slugClass,
  density: densityClass,
  spacer,
  sourcePath: sourcePathClass,
} = demoStage();

/**
 * The two theme-dependent regions of a §3.5 frame: the theme-tinted stage and the
 * meta row naming the coordinate it renders under.
 *
 * This is the client half of the frame — the only part that consumes the docs-local
 * preview context (§4), so driving the header picker re-renders the stage and its label
 * while the frame shell and the source region stay server-rendered. Density is the
 * *deployment default* for the previewed variant, stamped on the stage so the
 * comfortable re-scope in `globals.css` can take effect inside the sandbox.
 */
export function DemoStage({ sourcePath, children }: DemoStageProps): ReactElement {
  const { theme } = usePreviewTheme();
  const slug = themeSlug(theme).replaceAll("-", "·");
  const density = defaultDensityForVariant(theme.variant);

  return (
    <>
      <ThemeScope theme={theme} className={stage()} data-demo-stage {...densityAttributes(density)}>
        {children}
      </ThemeScope>
      <div className={meta()}>
        theme ={" "}
        <span className={slugClass()} data-demo-slug>
          {slug}
        </span>
        <span aria-hidden="true"> · </span>
        density ={" "}
        <span className={densityClass()} data-demo-density>
          {density}
        </span>
        <span className={spacer()} />
        <span className={sourcePathClass()}>{sourcePath}</span>
      </div>
    </>
  );
}
