/**
 * The browser bundle of the client renderers, which the compare page loads to mount its client
 * cells. rolldown bundles each renderer's module with the Fuse build it imports, React and
 * `client-mount.ts`, as `icon-library.ts` bundles the icons, for the browser this time. The bundle
 * mounts the page's client cells as soon as it runs.
 */

import { Effect } from "effect";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

import type { ClientCellRenderer } from "./cell-renderers.ts";

const ENTRY_ID = "\0fuse-compare-client.js";

/** Rolldown could not bundle the client renderers, such as for a rendering a module does not export. */
export class ClientBundleFailed extends Error {
  readonly _tag = "ClientBundleFailed" as const;
}

/** The bundle's entry: an import of each rendering, and the mount of every client cell. */
function entrySource(renderers: readonly ClientCellRenderer[]): string {
  const mount = JSON.stringify(fileURLToPath(new URL("client-mount.ts", import.meta.url)));
  const imports = renderers.map(
    ({ module }, index) =>
      `import { ${module.name} as r${String(index)} } from ${JSON.stringify(fileURLToPath(module.url))};`
  );
  const entries = renderers.map(({ set }, index) => `[${JSON.stringify(set)}, r${String(index)}]`);
  return [
    `import { mountClientCells } from ${mount};`,
    ...imports,
    `void mountClientCells(new Map([${entries.join(", ")}]));`,
  ].join("\n");
}

/** Rolldown's message for a failure, which the run reports. */
function bundleFailure(cause: unknown): ClientBundleFailed {
  return new ClientBundleFailed(cause instanceof Error ? cause.message : String(cause), { cause });
}

/**
 * Bundle the client renderers for the page.
 *
 * @param renderers - The client renderers, each with the module and export the bundle imports.
 * @returns The bundle's code, or an empty string for no client renderer. The Effect fails with
 *   `ClientBundleFailed` and rolldown's message, such as for a module that does not export the
 *   rendering its renderer names.
 */
export const buildClientBundle = Effect.fnUntraced(function* (renderers: readonly ClientCellRenderer[]) {
  if (renderers.length === 0) {
    return "";
  }
  const source = entrySource(renderers);
  const code = yield* Effect.acquireUseRelease(
    Effect.tryPromise({
      try: () =>
        rolldown({
          input: ENTRY_ID,
          // The bundle's imports resolve from this package, which depends on Fuse and React.
          cwd: fileURLToPath(new URL("../..", import.meta.url)),
          plugins: [
            {
              name: "fuse-compare-client",
              resolveId: (id) => (id === ENTRY_ID ? id : undefined),
              load: (id) => (id === ENTRY_ID ? source : undefined),
            },
          ],
          platform: "browser",
          logLevel: "silent",
          transform: { define: { "process.env.NODE_ENV": JSON.stringify("production") } },
        }),
      catch: bundleFailure,
    }),
    (bundle) =>
      Effect.tryPromise({
        try: () => bundle.generate({ format: "esm", codeSplitting: false }),
        catch: bundleFailure,
      }).pipe(Effect.map(({ output }) => output[0].code)),
    (bundle) => Effect.promise(() => bundle.close())
  );
  return code;
});
