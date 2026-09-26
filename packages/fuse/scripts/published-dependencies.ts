import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { packageRootFromScript } from "./paths";

/** A manifest's `dependencies`: package name to its declared specifier or published range. */
export type Dependencies = Readonly<Record<string, string>>;

/** The `catalog:` block of `pnpm-workspace.yaml`: package name to the exact version the workspace installs. */
export type WorkspaceCatalog = ReadonlyMap<string, string>;

/**
 * Dependencies published at exactly their catalog version rather than a caret range: their
 * styling hooks, data attributes or generated output are part of the rendered result, so a
 * consumer resolving a newer release could change what Fuse renders.
 */
const EXACT_DEPENDENCY_PINS: ReadonlySet<string> = new Set([
  "@base-ui/react",
  "react-aria",
  "react-aria-components",
  "@phosphor-icons/react",
  "tailwindcss-react-aria-components",
]);

/**
 * Deliberate published floors below `^<catalog version>`. Every other dependency publishes the
 * range derived from the `pnpm-workspace.yaml` catalog.
 */
const DEPENDENCY_FLOOR_OVERRIDES: ReadonlyMap<string, string> = new Map([
  // Any 2.4 release carries the granular `core` and `lang/javascript` entries Code imports;
  // the catalog's 2.4.1 is only the version the workspace tests.
  ["sugar-high", "^2.4.0"],
]);

type VersionParts = readonly [major: number, minor: number, patch: number];

const VERSION = /^(\d+)(?:\.(\d+)(?:\.(\d+))?)?$/;

/** The one version grammar: `<major>[.<minor>[.<patch>]]`, and how many parts were written. */
function parseVersionParts(
  text: string
): { readonly parts: VersionParts; readonly written: 1 | 2 | 3 } | undefined {
  const match = VERSION.exec(text);
  if (match?.[1] === undefined) {
    return undefined;
  }
  const [, major, minor, patch] = match;
  const written = patch !== undefined ? 3 : minor !== undefined ? 2 : 1;
  return { parts: [Number(major), Number(minor ?? 0), Number(patch ?? 0)], written };
}

function parseReleaseVersion(version: string): VersionParts | undefined {
  const parsed = parseVersionParts(version);
  return parsed?.written === 3 ? parsed.parts : undefined;
}

function parseCaretFloor(range: string): VersionParts | undefined {
  return range.startsWith("^") ? parseVersionParts(range.slice(1))?.parts : undefined;
}

function compareVersions(left: VersionParts, right: VersionParts): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

/**
 * The first release a caret peer range admits, such as `4.1.0` for `^4.1`.
 *
 * @param range - A caret range: `^<major>[.<minor>[.<patch>]]`.
 * @returns The floor as `<major>.<minor>.<patch>`; throws when the range is not a plain caret range.
 */
export function peerFloorRelease(range: string): string {
  const floor = parseCaretFloor(range);
  if (floor === undefined) {
    throw new Error(`Peer range ${range} is not a caret range`);
  }
  return floor.join(".");
}

function publishedRange(name: string, catalogVersion: string): string {
  const tested = parseReleaseVersion(catalogVersion);
  if (tested === undefined) {
    throw new Error(`Catalog version ${catalogVersion} of ${name} is not a plain release version`);
  }
  if (EXACT_DEPENDENCY_PINS.has(name)) {
    return catalogVersion;
  }
  const override = DEPENDENCY_FLOOR_OVERRIDES.get(name);
  if (override === undefined) {
    return `^${catalogVersion}`;
  }
  const floor = parseCaretFloor(override);
  // A caret below 1.0 locks more than the major, which the admission check below does not model;
  // Fuse has no 0.x runtime dependency, so such an override is refused rather than misread.
  if (floor?.[0] === 0) {
    throw new Error(
      `Floor override ${override} of ${name} is below 1.0, which caret floor overrides do not support`
    );
  }
  if (floor === undefined || floor[0] !== tested[0] || compareVersions(tested, floor) < 0) {
    throw new Error(`Floor override ${override} of ${name} does not admit catalog version ${catalogVersion}`);
  }
  return override;
}

/**
 * The published `dependencies`: every workspace dependency, ranged from its catalog version.
 * Exact pins publish the catalog version, floor overrides publish their floor, and every other
 * dependency publishes `^<catalog version>`.
 *
 * @param declared - The workspace manifest's `dependencies`; every specifier must be `catalog:`.
 * @param catalog - The workspace catalog the `catalog:` specifiers resolve against.
 * @returns The same dependency names with published ranges; throws when a range cannot be derived.
 */
export function publishedDependencies(declared: Dependencies, catalog: WorkspaceCatalog): Dependencies {
  return Object.fromEntries(
    Object.entries(declared).map(([name, specifier]) => {
      if (specifier !== "catalog:") {
        throw new Error(`Workspace dependency ${name} must use catalog:, got ${specifier}`);
      }
      const catalogVersion = catalog.get(name);
      if (catalogVersion === undefined) {
        throw new Error(`Workspace dependency ${name} has no pnpm-workspace.yaml catalog entry`);
      }
      return [name, publishedRange(name, catalogVersion)];
    })
  );
}

/**
 * Parses the `catalog:` block of a `pnpm-workspace.yaml` source. Every entry must be a string
 * version, since a published range is derived from it.
 *
 * @param source - The workspace file's YAML text.
 * @returns The catalog; throws when the file has no catalog or an entry is not a string.
 */
export function parseWorkspaceCatalog(source: string): WorkspaceCatalog {
  const workspace: unknown = parse(source);
  if (!(workspace instanceof Object)) {
    throw new Error("pnpm-workspace.yaml has no catalog mapping");
  }
  // SAFETY: the YAML document is the I/O boundary. Only `catalog` is read, and it stays unknown
  // until the check below rejects every value that is not a mapping.
  const { catalog } = workspace as { readonly catalog?: unknown };
  if (!(catalog instanceof Object) || Array.isArray(catalog)) {
    throw new Error("pnpm-workspace.yaml has no catalog mapping");
  }
  const versions = new Map<string, string>();
  for (const [name, version] of Object.entries(catalog)) {
    // YAML reads an unquoted `2.4` as a number, which would publish a mangled range.
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- workspace-file I/O: a YAML scalar's type is known only at runtime
    if (typeof version !== "string") {
      throw new Error(`pnpm-workspace.yaml catalog entry ${name} must be a version string`);
    }
    versions.set(name, version);
  }
  return versions;
}

/**
 * Reads the catalog of the workspace these scripts belong to. It is located from this module,
 * not from a caller's package root, so a generator run against a scratch copy of the package
 * still resolves the workspace's catalog.
 *
 * @returns The parsed workspace catalog.
 */
export function readWorkspaceCatalog(): WorkspaceCatalog {
  const workspaceRoot = join(packageRootFromScript(import.meta.url), "../..");
  return parseWorkspaceCatalog(readFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "utf8"));
}
