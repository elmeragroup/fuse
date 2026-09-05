"use client";

import { useCallback, useState } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { themeAttributes } from "./theme-attributes";
import type { ThemeAttributes } from "./theme-attributes";
import { ThemeContext, useResolvedTheme } from "./theme-context";
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

  let attributes: ThemeAttributes | undefined;
  try {
    attributes = themeAttributes(theme);
  } catch {
    // Do not abort useRender; useResolvedTheme rethrows after every hook.
  }

  const rendered = useRender({
    defaultTagName: "div",
    render,
    ref: ref === undefined ? setScopeElement : [ref, setScopeElement],
    props: mergeProps<"div">(rest, {
      ...attributes,
      children,
    }),
  });

  const value = useResolvedTheme(theme);

  return (
    <ThemeContext.Provider value={value}>
      <ThemeScopeContainerContext.Provider value={element}>{rendered}</ThemeScopeContainerContext.Provider>
    </ThemeContext.Provider>
  );
}
