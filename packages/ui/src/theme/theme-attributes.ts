import type { ThemeInput } from "./tokens/themes";
import { validateTheme } from "./validate-theme";

export type ThemeAttributes = {
  "data-theme-variant": ThemeInput["variant"];
  "data-theme-brand": ThemeInput["brand"];
  "data-theme-segment": ThemeInput["segment"];
};

export function themeAttributes(theme: ThemeInput): ThemeAttributes {
  const validated = validateTheme(theme);
  return {
    "data-theme-variant": validated.variant,
    "data-theme-brand": validated.brand,
    "data-theme-segment": validated.segment,
  };
}
