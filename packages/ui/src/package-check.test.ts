import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { discoverEntries } from "../scripts/entries";
import {
  bareEntryRacDeclarationFailure,
  emittedDirectiveFailure,
  isForbiddenRacDeclarationSpecifier,
  packedBareEntryRacDeclarationFailure,
  packedValueExportFailure,
  parsePackedEvalJson,
  withDeclarationParser,
} from "../scripts/package-check-lib";
import { parseFacadeValueExports } from "../scripts/parse-facade";
import { ARTIFACTS_DIR } from "../scripts/tarball";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function sorted(names: readonly string[]): string[] {
  return [...names].toSorted((left, right) => left.localeCompare(right));
}

describe("Twemoji packed notices", () => {
  it("wires the package-file copy and packed-artifact assertion", () => {
    expect(readFileSync(join(packageRoot, "scripts/package-check.ts"), "utf8")).toContain(
      "checkPackedTwemojiNotices"
    );
    expect(readFileSync(join(packageRoot, "scripts/package-check-packed.ts"), "utf8")).toContain(
      "twemojiNoticeFailure"
    );
    expect(readFileSync(join(packageRoot, "scripts/generate-exports.ts"), "utf8")).toContain(
      "copyTwemojiNotices"
    );
  });
});

describe("packed eval JSON", () => {
  it("returns the parsed value or the standard fail-path message", () => {
    expect(parsePackedEvalJson("not-json", "packed entries")).toEqual({
      ok: false,
      failure: "Packed import JSON parse failed for packed entries",
    });
    expect(parsePackedEvalJson('{"a":["Button"]}', "packed entries")).toEqual({
      ok: true,
      value: { a: ["Button"] },
    });
    expect(parsePackedEvalJson("{", "flagAssets URLs")).toEqual({
      ok: false,
      failure: "Packed import JSON parse failed for flagAssets URLs",
    });
  });
});

describe("artifacts directory single-sourcing", () => {
  it("keeps turbo.json's pack outputs in sync with ARTIFACTS_DIR", () => {
    // turbo.json is JSONC and cannot import the constant; pin the sync here.
    const turbo = readFileSync(join(packageRoot, "../../turbo.json"), "utf8");
    const outputs = /"pack":\s*\{[\s\S]*?"outputs":\s*\[\s*"([^"]+)"\s*\]/.exec(turbo)?.[1];
    expect(outputs).toBe(`${ARTIFACTS_DIR}/**`);
  });
});

describe("packed value-export gate", () => {
  it("fails extra names that are not in the expected set", () => {
    const message = packedValueExportFailure("./theme", ["BRANDS", "SneakyExtra"], ["BRANDS"]);
    expect(message).toBe("./theme unexpected runtime exports: SneakyExtra");
  });

  it("fails missing names that the expected set requires", () => {
    const message = packedValueExportFailure("./theme", ["BRANDS"], ["BRANDS", "isBrandCode"]);
    expect(message).toBe("./theme missing runtime exports: isBrandCode");
  });

  it("passes when packed names equal the expected set", () => {
    expect(
      packedValueExportFailure("./theme", ["BRANDS", "isBrandCode"], ["isBrandCode", "BRANDS"])
    ).toBeUndefined();
  });

  // Timeout: discoverEntries walks the published import graph; slow under full-gate parallel load.
  it("uses the parsed theme facade and asserts icons parse equals the roster", () => {
    const themeFacade = parseFacadeValueExports(
      "src/theme.ts",
      readFileSync(join(packageRoot, "src/theme.ts"), "utf8")
    );
    expect(themeFacade).toContain("BRAND_CODES");
    expect(themeFacade).toContain("isBrandCode");
    const discovered = discoverEntries(packageRoot);
    const theme = discovered.jsEntries.find((entry) => entry.subpath === "theme");
    expect(theme?.runtimeExports).toEqual(themeFacade);

    const iconsFacade = parseFacadeValueExports(
      "src/icons.ts",
      readFileSync(join(packageRoot, "src/icons.ts"), "utf8")
    );
    const icons = discovered.jsEntries.find((entry) => entry.subpath === "icons");
    expect(sorted(icons?.runtimeExports ?? [])).toEqual(sorted(iconsFacade));
  }, 30_000);
});

