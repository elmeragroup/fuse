/**
 * The Live code loader's rewrite as a Vite plugin, for the Vitest runs that render demos: the
 * docs unit project's transparency test and the Live code sweep. A module imported with the
 * `?original` query keeps its source, so a test can render a demo both ways.
 */

import { fileURLToPath } from "node:url";

import { liveCodeSchemaOf } from "./live-code-schemas.ts";
import { lensDemoSource } from "./live-code-transform.ts";

const lensModule = fileURLToPath(new URL("../../src/components/live-code/lens.tsx", import.meta.url));
const COMPONENT_DEMO = /\/src\/app\/\(docs\)\/components\/[^/]+\/demos\/[^/?]+\.tsx$/u;

/** The Vite plugin fields this plugin sets; Vitest's `plugins` option takes it as a Vite plugin. */
type LensPlugin = {
  readonly name: string;
  readonly enforce: "pre";
  readonly transform: (code: string, id: string) => string | null;
};

/**
 * Rewrites component demos for Live code, as `next.config.ts`'s Turbopack rule does.
 *
 * @returns The plugin.
 */
export function liveCodeLens(): LensPlugin {
  return {
    name: "live-code-lens",
    enforce: "pre",
    transform(code: string, id: string): string | null {
      if (!COMPONENT_DEMO.test(id)) return null;
      return lensDemoSource(code, liveCodeSchemaOf, lensModule);
    },
  };
}
