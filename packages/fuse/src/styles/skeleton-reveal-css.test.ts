/**
 * Unit under test: how `skeleton-reveal.css`, a private sheet `fuse.css` imports, reaches both
 * ways of consuming Fuse's styles. Oracle: the sheet's own two load-bearing rules, the ghost's
 * transparent glyphs and the first-paint cover over media, each of which must arrive in the
 * components layer of a Tailwind-source consumer build and in the shipped standalone stylesheet.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseScopedBlocks } from "../../test/css-rules";
import { consumerBuild } from "../../test/tailwind-consumer-build";

const here = dirname(fileURLToPath(import.meta.url));

/** Whether a block under `@layer components` declares `name: value` for a selector naming `slot`. */
function declaresInComponents(css: string, slot: string, name: string, value: string): boolean {
  return parseScopedBlocks(css).some(
    ({ block, ancestors }) =>
      [...ancestors, block.prelude].some((prelude) => prelude.includes(`[data-slot="${slot}"]`)) &&
      ancestors.some((ancestor) => ancestor.startsWith("@layer components")) &&
      block.declarations.some((declaration) => declaration.name === name && declaration.value === value)
  );
}

describe("skeleton-reveal.css", () => {
  it("reaches a Tailwind-source consumer build through fuse.css, in the components layer", async () => {
    const css = await consumerBuild([]);
    expect(
      declaresInComponents(css, "skeleton-reveal-ghost", "-webkit-text-fill-color", "transparent !important")
    ).toBe(true);
    expect(
      declaresInComponents(css, "skeleton-reveal-skeleton", "outline-offset", "-100vmax !important")
    ).toBe(true);
  });

  it("ships in the standalone stylesheet", () => {
    const standalone = join(here, "../../dist/styles.css");
    expect(existsSync(standalone), "build the package first").toBe(true);
    const css = readFileSync(standalone, "utf8");
    expect(css).toContain('[data-slot="skeleton-reveal-ghost"]');
    expect(css).toMatch(/-webkit-text-fill-color:\s*transparent\s*!important/u);
    expect(css).toMatch(/outline-offset:\s*-100vmax\s*!important/u);
  });
});
