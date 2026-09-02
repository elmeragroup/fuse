import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { toggleVariants as publicToggleVariants } from "../../toggle";
import { toggleVariants } from "../toggle/toggle-variants";

const here = dirname(fileURLToPath(import.meta.url));

describe("toggle-group recipe borrow", () => {
  it("imports the public toggleVariants identity and has no local tv fork", () => {
    expect(toggleVariants).toBe(publicToggleVariants);
    expect(existsSync(join(here, "toggle-group-variants.ts"))).toBe(false);
  });
});
