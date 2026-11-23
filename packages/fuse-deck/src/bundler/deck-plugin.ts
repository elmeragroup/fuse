/**
 * The Vite plugins that turn a deck directory into a site. Vite's root is the deck; the HTML shell,
 * the runtime and the slide pipeline belong to the package.
 *
 * - `virtual:fuse-deck` is the deck's manifest: its settings and, for each slide, the metadata the
 *   compile pass derives and a real `import()` of the slide, so Vite owns relative assets.
 * - The HTML shell links the token stylesheet in `<head>`, stamps Fuse's document attributes on
 *   `<html>`, and runs Fuse's classic color-scheme bootstrap after the stylesheet and before the
 *   module entry, in dev and in build.
 * - React, its JSX runtimes and Fuse resolve as if the package imported them. Compiled MDX imports
 *   `react/jsx-runtime` from the deck directory, which has no `node_modules`. In dev they go
 *   through Vite's dependency optimizer, also when fuse-deck itself is installed in `node_modules`.
 * - A change to `deck.json` or to the set of slide files reloads the page. A slide edit that changes
 *   what the manifest emits for that slide invalidates it and reloads; any other slide edit is
 *   normal HMR. After a manifest load fails, the next edit under `slides/` invalidates and reloads.
 */

import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";

import type { FirstPaint } from "./fuse-theme.ts";

/** The manifest's import id. */
export const MANIFEST_ID = "virtual:fuse-deck";
const RESOLVED_MANIFEST_ID = `\0${MANIFEST_ID}`;

/**
 * The bare specifiers resolved from the package rather than from the importer, each matched
 * exactly, so `react` never rewrites `react/jsx-runtime` or `react-dom/client`.
 */
const PACKAGE_RESOLVED =
  /^(?:react|react-dom|react-dom\/client|react\/jsx-runtime|react\/jsx-dev-runtime|@elmeragroup\/fuse(?:\/.+)?)$/;

/** A JavaScript file Vite's dependency optimizer can bundle, as Vite 8.3 tests it. */
const OPTIMIZABLE = /\.[cm]?[jt]s$/;

function isInNodeModules(file: string): boolean {
  return file.split(/[\\/]/).includes("node_modules");
}

/** The manifest module's source, and what it emits for each slide file. */
export type DeckManifestModule = {
  /** The module's JavaScript. */
  readonly source: string;
  /** Per slide file, the title, layout and step count the source emits for it. */
  readonly slides: ReadonlyMap<string, string>;
};

/** A slide compiled for Vite, with what the manifest would emit for it. */
export type CompiledSlideModule = {
  /** The JavaScript module. */
  readonly code: string;
  /** The title, layout and step count, as the manifest emits them. */
  readonly entry: string;
};

/** What the deck plugins read from the bundler. */
export type DeckPluginInput = {
  /** The deck directory, Vite's root. */
  readonly root: string;
  /** fuse-deck's package directory, where the runtime and shell live and dependencies resolve from. */
  readonly packageRoot: string;
  /** The deck's title, for the shell's `<title>`. */
  readonly title: () => Promise<string>;
  /** The first-paint attributes and bootstrap, read again for each page. */
  readonly firstPaint: () => Promise<FirstPaint>;
  /** The manifest module. */
  readonly manifestModule: () => Promise<DeckManifestModule>;
  /** Compile a slide file to JavaScript. */
  readonly compileSlide: (file: string, text: string) => Promise<CompiledSlideModule>;
};

/**
 * The deck's Vite plugins.
 *
 * @param input - The deck and what the plugins read from the bundler.
 * @returns The plugins, in order.
 */
export function deckPlugins(input: DeckPluginInput): Plugin[] {
  const indexHtml = path.join(input.root, "index.html");
  const anchor = path.join(input.packageRoot, "package.json");
  const runtime = (file: string) => `/@fs${path.join(input.packageRoot, "dist", "runtime", file)}`;

  const shell = async () => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(await input.title())}</title>
    <link rel="stylesheet" href="${runtime("deck.css")}" />
  </head>
  <body>
    <div id="deck"></div>
    <script type="module" src="${runtime("main.js")}"></script>
  </body>
