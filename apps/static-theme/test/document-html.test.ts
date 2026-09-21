import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { applyHostRootAttributes } from "../src/host-html";
import { DOCUMENT_COLOR_SCHEME } from "../src/theme";
import {
  BOOTSTRAP_MANIFEST_KEY,
  DOCUMENT_BRAND,
  INJECTED_BOOTSTRAP_SOURCE_KEY,
  bootstrapScripts,
  definesCssCustomProperty,
  isClassicScript,
  moduleScriptIndex,
  packedColorSchemeScriptSource,
  readDocumentBrand,
  readDocumentDensity,
  tokenBackgroundDefinitionIndex,
} from "./html";

const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function readFixtureFile(relativePath: string): string {
  return readFileSync(path.join(fixtureRoot, relativePath), "utf8");
}

function moveStylesheetLinksAfterModule(html: string): string {
  const links: string[] = [];
  const stripped = html.replace(/<link\b[^>]*\brel=(["'])stylesheet\1[^>]*>\s*/gi, (match) => {
    links.push(match.trim());
    return "";
  });
  const moduleIndex = moduleScriptIndex(stripped);
  if (links.length === 0 || moduleIndex === -1) {
    return html;
  }
  const headClose = stripped.indexOf("</head>", moduleIndex);
  const insertAt = headClose === -1 ? stripped.length : headClose;
  return `${stripped.slice(0, insertAt)}${links.join("")}${stripped.slice(insertAt)}`;
}

function expectHostFirstPaintHtml(
  html: string,
  expectedSource: string,
  documentPath: string,
  expectedBrand = DOCUMENT_BRAND
): void {
  expect(readDocumentBrand(html)).toEqual(expectedBrand);
  expect(readDocumentDensity(html)).toBe("dense");

  const bootstraps = bootstrapScripts(html);
  expect(bootstraps).toHaveLength(1);
  const bootstrap = bootstraps[0];
  expect(bootstrap).toBeDefined();
  expect(bootstrap && isClassicScript(bootstrap.attrs)).toBe(true);
  expect(bootstrap?.source).toBe(expectedSource);
  expect(bootstrap?.attrs).not.toMatch(/\stype=/i);
  expect(html).not.toContain(INJECTED_BOOTSTRAP_SOURCE_KEY);

  const moduleIndex = moduleScriptIndex(html);
  const bootstrapStart = bootstrap?.start ?? -1;
  const tokenCssIndex = tokenBackgroundDefinitionIndex(html, documentPath);
  expect(moduleIndex).toBeGreaterThan(-1);
  expect(bootstrapStart).toBeGreaterThan(-1);
  expect(tokenCssIndex).toBeGreaterThan(-1);
  expect(tokenCssIndex).toBeLessThan(bootstrapStart);
  expect(bootstrapStart).toBeLessThan(moduleIndex);

  expect(html).toMatch(/background:\s*var\(--background\)/);
  expect(html).toMatch(/rel="stylesheet"/);
}

describe("static theme built HTML", () => {
  it("stamps brand attributes and a classic bootstrap before the module entry", () => {
    const html = readFixtureFile("dist/index.html");
    expectHostFirstPaintHtml(
      html,
      packedColorSchemeScriptSource(
        JSON.stringify({
          storageKey: DOCUMENT_COLOR_SCHEME.storageKey,
          defaultColorScheme: DOCUMENT_COLOR_SCHEME.defaultColorScheme,
          enableSystem: DOCUMENT_COLOR_SCHEME.enableSystem,
        })
      ),
      path.join(fixtureRoot, "dist/index.html")
    );
  });

  it("passes the same document-level force into the packed theme bootstrap", () => {
    const html = readFixtureFile("dist/forced-dark.html");
    expectHostFirstPaintHtml(
      html,
      packedColorSchemeScriptSource(
        JSON.stringify({
          storageKey: DOCUMENT_COLOR_SCHEME.storageKey,
          defaultColorScheme: DOCUMENT_COLOR_SCHEME.defaultColorScheme,
          enableSystem: DOCUMENT_COLOR_SCHEME.enableSystem,
          forcedColorScheme: "dark",
        })
      ),
      path.join(fixtureRoot, "dist/forced-dark.html")
    );
  });

  it("fails if token CSS follows the blocking bootstrap while --background is unset", () => {
    const documentPath = path.join(fixtureRoot, "dist/index.html");
    const html = readFixtureFile("dist/index.html");
    const lateCss = moveStylesheetLinksAfterModule(html);
    const bootstrap = bootstrapScripts(lateCss)[0];
    expect(bootstrap).toBeDefined();
    expect(definesCssCustomProperty("html{background:var(--background)}", "--background")).toBe(false);
    expect(tokenBackgroundDefinitionIndex(lateCss, documentPath)).toBeGreaterThan(bootstrap?.start ?? -1);
    expect(bootstrap?.start ?? -1).toBeLessThan(moduleScriptIndex(lateCss));
  });

  it("stamps comfortable density on the isolated preview document", () => {
    const html = readFixtureFile("dist/comfortable.html");
    expect(readDocumentBrand(html)).toEqual(DOCUMENT_BRAND);
    expect(readDocumentDensity(html)).toBe("comfortable");
  });

  it("throws when source HTML already contains theme or density attributes", () => {
    const attributes = {
      "data-theme-variant": "internal",
      "data-theme-brand": "elma",
      "data-theme-segment": "private",
    } as const;
    const density = { "data-density": "dense" } as const;

    expect(() => applyHostRootAttributes('<html data-theme-brand="fkas">', attributes, density)).toThrow(
      /must not already contain data-theme-brand/
    );
    expect(() =>
      applyHostRootAttributes('<html data-theme-variant="external">', attributes, density)
    ).toThrow(/must not already contain data-theme-variant/);
    expect(() => applyHostRootAttributes('<html data-theme-segment="company">', attributes, density)).toThrow(
      /must not already contain data-theme-segment/
    );
    expect(() => applyHostRootAttributes('<html data-density="comfortable">', attributes, density)).toThrow(
      /must not already contain data-density/
    );

    const stamped = applyHostRootAttributes('<html lang="nb">', attributes, density);
    expect(stamped).toContain('data-theme-variant="internal"');
    expect(stamped).toContain('data-theme-brand="elma"');
    expect(stamped).toContain('data-theme-segment="private"');
    expect(stamped).toContain('data-density="dense"');
  });

  it("does not hand-copy the bootstrap or brand attributes into source HTML", () => {
    for (const relativePath of ["index.html", "forced-dark.html", "comfortable.html"] as const) {
      const html = readFixtureFile(relativePath);
      expect(html).not.toContain(BOOTSTRAP_MANIFEST_KEY);
      expect(html).not.toContain("data-theme-variant");
      expect(html).not.toContain("data-theme-brand");
      expect(html).not.toContain("data-theme-segment");
      expect(html).not.toContain("data-density");
      expect(html).not.toContain("createRoot");
    }
  });

  it("uses Vite transformIndexHtml against the public packed theme entry", () => {
    const config = readFixtureFile("vite.config.ts");
    expect(config).toContain("packages/fuse/dist/theme.js");
    expect(config).toContain("colorSchemeScriptSource");
    expect(config).toContain("themeAttributes");
    expect(config).toContain("densityAttributes");
    expect(config).toContain("defaultDensityForVariant");
    expect(config).toContain("transformIndexHtml");
    expect(config).not.toContain("createRoot");
    expect(config).not.toContain("dangerouslySetInnerHTML");
  });

  it("does not render the bootstrap through the client graph", () => {
    for (const relativePath of [
      "src/main.tsx",
      "src/forced-dark.tsx",
      "src/comfortable.tsx",
      "src/render.tsx",
      "src/app.tsx",
    ] as const) {
      const source = readFixtureFile(relativePath);
      expect(source).not.toMatch(/\bColorSchemeScript\b/);
      expect(source).not.toContain("colorSchemeScriptSource");
      expect(source).not.toContain("injectColorSchemeScript={true}");
      expect(source).not.toContain("dangerouslySetInnerHTML");
    }
    expect(readFixtureFile("src/render.tsx")).toContain("injectColorSchemeScript={false}");
  });
});
