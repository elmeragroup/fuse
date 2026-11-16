/**
 * Unit under test: each static kit definition, its root, parts, icons, labels, images, styles and
 * attribute conditions for every cell of its variant matrix, not only the cells its preview frames
 * place, since the kit builds every variant. Oracle: the static markup the real Fuse component
 * renders for that cell through the definition's compare renderer, read by `checkMarkup` in
 * `markup-check.ts`, whose JSDoc states the rules. A client set's popup renders only once a page
 * mounts it, so `figma:compare` checks those sets on the mounted page instead.
 */
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { matrixCells } from "../components/component-spec.ts";
import { KIT } from "../components/kit-registry.ts";
import { isClientRenderer, loadRenderers } from "./cell-renderers.ts";
import { checkMarkup } from "./markup-check.ts";

// Loading the renderers imports the Fuse build, which the `test` task builds first (`turbo.json`).
// It runs while the file collects, so each set's check gets a test of its own.
const renderers = await Effect.runPromise(loadRenderers());

// A client renderer's set is left out. A set with no renderer stays in, and fails.
const STATIC_SETS = KIT.flatMap((entry) => {
  const renderer = renderers.get(entry.definition.key);
  return renderer !== undefined && isClientRenderer(renderer)
    ? []
    : [[entry.definition.key, { ...entry, renderer }] as const];
});

describe("each static kit definition against its component's markup", () => {
  it.each(STATIC_SETS)("%s holds what its definition says in every cell", (key, { definition, renderer }) => {
    if (renderer === undefined) {
      expect.fail(`${key} has no renderer in cell-renderers.ts`);
    }
    const diagnostics = checkMarkup(definition, matrixCells(definition.axes), renderer);
    expect(diagnostics, diagnostics.map(({ message }) => message).join("\n")).toEqual([]);
  });
});
