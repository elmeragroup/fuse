"use client";

import { useCallback, useState } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import type { ThemeAttributes } from "./theme-attributes";
import { ThemeContext, useResolvedThemeResult } from "./theme-context";
import { ThemeScopeContainerContext } from "./theme-scope-container";
import type { ThemeInput } from "./tokens/themes";

export type ThemeScopeProps = Omit<
  useRender.ComponentProps<"div">,
  "data-theme-variant" | "data-theme-brand" | "data-theme-segment"
> & {
  theme: ThemeInput;
};

export function ThemeScope({ theme, render, ref, children, ...rest }: ThemeScopeProps) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const setScopeElement = useCallback((node: HTMLElement | null) => {
    setElement(node);
  }, []);

  const resolved = useResolvedThemeResult(theme);
  const attributes: ThemeAttributes | undefined = resolved.ok
    ? {
        "data-theme-variant": resolved.theme.variant,
        "data-theme-brand": resolved.theme.brand,
        "data-theme-segment": resolved.theme.segment,
      }
    : undefined;

  const rendered = useRender({
    defaultTagName: "div",
    render,
    ref: ref === undefined ? setScopeElement : [ref, setScopeElement],
    props: mergeProps<"div">(rest, {
      ...attributes,
      children,
    }),
  });

  // Rethrow only after every hook has registered, so hook order is stable across renders.
  if (!resolved.ok) throw resolved.error;
  const value = resolved.theme;

  return (
    <ThemeContext.Provider value={value}>
      <ThemeScopeContainerContext.Provider value={element}>{rendered}</ThemeScopeContainerContext.Provider>
    </ThemeContext.Provider>
  );
}