describe("emitted-directive walker", () => {
  const scratchDirs: string[] = [];

  afterEach(() => {
    for (const dir of scratchDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function scratch(): string {
    const dir = mkdtempSync(join(tmpdir(), "elmera-ui-directive-"));
    scratchDirs.push(dir);
    return dir;
  }

  it("does not fail a use-client module outside the published import graph", () => {
    const root = scratch();
    const extracted = scratch();
    mkdirSync(join(root, "src/hooks"), { recursive: true });
    writeFileSync(join(root, "src/theme.ts"), `export const themeAttributes = {};\n`);
    writeFileSync(join(root, "src/hooks/unpublished.ts"), `"use client";\nexport const useX = () => 1;\n`);
    writeFileSync(join(extracted, "theme.js"), `export const themeAttributes = {};\n`);
    expect(emittedDirectiveFailure(extracted, ["src/theme.ts"], root)).toBeUndefined();
  });

  it("fails when a published source has use client but packed JS lacks it", () => {
    const root = scratch();
    const extracted = scratch();
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src/button.tsx"), `"use client";\nexport function Button() {}\n`);
    writeFileSync(join(extracted, "button.js"), `export function Button() {}\n`);
    expect(emittedDirectiveFailure(extracted, ["src/button.tsx"], root)).toMatch(
      /Directive mismatch for button.tsx/
    );
  });

  // Timeout: discoverEntries walks the published import graph; slow under full-gate parallel load.
  it("scopes the walker to discoverEntries().sourceFiles, not all of src", () => {
    const discovered = discoverEntries(packageRoot);
    // Test-only fixture: reachable from no entry (Dialog made the hook itself reachable).
    expect(discovered.sourceFiles).not.toContain("src/hooks/intl-fixture/index.ts");
    expect(discovered.sourceFiles).toContain("src/theme.ts");
  }, 30_000);
});

describe("bare-entry RAC declaration quarantine", () => {
  const scratchDirs: string[] = [];

  afterEach(() => {
    for (const dir of scratchDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function scratch(): string {
    const dir = mkdtempSync(join(tmpdir(), "elmera-ui-rac-dts-"));
    scratchDirs.push(dir);
    return dir;
  }

  it("passes when only quarantined react-aria entries mention RAC packages", () => {
    expect(
      bareEntryRacDeclarationFailure([
        { subpath: ".", declaration: 'export { Button } from "./button";\n' },
        {
          subpath: "theme",
          declaration: 'export type { SupportedLocale } from "./theme/elmera-group-ui";\n',
        },
        { subpath: "button", declaration: 'export { Button } from "./components/button/button";\n' },
        {
          subpath: "react-aria/ui-providers",
          declaration: 'import { I18nProvider } from "react-aria-components";\n',
        },
      ])
    ).toBeUndefined();
  });

  it("does not treat our react-aria subpath or tailwindcss-react-aria-components as a leak", () => {
    expect(
      bareEntryRacDeclarationFailure([
        { subpath: "theme", declaration: 'export {} from "tailwindcss-react-aria-components";\n' },
        { subpath: ".", declaration: 'export type { UiProvidersProps } from "./react-aria/ui-providers";\n' },
        { subpath: "button", declaration: 'import "tailwindcss-react-aria-components";\n' },
      ])
    ).toBeUndefined();
  });

  it("fails when a bare entry declaration imports react-aria-components", () => {
    expect(
      bareEntryRacDeclarationFailure([
        { subpath: "button", declaration: 'export type { ButtonProps } from "react-aria-components";\n' },
      ])
    ).toBe("./button declaration references react-aria-components");
  });

  it("fails on a bare-entry side-effect import and ignores one in a quarantined entry", () => {
    expect(
      bareEntryRacDeclarationFailure([
        { subpath: "button", declaration: 'import "react-aria-components";\n' },
      ])
    ).toBe("./button declaration references react-aria-components");
    expect(
      bareEntryRacDeclarationFailure([{ subpath: "theme", declaration: 'import "react-aria";\n' }])
    ).toBe("./theme declaration references react-aria");
    expect(
      bareEntryRacDeclarationFailure([{ subpath: ".", declaration: 'import "@react-aria/i18n";\n' }])
    ).toBe(". declaration references @react-aria/i18n");
    expect(
      bareEntryRacDeclarationFailure([
        {
          subpath: "react-aria/ui-providers",
          declaration: 'import "react-aria-components";\n',
        },
      ])
    ).toBeUndefined();
  });

  it("fails on bare react-aria and @react-aria/* in root and theme declarations", () => {
    expect(
      bareEntryRacDeclarationFailure([
        { subpath: ".", declaration: 'export type { Locale } from "react-aria";\n' },
      ])
    ).toBe(". declaration references react-aria");
    expect(
      bareEntryRacDeclarationFailure([
        { subpath: "theme", declaration: 'import type { I18n } from "@react-aria/i18n";\n' },
      ])
    ).toBe("./theme declaration references @react-aria/i18n");
  });

  it("reads packed .d.ts paths and skips quarantined react-aria entries", () => {
    const extracted = scratch();
    mkdirSync(join(extracted, "react-aria"), { recursive: true });
    writeFileSync(
      join(extracted, "button.d.ts"),
      `export type { ButtonProps } from "react-aria-components";\n`
    );
    writeFileSync(
      join(extracted, "react-aria/ui-providers.d.ts"),
      `import { I18nProvider } from "react-aria-components";\n`
    );
    expect(
      packedBareEntryRacDeclarationFailure(extracted, [
        { subpath: "button", sourceFile: "src/button.ts" },
        { subpath: "react-aria/ui-providers", sourceFile: "src/react-aria/ui-providers.ts" },
      ])
    ).toBe("./button declaration references react-aria-components");
    writeFileSync(join(extracted, "button.d.ts"), `export { Button } from "./components/button/button";\n`);
    expect(
      packedBareEntryRacDeclarationFailure(extracted, [
        { subpath: "button", sourceFile: "src/button.ts" },
        { subpath: "react-aria/ui-providers", sourceFile: "src/react-aria/ui-providers.ts" },
      ])
    ).toBeUndefined();
  });

  it("collects only real module-specifier nodes across the syntax matrix", () => {
    withDeclarationParser((parser) => {
      expect(parser.specifiers('import { A } from "react-aria-components";\n')).toEqual([
        "react-aria-components",
      ]);
      expect(parser.specifiers('import type { B } from "react-aria";\n')).toEqual(["react-aria"]);
      expect(parser.specifiers('export { C } from "@internationalized/date";\n')).toEqual([
        "@internationalized/date",
      ]);
      expect(parser.specifiers('export type { D } from "@react-aria/i18n";\n')).toEqual(["@react-aria/i18n"]);
      expect(parser.specifiers('import "react-aria-components/i18n";\n')).toEqual([
        "react-aria-components/i18n",
      ]);
      expect(parser.specifiers('type E = import("@internationalized/date/calendar").Calendar;\n')).toEqual([
        "@internationalized/date/calendar",
      ]);
      expect(parser.specifiers('export type F = typeof import("react-aria");\n')).toEqual(["react-aria"]);
      expect(
        parser.specifiers(
          `// import { X } from "react-aria-components";\n/* import "react-aria" */\nconst note = "see @internationalized/date";\n/** {@link import("react-aria-components").Foo} */\nexport declare const ok: 1;\n`
        )
      ).toEqual([]);
    });
  }, 30_000);

  it("treats architecture quarantine packages and @react-aria/* as forbidden", () => {
    expect(isForbiddenRacDeclarationSpecifier("react-aria-components")).toBe(true);
    expect(isForbiddenRacDeclarationSpecifier("react-aria-components/i18n")).toBe(true);
    expect(isForbiddenRacDeclarationSpecifier("react-aria")).toBe(true);
    expect(isForbiddenRacDeclarationSpecifier("react-aria/i18n")).toBe(true);
    expect(isForbiddenRacDeclarationSpecifier("@internationalized/date")).toBe(true);
    expect(isForbiddenRacDeclarationSpecifier("@internationalized/date/calendar")).toBe(true);
    expect(isForbiddenRacDeclarationSpecifier("@react-aria/i18n")).toBe(true);
    expect(isForbiddenRacDeclarationSpecifier("tailwindcss-react-aria-components")).toBe(false);
    expect(isForbiddenRacDeclarationSpecifier("react-aria-components-extra")).toBe(false);
    expect(isForbiddenRacDeclarationSpecifier("@internationalized/string")).toBe(false);
    expect(isForbiddenRacDeclarationSpecifier("@internationalized/date-time")).toBe(false);
    expect(isForbiddenRacDeclarationSpecifier("./react-aria/ui-providers")).toBe(false);
  });

  it("fails named imports and import() forms, and ignores comments and string literals", () => {
    expect(
      bareEntryRacDeclarationFailure([
        { subpath: "button", declaration: 'import { Button } from "react-aria-components";\n' },
      ])
    ).toBe("./button declaration references react-aria-components");
    expect(
      bareEntryRacDeclarationFailure([
        { subpath: "theme", declaration: 'type Locale = import("react-aria").Locale;\n' },
      ])
    ).toBe("./theme declaration references react-aria");
    expect(
      bareEntryRacDeclarationFailure([
        {
          subpath: "button",
          declaration:
            '// import { X } from "react-aria-components";\nconst hint = "react-aria";\nexport declare const ok: 1;\n',
        },
      ])
    ).toBeUndefined();
  });

  it("fails exact and subpath @internationalized/date in bare declarations", () => {
    expect(
      bareEntryRacDeclarationFailure([
        { subpath: "button", declaration: 'export type { DateValue } from "@internationalized/date";\n' },
      ])
    ).toBe("./button declaration references @internationalized/date");
    expect(
      bareEntryRacDeclarationFailure([
        {
          subpath: "theme",
          declaration: 'import type { Calendar } from "@internationalized/date/calendar";\n',
        },
      ])
    ).toBe("./theme declaration references @internationalized/date/calendar");
    expect(
      bareEntryRacDeclarationFailure([
        { subpath: ".", declaration: 'export type { LocalizedString } from "@internationalized/string";\n' },
      ])
    ).toBeUndefined();
  });

  it("passes a clean multi-hop packed declaration graph", () => {
    const extracted = scratch();
    mkdirSync(join(extracted, "components/button/nested"), { recursive: true });
    writeFileSync(
      join(extracted, "button.d.ts"),
      `export { Button } from "./components/button/button.js";\n`
    );
    writeFileSync(join(extracted, "components/button/button.d.ts"), `export { Button } from "./nested";\n`);
    writeFileSync(
      join(extracted, "components/button/nested/index.d.ts"),
      `export { Button } from "../impl.d.ts";\n`
    );
    writeFileSync(
      join(extracted, "components/button/impl.d.ts"),
      `export declare function Button(): void;\n`
    );
    expect(
      packedBareEntryRacDeclarationFailure(extracted, [{ subpath: "button", sourceFile: "src/button.ts" }])
    ).toBeUndefined();
  });

  it("fails when a nested implementation declaration imports a RAC package", () => {
    const extracted = scratch();
    mkdirSync(join(extracted, "components/button"), { recursive: true });
    writeFileSync(join(extracted, "button.d.ts"), `export { Button } from "./components/button/button";\n`);
    writeFileSync(
      join(extracted, "components/button/button.d.ts"),
      `export type { ButtonProps } from "react-aria-components";\n`
    );
    expect(
      packedBareEntryRacDeclarationFailure(extracted, [
        { subpath: "button", sourceFile: "src/button.ts" },
        { subpath: "react-aria/ui-providers", sourceFile: "src/react-aria/ui-providers.ts" },
      ])
    ).toBe("./button declaration references react-aria-components");
  });

  it("fails when a bare entry reaches a packed react-aria declaration", () => {
    const extracted = scratch();
    mkdirSync(join(extracted, "react-aria"), { recursive: true });
    writeFileSync(
      join(extracted, "index.d.ts"),
      `export type { UiProvidersProps } from "./react-aria/ui-providers";\n`
    );
    writeFileSync(
      join(extracted, "react-aria/ui-providers.d.ts"),
      `export type UiProvidersProps = object;\n`
    );
    expect(
      packedBareEntryRacDeclarationFailure(extracted, [{ subpath: ".", sourceFile: "src/index.ts" }])
    ).toBe(". declaration references ./react-aria/ui-providers");
  });

  it("terminates cycles in the packed declaration graph", () => {
    const extracted = scratch();
    writeFileSync(join(extracted, "button.d.ts"), `export type { A } from "./a";\n`);
    writeFileSync(join(extracted, "a.d.ts"), `export type { B } from "./b";\n`);
    writeFileSync(join(extracted, "b.d.ts"), `export type { A } from "./a";\n`);
    expect(
      packedBareEntryRacDeclarationFailure(extracted, [{ subpath: "button", sourceFile: "src/button.ts" }])
    ).toBeUndefined();
  });

  it("skips quarantined react-aria entries as graph roots", () => {
    const extracted = scratch();
    mkdirSync(join(extracted, "react-aria"), { recursive: true });
    writeFileSync(join(extracted, "button.d.ts"), `export declare function Button(): void;\n`);
    writeFileSync(
      join(extracted, "react-aria/ui-providers.d.ts"),
      `import { I18nProvider } from "react-aria-components";\nexport type { DateValue } from "@internationalized/date";\n`
    );
    expect(
      packedBareEntryRacDeclarationFailure(extracted, [
        { subpath: "button", sourceFile: "src/button.ts" },
        { subpath: "react-aria/ui-providers", sourceFile: "src/react-aria/ui-providers.ts" },
      ])
    ).toBeUndefined();
  });

  it("does not follow relative specifiers that escape the extracted package", () => {
    const root = scratch();
    const extracted = join(root, "pkg");
    mkdirSync(extracted);
    writeFileSync(join(extracted, "button.d.ts"), `export type { Leaked } from "../outside";\n`);
    writeFileSync(join(root, "outside.d.ts"), `export type { Leaked } from "react-aria-components";\n`);
    expect(
      packedBareEntryRacDeclarationFailure(extracted, [{ subpath: "button", sourceFile: "src/button.ts" }])
    ).toBeUndefined();
  });

  it("fails when a packed graph hops through exact . to a same-directory index with a RAC package", () => {
    const extracted = scratch();
    mkdirSync(join(extracted, "components/button"), { recursive: true });
    writeFileSync(join(extracted, "button.d.ts"), `export { Button } from "./components/button/button";\n`);
    writeFileSync(join(extracted, "components/button/button.d.ts"), `export { Button } from ".";\n`);
    writeFileSync(
      join(extracted, "components/button/index.d.ts"),
      `export type { ButtonProps } from "react-aria-components";\n`
    );
    expect(
      packedBareEntryRacDeclarationFailure(extracted, [
        { subpath: "button", sourceFile: "src/button.ts" },
        { subpath: "react-aria/ui-providers", sourceFile: "src/react-aria/ui-providers.ts" },
      ])
    ).toBe("./button declaration references react-aria-components");
  });

  it("fails when a packed graph hops through exact .. to a parent index with a RAC package", () => {
    const extracted = scratch();
    mkdirSync(join(extracted, "components/button/nested"), { recursive: true });
    writeFileSync(join(extracted, "button.d.ts"), `export { Button } from "./components/button/nested";\n`);
    writeFileSync(join(extracted, "components/button/nested/index.d.ts"), `export { Button } from "..";\n`);
    writeFileSync(
      join(extracted, "components/button/index.d.ts"),
      `export type { ButtonProps } from "react-aria-components";\n`
    );
    expect(
      packedBareEntryRacDeclarationFailure(extracted, [
        { subpath: "button", sourceFile: "src/button.ts" },
        { subpath: "react-aria/ui-providers", sourceFile: "src/react-aria/ui-providers.ts" },
      ])
    ).toBe("./button declaration references react-aria-components");
  });

  it("passes a packed graph that hops through exact . and .. to clean indexes", () => {
    const extracted = scratch();
    mkdirSync(join(extracted, "deep/nested"), { recursive: true });
    writeFileSync(join(extracted, "button.d.ts"), `export { Button } from "./deep/nested/leaf";\n`);
    writeFileSync(join(extracted, "deep/nested/leaf.d.ts"), `export { Button } from ".";\n`);
    writeFileSync(join(extracted, "deep/nested/index.d.ts"), `export { Button } from "..";\n`);
    writeFileSync(join(extracted, "deep/index.d.ts"), `export declare function Button(): void;\n`);
    expect(
      packedBareEntryRacDeclarationFailure(extracted, [{ subpath: "button", sourceFile: "src/button.ts" }])
    ).toBeUndefined();
  });
});
