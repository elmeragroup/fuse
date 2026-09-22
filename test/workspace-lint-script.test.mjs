import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { asRecord, asRecordArray, asString, isString, readJsonObject } from "./json-object.mjs";
import { repoRoot } from "./repo-tree.mjs";

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
    const appsFuseOverride = overrides.find((entry) => overrideFiles(entry).includes("apps/**/*.{ts,tsx}"));
    expect(appsFuseOverride?.plugins).toEqual(["typescript", "oxc", "react", "unicorn"]);

    const fuseSrcOverride = overrides.find((entry) =>
      overrideFiles(entry).includes("packages/fuse/src/**/*.{ts,tsx}")
    );
    const fuseSrcRules = asRecord(fuseSrcOverride?.rules, "Fuse source override rules");
    expect(fuseSrcRules["elmera/no-hardcoded-density-metrics"]).toBe("warn");
    expect(fuseSrcRules["elmera/no-raw-class-map"]).toBe("error");
    expect(fuseSrcRules["elmera/facade-reexport-grammar"]).toBe("error");

    const docsSrcOverride = overrides.find((entry) =>
      overrideFiles(entry).includes("apps/docs/src/**/*.{ts,tsx}")
    );
    expect(asRecord(docsSrcOverride?.rules, "docs src override rules")["elmera/no-raw-class-map"]).toBe(
      "error"
    );
    expect(fuseSrcRules["elmera/no-rac-outside-quarantine"]).toBe("error");
    expect(fuseSrcRules["elmera/restrict-focus-ring-call"]).toBe("error");
    expect(fuseSrcRules["elmera/restrict-browser-helper-copy"]).toBe("error");
    expect(fuseSrcRules["elmera/no-field-part-jsx"]).toBe("error");

    const fuseTestOverride = overrides.find((entry) =>
      overrideFiles(entry).includes("packages/fuse/test/**/*.{ts,tsx}")
    );
    expect(
      asRecord(fuseTestOverride?.rules, "Fuse test override rules")["elmera/restrict-browser-helper-copy"]
    ).toBe("error");

    const fuseScriptsOverride = overrides.find((entry) =>
      overrideFiles(entry).includes("packages/fuse/scripts/**")
    );
    expect(
      asRecord(fuseScriptsOverride?.rules, "Fuse scripts override rules")[
        "elmera/restrict-package-root-from-script"
      ]
    ).toBe("error");
    expect(fuseSrcRules["no-restricted-imports"]?.[0]).toBe("error");

    const dictionaryFactoryOverride = overrides.find((entry) =>
      overrideFiles(entry).includes("packages/fuse/src/intl/create-string-dictionary.ts")
    );
    expect(
      asRecord(dictionaryFactoryOverride?.rules, "dictionary factory override rules")["no-restricted-imports"]
    ).toBe("off");

    const shadcnOverrideIndexes = overrides.flatMap((entry, index) =>
      Object.keys(asRecord(entry.rules, "override rules")).some((rule) => rule.startsWith("shadcn/"))
        ? [index]
        : []
    );
    const testExemptionIndex = overrides.findIndex((entry) =>
      overrideFiles(entry).includes("**/*.test.{ts,tsx}")
    );
    // Last-wins: the test exemption must be the final override that names a shadcn rule.
    expect(testExemptionIndex).toBe(shadcnOverrideIndexes.at(-1));

    // Deliberately off: the rule must not be named at the root or in any override.
    expect(rules["shadcn/require-static-classes"]).toBeUndefined();
    expect(
      overrides.filter((entry) =>
        Object.hasOwn(asRecord(entry.rules, "override rules"), "shadcn/require-static-classes")
      )
    ).toEqual([]);
  });

  /**
   * The React Aria quarantine boundary moved from the plugin into this config when the package
   * directory was renamed. Nothing upstream enforces the exemption's scope, so
   * these two tests are the boundary: one pins the exemption, the other retires it.
   */
  it("exempts react-aria from the RAC quarantine rule in exactly one place, scoped to the quarantine", () => {
    const parsed = readJsonObject(join(repoRoot, ".oxlintrc.json"));
    const exemptions = asRecordArray(parsed.overrides, "overrides").filter(
      (entry) => asRecord(entry.rules, "override rules")["elmera/no-rac-outside-quarantine"] === "off"
    );
    expect(exemptions.map((entry) => overrideFiles(entry))).toEqual([
      ["packages/fuse/src/react-aria/**/*.{ts,tsx}"],
    ]);
  });

  it("still needs the exemption because the pinned plugin's quarantine regex names the former directory", () => {
    const plugin = readFileSync(join(repoRoot, "node_modules/@elmeragroup/internal/dist/oxlint.mjs"), "utf8");
    // Escaped separators are what make this `QUARANTINE_DIR_RE` — the literal the rule matches
    // filenames against — and not one of the three prose copies of the same path (JSDoc, rule
    // description, violation message), which would keep a looser assertion green long after the
    // behaviour was fixed.
    const quarantineRegexSource = String.raw`packages\/ui\/src\/react-aria\/`;
    // A failure means the plugin stopped hard-coding the old path, in one of two ways. If it
    // learned the renamed directory, delete the override and this test. If it made the
    // quarantine directory configurable, set that option and keep a scoped rule, because
    // deleting the override would drop the boundary. Either way, bump the pin.
    expect(plugin).toContain(quarantineRegexSource);
  });
});
