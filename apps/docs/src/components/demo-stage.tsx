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
    stage:
      "sm:px-8 flex flex-wrap items-center justify-center gap-3 bg-background px-0 py-11 text-foreground min-[360px]:px-3",
    meta: "text-xs flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border bg-card px-3.5 py-2 font-mono text-muted-foreground",
    slug: "text-foreground",
    density: "text-foreground",
    sourcePath: "ml-auto max-w-full truncate text-muted-foreground lg:max-w-[290px]",
  },
});

const { stage, meta, slug: slugClass, density: densityClass, sourcePath: sourcePathClass } = demoStage();

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
      <div className={meta()} data-demo-meta>
        <span>
          theme ={" "}
          <span className={slugClass()} data-demo-slug>
            {slug}
          </span>
        </span>
        <span aria-hidden="true"> · </span>
        <span>
          density ={" "}
          <span className={densityClass()} data-demo-density>
            {density}
          </span>
        </span>
        <span className={sourcePathClass()}>{sourcePath}</span>
      </div>
    </>
  );
}
