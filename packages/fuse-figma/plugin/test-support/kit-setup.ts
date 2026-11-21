/**
 * Vitest's global setup. On a run of the whole package it builds the kit once and hands the workers
 * the file that holds it (`kit-cache.ts`), so no worker builds its own.
 *
 * A run of some files or some tests leaves the kit to the workers that read it, so a run that reads
 * no kit never waits for a build. A watch run leaves it too, because its reruns would read a kit
 * built before the edit. The setup imports the kit builder only when it builds, so those runs do
 * not load it.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { serialize } from "node:v8";
import type { TestProject } from "vitest/node";

/**
 * Whether the run takes every test of the package: not watching, no test name or tag filter, no
 * shard and no `--exclude`, discovery from the package root, so no `--dir`, and every file the
 * config includes selected, so no file filter, `related` or `--changed`. Vitest selects the files
 * before it applies a shard, and globs from `--dir`, so the selected files alone show neither.
 *
 * @param project - The Vitest project.
 */
async function runsWholePackage(project: TestProject): Promise<boolean> {
  const { config, state } = project.vitest;
  // SAFETY: Vitest 5 types `dir` as a string, but it stays undefined on a run without `--dir`.
  const dir = config.dir as string | undefined;
  if (
    config.watch ||
    config.testNamePattern !== undefined ||
    (config.tagsFilter?.length ?? 0) > 0 ||
    config.shard !== undefined ||
    (config.cliExclude?.length ?? 0) > 0 ||
    resolve(config.root, dir ?? ".") !== resolve(config.root)
  ) {
    return false;
  }
  const selected = new Set(state.getPaths());
  const { testFiles } = await project.globTestFiles();
  return testFiles.every((file) => selected.has(file));
}

/**
 * Build the kit for a run of the whole package and provide its file to the workers. Once the setup
 * builds, a failure fails the run, so a broken build cannot pass on kits each worker builds.
 *
 * @param project - The Vitest project.
 * @returns The teardown, which removes the kit's file, or nothing when the setup built no kit.
 * @throws When the kit does not build or its file cannot be written.
 */
export default async function setup(project: TestProject): Promise<(() => Promise<void>) | undefined> {
  if (!(await runsWholePackage(project))) {
    return undefined;
  }
  const directory = await mkdtemp(join(tmpdir(), "fuse-figma-kit-"));
  const removeDirectory = () => rm(directory, { recursive: true, force: true });
  try {
    const file = join(directory, "kit.v8");
    const { buildCachedKit } = await import("./kit-cache.ts");
    await writeFile(file, serialize(await buildCachedKit()));
    project.provide("fuseFigmaKit", file);
  } catch (error) {
    await removeDirectory();
    throw error;
  }
  return removeDirectory;
}
