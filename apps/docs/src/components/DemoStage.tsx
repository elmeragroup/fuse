"use client";

import type { ReactElement, ReactNode } from "react";

import { defaultDensityForVariant, densityAttributes, ThemeScope, themeSlug } from "@elmeragroup/ui/theme";

import { usePreviewTheme } from "./PreviewTheme";

export type DemoStageProps = {
  /** Repo-relative path of the demo file, printed at the end of the meta row. */
  sourcePath: string;
  children: ReactNode;
};

/**
 * The two theme-dependent regions of a §3.5 frame: the dotted, theme-tinted stage and the
 * meta row naming the coordinate it renders under.
 *
 * This is the client half of the frame — the only part that consumes the docs-local
 * preview context (§4), so driving the header picker re-renders the stage and its label
 * while the frame shell and the source region stay server-rendered. Density is the
 * *deployment default* for the previewed variant, stamped on the stage so the
 * comfortable re-scope in `DemoFrame.css` can take effect inside the sandbox.
 */
export function DemoStage({ sourcePath, children }: DemoStageProps): ReactElement {
  const { theme } = usePreviewTheme();
  const slug = themeSlug(theme).replaceAll("-", "·");
  const density = defaultDensityForVariant(theme.variant);

  return (
    <>
      <ThemeScope theme={theme} className="DemoStage" {...densityAttributes(density)}>
        {children}
      </ThemeScope>
      <div className="DemoMeta">
        theme = <span className="DemoSlug">{slug}</span>
        <span aria-hidden="true"> · </span>
        density = <span className="DemoDensity">{density}</span>
        <span className="DemoMetaSpacer" />
        <span className="DemoSourcePath">{sourcePath}</span>
      </div>
    </>
  );
}
