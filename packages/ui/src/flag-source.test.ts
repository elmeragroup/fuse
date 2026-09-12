import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  assertFlagSourceCheckout,
  copyFlagAssets,
  FLAG_SOURCE_COMMIT,
  listFlagFiles,
  vendorFlags,
} from "../scripts/flag-assets";
import { FLAG_SVG_COUNT } from "../scripts/flag-payload";

const FIXTURE_SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';

/**
 * Building the 249-file git fixture and spawning git against it is slow under full-gate
 * parallel load, so the file-level suite raises the test default and `beforeAll` the hook
 * default (suite timeouts do not reach hooks).
 */
const FIXTURE_TIMEOUT = 30_000;

type FlagSourceFixture = {
  root: string;
  repoRoot: string;
  packageRoot: string;
  sourceRoot: string;
  head: string;
};

function runFixtureGit(cwd: string, args: readonly string[]): string {
  const result = spawnSync(
    "git",
    [
      "-c",
      "user.name=fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd, encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout;
}

function twoLetterSvgNames(count: number): string[] {
  if (count > 26 * 26) {
    throw new Error(`Cannot generate ${count} two-letter SVG names`);
  }
  const names: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const first = String.fromCharCode(65 + Math.floor(index / 26));
    const second = String.fromCharCode(65 + (index % 26));
    names.push(`${first}${second}.svg`);
  }
  return names;
}

function makeFixture(): FlagSourceFixture {
  const root = mkdtempSync(join(tmpdir(), "elmera-ui-flag-source-"));
  try {
    const repoRoot = join(root, "repo");
    const packageRoot = join(root, "package");
    const sourceRoot = join(repoRoot, ".ref/flag-icons");
    const svgDir = join(sourceRoot, "svg");
    mkdirSync(svgDir, { recursive: true });
    mkdirSync(packageRoot, { recursive: true });

    for (const name of twoLetterSvgNames(FLAG_SVG_COUNT)) {
      writeFileSync(join(svgDir, name), FIXTURE_SVG);
    }
    writeFileSync(join(sourceRoot, "LICENSE"), "MIT\n");
    writeFileSync(join(sourceRoot, "README.md"), "unrelated\n");

    runFixtureGit(sourceRoot, ["init", "-q"]);
    runFixtureGit(sourceRoot, ["add", "-A"]);
    runFixtureGit(sourceRoot, ["commit", "-q", "-m", "fixture"]);
    const head = runFixtureGit(sourceRoot, ["rev-parse", "HEAD"]).trim();

    return { root, repoRoot, packageRoot, sourceRoot, head };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

/**
 * One fixture for the whole file: the checkout is only ever inspected or reset, and every
 * suite's destination writes are cleaned up by the file-level `afterEach`.
 */
describe("flag source", { timeout: FIXTURE_TIMEOUT }, () => {
  let fixture!: FlagSourceFixture;

  beforeAll(() => {
    fixture = makeFixture();
  }, FIXTURE_TIMEOUT);

  afterAll(() => {
    rmSync(fixture.root, { recursive: true, force: true });
  });

  afterEach(() => {
    runFixtureGit(fixture.sourceRoot, ["reset", "--hard", fixture.head]);
    runFixtureGit(fixture.sourceRoot, ["clean", "-fd"]);
    rmSync(join(fixture.packageRoot, "src/flags"), { recursive: true, force: true });
  });

  describe("provenance", () => {
    it("refuses to vendor off the production pin and leaves the destination untouched", () => {
      const destDir = join(fixture.packageRoot, "src/flags");
      mkdirSync(destDir, { recursive: true });
      const sentinel = join(destDir, "sentinel.txt");
      writeFileSync(sentinel, "do-not-touch");
      expect(() => vendorFlags(fixture.repoRoot, fixture.packageRoot)).toThrow(
        new RegExp(FLAG_SOURCE_COMMIT)
      );
      expect(readFileSync(sentinel, "utf8")).toBe("do-not-touch");
      expect(readdirSync(destDir)).toEqual(["sentinel.txt"]);
    });
  });

  describe("assertFlagSourceCheckout", () => {
    it("accepts a clean checkout at the expected commit", () => {
      expect(() => assertFlagSourceCheckout(fixture.sourceRoot, fixture.head)).not.toThrow();
    });

    it("rejects a later commit", () => {
      writeFileSync(join(fixture.sourceRoot, "README.md"), "moved\n");
      runFixtureGit(fixture.sourceRoot, ["add", "-A"]);
      runFixtureGit(fixture.sourceRoot, ["commit", "-q", "-m", "later"]);
      expect(() => assertFlagSourceCheckout(fixture.sourceRoot, fixture.head)).toThrow(
        /expected [0-9a-f]{40}/
      );
      expect(() => assertFlagSourceCheckout(fixture.sourceRoot, fixture.head)).toThrow(fixture.head);
    });

    it("rejects an unstaged svg edit", () => {
      writeFileSync(join(fixture.sourceRoot, "svg/AA.svg"), `${FIXTURE_SVG}<!--edit-->`);
      expect(() => assertFlagSourceCheckout(fixture.sourceRoot, fixture.head)).toThrow(/local changes/);
    });

    it("rejects a staged svg edit", () => {
      writeFileSync(join(fixture.sourceRoot, "svg/AA.svg"), `${FIXTURE_SVG}<!--staged-->`);
      runFixtureGit(fixture.sourceRoot, ["add", "svg/AA.svg"]);
      expect(() => assertFlagSourceCheckout(fixture.sourceRoot, fixture.head)).toThrow(/local changes/);
    });

    it("rejects a LICENSE edit", () => {
      writeFileSync(join(fixture.sourceRoot, "LICENSE"), "changed\n");
      expect(() => assertFlagSourceCheckout(fixture.sourceRoot, fixture.head)).toThrow(/local changes/);
    });

    it("rejects an untracked svg", () => {
      writeFileSync(join(fixture.sourceRoot, "svg/ZZ.svg"), FIXTURE_SVG);
      expect(() => assertFlagSourceCheckout(fixture.sourceRoot, fixture.head)).toThrow(/local changes/);
    });

    it("ignores an unrelated README edit", () => {
      writeFileSync(join(fixture.sourceRoot, "README.md"), "still unrelated\n");
      expect(() => assertFlagSourceCheckout(fixture.sourceRoot, fixture.head)).not.toThrow();
    });

    it("rejects a nested directory that is not the checkout root", () => {
      expect(() =>
        assertFlagSourceCheckout(join(fixture.repoRoot, ".ref/flag-icons/svg"), fixture.head)
      ).toThrow(/not the root of a Git checkout/);
    });

    it("rejects a missing source root", () => {
      expect(() => assertFlagSourceCheckout(join(fixture.sourceRoot, "missing"), fixture.head)).toThrow(
        /is missing/
      );
    });
  });

  describe("copyFlagAssets with an injected pin", () => {
    it("copies assets when HEAD matches the injected pin", () => {
      copyFlagAssets(fixture.sourceRoot, fixture.packageRoot, fixture.head);
      const destDir = join(fixture.packageRoot, "src/flags");
      expect(listFlagFiles(destDir)).toHaveLength(FLAG_SVG_COUNT);
      expect(existsSync(join(destDir, "LICENSE"))).toBe(true);
      expect(existsSync(join(destDir, "manifest.ts"))).toBe(true);
      expect(readFileSync(join(destDir, "PROVENANCE.md"), "utf8")).toContain(`Commit: \`${fixture.head}\``);
    });
  });
});
