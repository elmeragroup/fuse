/**
 * The browser bundle of the client renderers, which the compare page loads to mount its client
 * cells. rolldown bundles each renderer's module with the Fuse build it imports, React and
 * `client-mount.ts`, as `icon-library.ts` bundles the icons, for the browser this time. The bundle
 * mounts the page's client cells as soon as it runs.
 */

import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

import type { ClientCellRenderer } from "./cell-renderers.ts";

const ENTRY_ID = "\0fuse-compare-client.js";

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

/**
 * Bundle the client renderers for the page.
 *
 * @param renderers - The client renderers, each with the module and export the bundle imports.
 * @returns The bundle's code, or an empty string for no client renderer.
 * @throws When a module does not export the rendering its renderer names, which rolldown reports.
 */
export async function buildClientBundle(renderers: readonly ClientCellRenderer[]): Promise<string> {
  if (renderers.length === 0) {
    return "";
  }
  const source = entrySource(renderers);
  const bundle = await rolldown({
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
  });
  try {
    const { output } = await bundle.generate({ format: "esm", codeSplitting: false });
    return output[0].code;
  } finally {
    await bundle.close();
  }
}
