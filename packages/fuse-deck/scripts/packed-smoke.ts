/**
 * The packed smoke test: fuse-deck's portability gate. It installs the packed fuse-deck and the
 * packed Fuse with npm in a directory outside the workspace, creates a deck in another directory
 * outside that install, gives a slide a Fuse component, and runs `create`, `describe`, `slides add`,
 * `check --json` and `build` through the `fuse-deck` command npm installed. It checks that the
 * skill `describe` names exists, and that the package refuses a deep import. It then runs the built
 * page's classic bootstrap and checks the theme it applies before the module entry runs. Last, it
 * serves the deck with `dev`, renders both slides in Chromium, and stops the server with SIGINT. A
 * second `dev` starts with a slide that does not compile and must render it once it is repaired.
 *
 * Without a workspace, Fuse resolves to its built `dist` and React to the consumer's install, so
 * this is the check that fuse-deck's anchored `runnerImport` and its resolver work when installed.
 *
 * Usage: node scripts/packed-smoke.ts (after `pack` here and in packages/fuse)
 */

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { chromium } from "playwright";
import type { Browser } from "playwright";

/** One step of the smoke test failed. */
class SmokeFailed extends Schema.TaggedError<SmokeFailed>()("SmokeFailed", {
  message: Schema.String,
}) {}

const packageRoot = path.resolve(import.meta.dirname, "..");
const fuseRoot = path.resolve(packageRoot, "../fuse");

/** Mirrors `minimumReleaseAge` in pnpm-workspace.yaml, so npm resolves what the lockfile could. */
const RELEASE_AGE = Duration.minutes(4320);

/** The tarball `pack` left in a package's `.artifacts`. */
const tarball = Effect.fn("tarball")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const directory = path.join(root, ".artifacts");
  const names = yield* fs
    .readDirectory(directory)
    .pipe(Effect.mapError(() => new SmokeFailed({ message: `No ${directory}. Run the pack task first.` })));
  const tarballs = names.filter((name) => name.endsWith(".tgz"));
  const [only] = tarballs;
  if (only === undefined || tarballs.length !== 1) {
    return yield* new SmokeFailed({
      message: `Expected one tarball in ${directory}, found ${String(tarballs.length)}.`,
    });
  }
  return path.join(directory, only);
});

/** Run a command to completion and return its stdout; a non-zero exit fails with its output. */
const run = Effect.fn("run")(function* (command: string, args: readonly string[], cwd: string) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const label = `${path.basename(command)} ${args.join(" ")}`;
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(
        ChildProcess.make(command, [...args], {
          cwd,
          stdin: "ignore",
          forceKillAfter: Duration.seconds(2),
        })
      );
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [text(handle.stdout), text(handle.stderr), handle.exitCode],
        { concurrency: "unbounded" }
      );
      yield* Console.log(
        `$ ${label}  (in ${cwd})\n${stdout}${stderr === "" ? "" : `[stderr]\n${stderr}`}[exit ${String(exitCode)}]`
      );
      if (exitCode !== 0) {
        return yield* new SmokeFailed({ message: `${label} exited ${String(exitCode)}:\n${stderr}` });
      }
      return stdout;
    })
  ).pipe(
    Effect.mapError((error) =>
      error._tag === "SmokeFailed" ? error : new SmokeFailed({ message: `${label}: ${error.message}` })
    )
  );
});

function text<E>(stream: Stream.Stream<Uint8Array, E>): Effect.Effect<string, E> {
  return stream.pipe(Stream.decodeText(), Stream.mkString);
}

const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

/** A CLI result: the single JSON document a `--json` run prints. */
const Document = Schema.fromJsonString(Schema.Struct({ _tag: Schema.String }));

const expectDocument = Effect.fn("expectDocument")(function* (stdout: string, tag: string) {
  const document = yield* Schema.decodeEffect(Document)(stdout).pipe(
    Effect.mapError(() => new SmokeFailed({ message: `Expected one JSON document, got: ${stdout}` }))
  );
  if (document._tag !== tag) {
    return yield* new SmokeFailed({ message: `Expected ${tag}, got: ${stdout}` });
  }
});

/** `describe --json`'s pointer to the skill that ships in the package. */
const Vocabulary = Schema.fromJsonString(Schema.TaggedStruct("DeckVocabulary", { skill: Schema.String }));

/**
 * A module that imports a file inside fuse-deck's `dist` by its package path, and exits 0 only when
 * Node refuses it because the package exports no such path.
 */
