import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { FLAG_RAW_CEILING_BYTES, FLAG_SVG_COUNT } from "./flag-payload.ts";

const FLAG_SOURCE_COMMIT = "a3d5adcf4fe650536d7694ca6d93c607ebf16c4e";
const FLAG_SOURCE_REPO = "https://github.com/yammadev/flag-icons";

const GENERATED_HEADER = `/**
 * AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY.
 *
 * Generated from the two-letter SVGs in src/flags/.
 */

`;

function isTwoLetterSvg(name: string): boolean {
  return /^[A-Z]{2}\.svg$/.test(name);
}

export function listFlagFiles(flagsDir: string): string[] {
  return readdirSync(flagsDir)
    .filter(isTwoLetterSvg)
    .toSorted((left, right) => left.localeCompare(right));
}

export type FlagPayload = {
  count: number;
  bytes: number;
};

export function flagPayload(flagsDir: string, files: readonly string[]): FlagPayload {
  let bytes = 0;
  // Packed byte length is the inode size. Do not read SVG bodies here: 249 full
  // reads contend with turbo --force pack/hash/test IO and trip the 5s timeout.
  for (const file of files) {
    bytes += statSync(join(flagsDir, file)).size;
  }
  return { count: files.length, bytes };
}

export function assertFlagPayload(payload: FlagPayload): void {
  if (payload.count !== FLAG_SVG_COUNT) {
    throw new Error(`Expected ${FLAG_SVG_COUNT} two-letter flag SVGs, found ${payload.count}`);
  }
  if (payload.bytes > FLAG_RAW_CEILING_BYTES) {
    throw new Error(`Flag payload ${payload.bytes} exceeds ${FLAG_RAW_CEILING_BYTES} bytes`);
  }
}

