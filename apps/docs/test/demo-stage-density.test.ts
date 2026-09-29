import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(here, "..");
const artifactPath = join(docsRoot, "../../packages/fuse/dist/demo-stage-comfortable.css");

describe("DemoStage comfortable density", () => {
  it("the imported artifact exists after the ui build", () => {
    // apps/docs/turbo.json shadows the root `test` task, so the guarantee is transitive:
    // docs#test -> docs#build -> docs#generate -> ^build -> @elmeragroup/fuse#build, through
    // the workspace dependency in package.json. Its absence is the regression, not a skip.
    expect(existsSync(artifactPath), artifactPath).toBe(true);
    expect(readFileSync(artifactPath, "utf8")).toContain('[data-demo-stage][data-density="comfortable"]');
  });
});
