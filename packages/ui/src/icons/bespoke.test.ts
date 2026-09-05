import { createElement } from "react";
import type { ReactElement } from "react";

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  Contract,
  ElmeraGroupLogo,
  FjordkraftLogo,
  GudbrandsdalEnergiLogo,
  HomeTitleIcon,
  Signing,
  SteddiLogo,
  TelinetLogo,
  TrondelagkraftLogo,
  TrumfLogo,
  Vipps,
} from "../icons";
import { FkasMeter } from "../illustrations";
import * as Root from "../index";
import type { LogoProps } from "./bespoke-svg";
import { TelinetLogoFull } from "./bespoke/telinet-logo-full";
import { TelinetLogoMark } from "./bespoke/telinet-logo-mark";
import { iconModuleSlug } from "./generate";
import { BESPOKE_ICON_NAMES, LOGO_NAMES } from "./roster";
import type { LogoName } from "./roster";

const logosByName = {
  ElmeraGroupLogo,
  FjordkraftLogo,
  GudbrandsdalEnergiLogo,
  SteddiLogo,
  TelinetLogo,
  TrondelagkraftLogo,
  TrumfLogo,
} satisfies Record<LogoName, (props: LogoProps) => ReactElement>;

const here = dirname(fileURLToPath(import.meta.url));

type AssetSource = { file: string; source: string };

function definedIds(text: string): string[] {
  return [...text.matchAll(/\bid="([^"]+)"/g)].flatMap((match) => match[1] ?? []);
}

function assetSources(): AssetSource[] {
  const dirs = [join(here, "bespoke"), join(here, "../illustrations")];
  return dirs.flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => ({ file: name, source: readFileSync(join(dir, name), "utf8") }))
  );
}

