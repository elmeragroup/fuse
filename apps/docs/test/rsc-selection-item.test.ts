/**
 * Unit under test: the server HTML of selection rows whose SubSections cross React Flight before a
 * row partitions them (`SelectionItem.Shell` written in a server component, and `CheckboxItem` and
 * `RadioItem` rendered by a client component around a server component's children), as the first
 * paint before hydration. Oracle: a client-only render of the same page, whose SubSections never
 * cross Flight, and the band count written by hand from the page. Where the bands land after
 * hydration, by name and by click, is `selection-item-server.browser.test.ts`'s.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

type SsrResult = { flight: string; clientOnly: string };

describe("SelectionItem rows under React Server Components", () => {
  const server = execFileSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      join(fixtures, "rsc-namespace-register.mjs"),
      join(fixtures, "rsc-selection-item-server.ts"),
    ],
    { cwd: fixtures, encoding: "utf8" }
  );
  // SAFETY: rsc-selection-item-ssr.ts writes this one JSON object, and both fields the test reads
  // are compared against expected values, so a shape that disagrees fails an assertion.
  const ssr = JSON.parse(
    execFileSync(
      process.execPath,
      ["--import", join(fixtures, "rsc-chart-register-ssr.mjs"), join(fixtures, "rsc-selection-item-ssr.ts")],
      { cwd: fixtures, encoding: "utf8", input: server }
    )
  ) as SsrResult;

  it("produces the same HTML through Flight as a client-only render", () => {
    // An empty SubSection renders nothing on the server, so the client must open no band for it.
    expect(ssr.clientOnly.split('data-slot="selection-item-sub-sections"').length - 1).toBe(3);
    expect(ssr.flight).toBe(ssr.clientOnly);
  });
});
