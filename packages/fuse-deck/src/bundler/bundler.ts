/**
 * Vite behind the deck: the dev server, the static build, the slide compile and the theme check.
 * The CLI owns the whole Vite config: the deck directory is the root, no `vite.config` file loads,
 * the runtime comes from the package, and Vite's logs go to stderr so stdout keeps the CLI's results.
 */

import react from "@vitejs/plugin-react";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import { Console } from "node:console";
import path from "node:path";
import { build as viteBuild, createLogger, createServer } from "vite";
import type { InlineConfig, Logger } from "vite";

import { DeckFiles } from "../deck/deck-files.ts";
import type { DeckIoFailed } from "../deck/deck-files.ts";
import type { DeckManifest, DeckManifestInvalid } from "../deck/deck-manifest.ts";
import type { SlideFrontmatterInvalid } from "../deck/slide-source.ts";
import { dependencyPackage, fuseDeckPackageRoot } from "../package-root.ts";
import type { DependencyPackage } from "../package-root.ts";
import { BUILD_MARKER, resolveBuildOutput } from "./build-output.ts";
import type { BuildOutputRefused } from "./build-output.ts";
import { deckPlugins } from "./deck-plugin.ts";
import type { DeckManifestModule } from "./deck-plugin.ts";
import { firstPaint, loadFuseTheme } from "./fuse-theme.ts";
import type { FirstPaint, FuseThemeUnavailable, InvalidTheme } from "./fuse-theme.ts";
import { compileSlide } from "./mdx.ts";
import type { CompiledSlide, SlideCompileFailed, SlideMetadata } from "./mdx.ts";
import { optimizerCache } from "./optimizer-cache.ts";
import type { OptimizerCache } from "./optimizer-cache.ts";

/** Vite failed to start, build or serve the deck. */
export class BundlerFailed extends Schema.TaggedError<BundlerFailed>()("BundlerFailed", {
  message: Schema.String,
}) {}

/** A running dev server. */
export type DevServer = {
  /** The address the deck is served at. */
  readonly url: string;
};

/** What `dev` and `build` can fail with before Vite runs. */
export type DeckSiteError =
  | DeckManifestInvalid
  | DeckIoFailed
  | InvalidTheme
  | FuseThemeUnavailable
  | BundlerFailed;

/** Which JSX runtime a compile targets: `dev` serves the development one. */
type Mode = "development" | "production";

/** Serves, builds and compiles the deck. */
export class Bundler extends Context.Service<
  Bundler,
  {
    /** The first-paint attributes and bootstrap for a manifest the caller already loaded. */
    readonly firstPaint: (
      manifest: Pick<DeckManifest, "theme" | "density">
    ) => Effect.Effect<FirstPaint, InvalidTheme | FuseThemeUnavailable>;

    /** Compile one slide through the deck's MDX pipeline, as `build` does. */
    readonly compile: (
      id: string,
      text: string
    ) => Effect.Effect<CompiledSlide, SlideCompileFailed | SlideFrontmatterInvalid>;

    /** Serve the deck until the scope closes. */
    readonly dev: (port: Option.Option<number>) => Effect.Effect<DevServer, DeckSiteError, Scope.Scope>;

    /** Build the deck into `out`, a directory inside the deck or outside it that the build owns. */
    readonly build: (
      out: string
    ) => Effect.Effect<{ readonly out: string }, DeckSiteError | BuildOutputRefused>;
  }
