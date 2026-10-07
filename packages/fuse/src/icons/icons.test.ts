import { createElement } from "react";

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import * as Icons from "../icons";
import { FkasMeter } from "../illustrations";
import * as Root from "../index";
import { generatedAdapterSource, generatedFacadeSource, iconModuleSlug } from "./generate";
import { BESPOKE_ICON_NAMES, LOGO_NAMES, PHOSPHOR_ICON_NAMES } from "./roster";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const generatedDir = join(packageRoot, "src/icons/generated");
const byName = [...PHOSPHOR_ICON_NAMES].toSorted((left, right) => left.localeCompare(right));

describe("Phosphor adapters", () => {
  it("treats the roster as a public API snapshot", async () => {
    expect(PHOSPHOR_ICON_NAMES).toHaveLength(127);
    expect(new Set(PHOSPHOR_ICON_NAMES).size).toBe(PHOSPHOR_ICON_NAMES.length);
    await expect([...PHOSPHOR_ICON_NAMES]).toMatchFileSnapshot("./__snapshots__/roster.json");
  });

  it("exports every curated name from /icons and does not export Icon", () => {
    expect(Object.keys(Icons).toSorted((left, right) => left.localeCompare(right))).toEqual(
      ["BrandLogo", ...BESPOKE_ICON_NAMES, ...LOGO_NAMES, ...byName].toSorted((left, right) =>
        left.localeCompare(right)
      )
    );
    expect(Icons).toHaveProperty("BrandLogo");
    expect(Icons).not.toHaveProperty("Icon");
  });

  it("does not re-export icons or illustrations from the root barrel", () => {
    const rootEntries = new Map(Object.entries(Root));
    // `Sidebar` is both a Phosphor glyph and the Appendix A component namespace the barrel
    // must publish; the barrel value has to be the component, never the icon adapter.
    const homonyms = byName.filter((name) => rootEntries.has(name));
    expect(homonyms).toEqual(["Sidebar"]);
    const iconEntries = new Map(Object.entries(Icons));
    for (const name of homonyms) {
      expect(rootEntries.get(name), name).not.toBe(iconEntries.get(name));
    }
    expect(Root.Sidebar).toHaveProperty("Provider");
    expect(Root).not.toHaveProperty("Icon");
    expect(Root).not.toHaveProperty("BrandLogo");
    expect(FkasMeter).toEqual(expect.any(Function));
    expect(Root).not.toHaveProperty("FkasMeter");
    for (const name of [...BESPOKE_ICON_NAMES, ...LOGO_NAMES]) {
      expect(Root).not.toHaveProperty(name);
    }
  });

  it("keeps generated modules and the facade in lock-step with the roster", () => {
    expect(readFileSync(join(packageRoot, "src/icons.ts"), "utf8")).toBe(
      generatedFacadeSource(PHOSPHOR_ICON_NAMES)
    );

    const expectedFiles = PHOSPHOR_ICON_NAMES.map((name) => `${iconModuleSlug(name)}.ts`);
    expect(readdirSync(generatedDir).toSorted((left, right) => left.localeCompare(right))).toEqual(
      [...expectedFiles].toSorted((left, right) => left.localeCompare(right))
    );

    for (const name of PHOSPHOR_ICON_NAMES) {
      const path = join(generatedDir, `${iconModuleSlug(name)}.ts`);
      expect(readFileSync(path, "utf8"), name).toBe(generatedAdapterSource(name));
    }
  });

  it("imports only per-icon SSR modules and stays server-safe", () => {
    const facade = readFileSync(join(packageRoot, "src/icons.ts"), "utf8");
    expect(facade).not.toContain("use client");
    expect(facade).not.toContain("dist/csr");
    expect(facade).not.toMatch(/from ["']@phosphor-icons\/react["']/);
    expect(facade).not.toMatch(/from ["']@phosphor-icons\/react\/ssr["']/);

    const helper = readFileSync(join(packageRoot, "src/icons/create-elmera-icon.ts"), "utf8");
    expect(helper).not.toContain("use client");
    expect(helper).not.toContain("dist/csr");
    expect(helper).not.toMatch(/from ["']@phosphor-icons\/react["']/);
    expect(helper).toContain(`from "@phosphor-icons/react/dist/ssr/Check"`);

    for (const name of PHOSPHOR_ICON_NAMES) {
      const text = readFileSync(join(generatedDir, `${iconModuleSlug(name)}.ts`), "utf8");
      expect(text, name).toContain(`from "@phosphor-icons/react/dist/ssr/${name}"`);
      expect(text, name).not.toContain("use client");
      expect(text, name).not.toContain("dist/csr");
      expect(text, name).not.toMatch(/from ["']@phosphor-icons\/react["']/);
      expect(text, name).not.toMatch(/from ["']lucide-react["']/);
    }
  });

  // Oracle: Phosphor's own path data for Check (`dist/defs/Check.es.js`), copied as literals.
  // Bold draws 24/256-unit strokes, regular 16/256, fill a filled square with the tick cut out.
  const CHECK_PATH_START = {
    bold: 'd="M232.49,80.49l-128,128',
    regular: 'd="M229.66,77.66l-128,128',
    fill: 'd="M216,40H40A16,16,0,0,0,24,56V200',
  } as const;

  it("draws bold when no weight is passed, and regular or fill only on request", () => {
    const untouched = renderToStaticMarkup(createElement(Icons.Check));
    expect(untouched).toContain(CHECK_PATH_START.bold);
    expect(untouched).not.toContain(CHECK_PATH_START.regular);

    for (const weight of ["regular", "bold", "fill"] as const) {
      const markup = renderToStaticMarkup(createElement(Icons.Check, { weight }));
      for (const [other, path] of Object.entries(CHECK_PATH_START)) {
        if (other === weight) {
          expect(markup, weight).toContain(path);
        } else {
          expect(markup, `${weight} draws no ${other} path`).not.toContain(path);
        }
      }
    }
  });
});
