import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseCssBlocks } from "../../test/css-rules";
import { RADIUS_RUNG_NAMES, RADIUS_RUNGS } from "./tokens/radius-scale";

const here = dirname(fileURLToPath(import.meta.url));
const fuseCss = readFileSync(join(here, "../styles/fuse.css"), "utf8");

describe("radius scale CSS", () => {
  // This cross-check reads the hand-written @theme block in fuse.css, and the CSS values in
  // RADIUS_RUNGS are the oracle it must reproduce character for character.
  it("declares exactly the RADIUS_RUNGS values in the @theme block", () => {
    const themeBlocks = parseCssBlocks(fuseCss).filter((block) => block.prelude === "@theme inline");
    expect(themeBlocks).toHaveLength(1);
    const rungs = (themeBlocks[0]?.declarations ?? [])
      .filter((declaration) => declaration.name.startsWith("radius-"))
      .map((declaration) => ({ name: declaration.name, value: declaration.value }));

    expect(rungs).toEqual(RADIUS_RUNG_NAMES.map((name) => ({ name, value: RADIUS_RUNGS[name].css })));
  });
});
