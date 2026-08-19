"use client";

import { use, useInsertionEffect, useRef } from "react";
import type { ReactNode } from "react";

import type { ColorScheme } from "./color-scheme";
import { ColorSchemeControllerContext, ColorSchemeForceDepthContext } from "./color-scheme-context";

export type ForceColorSchemeProps = {
  value: ColorScheme;
  children?: ReactNode;
};

export function ForceColorScheme({ value, children }: ForceColorSchemeProps) {
  const controller = use(ColorSchemeControllerContext);
  const parentDepth = use(ColorSchemeForceDepthContext);
  if (controller === undefined) {
    throw new Error("ForceColorScheme must be used within ThemeProvider");
  }

  const depth = parentDepth + 1;
  const id = useRef(Symbol("ForceColorScheme"));

  useInsertionEffect(() => {
    controller.setRuntimeForce(id.current, value, depth);
    return () => {
      controller.setRuntimeForce(id.current, undefined, depth);
    };
  }, [controller, depth, value]);

  return (
    <ColorSchemeForceDepthContext.Provider value={depth}>{children}</ColorSchemeForceDepthContext.Provider>
  );
}