const DEEP_IMPORT = `try {
  await import("@elmeragroup/fuse-deck/dist/runtime/main.js");
  process.exit(1);
} catch (error) {
  process.exit(error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED" ? 0 : 1);
}`;

/** What the bootstrap does to the document when it runs as a classic script. */
function runBootstrap(source: string, stored: string | null, systemDark: boolean): string | null {
  let scheme: string | null = null;
  runInNewContext(source, {
    document: {
      documentElement: {
        setAttribute: (name: string, value: string) => (scheme = name === "data-theme" ? value : scheme),
      },
    },
    localStorage: { getItem: () => stored },
    window: { matchMedia: () => ({ matches: systemDark }) },
    globalThis: {},
  });
  return scheme;
}

const smoke = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const deckTarball = yield* tarball(packageRoot);
  const fuseTarball = yield* tarball(fuseRoot);
  const consumer = yield* fs.makeTempDirectoryScoped({ directory: tmpdir(), prefix: "fuse-deck-packed-" });
  const decks = yield* fs.makeTempDirectoryScoped({ directory: tmpdir(), prefix: "fuse-deck-decks-" });

  // The consumer installs the React this workspace tests against.
  const react = yield* installedVersion("react");
  yield* fs.writeFileString(
    path.join(consumer, "package.json"),
    yield* encodeJson({
      private: true,
      type: "module",
      dependencies: {
        "@elmeragroup/fuse": `file:${fuseTarball}`,
        "@elmeragroup/fuse-deck": `file:${deckTarball}`,
        react,
        "react-dom": react,
      },
    })
  );
  const cutoff = DateTime.formatIso(DateTime.subtractDuration(yield* DateTime.now, RELEASE_AGE));
  // npm writes package-lock.json, as an install does by default. fuse-deck keys the deck's optimizer
  // cache by it, so the second `dev` below starts from what the first one optimized.
  yield* run(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", `--before=${cutoff}`],
    consumer
  );

  // The command npm linked for the package's `bin`, as an agent in the consumer runs it. Its
  // `#!/usr/bin/env node` finds the Node pnpm put first on PATH for this script.
  const bin = path.join(consumer, "node_modules", ".bin", "fuse-deck");
  const fuseDeck = (args: readonly string[], cwd: string) => run(bin, args, cwd);
  yield* expectDocument(
    yield* fuseDeck(["create", "talk", "--brief", "Packed smoke.", "--json"], decks),
    "DeckCreated"
  );
  const deck = path.join(decks, "talk");

  const { skill } = yield* Schema.decodeEffect(Vocabulary)(
    yield* fuseDeck(["describe", "--json"], deck)
  ).pipe(Effect.mapError((error) => new SmokeFailed({ message: `describe --json: ${error.message}` })));
  const installedSkill = path.join(
    consumer,
    "node_modules",
    "@elmeragroup",
    "fuse-deck",
    "skill",
    "SKILL.md"
  );
  if ((yield* fs.realPath(skill)) !== (yield* fs.realPath(installedSkill))) {
    return yield* new SmokeFailed({
      message: `describe names ${skill}, not the installed ${installedSkill}.`,
    });
  }
  yield* run(process.execPath, ["--input-type=module", "--eval", DEEP_IMPORT], consumer);
  yield* expectDocument(yield* fuseDeck(["slides", "add", "intro", "--json"], deck), "SlideAdded");
  yield* fs.writeFileString(path.join(deck, "slides", "intro.mdx"), INTRO);
  yield* expectDocument(yield* fuseDeck(["check", "--json"], deck), "DeckChecked");
  yield* expectDocument(yield* fuseDeck(["build", "--json"], deck), "DeckBuilt");

  const html = yield* fs.readFileString(path.join(deck, "dist", "index.html"));
  const root = /<html\b[^>]*>/.exec(html)?.[0] ?? "";
  for (const attribute of [
    'data-theme-identity="neutral"',
    'data-theme-brand="elma"',
    'data-theme-segment="private"',
    'data-density="comfortable"',
  ]) {
    if (!root.includes(attribute)) {
      return yield* new SmokeFailed({ message: `<html> lacks ${attribute}: ${root}` });
    }
  }
  const stylesheet = html.search(/<link[^>]*rel="stylesheet"/);
  const bootstrap = /<script>([\s\S]*?)<\/script>/.exec(html);
  const entry = html.search(/<script[^>]*type="module"/);
  if (bootstrap === null || stylesheet === -1 || !(stylesheet < bootstrap.index && bootstrap.index < entry)) {
    return yield* new SmokeFailed({
      message: "The page must link the stylesheet, then run the bootstrap, then load the module entry.",
    });
  }
  const source = bootstrap[1] ?? "";
  const cases = [
    { stored: null, systemDark: false, expected: "light" },
    { stored: null, systemDark: true, expected: "dark" },
    { stored: "light", systemDark: true, expected: "light" },
    { stored: "dark", systemDark: false, expected: "dark" },
  ];
  for (const { stored, systemDark, expected } of cases) {
    const applied = runBootstrap(source, stored, systemDark);
    if (applied !== expected) {
      return yield* new SmokeFailed({
        message: `The bootstrap applied ${String(applied)} with storage ${String(stored)} and a ${systemDark ? "dark" : "light"} system, not ${expected}.`,
      });
    }
  }
  yield* serveAndRender(bin, deck);
  yield* Console.log(
    "Packed smoke passed: create, describe, slides add, check, build and dev ran through the installed fuse-deck command, describe named the installed skill, a deep import failed, the bootstrap applied each scheme, the dev server rendered both slides in Chromium, and a second dev server recovered from a broken first load."
  );
}).pipe(Effect.scoped);

