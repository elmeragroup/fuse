import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { assertFlagSourceCheckout, copyFlagAssets, listFlagFiles, vendorFlags } from "../scripts/flag-assets";
import { FLAG_SVG_COUNT } from "../scripts/flag-payload";

const PRODUCTION_PIN = "a3d5adcf4fe650536d7694ca6d93c607ebf16c4e";
const FIXTURE_SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';

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

function requireFixture(fixture: FlagSourceFixture | undefined): FlagSourceFixture {
  if (fixture === undefined) {
    throw new Error("flag source fixture was not created");
  }
  return fixture;
}

function restoreSource(fixture: FlagSourceFixture): void {
  runFixtureGit(fixture.sourceRoot, ["reset", "--hard", fixture.head]);
  runFixtureGit(fixture.sourceRoot, ["clean", "-fd"]);
}

describe("flag source provenance", () => {
  // Timeout: building a 249-file git fixture and spawning git is slow under full-gate parallel load.
  it("refuses to vendor when the checkout is not at the production pin", () => {
    const fixture = makeFixture();
    try {
      expect(() => vendorFlags(fixture.repoRoot, fixture.packageRoot)).toThrow(new RegExp(PRODUCTION_PIN));
      expect(existsSync(join(fixture.packageRoot, "src/flags"))).toBe(false);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  }, 30_000);

  // Timeout: building a 249-file git fixture and spawning git is slow under full-gate parallel load.
  it("leaves a pre-existing destination untouched when the pin does not match", () => {
    const fixture = makeFixture();
    try {
      const destDir = join(fixture.packageRoot, "src/flags");
      mkdirSync(destDir, { recursive: true });
      const sentinel = join(destDir, "sentinel.txt");
      writeFileSync(sentinel, "do-not-touch");
      expect(() => vendorFlags(fixture.repoRoot, fixture.packageRoot)).toThrow(new RegExp(PRODUCTION_PIN));
      expect(readFileSync(sentinel, "utf8")).toBe("do-not-touch");
      expect(existsSync(join(destDir, "PROVENANCE.md"))).toBe(false);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("assertFlagSourceCheckout", () => {
  let fixture: FlagSourceFixture | undefined;

  // Timeout: building a 249-file git fixture is slow under full-gate parallel load.
  beforeAll(() => {
    fixture = makeFixture();
  }, 30_000);

  afterEach(() => {
    restoreSource(requireFixture(fixture));
  });

  afterAll(() => {
    rmSync(requireFixture(fixture).root, { recursive: true, force: true });
  });

  // Timeout: spawning git against the 249-file fixture is slow under full-gate parallel load.
  it("accepts a clean checkout at the expected commit", () => {
    const current = requireFixture(fixture);
    expect(() => assertFlagSourceCheckout(current.sourceRoot, current.head)).not.toThrow();
  }, 30_000);

  // Timeout: spawning git against the 249-file fixture is slow under full-gate parallel load.
  it("rejects a later commit", () => {
    const current = requireFixture(fixture);
    writeFileSync(join(current.sourceRoot, "README.md"), "moved\n");
    runFixtureGit(current.sourceRoot, ["add", "-A"]);
    runFixtureGit(current.sourceRoot, ["commit", "-q", "-m", "later"]);
    expect(() => assertFlagSourceCheckout(current.sourceRoot, current.head)).toThrow(/expected [0-9a-f]{40}/);
    expect(() => assertFlagSourceCheckout(current.sourceRoot, current.head)).toThrow(current.head);
  }, 30_000);

  // Timeout: spawning git against the 249-file fixture is slow under full-gate parallel load.
  it("rejects an unstaged svg edit", () => {
    const current = requireFixture(fixture);
    writeFileSync(join(current.sourceRoot, "svg/AA.svg"), `${FIXTURE_SVG}<!--edit-->`);
    expect(() => assertFlagSourceCheckout(current.sourceRoot, current.head)).toThrow(/local changes/);
  }, 30_000);

  // Timeout: spawning git against the 249-file fixture is slow under full-gate parallel load.
  it("rejects a staged svg edit", () => {
    const current = requireFixture(fixture);
    writeFileSync(join(current.sourceRoot, "svg/AA.svg"), `${FIXTURE_SVG}<!--staged-->`);
    runFixtureGit(current.sourceRoot, ["add", "svg/AA.svg"]);
    expect(() => assertFlagSourceCheckout(current.sourceRoot, current.head)).toThrow(/local changes/);
  }, 30_000);

  // Timeout: spawning git against the 249-file fixture is slow under full-gate parallel load.
  it("rejects a LICENSE edit", () => {
    const current = requireFixture(fixture);
    writeFileSync(join(current.sourceRoot, "LICENSE"), "changed\n");
    expect(() => assertFlagSourceCheckout(current.sourceRoot, current.head)).toThrow(/local changes/);
  }, 30_000);

  // Timeout: spawning git against the 249-file fixture is slow under full-gate parallel load.
  it("rejects an untracked svg", () => {
    const current = requireFixture(fixture);
    writeFileSync(join(current.sourceRoot, "svg/ZZ.svg"), FIXTURE_SVG);
    expect(() => assertFlagSourceCheckout(current.sourceRoot, current.head)).toThrow(/local changes/);
  }, 30_000);

  // Timeout: spawning git against the 249-file fixture is slow under full-gate parallel load.
  it("ignores an unrelated README edit", () => {
    const current = requireFixture(fixture);
    writeFileSync(join(current.sourceRoot, "README.md"), "still unrelated\n");
    expect(() => assertFlagSourceCheckout(current.sourceRoot, current.head)).not.toThrow();
  }, 30_000);

  // Timeout: spawning git against the 249-file fixture is slow under full-gate parallel load.
  it("rejects a nested directory that is not the checkout root", () => {
    const current = requireFixture(fixture);
    expect(() =>
      assertFlagSourceCheckout(join(current.repoRoot, ".ref/flag-icons/svg"), current.head)
    ).toThrow(/not the root of a Git checkout/);
  }, 30_000);

  // Timeout: spawning git against the 249-file fixture is slow under full-gate parallel load.
  it("rejects a missing source root", () => {
    const current = requireFixture(fixture);
    expect(() => assertFlagSourceCheckout(join(current.sourceRoot, "missing"), current.head)).toThrow(
      /is missing/
    );
  }, 30_000);
});

describe("copyFlagAssets with an injected pin", () => {
  let fixture: FlagSourceFixture | undefined;

  // Timeout: building a 249-file git fixture is slow under full-gate parallel load.
  beforeAll(() => {
    fixture = makeFixture();
  }, 30_000);

  afterEach(() => {
    const current = requireFixture(fixture);
    restoreSource(current);
    rmSync(join(current.packageRoot, "src/flags"), { recursive: true, force: true });
  });

  afterAll(() => {
    rmSync(requireFixture(fixture).root, { recursive: true, force: true });
  });

  // Timeout: vendoring 249 SVGs and spawning git is slow under full-gate parallel load.
  it("copies assets when HEAD matches the injected pin", () => {
    const current = requireFixture(fixture);
    copyFlagAssets(current.sourceRoot, current.packageRoot, current.head);
    const destDir = join(current.packageRoot, "src/flags");
    expect(listFlagFiles(destDir)).toHaveLength(FLAG_SVG_COUNT);
    expect(existsSync(join(destDir, "LICENSE"))).toBe(true);
    expect(existsSync(join(destDir, "manifest.ts"))).toBe(true);
    expect(readFileSync(join(destDir, "PROVENANCE.md"), "utf8")).toContain(`Commit: \`${current.head}\``);
  }, 30_000);

  // Timeout: spawning git against the 249-file fixture is slow under full-gate parallel load.
  it("refuses a dirty svg and does not create the destination", () => {
    const current = requireFixture(fixture);
    writeFileSync(join(current.sourceRoot, "svg/AA.svg"), `${FIXTURE_SVG}<!--dirty-->`);
    expect(() => copyFlagAssets(current.sourceRoot, current.packageRoot, current.head)).toThrow(
      /local changes/
    );
    expect(existsSync(join(current.packageRoot, "src/flags"))).toBe(false);
  }, 30_000);
});
