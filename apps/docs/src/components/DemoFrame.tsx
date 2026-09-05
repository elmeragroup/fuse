"use client";

import type { ReactElement, ReactNode } from "react";

import { defaultDensityForVariant, densityAttributes, ThemeScope, themeSlug } from "@elmeragroup/ui/theme";

import "./DemoFrame.css";
import { usePreviewTheme } from "./PreviewTheme";

export type DemoFrameProps = {
  id: string;
  title: string;
  children: ReactNode;
};

export function DemoFrame({ id, title, children }: DemoFrameProps): ReactElement {
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
        </div>
      </div>
    </section>
  );
}