>()("@elmeragroup/fuse-deck/Bundler") {
  /** The bundler for the deck `DeckFiles` found. */
  static readonly layer = Layer.effect(
    Bundler,
    Effect.gen(function* () {
      const deck = yield* DeckFiles;
      const fs = yield* FileSystem.FileSystem;
      const packageRoot = fuseDeckPackageRoot();
      const fuse = yield* Effect.cached(loadFuseTheme(packageRoot));
      const services = yield* Effect.context<DeckFiles>();
      const run = <A>(effect: Effect.Effect<A, HookError, DeckFiles>): Promise<A> =>
        Effect.runPromiseWith(services)(effect.pipe(Effect.mapError(toThrowable)));

      // Each slide compiles once per text: the manifest and Vite's transform both read the result.
      const compiled = new Map<string, { readonly text: string; readonly slide: CompiledSlide }>();
      const compileOnce = (file: string, text: string, mode: Mode) =>
        Effect.suspend(() => {
          const key = `${mode}:${file}`;
          const hit = compiled.get(key);
          return hit?.text === text
            ? Effect.succeed(hit.slide)
            : compileSlide(path.basename(file, ".mdx"), file, text, mode).pipe(
                Effect.tap((slide) =>
                  Effect.sync(() => {
                    compiled.set(key, { text, slide });
                  })
                )
              );
        });

      const deckFirstPaint = Effect.gen(function* () {
        const { manifest } = yield* deck.load;
        return yield* firstPaint(yield* fuse, manifest);
      });

      const dependencies = dependencyPackages();
      // The optimizer reads React, React DOM and Fuse, and fuse-deck's runtime imports them.
      const cacheDir = optimizerCache(
        deck.root,
        [...dependencies, { root: packageRoot, entry: path.join(packageRoot, "dist", "runtime", "main.js") }],
        packageRoot
      ).pipe(Effect.provideService(FileSystem.FileSystem, fs));

      const config = (mode: Mode, cache: OptimizerCache): InlineConfig => ({
        root: deck.root,
        configFile: false,
        envDir: false,
        mode,
        base: "./",
        cacheDir: cache.directory,
        // Without a lockfile the directory's name cannot follow a dependency of React, React DOM or
        // Fuse, so each start optimizes afresh.
        optimizeDeps: { force: Option.isNone(cache.lockfile) },
        customLogger: stderrLogger(mode),
        appType: "spa",
        plugins: [
          deckPlugins({
            root: deck.root,
            packageRoot,
            title: () => run(Effect.map(deck.load, (loaded) => loaded.manifest.title)),
            firstPaint: () => run(deckFirstPaint),
            manifestModule: () => run(manifestModule(mode, compileOnce)),
            compileSlide: (file, text) =>
              run(
                Effect.map(compileOnce(file, text, mode), (slide) => ({
                  code: slide.code,
                  entry: manifestEntry(slide.metadata),
                }))
              ),
          }),
          react({ include: /\.(?:mdx|[jt]sx?)$/ }),
        ],
        server: {
          fs: { allow: [deck.root, packageRoot, ...dependencies.map(({ root }) => root)] },
          // A deck holds a few dozen files, so polling them costs little, and an edit reaches the
          // page within 100 ms. On a busy Mac, FSEvents delivered slide edits 10 s late or not
          // within a minute. Chokidar's CHOKIDAR_USEPOLLING cannot turn it off there: Vite's
          // bundled copy keeps FSEvents when only the variable asks for polling.
          watch: { usePolling: true, interval: 100 },
        },
      });

      return Bundler.of({
        firstPaint: (manifest) => Effect.flatMap(fuse, (theme) => firstPaint(theme, manifest)),
        compile: (id, text) => compileOnce(path.join(deck.root, "slides", `${id}.mdx`), text, "production"),
        dev: Effect.fn("Bundler.dev")(function* (port) {
          yield* deckFirstPaint;
          const cache = yield* cacheDir;
          const devConfig = config("development", cache);
          // The finalizer holds the server from its creation, so a failed `listen` still closes
          // the watcher and the optimizer that `createServer` started.
          const server = yield* Effect.acquireRelease(
            Effect.tryPromise({
              try: () =>
                createServer({
                  ...devConfig,
                  server: {
                    ...devConfig.server,
                    ...Option.match(port, {
                      onNone: () => ({}),
                      onSome: (value) => ({ port: value, strictPort: true }),
                    }),
                  },
                }),
              catch: bundlerFailed("create the dev server"),
            }),
            // With Vite 8.3, `close` did not settle when SIGINT followed the page's first module
            // request (with NODE_ENV=test, every time), so the release stops waiting after 3 s.
            // This matches vitejs/vite#22934: the optimizer leaves a discovered dependency's
            // processing promise unsettled on close. Its fix, vitejs/vite#23567, came after 8.3.0.
            (created) =>
              Effect.promise(() => created.close()).pipe(Effect.timeout("3 seconds"), Effect.ignore)
          );
          yield* Effect.tryPromise({
            try: () => server.listen(),
            catch: bundlerFailed("start the dev server"),
          });
          const url = server.resolvedUrls?.local[0];
          if (url === undefined) {
            return yield* new BundlerFailed({ message: "The dev server started without a local address." });
          }
          return { url };
        }),
        build: Effect.fn("Bundler.build")(function* (out) {
          yield* deckFirstPaint;
          const cache = yield* cacheDir;
          const output = yield* resolveBuildOutput(deck.root, out).pipe(
            Effect.provideService(FileSystem.FileSystem, fs)
          );
          yield* Effect.tryPromise({
            try: () =>
              viteBuild({
                ...config("production", cache),
                // Rolldown's build reporter writes its progress straight to stdout, past the
                // custom logger, and stdout carries the CLI's result. Below info it stays quiet;
                // warnings and errors still reach stderr.
                logLevel: "warn",
                build: { outDir: output.directory, emptyOutDir: true },
              }),
            catch: bundlerFailed("build the deck"),
          });
          const marker = path.join(output.directory, BUILD_MARKER);
          yield* fs
            .writeFileString(
              marker,
              "fuse-deck build wrote this directory and empties it on the next build.\n"
            )
            .pipe(
              Effect.mapError(
                (error) => new BundlerFailed({ message: `Could not write ${marker}: ${error.message}` })
              )
            );
          return { out: output.directory };
        }),
      });
    })
  );
}

