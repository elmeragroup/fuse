import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { repoRoot } from "../scripts/lib/paths.ts";

describe("docs#generate turbo outputs", () => {
  it("declares generate outputs so a cache hit restores the generated tree", () => {
    const turbo = readFileSync(join(repoRoot, "apps/docs/turbo.json"), "utf8");
    const generate = /"generate":\s*\{[\s\S]*?\n    \}/.exec(turbo)?.[0];
    expect(generate, "apps/docs/turbo.json is missing a generate task").toBeDefined();
    expect(generate).toMatch(/"outputs"\s*:/);
    expect(generate).toContain("src/generated/**");
    expect(generate).toMatch(/src\/app\/\\+\(docs\\+\)\/components\/\*\/api\.json/);
    expect(generate).toContain("public/components/**");
    expect(generate).toContain("public/llms.txt");
  });
});
