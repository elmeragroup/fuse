"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";

import * as Hex from "@elmeragroup/color/hex";
import * as Wcag from "@elmeragroup/color/wcag";
import { useColorScheme } from "@elmeragroup/fuse/theme";
import type { BrandCode } from "@elmeragroup/fuse/theme";

import { computedSrgb, useLandingTheme } from "./landing-theme";

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
  /** Hex colour of the page background under the shader, so its grain meets it without a seam. */
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
  const srgb = computedSrgb(value);
  return srgb === undefined
    ? undefined
    : { hex: Hex.formatOpaque(srgb), luminance: Wcag.relativeLuminance(srgb) };
}

/**
 * Reads the page brand's roles in the active scheme off `host`, which wears the page's theme.
 * Dark mode runs dark to light, so the mark glows; light mode runs light to dark, so it inks.
 */
function readRamp(host: HTMLElement, brand: BrandCode, scheme: "light" | "dark"): string[] {
  const values = [...HEAT_ROLES, `brand-${brand}`].map((token) => resolveColor(host, token));

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
 * The heat ramp for the page's brand and the hex of the background under `host`, re-read
 * whenever the page re-themes or switches scheme. Undefined until the first client read.
 */
export function useHeat(host: RefObject<HTMLElement | null>): Heat | undefined {
  const { theme } = useLandingTheme();
  const { resolvedColorScheme } = useColorScheme();
  const [heat, setHeat] = useState<Heat>();

  useEffect(() => {
    // ThemeProvider stamps <html> in an insertion effect, so the host already wears the new
    // theme here. The read still waits a frame: setting state from it synchronously would start
    // a second render inside this commit, and the read lands in the next frame.
    const frame = window.requestAnimationFrame(() => {
      const element = host.current;
      if (element === null) {
        return;
      }
      const scheme = resolvedColorScheme === "dark" ? "dark" : "light";
      const back = toSwatch(resolveColor(element, "background"));
      setHeat({ colors: readRamp(element, theme.brand, scheme), back: back?.hex ?? "#000000" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [host, theme, resolvedColorScheme]);

  return heat;
}