/** What the manifest emits for a slide besides its id and import, as one comparable string. */
function manifestEntry(metadata: SlideMetadata): string {
  return `title: ${JSON.stringify(Option.getOrNull(metadata.title))}, layout: ${JSON.stringify(metadata.layout)}, steps: ${String(metadata.steps)}`;
}

/**
 * The manifest module: the deck's settings and, per slide, its title, layout, step count and an
 * `import()` of its file. It fails on a dangling id or a slide that does not compile, which Vite
 * shows.
 */
function manifestModule(
  mode: Mode,
  compile: (
    file: string,
    text: string,
    mode: Mode
  ) => Effect.Effect<CompiledSlide, SlideCompileFailed | SlideFrontmatterInvalid>
) {
  return Effect.gen(function* () {
    const deck = yield* DeckFiles;
    const loaded = yield* deck.load;
    const slides: Array<{ readonly id: string; readonly entry: string }> = [];
    const entries = new Map<string, string>();
    for (const { id, file } of loaded.slides) {
      const compiled = yield* compile(file, yield* deck.readSlide(id), mode);
      const entry = manifestEntry(compiled.metadata);
      entries.set(file, entry);
      slides.push({ id, entry });
    }
    return {
      source: manifestSource(loaded.manifest, slides),
      slides: entries,
    } satisfies DeckManifestModule;
  });
}

/** The manifest module's source, from the deck's settings and each slide's entry. */
function manifestSource(
  manifest: { readonly title: string; readonly aspect: string },
  slides: ReadonlyArray<{ readonly id: string; readonly entry: string }>
): string {
  const items = slides.map(
    ({ id, entry }) =>
      `{ id: ${JSON.stringify(id)}, ${entry}, load: () => import(${JSON.stringify(`/slides/${id}.mdx`)}) }`
  );
  return `export default {
  title: ${JSON.stringify(manifest.title)},
  aspect: ${JSON.stringify(manifest.aspect)},
  slides: [
    ${items.join(",\n    ")}
  ],
};
`;
}

/** What a Vite hook's effect can fail with. */
type HookError =
  | DeckManifestInvalid
  | DeckIoFailed
  | InvalidTheme
  | FuseThemeUnavailable
  | SlideFrontmatterInvalid
  | SlideCompileFailed;

/** Vite's hooks are promise-based; a typed failure crosses them as an `Error` with its message and hint. */
function toThrowable(error: HookError): Error {
  return new Error("hint" in error ? `${error.message}\n${error.hint}` : error.message);
}

function bundlerFailed(operation: string) {
  return (cause: unknown) =>
    new BundlerFailed({
      message: `Vite could not ${operation}: ${cause instanceof Error ? cause.message : String(cause)}`,
    });
}

/**
 * React, React DOM and Fuse, wherever the install put them. With the deck and fuse-deck's own
 * directory, their directories are all Vite may serve; the dependencies they import reach the page
 * through the optimizer's cache in the deck.
 */
function dependencyPackages(): DependencyPackage[] {
  return ["react", "react-dom", "@elmeragroup/fuse"].flatMap((name) =>
    Option.toArray(dependencyPackage(name))
  );
}

/**
 * Vite's own logger with both streams on stderr, so stdout carries only the CLI's results. `dev`
 * logs from info up; `build` logs warnings and errors.
 */
function stderrLogger(mode: Mode): Logger {
  return createLogger(mode === "development" ? "info" : "warn", {
    allowClearScreen: false,
    console: new Console(process.stderr, process.stderr),
  });
}
