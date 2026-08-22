"use client";

import type { ReactElement, ReactNode } from "react";

import { defaultDensityForVariant, densityAttributes, ThemeScope, themeSlug } from "@elmeragroup/ui/theme";

import "./DemoFrame.css";
import { usePreviewTheme } from "./PreviewTheme";

export type DemoFrameProps = {
  id: string;
  title: string;
  /** Syntax-highlighted HTML of the authored demo file, extracted at docs build. */
  highlighted: string;
  /** Repo-relative path of the authored demo file. */
  sourcePath: string;
  children: ReactNode;
};

/**
 * The §3.5 demo frame: a theme-tinted dotted stage, the active theme coordinate and its
 * deployment-default density in mono, and the extracted source of the very file that
 * rendered the stage.
 */
export function DemoFrame({ id, title, highlighted, sourcePath, children }: DemoFrameProps): ReactElement {
  const { theme } = usePreviewTheme();
  const slug = themeSlug(theme).replaceAll("-", "·");
  const density = defaultDensityForVariant(theme.variant);

  return (
    <section className="DemoFrame" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <div className="DemoFrameCard">
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
        <pre className="DemoSource">
          {/* Highlighted at docs build from the same file the stage above renders. */}
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
      </div>
    </section>
  );
}
