import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import * as Icons from "../icons";
import * as Root from "../index";
import { generatedAdapterSource, generatedFacadeSource, iconModuleSlug } from "./generate";
import { BESPOKE_ICON_NAMES, LOGO_NAMES, PHOSPHOR_ICON_NAMES } from "./roster";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const generatedDir = join(packageRoot, "src/icons/generated");
const byName = [...PHOSPHOR_ICON_NAMES].toSorted((left, right) => left.localeCompare(right));

describe("Phosphor adapters", () => {
  it("treats the roster as a public API snapshot", async () => {
    expect(PHOSPHOR_ICON_NAMES).toHaveLength(111);
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

  it("does not re-export icons from the root barrel", () => {
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
    expect(helper).toContain('weight = "regular"');
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
});
