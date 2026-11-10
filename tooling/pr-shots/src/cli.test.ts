import { assert, describe, it } from "@effect/vitest";
import { Effect, Runtime } from "effect";
import { TestConsole } from "effect/testing";

import { cliEnvironment, parseArgv } from "../test/parse-argv.ts";
import { runCli } from "./cli.ts";

const REQUIRED = ["phone-dial", "--route", "/components/phone-number-field", "--target", "textbox:Mobile"];

describe("the shots command line", () => {
  it.effect("fills every default the README documents", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* parseArgv(REQUIRED), {
        name: "phone-dial",
        route: "/components/phone-number-field",
        target: { role: "textbox", name: "Mobile" },
        nth: 0,
        clicks: [],
        fill: null,
        frame: "auto",
        pad: 12,
        themes: [{ _tag: "page-default" }],
        densities: [{ _tag: "stage-default" }],
        engines: ["chromium"],
        viewports: [{ width: 1280, height: 900 }],
        scale: 2,
        colorScheme: "light",
        before: { _tag: "remote", origin: new URL("https://fuse.elmeragroup.no"), label: "prod" },
        after: { _tag: "local" },
        diff: "on",
        threshold: 0.1,
        pr: null,
      });
    })
  );

  it.effect("takes every override", () =>
    Effect.gen(function* () {
      const parsed = yield* parseArgv([
        "theme-matrix",
        "--route",
        "/components/button",
        "--target",
        "button:Save changes: now",
        "--nth",
        "2",
        "--click",
        "tab:Neutral",
        "--click",
        "button:Save changes: now@1",
        "--fill",
        "123 123",
        "--frame",
        "target",
        "--pad",
        "0",
        "--themes",
        "branded-tkas-company, neutral-fkse-private",
        "--densities",
        "comfortable,dense",
        "--engines",
        "webkit,chromium",
        "--viewports",
        "1280x800, 390x844",
        "--scale",
        "1.5",
        "--color-scheme",
        "dark",
        "--before",
        "http://127.0.0.1:3000/ignored/path",
        "--after",
        "prod",
        "--no-diff",
        "--threshold",
        "0.25",
        "--pr",
        "182",
      ]);
      assert.deepStrictEqual(parsed, {
        name: "theme-matrix",
        route: "/components/button",
        // Only the first colon separates the role, so the name may contain colons.
        target: { role: "button", name: "Save changes: now" },
        nth: 2,
        // In the order given, each with the match its @n picks.
        clicks: [
          { role: "tab", name: "Neutral", nth: 0 },
          { role: "button", name: "Save changes: now", nth: 1 },
        ],
        fill: "123 123",
        frame: "target",
        pad: 0,
        themes: [
          {
            _tag: "picked",
            slug: "branded-tkas-company",
            identity: "branded",
            brand: "tkas",
            segment: "company",
          },
          {
            _tag: "picked",
            slug: "neutral-fkse-private",
            identity: "neutral",
            brand: "fkse",
            segment: "private",
          },
        ],
        densities: [
          { _tag: "override", density: "comfortable" },
          { _tag: "override", density: "dense" },
        ],
        engines: ["webkit", "chromium"],
        viewports: [
          { width: 1280, height: 800 },
          { width: 390, height: 844 },
        ],
        scale: 1.5,
        colorScheme: "dark",
        before: { _tag: "remote", origin: new URL("http://127.0.0.1:3000"), label: "http://127.0.0.1:3000" },
        after: { _tag: "remote", origin: new URL("https://fuse.elmeragroup.no"), label: "prod" },
        diff: "off",
        threshold: 0.25,
        pr: 182,
      });
    })
  );

  it.effect("takes a run without a target, which covers the page", () =>
    Effect.gen(function* () {
      const parsed = yield* parseArgv(["landing", "--route", "/"]);
      assert.strictEqual(parsed.target, null);
      assert.strictEqual(parsed.frame, "auto");
      assert.deepStrictEqual(parsed.viewports, [{ width: 1280, height: 900 }]);
    })
  );

  it.effect.each(["auto", "stage", "target", "viewport", "page"] as const)("takes --frame %s", (frame) =>
    Effect.gen(function* () {
      assert.strictEqual((yield* parseArgv([...REQUIRED, "--frame", frame])).frame, frame);
    })
  );

  it.effect.each([
    ["combobox:Rows per page", { role: "combobox", name: "Rows per page", nth: 0 }],
    ["button:Save@12", { role: "button", name: "Save", nth: 12 }],
    // Only a trailing @<n> picks a match; an @ elsewhere belongs to the name.
    ["link:me@example.com", { role: "link", name: "me@example.com", nth: 0 }],
    ["button:Save@", { role: "button", name: "Save@", nth: 0 }],
    // A name that itself ends in @<n> keeps it by adding the match: @0.
    ["button:Seat@3@0", { role: "button", name: "Seat@3", nth: 0 }],
  ] as const)("reads --click %s", ([value, step]) =>
    Effect.gen(function* () {
      assert.deepStrictEqual((yield* parseArgv([...REQUIRED, "--click", value])).clicks, [step]);
    })
  );

  it.effect("captures a repeated list entry once, also when spaces set it apart", () =>
    Effect.gen(function* () {
      const parsed = yield* parseArgv([...REQUIRED, "--densities", "dense,, dense"]);
      assert.deepStrictEqual(parsed.densities, [{ _tag: "override", density: "dense" }]);
    })
  );

  it.effect("exits 2 on a command line that does not parse, without starting anything", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(runCli([...REQUIRED, "--scale", "0"]));
      assert.strictEqual(failure._tag, "ReportedFailure");
      assert.strictEqual(Runtime.getErrorExitCode(failure), 2);
    }).pipe(Effect.provide(cliEnvironment))
  );

  it.effect("exits 2, not 1, on a route that URL parsing would throw on", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        runCli(["phone-dial", "--route", "/\n/[", "--target", "textbox:Mobile"])
      );
      assert.strictEqual(failure._tag, "ReportedFailure");
      assert.strictEqual(Runtime.getErrorExitCode(failure), 2);
    }).pipe(Effect.provide(cliEnvironment))
  );

  it.effect("prints help and succeeds on --help", () =>
    Effect.gen(function* () {
      yield* runCli(["--help"]);
      const help = (yield* TestConsole.logLines).map(String).join("\n");
      assert.include(help, "--target role:name");
      assert.include(help, "--densities list");
      assert.include(help, "--click role:name[@n]");
    }).pipe(Effect.provide(cliEnvironment))
  );
});
