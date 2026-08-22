import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("workspace lint script", () => {
  it("runs oxlint over the tree with --deny-warnings and without --quiet", () => {
    const parsed = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    if (parsed === null || Array.isArray(parsed)) {
      throw new Error("root package.json is not an object");
    }
    expect(parsed.scripts.lint).toMatch(/\boxlint\b/);
    expect(parsed.scripts.lint).toMatch(/(?:^|\s)\.(?:\s|$)/);
    expect(parsed.scripts.lint).toContain("--deny-warnings");
    expect(parsed.scripts.lint).not.toContain("--quiet");
  });

  it("keeps the previously warning-level rules enabled", () => {
    const parsed = JSON.parse(readFileSync(join(repoRoot, ".oxlintrc.json"), "utf8"));
    if (parsed === null || Array.isArray(parsed)) {
      throw new Error(".oxlintrc.json is not an object");
    }
    expect(parsed.rules["import/consistent-type-specifier-style"]).toEqual(["warn", "prefer-top-level"]);
    expect(parsed.rules["anti-slop/require-safety-comment-for-type-assertion"]).toBe("warn");
    expect(parsed.rules["anti-slop/no-runtime-typeof"]).toBe("warn");

    const antiSlopOverride = parsed.overrides.find((entry) =>
      entry.files.includes("tooling/oxlint-anti-slop/**")
    );
    expect(antiSlopOverride?.rules["anti-slop/no-runtime-typeof"]).toBe("off");

    const uiSrcOverride = parsed.overrides.find((entry) =>
      entry.files.includes("packages/ui/src/**/*.{ts,tsx}")
    );
    expect(uiSrcOverride?.rules["elmera/no-hardcoded-density-metrics"]).toBe("warn");
    expect(uiSrcOverride?.rules["elmera/facade-reexport-grammar"]).toBe("error");
    expect(uiSrcOverride?.rules["elmera/no-rac-outside-quarantine"]).toBe("error");
  });
});