/** `dev --json`'s readiness document. */
const DevServerReady = Schema.fromJsonString(Schema.TaggedStruct("DevServerReady", { url: Schema.String }));
const decodeReady = Schema.decodeUnknownOption(DevServerReady);

/** The deck's title, which labels its cover slide. */
const DeckTitle = Schema.fromJsonString(Schema.Struct({ title: Schema.String }));

/** The intro slide the smoke writes: a Fuse Button, imported from a deck outside the install. */
const INTRO =
  'import { Button } from "@elmeragroup/fuse/button";\n\n# Intro\n\n<Step>One</Step>\n\n<Step>Two</Step>\n\n<Button>Ask</Button>\n';

/** The intro slide with a `<Step>` inside an expression, which the slide compile rejects. */
const BROKEN_INTRO = "# Intro\n\n{<Step>later</Step>}\n";

/**
 * Serve the deck with the installed `dev` twice. The first server renders the cover slide and the
 * slide with the Fuse Button in Chromium. The second starts with the intro slide broken, shows
 * Vite's error overlay, and renders the slide once the file is repaired, with no reload from the
 * test. Each server stops on SIGINT to its PID and must exit 130.
 */
const serveAndRender = Effect.fn("serveAndRender")(
  function* (bin: string, deck: string) {
    const fs = yield* FileSystem.FileSystem;
    const { title } = yield* Schema.decodeEffect(DeckTitle)(
      yield* fs.readFileString(path.join(deck, "deck.json"))
    );
    const slide = path.join(deck, "slides", "intro.mdx");
    const runPromise = Effect.runPromiseWith(yield* Effect.context<never>());
    yield* serveWith(bin, deck, "renders both slides", (browser, url) => renderDeck(browser, url, title));
    yield* fs.writeFileString(slide, BROKEN_INTRO);
    yield* serveWith(bin, deck, "recovers from a broken first load", (browser, url) =>
      recoverFromBrokenLoad(browser, url, () => runPromise(fs.writeFileString(slide, INTRO)))
    );
  },
  Effect.mapError((error) =>
    error._tag === "SmokeFailed" ? error : new SmokeFailed({ message: `dev: ${error.message}` })
  )
);

/**
 * Start `dev --json` in the deck, run `drive` against its address in Chromium, then stop the server
 * with SIGINT and check that it exits 130.
 *
 * @param step - What the step checks, for the log and the failure.
 * @param drive - Opens the page and returns its errors, empty when it behaved.
 */
