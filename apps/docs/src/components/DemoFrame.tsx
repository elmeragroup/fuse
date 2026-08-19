"use client";

import type { ReactElement, ReactNode } from "react";

import { ThemeScope, themeSlug } from "@elmeragroup/ui/theme";

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

  return (
    <section className="DemoFrame" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <div className="DemoFrameCard">
        <ThemeScope theme={theme} className="DemoStage">
          {children}
        </ThemeScope>
        <div className="DemoMeta">
          theme = <span className="DemoSlug">{slug}</span>
        </div>
      </div>
    </section>
  );
}
