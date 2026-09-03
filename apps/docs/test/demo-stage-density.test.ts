import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(here, "..");
const globalsCss = readFileSync(join(docsRoot, "src/styles/globals.css"), "utf8");
const artifactPath = join(docsRoot, "../../packages/ui/dist/demo-stage-comfortable.css");

describe("DemoStage comfortable density", () => {
  it("imports the generated library artifact and carries no hand-copied metrics", () => {
    expect(globalsCss).toMatch(/@import\s+"@elmeragroup\/ui\/demo-stage-comfortable\.css"/);
    expect(globalsCss).not.toMatch(/--control-/);
    expect(existsSync(join(docsRoot, "src/components/DemoFrame.comfortable.css"))).toBe(false);
    expect(existsSync(join(docsRoot, "scripts/elmera-demo-stage-density.ts"))).toBe(false);
  });

  it("does not wire a docs PostCSS density plugin", () => {
    const config = readFileSync(join(docsRoot, "postcss.config.mjs"), "utf8");
    expect(config).not.toMatch(/elmera-demo-stage-density|DemoFrame\.css/);
  });

  it("the imported artifact exists after the ui build", () => {
    // turbo.json gives every `test` task the `@elmeragroup/ui#build` dependency, so the
    // artifact is guaranteed here; its absence is the regression this test is for.
    expect(existsSync(artifactPath), artifactPath).toBe(true);
    expect(readFileSync(artifactPath, "utf8")).toContain('.DemoStage[data-density="comfortable"]');
  });
});
