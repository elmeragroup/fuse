import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseCssBlocks } from "./css-rules";
import { RADIUS_STEP_NAMES, RADIUS_STEP_OFFSETS } from "./tokens/radius-scale";

const here = dirname(fileURLToPath(import.meta.url));
const fuseCss = readFileSync(join(here, "../styles/fuse.css"), "utf8");

const OFFSET_FROM_RADIUS = /^calc\(var\(--radius\) ([+-]) ([0-9]+(?:\.[0-9]+)?)px\)$/;

/**
 * The pixel offset a `fuse.css` step declares: `var(--radius)` is 0, and
 * `calc(var(--radius) - 2px)` is -2. Any other form is `undefined`, which fails the match.
 */
function declaredOffset(value: string): number | undefined {
  if (value === "var(--radius)") {
    return 0;
  }
  const match = OFFSET_FROM_RADIUS.exec(value);
  if (match === null) {
    return undefined;
  }
  const amount = Number(match[2]);
  return match[1] === "-" ? -amount : amount;
}

describe("radius scale CSS", () => {
  // Cross-check: the @theme block in fuse.css is hand-written, and RADIUS_STEP_OFFSETS is the
  // oracle it must reproduce.
  it("derives exactly the RADIUS_STEP_OFFSETS from --radius in the @theme block", () => {
    const themeBlocks = parseCssBlocks(fuseCss).filter((block) => block.prelude === "@theme inline");
    expect(themeBlocks).toHaveLength(1);
    const steps = (themeBlocks[0]?.declarations ?? [])
      .filter((declaration) => declaration.name.startsWith("radius-"))
      .map((declaration) => ({ name: declaration.name, offset: declaredOffset(declaration.value) }));

    expect(steps).toEqual(RADIUS_STEP_NAMES.map((name) => ({ name, offset: RADIUS_STEP_OFFSETS[name] })));
  });
});
