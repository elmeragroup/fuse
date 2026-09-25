/**
 * Unit under test: Fuse namespace exports and Alert, rendered from a server module.
 * Oracle: React Flight's client-module proxy. A part that still lives on a `"use client"`
 * object throws "Cannot access X.Y on the server". The fixture's part lists and the
 * Alert strings are handwritten; this file only checks the child process result.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("server components can render Fuse namespaces", () => {
  it("renders every namespace part and a server Alert", () => {
    const output = execFileSync(
      process.execPath,
      ["--conditions=react-server", "--import", join(fixtures, "rsc-namespace-register.mjs"), join(fixtures, "rsc-namespace-run.mjs")],
      { cwd: fixtures, encoding: "utf8" }
    );
    expect(output).toContain("RSC_OK");
  });
});
