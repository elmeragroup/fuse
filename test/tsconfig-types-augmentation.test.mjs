import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { asRecord, readJsonObject } from "./json-object.mjs";
import { repoRoot } from "./repo-tree.mjs";

/** The `types` entry that pulls the csstype custom-property augmentation into a program. */
const AUGMENTATION = "@elmeragroup/typescript-config/css-custom-properties";

describe("tsconfig types augmentation", () => {
  it("re-lists the csstype augmentation in the config that overrides `types`", () => {
    const options = asRecord(
      readJsonObject(join(repoRoot, "apps", "static-theme", "tsconfig.json")).compilerOptions,
      "apps/static-theme/tsconfig.json compilerOptions"
    );
    if (!Array.isArray(options.types)) {
      throw new Error("apps/static-theme/tsconfig.json has no compilerOptions.types list");
    }
    expect(options.types).toContain(AUGMENTATION);
  });
});