describe("bespoke icons", () => {
  it("renders a titled SVG as role=img and a decorative SVG as aria-hidden", () => {
    const titled = renderToStaticMarkup(createElement(Vipps, { title: "Vipps" }));
    expect(titled).toContain('role="img"');
    expect(titled).toContain("<title>Vipps</title>");
    expect(titled).not.toContain("aria-hidden");

    const decorative = renderToStaticMarkup(createElement(Vipps));
    expect(decorative).toContain("aria-hidden");
    expect(decorative).toContain("focusable");
    expect(decorative).not.toContain("<title>");
  });

  it("uses canonical Signing fill classes and rejects Material leftovers", () => {
    const html = renderToStaticMarkup(createElement(Signing));
    expect(html).toContain("fill-secondary-soft");
    expect(html).toContain("fill-card-soft");
    expect(html).toContain("fill-feature-foreground");
    expect(html).toContain("fill-foreground");
    expect(html).not.toContain("fill-secondary-container");
    expect(html).not.toContain("fill-surface-bright");
    expect(html).not.toContain("fill-on-surface-variant");
    expect(html).not.toContain('className="fill-on-surface"');
  });

  it("does not embed a .ref path in bespoke source", () => {
    const files = readdirSync(join(here, "bespoke")).filter((name) => name.endsWith(".tsx"));
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      expect(readFileSync(join(here, "bespoke", name), "utf8"), name).not.toContain(".ref/");
    }
  });

  it("ships no static title element besides the prop-driven title slot", () => {
    const files = readdirSync(join(here, "bespoke")).filter((name) => name.endsWith(".tsx"));
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const titles = [
        ...readFileSync(join(here, "bespoke", name), "utf8").matchAll(/<title>[\s\S]*?<\/title>/g),
      ].map((match) => match[0]);
      for (const title of titles) {
        expect(title, name).toBe("<title>{title}</title>");
      }
    }
  });

  it("lets Gudbrandsdal full announce the passed title and stay silent when decorative", () => {
    const titled = renderToStaticMarkup(
      createElement(GudbrandsdalEnergiLogo, { title: "Gudbrandsdal Energi" })
    );
    expect(titled).toContain("<title>Gudbrandsdal Energi</title>");
    expect(titled).not.toContain("Asset 1");
    expect(titled.match(/<title>/g)).toEqual(["<title>"]);

    const decorative = renderToStaticMarkup(createElement(GudbrandsdalEnergiLogo));
    expect(decorative).not.toContain("<title>");
    expect(decorative).toContain("aria-hidden");
  });

  it("documents fixed-palette artwork as permitted for illustrations", () => {
    const contract = readFileSync(join(here, "bespoke-svg.ts"), "utf8");
    expect(contract).toContain("Fixed-palette artwork is permitted for illustrations");
    expect(renderToStaticMarkup(createElement(Contract))).toContain("#F8D0BA");
    expect(renderToStaticMarkup(createElement(HomeTitleIcon))).toContain("#F8D0BA");
    expect(renderToStaticMarkup(createElement(Signing))).toContain("fill-secondary-soft");
  });

  it("namespaces defs ids per asset so no id is defined by two assets", () => {
    // The next Figma/Sketch intake with generic ids (mask0_1_353, linearGradient-1)
    // must fail here instead of colliding with another asset's defs in the DOM.
    const owners = new Map<string, string>();
    let definitions = 0;
    for (const { file, source } of assetSources()) {
      const defined = definedIds(source);
      definitions += defined.length;
      for (const id of defined) {
        const owner = owners.get(id);
        expect(owner, `id "${id}" is defined in both ${owner} and ${file}`).toBeUndefined();
        owners.set(id, file);
      }
      for (const [, ref] of source.matchAll(/url\(#([^)]+)\)/g)) {
        expect(defined, `${file} references #${ref}`).toContain(ref);
      }
    }
    expect(definitions).toBeGreaterThan(0);
  });

  it("keeps bespoke assets and illustrations server-safe: no hooks, no use client", () => {
    for (const { file, source } of assetSources()) {
      expect(source, file).not.toContain('"use client"');
      expect(source, file).not.toMatch(/import\s*\{[^}]*\buse[A-Z]/);
      expect(source, file).not.toMatch(/\buse[A-Z][A-Za-z]*\s*\(/);
    }
  });

  it("renders the same asset twice as duplicate-but-identical defs", () => {
    // Two instances of one asset share identical namespaced defs by construction,
    // so the first definition in the DOM wins harmlessly. Cross-asset collisions
    // are what the per-asset id namespace above prevents.
    for (const Component of [Signing, Contract, TelinetLogo]) {
      const html = renderToStaticMarkup(
        createElement("div", null, createElement(Component), createElement(Component))
      );
      const ids = definedIds(html);
      expect(ids.length, Component.name).toBeGreaterThan(0);
      const counts = new Map<string, number>();
      for (const id of ids) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      for (const [id, count] of counts) {
        expect(count, `${Component.name} defines ${id}`).toBe(2);
      }
      for (const [, ref] of html.matchAll(/url\(#([^)]+)\)/g)) {
        expect(ids, `${Component.name} references #${ref}`).toContain(ref);
      }
    }
  });

  it("routes logo variant switching through createLogo", () => {
    expect(renderToStaticMarkup(createElement(TelinetLogo, { variant: "mark", title: "Telinet" }))).toBe(
      renderToStaticMarkup(createElement(TelinetLogoMark, { title: "Telinet" }))
    );
    expect(renderToStaticMarkup(createElement(TelinetLogo, { title: "Telinet" }))).toBe(
      renderToStaticMarkup(createElement(TelinetLogoFull, { title: "Telinet" }))
    );
    expect(renderToStaticMarkup(createElement(TelinetLogo, { variant: "full" }))).toBe(
      renderToStaticMarkup(createElement(TelinetLogoFull))
    );
    for (const [name, Logo] of Object.entries(logosByName)) {
      // SAFETY: displayName is stamped by createLogo; the public prop type does not carry it.
      expect((Logo as { displayName?: string }).displayName, name).toBe(name);
    }
    for (const name of LOGO_NAMES) {
      const file = `${iconModuleSlug(name)}.tsx`;
      const source = readFileSync(join(here, "bespoke", file), "utf8");
      expect(source, file).toContain("createLogo(");
      expect(source, file).not.toContain('if (variant === "mark")');
    }
  });
});

describe("illustrations", () => {
  it("exports FkasMeter from the subpath and not the root barrel", () => {
    expect(FkasMeter).toEqual(expect.any(Function));
    expect(Root).not.toHaveProperty("FkasMeter");
    for (const name of [...BESPOKE_ICON_NAMES, ...LOGO_NAMES, "BrandLogo"]) {
      expect(Root).not.toHaveProperty(name);
    }
  });

  it("uses the titled vs decorative SVG contract", () => {
    const titled = renderToStaticMarkup(createElement(FkasMeter, { title: "Meter" }));
    expect(titled).toContain('role="img"');
    expect(titled).toContain("<title>Meter</title>");
    const decorative = renderToStaticMarkup(createElement(FkasMeter));
    expect(decorative).toContain("aria-hidden");
    expect(decorative).not.toContain("<title>");
  });
});
