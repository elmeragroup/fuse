import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { generateThemesCss } from "./generate-css";
import { EXTERNAL_RESET_KEYS, TOKEN_NAMES } from "./tokens/contract";

const here = dirname(fileURLToPath(import.meta.url));
const uiCss = readFileSync(join(here, "../styles/ui.css"), "utf8");
const compiledCssPath = join(here, "../../dist/styles.css");
const packedRawCssPath = join(here, "../../dist/styles/ui.css");

const DENSITY_VARIABLE_NAMES = [
  "--control-h-xs",
  "--control-h-sm",
  "--control-h-md",
  "--control-h-lg",
  "--control-px-xs",
  "--control-px-sm",
  "--control-px-md",
  "--control-px-lg",
  "--control-px-icon-xs",
  "--control-px-icon-sm",
  "--control-px-icon-md",
  "--control-px-icon-lg",
  "--control-gap-xs",
  "--control-gap-sm",
  "--control-gap-md",
  "--control-gap-lg",
  "--control-text",
  "--control-leading",
] as const;

describe("density CSS", () => {
  it("declares dense defaults on :root and comfortable overrides on the rooted attribute", () => {
    expect(uiCss).toContain(':root[data-density="comfortable"]');
    const dense = /:root\s*\{[^}]*\}/s.exec(uiCss)?.[0] ?? "";
    const comfortable = /:root\[data-density="comfortable"\]\s*\{[^}]*\}/s.exec(uiCss)?.[0] ?? "";

    expect(dense).toMatch(/--control-h-xs:\s*1\.5rem/);
    expect(dense).toMatch(/--control-h-sm:\s*2rem/);
    expect(dense).toMatch(/--control-h-md:\s*2\.25rem/);
    expect(dense).toMatch(/--control-h-lg:\s*2\.5rem/);
    expect(dense).toMatch(/--control-px-xs:\s*0\.5rem/);
    expect(dense).toMatch(/--control-px-sm:\s*0\.625rem/);
    expect(dense).toMatch(/--control-px-md:\s*0\.625rem/);
    expect(dense).toMatch(/--control-px-lg:\s*0\.625rem/);
    expect(dense).toMatch(/--control-px-icon-xs:\s*0\.375rem/);
    expect(dense).toMatch(/--control-px-icon-sm:\s*0\.375rem/);
    expect(dense).toMatch(/--control-px-icon-md:\s*0\.5rem/);
    expect(dense).toMatch(/--control-px-icon-lg:\s*0\.5rem/);
    expect(dense).toMatch(/--control-gap-xs:\s*0\.25rem/);
    expect(dense).toMatch(/--control-gap-sm:\s*0\.25rem/);
    expect(dense).toMatch(/--control-gap-md:\s*0\.375rem/);
    expect(dense).toMatch(/--control-gap-lg:\s*0\.375rem/);
    expect(dense).toMatch(/--control-text:\s*0\.875rem/);
    expect(dense).toMatch(/--control-leading:\s*1\.25rem/);

    expect(comfortable).toMatch(/--control-h-xs:\s*2rem/);
    expect(comfortable).toMatch(/--control-h-sm:\s*2\.25rem/);
    expect(comfortable).toMatch(/--control-h-md:\s*2\.75rem/);
    expect(comfortable).toMatch(/--control-h-lg:\s*3rem/);
    expect(comfortable).toMatch(/--control-px-xs:\s*0\.75rem/);
    expect(comfortable).toMatch(/--control-px-sm:\s*0\.875rem/);
    expect(comfortable).toMatch(/--control-px-md:\s*0\.875rem/);
    expect(comfortable).toMatch(/--control-px-lg:\s*0\.875rem/);
    expect(comfortable).toMatch(/--control-px-icon-xs:\s*0\.625rem/);
    expect(comfortable).toMatch(/--control-px-icon-sm:\s*0\.625rem/);
    expect(comfortable).toMatch(/--control-px-icon-md:\s*0\.75rem/);
    expect(comfortable).toMatch(/--control-px-icon-lg:\s*0\.75rem/);
    expect(comfortable).toMatch(/--control-gap-xs:\s*0\.375rem/);
    expect(comfortable).toMatch(/--control-gap-sm:\s*0\.375rem/);
    expect(comfortable).toMatch(/--control-gap-md:\s*0\.5rem/);
    expect(comfortable).toMatch(/--control-gap-lg:\s*0\.5rem/);
    expect(comfortable).toMatch(/--control-text:\s*1\.125rem/);
    expect(comfortable).toMatch(/--control-leading:\s*1\.5rem/);
  });

  it("does not key density metrics on data-theme-variant or a nested attribute selector", () => {
    expect(uiCss).not.toMatch(/\[data-theme-variant[^\]]*\][^{]*--control-/s);
    expect(uiCss).not.toMatch(/(?<!:root)\[data-density="comfortable"\]/);
  });

  it("never enters TOKEN_NAMES or EXTERNAL_RESET_KEYS", () => {
    for (const name of DENSITY_VARIABLE_NAMES) {
      const token = name.replace(/^--/, "");
      expect(TOKEN_NAMES).not.toContain(token);
      expect(EXTERNAL_RESET_KEYS).not.toContain(token);
    }
  });

  it("does not enter generated theme CSS", () => {
    const css = generateThemesCss();
    expect(css).not.toContain("--control-");
    expect(css).not.toContain("data-density");
  });

  it.skipIf(!existsSync(compiledCssPath) || !existsSync(packedRawCssPath))(
    "reaches both stylesheet distribution modes",
    () => {
      const compiled = readFileSync(compiledCssPath, "utf8");
      const packedRaw = readFileSync(packedRawCssPath, "utf8");
      expect(compiled).toContain("--control-h-md");
      expect(compiled).toContain(':root[data-density="comfortable"]');
      expect(packedRaw).toContain("--control-h-md");
      expect(packedRaw).toContain(':root[data-density="comfortable"]');
    }
  );
});
