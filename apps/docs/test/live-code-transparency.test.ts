import { createElement } from "react";
import type { ComponentType } from "react";

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LocaleProvider, ThemeScope } from "@elmeragroup/fuse/theme";

import { componentRoutesDir } from "../scripts/lib/paths.ts";
import { LiveCodeProvider, LiveCodeStore } from "../src/components/live-code/lens";

/** A theme the docs preview stages in. */
const STAGE_THEME = { identity: "neutral", brand: "fkas", segment: "private" } as const;

/** The server HTML of one demo component on a stage like the docs', in a Live code frame. */
function html(Demo: ComponentType): string {
  const stage = createElement(
    ThemeScope,
    { theme: STAGE_THEME },
    createElement(LocaleProvider, { locale: "en-US", children: createElement(Demo) })
  );
  return renderToString(createElement(LiveCodeProvider, { store: new LiveCodeStore(), children: stage }));
}

/** Every component demo file. */
function componentDemos(): readonly string[] {
  return readdirSync(componentRoutesDir, { withFileTypes: true }).flatMap((page) => {
    if (!page.isDirectory()) return [];
    const demos = join(componentRoutesDir, page.name, "demos");
    return readdirSync(join(componentRoutesDir, page.name))
      .filter((entry) => entry === "demos")
      .flatMap(() => readdirSync(demos))
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => join(demos, file));
  });
}

/** The capitalised function exports of a demo module, by name. */
async function demoComponents(specifier: string): Promise<ReadonlyMap<string, ComponentType>> {
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

describe("Live code transparency", () => {
  // Unit under test: the Live code loader's rewrite (`lensDemoSource`), which this project applies
  // to every demo module as the docs build does. Oracle: the same demo module unrewritten, which
  // the `?original` import keeps. With no edits, Live code must change nothing a demo renders.
  it("renders every lensed demo exactly as the original renders it", async () => {
    const differences: string[] = [];
    // React logs a server render error it recovers from; a difference shows in the HTML instead.
    const consoleError = console.error;
    console.error = () => undefined;
    try {
      for (const file of componentDemos()) {
        const lensed = await demoComponents(file);
        const original = await demoComponents(`${file}?original`);
        for (const [name, Demo] of original) {
          const Lensed = lensed.get(name);
          const expected = html(Demo);
          if (Lensed === undefined || html(Lensed) !== expected) {
            differences.push(`${file.slice(componentRoutesDir.length + 1)} ${name}`);
          }
        }
      }
    } finally {
      console.error = consoleError;
    }
    expect(differences).toEqual([]);
  });
});
