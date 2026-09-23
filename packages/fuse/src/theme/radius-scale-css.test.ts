import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseCssBlocks } from "./css-rules";
import { RADIUS_RUNG_NAMES, RADIUS_RUNG_STEPS } from "./tokens/radius-scale";

const here = dirname(fileURLToPath(import.meta.url));
const fuseCss = readFileSync(join(here, "../styles/fuse.css"), "utf8");

const STEPS_FROM_RADIUS = /^calc\(var\(--radius\) ([+-]) (?:([0-9]+) \* )?var\(--radius-step\)\)$/;

/**
 * The `--radius-step` count a `fuse.css` rung declares. `var(--radius)` is 0,
 * `calc(var(--radius) - var(--radius-step))` is -1, and
 * `calc(var(--radius) + 2 * var(--radius-step))` is 2. Any other form is `undefined`, which
 * fails the match.
 */
function declaredSteps(value: string): number | undefined {
  if (value === "var(--radius)") {
    return 0;
  }
  const match = STEPS_FROM_RADIUS.exec(value);
  if (match === null) {
    return undefined;
  }
  const count = match[2] === undefined ? 1 : Number(match[2]);
  return match[1] === "-" ? -count : count;
}

describe("radius scale CSS", () => {
  // Cross-check: the @theme block in fuse.css is hand-written, and RADIUS_RUNG_STEPS is the
  // oracle it must reproduce.
  it("derives exactly the RADIUS_RUNG_STEPS from --radius and --radius-step in the @theme block", () => {
    const themeBlocks = parseCssBlocks(fuseCss).filter((block) => block.prelude === "@theme inline");
    expect(themeBlocks).toHaveLength(1);
    const rungs = (themeBlocks[0]?.declarations ?? [])
      .filter((declaration) => declaration.name.startsWith("radius-"))
      .map((declaration) => ({ name: declaration.name, steps: declaredSteps(declaration.value) }));

    expect(rungs).toEqual(RADIUS_RUNG_NAMES.map((name) => ({ name, steps: RADIUS_RUNG_STEPS[name] })));
  });
});
