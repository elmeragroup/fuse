import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { asRecord, asRecordArray, asString, isString, readJsonObject } from "./json-object.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {Record<string, unknown>} override
 */
function overrideFiles(override) {
  const files = override.files;
  if (!Array.isArray(files)) {
    throw new Error("override.files is not an array");
  }
  return files.filter((file) => isString(file));
}

describe("workspace lint script", () => {
  it("runs oxlint over the tree with --deny-warnings and without --quiet", () => {
    const parsed = readJsonObject(join(repoRoot, "package.json"));
    const lint = asString(asRecord(parsed.scripts, "scripts").lint, "scripts.lint");
    expect(lint).toMatch(/\boxlint\b/);
    expect(lint).toMatch(/(?:^|\s)\.(?:\s|$)/);
    expect(lint).toContain("--deny-warnings");
    expect(lint).not.toContain("--quiet");
  });

  it("runs repo-policy tests from the root vitest project in ci:checks", () => {
    const turbo = readFileSync(join(repoRoot, "turbo.json"), "utf8");
    expect(turbo).toContain('"//#test:repo-policy"');
    const parsed = readJsonObject(join(repoRoot, "package.json"));
    expect(asString(asRecord(parsed.scripts, "scripts")["test:repo-policy"], "test:repo-policy")).toMatch(
      /\bvitest\b/
    );
  });

  it("keeps the previously warning-level rules enabled", () => {
    const parsed = readJsonObject(join(repoRoot, ".oxlintrc.json"));
    const rules = asRecord(parsed.rules, "rules");
    expect(parsed.plugins).toEqual(["typescript", "oxc", "import", "unicorn"]);
    expect(rules["unicorn/filename-case"]).toEqual([
      "error",
      { case: "kebabCase", ignore: ["^[a-z]{2}-[A-Z]{2}\\."] },
    ]);
    expect(rules["unicorn/no-useless-spread"]).toBe("off");
    expect(rules["import/consistent-type-specifier-style"]).toEqual(["warn", "prefer-top-level"]);
    expect(rules["anti-slop/require-safety-comment-for-type-assertion"]).toBe("warn");
    expect(rules["anti-slop/no-runtime-typeof"]).toBe("warn");

    const overrides = asRecordArray(parsed.overrides, "overrides");
    const appsUiOverride = overrides.find((entry) => overrideFiles(entry).includes("apps/**/*.{ts,tsx}"));
    expect(appsUiOverride?.plugins).toEqual(["typescript", "oxc", "react", "unicorn"]);

    const antiSlopOverride = overrides.find((entry) =>
      overrideFiles(entry).includes("tooling/oxlint-anti-slop/**")
    );
    expect(asRecord(antiSlopOverride?.rules, "anti-slop override rules")["anti-slop/no-runtime-typeof"]).toBe(
      "off"
    );

    const uiSrcOverride = overrides.find((entry) =>
      overrideFiles(entry).includes("packages/ui/src/**/*.{ts,tsx}")
    );
    const uiSrcRules = asRecord(uiSrcOverride?.rules, "ui src override rules");
    expect(uiSrcRules["elmera/no-hardcoded-density-metrics"]).toBe("warn");
    expect(uiSrcRules["elmera/facade-reexport-grammar"]).toBe("error");
    expect(uiSrcRules["elmera/no-rac-outside-quarantine"]).toBe("error");
    expect(uiSrcRules["elmera/restrict-focus-ring-call"]).toBe("error");
    expect(uiSrcRules["elmera/no-field-part-jsx"]).toBe("error");
    expect(uiSrcRules["no-restricted-imports"]?.[0]).toBe("error");

    const dictionaryFactoryOverride = overrides.find((entry) =>
      overrideFiles(entry).includes("packages/ui/src/intl/create-string-dictionary.ts")
    );
    expect(
      asRecord(dictionaryFactoryOverride?.rules, "dictionary factory override rules")["no-restricted-imports"]
    ).toBe("off");
  });
});
