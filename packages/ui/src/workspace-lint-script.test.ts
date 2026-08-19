import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

type WorkspaceManifest = {
  scripts: {
    lint: string;
  };
};

type OxlintFileOverride = {
  files: string[];
  rules: {
    "anti-slop/no-runtime-typeof"?: string;
  };
};

type OxlintConfig = {
  rules: {
    "import/consistent-type-specifier-style": string | [string, string];
    "anti-slop/require-safety-comment-for-type-assertion": string;
    "anti-slop/no-runtime-typeof": string;
  };
  overrides: OxlintFileOverride[];
};

describe("workspace lint script", () => {
  it("runs oxlint over the tree with --deny-warnings and without --quiet", () => {
    const parsed: unknown = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    if (parsed === null || Array.isArray(parsed)) {
      throw new Error("root package.json is not an object");
    }
    // SAFETY: this test only reads the workspace lint script string.
    const pkg = parsed as WorkspaceManifest;
    expect(pkg.scripts.lint).toMatch(/\boxlint\b/);
    expect(pkg.scripts.lint).toMatch(/(?:^|\s)\.(?:\s|$)/);
    expect(pkg.scripts.lint).toContain("--deny-warnings");
    expect(pkg.scripts.lint).not.toContain("--quiet");
  });

  it("keeps the previously warning-level rules enabled", () => {
    const parsed: unknown = JSON.parse(readFileSync(join(repoRoot, ".oxlintrc.json"), "utf8"));
    if (parsed === null || Array.isArray(parsed)) {
      throw new Error(".oxlintrc.json is not an object");
    }
    // SAFETY: this test only reads rule enablement from the committed oxlint config.
    const config = parsed as OxlintConfig;
    expect(config.rules["import/consistent-type-specifier-style"]).toEqual(["warn", "prefer-top-level"]);
    expect(config.rules["anti-slop/require-safety-comment-for-type-assertion"]).toBe("warn");
    expect(config.rules["anti-slop/no-runtime-typeof"]).toBe("warn");

    const antiSlopOverride = config.overrides.find((entry) =>
      entry.files.includes("tooling/oxlint-anti-slop/**")
    );
    expect(antiSlopOverride?.rules["anti-slop/no-runtime-typeof"]).toBe("off");
  });
});
