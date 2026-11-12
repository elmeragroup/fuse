/**
 * The render harness of the Vitest runs that render Live code demos on the server: the
 * transparency test and the Live code sweep. Both run under the `liveCodeLens` Vite plugin, so a
 * component demo imports rewritten and its `?original` import does not.
 */

import { createElement } from "react";
import type { ComponentType } from "react";

import { renderToString } from "react-dom/server";

import { LocaleProvider, ThemeScope } from "@elmeragroup/fuse/theme";

import { LiveCodeContext } from "../../src/components/live-code/lens.tsx";
import { demoLocations } from "../../src/lib/demo-source.ts";
import { docsRouteFile } from "../../src/lib/docs-route-files.ts";
import { hasLiveCode } from "../../src/lib/live-code/live-code-demo.ts";
import type { LiveCodeStore } from "../../src/lib/live-code/store.ts";
import { DEFAULT_THEME } from "../../src/lib/theme.ts";

/** One Live code demo file: its absolute path, and its name as a report lists it. */
export type LiveCodeDemoFile = { readonly path: string; readonly name: string };

/**
 * Every demo file that is Live code, from the docs' own demo listing.
 *
 * @returns Each component demo module.
 */
export function liveCodeDemoFiles(): readonly LiveCodeDemoFile[] {
  return demoLocations()
    .filter(({ section, file }) => hasLiveCode(section) && file.endsWith(".tsx"))
    .map(({ section, slug, file }) => ({
      path: docsRouteFile(section, slug, "demos", file).absolute,
      name: `${slug}/demos/${file}`,
    }));
}

/**
 * The server HTML of one demo on a stage like the docs': the docs' default theme, the site's
 * locale, and a Live code frame holding `store`.
 *
 * @param Demo - The demo component.
 * @param store - The frame's store, with any edits the caller set.
 * @returns The rendered HTML.
 */
export function renderStage(Demo: ComponentType, store: LiveCodeStore): string {
  const stage = createElement(
    ThemeScope,
    { theme: DEFAULT_THEME },
    createElement(LocaleProvider, { locale: "en-US", children: createElement(Demo) })
  );
  return renderToString(createElement(LiveCodeContext, { value: store, children: stage }));
}

/**
 * The components a demo module exports: its capitalised function exports, by name.
 *
 * @param specifier - The module to import, such as a demo path or its `?original` import.
 * @returns The components, by export name.
 */
export async function demoComponents(specifier: string): Promise<ReadonlyMap<string, ComponentType>> {
  // SAFETY: a module namespace maps its export names to values; the filter keeps the components.
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- module boundary: a dynamically imported demo module's exports
  const module = (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>;
  // SAFETY: a capitalised exported function of a demo module is a component.
  return new Map(
    Object.entries(module)
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- module boundary, as above: demo modules export components and helpers
      .filter(([name, value]) => /^[A-Z]/u.test(name) && typeof value === "function")
      .map(([name, value]) => [name, value as ComponentType])
  );
}
