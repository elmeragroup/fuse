/**
 * The in-memory file's first side stroke weight, rule 49 in `fake/paints.ts`. Unit under test: the
 * fake in `fake-figma.ts`. Oracle: the owner's probe through the Plugin API on 2026-11-20 (FS1). A
 * frame, an auto layout frame and a component, each with one SOLID stroke and no weight ever
 * written, read `[1,1,1,1]`; `strokeTopWeight = 2` then read `[2,0,0,0]` and `strokeLeftWeight = 2`
 * read `[0,0,0,2]`, with `strokeWeight` mixed.
 */
import { describe, expect, it } from "vitest";

import { fixtureFile } from "./fake-fixtures.ts";

type StrokedNode = FrameNode | ComponentNode;

const NODES: readonly (readonly [string, (figma: PluginAPI) => StrokedNode])[] = [
  ["frame", (figma) => figma.createFrame()],
  [
    "auto layout frame",
    (figma) => {
      const frame = figma.createFrame();
      frame.layoutMode = "HORIZONTAL";
      return frame;
    },
  ],
  ["component", (figma) => figma.createComponent()],
];

const SIDES = [
  ["strokeTopWeight", [2, 0, 0, 0]],
  ["strokeLeftWeight", [0, 0, 0, 2]],
] as const;

describe("the fake's first side stroke weight", () => {
  it.each(
    NODES.flatMap(([kind, create]) => SIDES.map(([side, read]) => [kind, side, create, read] as const))
  )("on a %s, %s = 2 spills 0 to the other sides and keeps its own (FS1)", (_kind, side, create, read) => {
    const { figma } = fixtureFile([]);
    const node = create(figma);
    node.resize(40, 40);
    node.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
    const before = [
      node.strokeTopWeight,
      node.strokeRightWeight,
      node.strokeBottomWeight,
      node.strokeLeftWeight,
    ];
    node[side] = 2;
    expect({
      before,
      after: [node.strokeTopWeight, node.strokeRightWeight, node.strokeBottomWeight, node.strokeLeftWeight],
      mixed: node.strokeWeight === figma.mixed,
    }).toEqual({ before: [1, 1, 1, 1], after: read, mixed: true });
  });

  // The Plugin API typings require a non-negative side weight, so a negative or NaN one is a defect
  // in the caller. A rejected write leaves the sides and the write log as they were, and the next
  // side still spills.
  it.each([-1, Number.NaN])(
    "refuses a first side weight of %s and leaves the sides as they were",
    (weight) => {
      const file = fixtureFile([]);
      const node = file.figma.createFrame();
      node.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
      const logged = file.writes.length;
      expect(() => {
        node.strokeTopWeight = weight;
      }).toThrow();
      const rejected = [
        node.strokeTopWeight,
        node.strokeRightWeight,
        node.strokeBottomWeight,
        node.strokeLeftWeight,
      ];
      const loggedAfter = file.writes.length;
      node.strokeLeftWeight = 2;
      expect({
        rejected,
        logged: loggedAfter - logged,
        after: [node.strokeTopWeight, node.strokeRightWeight, node.strokeBottomWeight, node.strokeLeftWeight],
      }).toEqual({ rejected: [1, 1, 1, 1], logged: 0, after: [0, 0, 0, 2] });
    }
  );
});