</html>
`;

  // What the manifest Vite last loaded emitted for each slide file.
  let emitted: ReadonlyMap<string, string> = new Map();
  // Whether the last manifest load failed. Then `emitted` says nothing about the page, which shows
  // Vite's error overlay, so the next slide edit reloads it.
  let loadFailed = false;

  return [
    {
      name: "fuse-deck:resolve",
      enforce: "pre",
      config: {
        // @vitejs/plugin-react asks the dependency optimizer to resolve React from the root up
        // front, which fails in a deck directory. The optimizer finds React on first request,
        // through the resolver below.
        order: "post",
        handler(config) {
          const include = config.optimizeDeps?.include;
          if (include !== undefined) {
            config.optimizeDeps = {
              ...config.optimizeDeps,
              include: include.filter((id) => !PACKAGE_RESOLVED.test(id)),
            };
          }
        },
      },
      // `scan` is Vite's internal flag for its dependency scan, which records the ids itself.
      async resolveId(source, importer, options: { readonly isEntry: boolean; readonly scan?: boolean }) {
        if (!PACKAGE_RESOLVED.test(source) || importer === anchor) {
          return null;
        }
        const resolved = await this.resolve(source, anchor, { skipSelf: true });
        const optimizer = this.environment.mode === "dev" ? this.environment.depsOptimizer : undefined;
        if (resolved === null || optimizer === undefined || options.scan === true) {
          return resolved;
        }
        // Vite optimizes a bare import only when its importer sits outside node_modules. The anchor
        // is the importer here, and in an install it sits inside node_modules, so Vite serves
        // React's CommonJS entry as is. Hand the id to the optimizer as Vite does for an app's own
        // import. The workspace anchor gets an optimized id from Vite already.
        const file = resolved.id.split("?")[0] ?? resolved.id;
        if (optimizer.isOptimizedDepFile(resolved.id) || !OPTIMIZABLE.test(file) || !isInNodeModules(file)) {
          return resolved;
        }
        return {
          ...resolved,
          id: optimizer.getOptimizedDepId(optimizer.registerMissingImport(source, file)),
        };
      },
    },
    {
      name: "fuse-deck:mdx",
      enforce: "pre",
      async transform(code, id) {
        const file = id.split("?")[0] ?? id;
        if (!file.endsWith(".mdx")) {
          return null;
        }
        return { code: (await input.compileSlide(file, code)).code, map: null };
      },
    },
    {
      name: "fuse-deck:manifest",
      resolveId(source) {
        return source === MANIFEST_ID ? RESOLVED_MANIFEST_ID : null;
      },
      async load(id) {
        if (id !== RESOLVED_MANIFEST_ID) {
          return null;
        }
        try {
          const manifest = await input.manifestModule();
          emitted = manifest.slides;
          loadFailed = false;
          return manifest.source;
        } catch (error) {
          loadFailed = true;
          throw error;
        }
      },
      async handleHotUpdate({ file, server, read }) {
        if (loadFailed && isWithin(path.join(input.root, "slides"), file)) {
          reloadManifest(server);
          return [];
        }
        const before = emitted.get(file);
        if (before === undefined) {
          return undefined;
        }
        // A slide that no longer compiles goes through normal HMR, whose transform reports it.
        const after = await input.compileSlide(file, await read()).then(
          (slide) => slide.entry,
          () => before
        );
        if (after === before) {
          return undefined;
        }
        reloadManifest(server);
        return [];
      },
      configureServer(server) {
        const reloadOn = (file: string) => {
          if (file === path.join(input.root, "deck.json") || isSlideFile(input.root, file)) {
            reloadManifest(server);
          }
        };
        server.watcher.on("add", reloadOn);
        server.watcher.on("unlink", reloadOn);
        server.watcher.on("change", (file) => {
          if (file === path.join(input.root, "deck.json")) {
            reloadManifest(server);
          }
        });
      },
    },
    {
      name: "fuse-deck:html",
      resolveId: {
        order: "pre",
        handler(id) {
          return id === indexHtml ? id : null;
        },
      },
      load: {
        order: "pre",
        handler(id) {
          return id === indexHtml ? shell() : null;
        },
      },
      configureServer(server) {
        // Runs after Vite's own middlewares, so the SPA fallback has already rewritten the URL.
        return () => {
          server.middlewares.use((request, response, next) => {
            if (request.url !== "/index.html" && request.url !== "/") {
              next();
              return;
            }
            shell()
              .then((html) => server.transformIndexHtml(request.url ?? "/", html))
              .then((html) => {
                response.setHeader("Content-Type", "text/html");
                response.statusCode = 200;
                response.end(html);
              })
              .catch(next);
          });
        };
      },
      transformIndexHtml: {
        order: "post",
        async handler(html) {
          return applyFirstPaint(html, await input.firstPaint());
        },
      },
    },
  ];
}

function isWithin(directory: string, file: string): boolean {
  return file.startsWith(`${directory}${path.sep}`);
}

function isSlideFile(root: string, file: string): boolean {
  return path.dirname(file) === path.join(root, "slides") && file.endsWith(".mdx");
}

function reloadManifest(server: ViteDevServer): void {
  const module = server.moduleGraph.getModuleById(RESOLVED_MANIFEST_ID);
  if (module !== undefined) {
    server.moduleGraph.invalidateModule(module);
  }
  server.ws.send({ type: "full-reload" });
}

const HTML_OPEN_TAG = /<html\b[^>]*>/i;
const MODULE_SCRIPT = /<script\b[^>]*\btype=(["'])module\1[^>]*>/i;
const STYLESHEET = /<link\b[^>]*\brel=(["'])stylesheet\1[^>]*>\s*/gi;

/**
 * Stamp the document attributes on `<html>`, and put the stylesheets, then the classic bootstrap,
 * before the first module script.
 *
 * @param html - The page.
 * @param paint - The attributes and the bootstrap.
 * @returns The page ready for its first paint.
 * @throws When the page lacks `<html>`, a stylesheet or a module script, which only a broken shell causes.
 */
export function applyFirstPaint(html: string, paint: FirstPaint): string {
  const stamped = html.replace(HTML_OPEN_TAG, (tag) =>
    tag.replace(
      />$/,
      `${Object.entries(paint.attributes)
        .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
        .join("")}>`
    )
  );
  const stylesheets = [...stamped.matchAll(STYLESHEET)].map((match) => match[0].trim());
  if (stylesheets.length === 0) {
    throw new Error("The deck shell has no stylesheet link.");
  }
  const withoutStylesheets = stamped.replace(STYLESHEET, "");
  const entry = MODULE_SCRIPT.exec(withoutStylesheets);
  if (entry === null) {
    throw new Error("The deck shell has no module script.");
  }
  return `${withoutStylesheets.slice(0, entry.index)}${stylesheets.join("")}<script>${paint.bootstrap}</script>${withoutStylesheets.slice(entry.index)}`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
