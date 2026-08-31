import { Schema } from "effect";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageDirectory = resolve(import.meta.dirname, "..");
const repositoryDirectory = resolve(packageDirectory, "../..");
const packageRelativeScript = "scripts/issue-14-timing.ts";
const repositoryRelativeScript = "tooling/api-extractor/scripts/issue-14-timing.ts";

const TimingCommandOutputSchema = Schema.Struct({
  decision: Schema.Literals(["go", "no-go"] as const),
  aggregate: Schema.Struct({
    measured: Schema.Struct({
      bytesSent: Schema.Number,
      bytesReceived: Schema.Number,
    }),
  }),
});

type TimingCommandOutput = Schema.Schema.Type<typeof TimingCommandOutputSchema>;

function runTimingCommand(cwd: string, script: string): TimingCommandOutput {
  const result = spawnSync(process.execPath, [script, "--check"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15_000,
  });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return Schema.decodeUnknownSync(TimingCommandOutputSchema)(JSON.parse(result.stdout));
}

describe("timing command portability", () => {
  it("reaches the same semantic decision from the package, repository, and a relocated checkout", () => {
    const packageRun = runTimingCommand(packageDirectory, packageRelativeScript);
    const repositoryRun = runTimingCommand(repositoryDirectory, repositoryRelativeScript);
    const relocatedRepository = mkdtempSync(
      join(tmpdir(), "api-extractor-relocated-checkout-with-a-different-path-length-")
    );
    const relocatedPackage = join(relocatedRepository, "tooling/api-extractor");

    try {
      cpSync(packageDirectory, relocatedPackage, {
        recursive: true,
        filter: (source) => source !== join(packageDirectory, "node_modules"),
      });
      symlinkSync(join(packageDirectory, "node_modules"), join(relocatedPackage, "node_modules"), "junction");
      const relocatedRun = runTimingCommand(relocatedRepository, repositoryRelativeScript);

      expect([packageRun.decision, repositoryRun.decision, relocatedRun.decision]).toEqual([
        "go",
        "go",
        "go",
      ]);
      for (const run of [packageRun, repositoryRun, relocatedRun]) {
        expect(Number.isFinite(run.aggregate.measured.bytesSent)).toBe(true);
        expect(Number.isFinite(run.aggregate.measured.bytesReceived)).toBe(true);
        expect(run.aggregate.measured.bytesSent).toBeGreaterThanOrEqual(0);
        expect(run.aggregate.measured.bytesReceived).toBeGreaterThanOrEqual(0);
      }
    } finally {
      rmSync(relocatedRepository, { recursive: true, force: true });
    }
  });
});
