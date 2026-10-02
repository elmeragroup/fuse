"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";

import * as CssColor from "@elmeragroup/color/css-color";
import * as Hex from "@elmeragroup/color/hex";
import * as Wcag from "@elmeragroup/color/wcag";
import { coerceTheme, themeAttributes, useColorScheme } from "@elmeragroup/fuse/theme";
import type { BrandCode, ThemeInput } from "@elmeragroup/fuse/theme";

import { useLandingTheme } from "./landing-theme";

/** The brand's tonal roles that make up its heat ramp, plus its accent primitive. */
const HEAT_ROLES = [
  "secondary",
  "primary",
  "feature",
  "feature-bright",
  "feature-foreground",
  "primary-soft",
];

/** The Heatmap shader takes at most seven colours. */
const RAMP_LENGTH = 7;

export type Heat = {
  /** Hex colours for the shader, cold to hot for the active scheme. */
  colors: string[];
  /** Hex colour of the surface the shader sits on, so its grain meets the page without a seam. */
  back: string;
};

type Swatch = { hex: string; luminance: number };

/**
 * A custom property's computed value is its source text, which the build may have written in a
 * notation the colour parser does not take. Routing it through `color` makes the browser
 * serialise a resolved colour instead.
 */
function resolveColor(element: HTMLElement, token: string): string {
  element.style.color = `var(--${token})`;
  const value = window.getComputedStyle(element).color;
  element.style.removeProperty("color");
  return value;
}

function toSwatch(value: string): Swatch | undefined {
  const parsed = CssColor.parse(value.trim());
  if (parsed._tag === "err") {
    return undefined;
  }
  const srgb = CssColor.toSrgb(parsed.value);
  return { hex: Hex.formatOpaque(srgb), luminance: Wcag.relativeLuminance(srgb) };
}

/**
 * Reads a brand's roles in the active scheme from a hidden probe that carries the brand's
 * theme attributes, so each tile can show a brand other than the page's own. Dark mode runs
 * dark to light, so the mark glows; light mode runs light to dark, so it inks.
 */
function readRamp(
  host: HTMLElement,
  theme: ThemeInput,
  brand: BrandCode,
  scheme: "light" | "dark"
): string[] {
  const coerced = coerceTheme({ ...theme, brand });
  if (coerced === null) {
    return [];
  }
  const probe = document.createElement("div");
  // Not `hidden`: a display:none element reports colours unresolved, in the source notation.
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  for (const [name, value] of Object.entries(themeAttributes(coerced))) {
    probe.setAttribute(name, value);
  }
  host.append(probe);
  const values = [...HEAT_ROLES, `brand-${brand}`].map((token) => resolveColor(probe, token));
  probe.remove();

  const unique = new Map<string, Swatch>();
  for (const value of values) {
    const swatch = toSwatch(value);
    if (swatch !== undefined) {
      unique.set(swatch.hex, swatch);
    }
  }
  const rising = [...unique.values()].sort((a, b) => a.luminance - b.luminance).map((swatch) => swatch.hex);
  return scheme === "dark" ? rising.slice(-RAMP_LENGTH) : rising.reverse().slice(0, RAMP_LENGTH);
}

/**
 * The heat ramp for `brand` and the hex of `surface` under `host`, re-read whenever the page
 * re-themes or switches scheme. Undefined until the first client read.
 */
export function useHeat(
  host: RefObject<HTMLElement | null>,
  brand: BrandCode,
  surface: "background" | "card"
): Heat | undefined {
  const { theme } = useLandingTheme();
  const { resolvedColorScheme } = useColorScheme();
  const [heat, setHeat] = useState<Heat>();

  useEffect(() => {
    // ThemeProvider stamps <html> in its own effect, which runs after this one; read a frame later.
    const frame = window.requestAnimationFrame(() => {
      const element = host.current;
      if (element === null) {
        return;
      }
      const scheme = resolvedColorScheme === "dark" ? "dark" : "light";
      const back = toSwatch(resolveColor(element, surface));
      setHeat({ colors: readRamp(element, theme, brand, scheme), back: back?.hex ?? "#000000" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [host, brand, surface, theme, resolvedColorScheme]);

  return heat;
}
