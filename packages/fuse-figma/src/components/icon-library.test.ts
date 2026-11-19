/**
 * The icons the library draws in a weight other than the default. Unit under test: `fuseIcons`, which
 * renders each glyph through `@elmeragroup/fuse/icons`. Oracle: the paths `@phosphor-icons/react`
 * 2.1.10 publishes for `CheckCircle`, its solid `fill` disc and its `bold` ring, which Fuse renders by
 * default, copied from the package's `dist/defs/CheckCircle.es.js`.
 */
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { fuseIcons } from "./icon-library";

/** The start of the `fill` weight's path: the disc, which the check cuts out of. */
const FILL_DISC = "M128,24A104,104,0,1,0,232,128";

/** The start of the `bold` weight's path: the check, which the ring draws around. */
const BOLD_CHECK = "M176.49,95.51a12,12,0,0,1,0,17";

describe("the icon library", () => {
  it.effect("draws CheckCircle's fill weight as CheckCircleFill beside its default bold glyph", () =>
    Effect.gen(function* () {
      const icons = yield* fuseIcons([{ name: "CheckCircle", weight: "fill" }]);
      const svg = (key: string) => icons.find((icon) => icon.key === key)?.svg ?? "";
      expect({
        fill: [
          svg("icon/CheckCircleFill").includes(FILL_DISC),
          svg("icon/CheckCircleFill").includes(BOLD_CHECK),
        ],
        bold: [svg("icon/CheckCircle").includes(FILL_DISC), svg("icon/CheckCircle").includes(BOLD_CHECK)],
      }).toEqual({ fill: [true, false], bold: [false, true] });
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
