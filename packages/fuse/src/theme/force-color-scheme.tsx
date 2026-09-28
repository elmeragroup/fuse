"use client";

import { use, useInsertionEffect } from "react";
import type { ReactNode } from "react";

import type { ColorScheme } from "./color-scheme";
import { ColorSchemeForceContext, ColorSchemeForceDepthContext } from "./color-scheme-root";

export type ForceColorSchemeProps = {
  value: ColorScheme;
  children?: ReactNode;
};

export function ForceColorScheme({ value, children }: ForceColorSchemeProps) {
  const force = use(ColorSchemeForceContext);
  const parentDepth = use(ColorSchemeForceDepthContext);
  if (force === undefined) {
    throw new Error("ForceColorScheme must be used within ThemeProvider");
  }

  const depth = parentDepth + 1;

  // The release force() returns is the cleanup, so a value change re-applies at the top.
  useInsertionEffect(() => force(value, depth), [force, depth, value]);

  return (
    <ColorSchemeForceDepthContext.Provider value={depth}>{children}</ColorSchemeForceDepthContext.Provider>
  );
}