/** Query-plus-guard: reports absence, but throws on a wiped or non-directory flags path. */
export function requireFlagsDirectory(flagsDir: string): "missing" | "present" {
  if (!existsSync(flagsDir)) {
    return "missing";
  }
  if (!statSync(flagsDir).isDirectory()) {
    throw new Error(`${flagsDir} exists but is not a directory`);
  }
  if (listFlagFiles(flagsDir).length === 0) {
    throw new Error(
      `${flagsDir} is empty — flag assets were wiped. Re-vendor with generate-flags, or remove the directory if flags were never vendored.`
    );
  }
  return "present";
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function parseProvenanceHashes(markdown: string): Map<string, string> {
  const marker = "## SHA-256";
  const start = markdown.indexOf(marker);
  if (start < 0) {
    throw new Error("PROVENANCE.md is missing the SHA-256 section");
  }
  const hashes = new Map<string, string>();
  for (const line of markdown
    .slice(start + marker.length)
    .trim()
    .split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const separator = trimmed.indexOf(" ");
    if (separator < 0) {
      throw new Error(`PROVENANCE.md hash line is malformed: ${trimmed}`);
    }
    hashes.set(trimmed.slice(0, separator), trimmed.slice(separator + 1));
  }
  return hashes;
}

export function flagHashFailure(
  flagsDir: string,
  files: readonly string[],
  expected: ReadonlyMap<string, string>
): string | undefined {
  for (const file of files) {
    const want = expected.get(file);
    if (want === undefined) {
      return `PROVENANCE.md is missing a SHA-256 for ${file}`;
    }
    const got = sha256(readFileSync(join(flagsDir, file)));
    if (got !== want) {
      return `${file} SHA-256 ${got} does not match PROVENANCE.md`;
    }
  }
  if (expected.size !== files.length) {
    return `PROVENANCE.md has ${expected.size} hashes, flags directory has ${files.length} SVGs`;
  }
  return undefined;
}

export function writeFlagManifest(packageRoot: string): void {
  const flagsDir = join(packageRoot, "src/flags");
  const files = listFlagFiles(flagsDir);
  const payload = flagPayload(flagsDir, files);
  assertFlagPayload(payload);

  const codes = files.map((file) => file.slice(0, 2));
  const entries = codes
    .map((code) => `  ${code}: new URL("./${code}.svg?no-inline", import.meta.url).href,`)
    .join("\n");

  writeFileSync(
    join(flagsDir, "manifest.ts"),
    `${GENERATED_HEADER}export const flagAssets = {\n${entries}\n} as const;\n\nexport type FlagAssetCode = keyof typeof flagAssets;\n`
  );
}

function gitOutput(sourceRoot: string, args: readonly string[]): string {
  const result = spawnSync("git", args, { cwd: sourceRoot, encoding: "utf8" });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed in ${sourceRoot}: ${result.stderr}`);
  }
  return result.stdout;
}

export function assertFlagSourceCheckout(sourceRoot: string, expectedCommit: string): void {
  if (!existsSync(sourceRoot) || !statSync(sourceRoot).isDirectory()) {
    throw new Error(
      `Flag source ${sourceRoot} is missing; clone the pinned reference described in docs/reference-sources.md`
    );
  }

  const toplevel = gitOutput(sourceRoot, ["rev-parse", "--show-toplevel"]).trim();
  // Git walks upward to a parent .git; realpath both sides because macOS tmpdir() is a symlink.
  if (realpathSync(toplevel) !== realpathSync(sourceRoot)) {
    throw new Error(`Flag source ${sourceRoot} is not the root of a Git checkout (git resolved ${toplevel})`);
  }

  const head = gitOutput(sourceRoot, ["rev-parse", "HEAD"]).trim();
  if (head !== expectedCommit) {
    throw new Error(
      `Flag source is at ${head}, expected ${expectedCommit}; check out the pinned commit before regenerating`
    );
  }

  const porcelain = gitOutput(sourceRoot, [
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--",
    "svg",
    "LICENSE",
  ]);
  if (porcelain.trim() !== "") {
    throw new Error(
      `Flag source has local changes under svg/ or LICENSE; restore the checkout before regenerating:\n${porcelain}`
    );
  }
}

/**
 * Verify the checkout, then copy the flag SVGs, LICENSE, provenance and manifest across.
 * `pin` is the commit the checkout must be at and the one PROVENANCE.md names — the two
 * are the same value by construction, which is the guarantee this step exists to keep.
 */
export function copyFlagAssets(sourceRoot: string, packageRoot: string, pin: string): void {
  assertFlagSourceCheckout(sourceRoot, pin);
  const sourceDir = join(sourceRoot, "svg");
  const destDir = join(packageRoot, "src/flags");
  mkdirSync(destDir, { recursive: true });

  const files = listFlagFiles(sourceDir);
  const payload = flagPayload(sourceDir, files);
  assertFlagPayload(payload);

  const hashes: string[] = [];
  for (const file of files) {
    copyFileSync(join(sourceDir, file), join(destDir, file));
    hashes.push(`${file} ${sha256(readFileSync(join(sourceDir, file)))}`);
  }

  copyFileSync(join(sourceRoot, "LICENSE"), join(destDir, "LICENSE"));
  writeFileSync(
    join(destDir, "PROVENANCE.md"),
    `# Flag asset provenance

- Source: ${FLAG_SOURCE_REPO} (MIT, copyright Yefferson)
- Commit: \`${pin}\`
- Selection: exactly the ${FLAG_SVG_COUNT} two-letter country SVGs. Subdivision/collection artwork is not copied.
- Aggregate ceiling: ${FLAG_RAW_CEILING_BYTES / 1024} KiB.

## SHA-256

${hashes.join("\n")}
`
  );

  writeFlagManifest(packageRoot);
}

/** Production entry point; the pin is `FLAG_SOURCE_COMMIT`. */
export function vendorFlags(repoRoot: string, packageRoot: string): void {
  copyFlagAssets(join(repoRoot, ".ref/flag-icons"), packageRoot, FLAG_SOURCE_COMMIT);
}
