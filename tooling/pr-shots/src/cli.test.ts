import { assert, describe, it } from "@effect/vitest";
import { Effect, Runtime } from "effect";
import { TestConsole } from "effect/testing";

import { cliEnvironment, parseArgv } from "../test/parse-argv.ts";
import { runCli } from "./cli.ts";

const REQUIRED = ["phone-dial", "--route", "/components/phone-number-field", "--target", "textbox:Mobile"];

/** Every message a parse failure carries, one per line. */
function failureMessages(argv: readonly string[]) {
  return Effect.gen(function* () {
    const failure = yield* Effect.flip(parseArgv(argv));
    assert.strictEqual(failure._tag, "ShowHelp");
    return failure._tag === "ShowHelp" ? failure.errors.map((error) => error.message).join("\n") : "";
  });
}

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
        "tab:Internal",
        "--click",
        "button:Save changes: now@1",
        "--fill",
        "123 123",
        "--frame",
        "target",
        "--pad",
        "0",
        "--themes",
        "external-tkas-company, internal-fkse-private",
        "--densities",
        "comfortable,dense",
        "--engines",
        "webkit,firefox,chromium",
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
          { role: "tab", name: "Internal", nth: 0 },
          { role: "button", name: "Save changes: now", nth: 1 },
        ],
        fill: "123 123",
        frame: "target",
        pad: 0,
        themes: [
          {
            _tag: "picked",
            slug: "external-tkas-company",
            variant: "external",
            brand: "tkas",
            segment: "company",
          },
          {
            _tag: "picked",
            slug: "internal-fkse-private",
            variant: "internal",
            brand: "fkse",
            segment: "private",
          },
        ],
        densities: [
          { _tag: "override", density: "comfortable" },
          { _tag: "override", density: "dense" },
        ],
        engines: ["webkit", "firefox", "chromium"],
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

  it.effect("captures a repeated list entry once", () =>
    Effect.gen(function* () {
      const parsed = yield* parseArgv([...REQUIRED, "--densities", "dense,,dense"]);
      assert.deepStrictEqual(parsed.densities, [{ _tag: "override", density: "dense" }]);
    })
  );

  // The parser owns the frame of each message; the schemas in options.ts own what follows
  // "Schema validation failed:".
  const invalid = (flag: string, value: string, expected: string) =>
    `Invalid value for flag --${flag}: "${value}". Expected: Schema validation failed: ${expected}`;

  it.effect.each([
    [[], "Missing required argument: name"],
    [["a", "b", "--route", "/x", "--target", "textbox:Mobile"], 'Unexpected positional argument: "b"'],
    [
      ["Phone Dial", "--route", "/x", "--target", "textbox:Mobile"],
      'Invalid value for argument <name>: "Phone Dial". Expected: Schema validation failed: lowercase letters, digits and dashes, such as phone-dial',
    ],
    [["run", "--target", "textbox:Mobile"], "Missing required flag: --route"],
    [
      ["run", "--route", "components/x", "--target", "textbox:Mobile"],
      invalid("route", "components/x", 'a docs path starting with a single "/", such as /components/button'),
    ],
    // URL resolution would replace the source's host with these.
    [
      ["run", "--route", "//example.invalid/demo", "--target", "textbox:Mobile"],
      invalid(
        "route",
        "//example.invalid/demo",
        'a docs path starting with a single "/", such as /components/button'
      ),
    ],
    [
      ["run", "--route", "/\\example.invalid/demo", "--target", "textbox:Mobile"],
      invalid(
        "route",
        "/\\example.invalid/demo",
        'a docs path starting with a single "/", such as /components/button'
      ),
    ],
    [
      ["run", "--route", "/components\\button", "--target", "textbox:Mobile"],
      invalid(
        "route",
        "/components\\button",
        'a docs path starting with a single "/", such as /components/button'
      ),
    ],
    // URL parsing strips a tab, which would move the request to source.invalid.
    [
      ["run", "--route", "/\t/source.invalid/demo", "--target", "textbox:Mobile"],
      invalid(
        "route",
        "/\t/source.invalid/demo",
        'a docs path starting with a single "/", such as /components/button'
      ),
    ],
    [
      ["run", "--route", "/\n/[", "--target", "textbox:Mobile"],
      invalid("route", "/\n/[", 'a docs path starting with a single "/", such as /components/button'),
    ],
    [
      ["run", "--route", "/x", "--target", "textfield:Mobile"],
      invalid(
        "target",
        "textfield:Mobile",
        '"textfield" is not an ARIA role; use <role>:<accessible name>, such as textbox:Mobile'
      ),
    ],
    [
      ["run", "--route", "/x", "--target", "textbox"],
      invalid("target", "textbox", "an accessible name after the role, such as textbox:Mobile"),
    ],
    [
      ["run", "--route", "/x", "--target", "textbox:"],
      invalid("target", "textbox:", "an accessible name after the role, such as textbox:Mobile"),
    ],
    [[...REQUIRED, "--nth=-1"], invalid("nth", "-1", "a whole number of 0 or more")],
    [
      [...REQUIRED, "--click", "tabs:Internal"],
      invalid(
        "click",
        "tabs:Internal",
        '"tabs" is not an ARIA role; use <role>:<accessible name>[@<n>], such as tab:Internal'
      ),
    ],
    [
      [...REQUIRED, "--click", "button:@1"],
      invalid("click", "button:@1", "an accessible name after the role, such as button:Internal"),
    ],
    [[...REQUIRED, "--click"], "Missing value for flag --click"],
    [[...REQUIRED, "--pad", "1.5"], invalid("pad", "1.5", "a whole number of 0 or more")],
    [[...REQUIRED, "--frame", "screen"], 'Invalid value for flag --frame: "screen"'],
    [
      [...REQUIRED, "--viewports", "1280"],
      invalid(
        "viewports",
        "1280",
        '"1280" is not a window size; use <width>x<height> in whole CSS pixels from 1 to 4096, written without leading zeros, such as 1280x800'
      ),
    ],
    [[...REQUIRED, "--viewports", "0x800"], '"0x800" is not a window size'],
    // The same size written twice with leading zeros would plan two identical pairs.
    [
      [...REQUIRED, "--viewports", "390x844,0390x0844"],
      invalid(
        "viewports",
        "390x844,0390x0844",
        '"0390x0844" is not a window size; use <width>x<height> in whole CSS pixels from 1 to 4096, written without leading zeros, such as 1280x800'
      ),
    ],
    [[...REQUIRED, "--viewports", "1280x"], '"1280x" is not a window size'],
    [[...REQUIRED, "--viewports", "1280×800"], '"1280×800" is not a window size'],
    [[...REQUIRED, "--viewports", "1280.5x800"], '"1280.5x800" is not a window size'],
    [[...REQUIRED, "--viewports", "5000x800"], '"5000x800" is not a window size'],
    [[...REQUIRED, "--viewports", "1280x800,abc"], '"abc" is not a window size'],
    [[...REQUIRED, "--viewports", ","], invalid("viewports", ",", "at least one entry")],
    [
      [...REQUIRED, "--themes", "internal-fkas"],
      invalid(
        "themes",
        "internal-fkas",
        '"internal-fkas" is not a theme slug; use <internal|external>-<brand>-<private|company>, such as external-tkas-company'
      ),
    ],
    [[...REQUIRED, "--themes", "inner-fkas-private"], '"inner-fkas-private" is not a theme slug'],
    [[...REQUIRED, "--themes", "internal-fkas-business"], '"internal-fkas-business" is not a theme slug'],
    [[...REQUIRED, "--themes", ","], invalid("themes", ",", "at least one entry")],
    [
      [...REQUIRED, "--densities", "compact"],
      invalid("densities", "compact", '"compact" must be dense or comfortable'),
    ],
    [
      [...REQUIRED, "--engines", "chrome"],
      invalid("engines", "chrome", '"chrome" must be chromium, webkit or firefox'),
    ],
    [[...REQUIRED, "--scale", "0"], invalid("scale", "0", "a number above 0 and at most 4")],
    [[...REQUIRED, "--scale", "two"], invalid("scale", "two", "a number above 0 and at most 4")],
    [[...REQUIRED, "--color-scheme", "system"], 'Invalid value for flag --color-scheme: "system"'],
    [[...REQUIRED, "--before", "staging"], invalid("before", "staging", "prod, local or an http(s) URL")],
    [
      [...REQUIRED, "--after", "file:///tmp/x"],
      invalid("after", "file:///tmp/x", "prod, local or an http(s) URL"),
    ],
    [[...REQUIRED, "--threshold", "1.5"], invalid("threshold", "1.5", "a number from 0 to 1")],
    [[...REQUIRED, "--threshold=-0.1"], invalid("threshold", "-0.1", "a number from 0 to 1")],
    [[...REQUIRED, "--pr", "#182"], invalid("pr", "#182", "a pull request number, such as 182")],
    [[...REQUIRED, "--densitys", "dense"], "Unrecognized flag: --densitys"],
    [[...REQUIRED, "--fill"], "Missing value for flag --fill"],
  ] as const)("rejects %j", ([argv, message]) =>
    Effect.gen(function* () {
      assert.include(yield* failureMessages(argv), message);
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