const serveWith = Effect.fn("serveWith")(function* (
  bin: string,
  deck: string,
  step: string,
  drive: (browser: Browser, url: string) => Promise<string[]>
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  yield* Effect.scoped(
    Effect.gen(function* () {
      // The scope kills the server if a step below fails before the SIGINT.
      const server = yield* spawner.spawn(
        ChildProcess.make(bin, ["dev", "--json"], {
          cwd: deck,
          stdin: "ignore",
          forceKillAfter: Duration.seconds(2),
        })
      );
      yield* Console.log(`$ fuse-deck dev --json  (${step}; in ${deck}, pid ${String(server.pid)})`);
      const stderr = yield* Effect.forkScoped(text(server.stderr));
      const ready = yield* server.stdout.pipe(
        Stream.decodeText(),
        Stream.splitLines,
        Stream.filterMap((line) => Result.fromOption(decodeReady(line), () => line)),
        Stream.runHead,
        Effect.timeout("60 seconds")
      );
      if (Option.isNone(ready)) {
        return yield* new SmokeFailed({
          message: "dev --json closed stdout without a readiness document.",
        });
      }
      const { url } = ready.value;
      yield* Console.log(`ready at ${url}`);

      const pageErrors = yield* Effect.acquireUseRelease(
        Effect.tryPromise({
          try: () => chromium.launch({ headless: true }),
          catch: (cause) => new SmokeFailed({ message: `Chromium did not launch: ${String(cause)}` }),
        }),
        (browser) => Effect.promise(() => drive(browser, url)),
        (browser) => Effect.promise(() => browser.close()).pipe(Effect.ignore)
      );

      // stderr ends only when the server exits, so stop it before reading what it logged.
      // `kill` waits for the exit, so the 10 s limit sits on the kill itself: after it the server
      // gets SIGKILL, its exit code is a signal rather than a number, and the step fails.
      yield* server.kill({ killSignal: "SIGINT", forceKillAfter: Duration.seconds(10) });
      const exited = yield* Effect.result(server.exitCode);
      const status = Result.isSuccess(exited)
        ? `exited ${String(exited.success)}`
        : `did not exit by itself (${exited.failure.message})`;
      yield* Console.log(`dev ${status} on SIGINT\n[stderr]\n${yield* Fiber.join(stderr)}`);
      if (pageErrors.length > 0) {
        return yield* new SmokeFailed({
          message: `The dev page ${step}, but reported errors:\n${pageErrors.join("\n")}`,
        });
      }
      if (!Result.isSuccess(exited) || exited.success !== 130) {
        return yield* new SmokeFailed({ message: `dev ${status} within 10 s of SIGINT, not exit 130.` });
      }
    })
  );
});

/**
 * Open the deck, wait for the cover slide, step to the intro slide and wait for its Fuse Button.
 *
 * @returns The page errors, console errors and failed steps, empty when the deck rendered cleanly.
 */
async function renderDeck(browser: Browser, url: string, title: string): Promise<string[]> {
  const errors: string[] = [];
  try {
    const page = await browser.newPage();
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(`console.error: ${message.text()}`);
      }
    });
    const slide = page.locator('section[aria-roledescription="slide"]');
    await page.goto(url);
    await slide.and(page.getByRole("region", { name: title })).waitFor({ timeout: 30_000 });
    // The cover has no steps, so one ArrowRight opens the intro slide.
    await page.keyboard.press("ArrowRight");
    await slide.and(page.getByRole("region", { name: "Intro" })).waitFor({ timeout: 10_000 });
    await page.getByRole("button", { name: "Ask" }).waitFor({ timeout: 10_000 });
  } catch (error) {
    errors.push(`render: ${error instanceof Error ? error.message : String(error)}`);
  }
  return errors;
}

/**
 * Open the intro slide while it does not compile and wait for Vite's error overlay. Then repair the
 * file and wait for the slide and its Fuse Button, without reloading the page. The broken load
 * logs errors by design, so only a missing overlay or a slide that never renders counts.
 *
 * @param repair - Writes the slide's working text.
 * @returns The failed steps, empty when the page recovered.
 */
async function recoverFromBrokenLoad(
  browser: Browser,
  url: string,
  repair: () => Promise<void>
): Promise<string[]> {
  try {
    const page = await browser.newPage();
    await page.goto(`${url}#/intro`);
    await page.locator("vite-error-overlay").waitFor({ state: "attached", timeout: 30_000 });
    await repair();
    // `dev` polls the deck every 100 ms, so the repair reaches the server at once. Without the
    // reload after a failed load, the slide never renders.
    const slide = page.locator('section[aria-roledescription="slide"]');
    await slide.and(page.getByRole("region", { name: "Intro" })).waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: "Ask" }).waitFor({ timeout: 10_000 });
    return [];
  } catch (error) {
    return [`recover: ${error instanceof Error ? error.message : String(error)}`];
  }
}

/** The version of a package this workspace installed for fuse-deck. */
const installedVersion = Effect.fn("installedVersion")(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  const manifest = yield* fs.readFileString(path.join(packageRoot, "node_modules", name, "package.json"));
  const { version } = yield* Schema.decodeEffect(
    Schema.fromJsonString(Schema.Struct({ version: Schema.String }))
  )(manifest);
  return version;
});

smoke.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
