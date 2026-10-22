/**
 * The renderer of the `skeleton` set: each cell as the real Fuse `<Skeleton>`, with the shape a
 * docs demo gives it as consumer classes, as `skeleton-kit.ts` draws it: a 192 × 16 line and a
 * 40px circle. A Skeleton has no state, so the shape's classes are its only prop. Fuse's
 * `styles.css` compiles only the classes Fuse's own source uses, so the renderer names every shape
 * class as the host's own, which the page compiles.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Skeleton } from "../../../fuse/dist/skeleton.js";
import type { Cell } from "../components/component-spec.ts";
import { DEMO_CLASSES, demoClassesFor } from "../components/skeleton-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** A `skeleton` cell: a placeholder of one shape, at a size the host's own build compiles. */
export const skeleton: CellRendering = {
  hostClasses: [...DEMO_CLASSES.values()].flatMap((classes) => classes.split(" ")),
  element: (cell: Cell) => createElement(Skeleton, { className: demoClassesFor(cell) }),
};
