"use client";

import { createContext } from "react";

import type { ColorScheme, UseColorSchemeResult } from "./color-scheme";

export type ColorSchemeController = {
  setRuntimeForce: (id: symbol, value: ColorScheme | undefined, depth: number) => void;
};

export const ColorSchemeContext = createContext<UseColorSchemeResult | undefined>(undefined);
export const ColorSchemeControllerContext = createContext<ColorSchemeController | undefined>(undefined);
export const ColorSchemeForceDepthContext = createContext(0);
