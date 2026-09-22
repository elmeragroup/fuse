import type { ThemeInput } from "./tokens/themes";

export type ThemeAxisDeps = readonly [
  ThemeInput["variant"] | undefined,
  ThemeInput["brand"] | undefined,
  ThemeInput["segment"] | undefined,
];

export function themeAxisDeps(theme: ThemeInput): ThemeAxisDeps {
  // SAFETY: untyped CMS/env input is the boundary; optional axis reads keep insertion/memo
  // deps from throwing before remaining hooks register.
  const axes = theme as ThemeInput | null;
  return [axes?.variant, axes?.brand, axes?.segment];
}
