"use client";

import { useCallback, useState } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import type { ThemeAttributes } from "./theme-attributes";
import { ThemeContext, useResolvedTheme } from "./theme-context";
import type { Theme } from "./theme-context";
import { ThemeScopeContainerContext } from "./theme-scope-container";
import type { ThemeInput } from "./tokens/themes";

export type ThemeScopeProps = Omit<
  useRender.ComponentProps<"div">,
  "data-theme-variant" | "data-theme-brand" | "data-theme-segment"
> & {
  theme: ThemeInput;
};

export function ThemeScope({ theme, render, ref, children, ...rest }: ThemeScopeProps) {
  const resolved = useResolvedTheme(theme);
  return (
    <ThemeScopeElement
      {...rest}
      render={render}
      ref={ref}
      theme={resolved.theme}
      attributes={resolved.attributes}>
      {children}
    </ThemeScopeElement>
  );
}

// The throw for an invalid theme directly follows the one hook it depends on in ThemeScope;
// the element's own hooks run only for a valid theme.
function ThemeScopeElement({
  theme,
  attributes,
  render,
  ref,
  children,
  ...rest
}: Omit<ThemeScopeProps, "theme"> & { theme: Theme; attributes: ThemeAttributes }) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const setScopeElement = useCallback((node: HTMLElement | null) => {
    setElement(node);
  }, []);

  const rendered = useRender({
    defaultTagName: "div",
    render,
    ref: ref === undefined ? setScopeElement : [ref, setScopeElement],
    props: mergeProps<"div">(rest, {
      ...attributes,
      children,
    }),
  });

  return (
    <ThemeContext.Provider value={theme}>
      <ThemeScopeContainerContext.Provider value={element}>{rendered}</ThemeScopeContainerContext.Provider>
    </ThemeContext.Provider>
  );
}
