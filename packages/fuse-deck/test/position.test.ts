import { describe, expect, it } from "vitest";

import { fromHash, moveForKey, moveTo, toHash } from "../src/runtime/position.ts";
import type { Move, Position } from "../src/runtime/position.ts";

/** cover has no steps, intro three, outro none. */
const SLIDES = [
  { id: "cover", steps: 0 },
  { id: "intro", steps: 3 },
  { id: "outro", steps: 0 },
];

describe("moveTo", () => {
  it.each<{ from: Position; move: Move; to: Position }>([
    { from: { slide: 0, step: 0 }, move: "next", to: { slide: 1, step: 0 } },
    { from: { slide: 1, step: 0 }, move: "next", to: { slide: 1, step: 1 } },
    { from: { slide: 1, step: 3 }, move: "next", to: { slide: 2, step: 0 } },
    { from: { slide: 2, step: 0 }, move: "next", to: { slide: 2, step: 0 } },
    { from: { slide: 1, step: 2 }, move: "previous", to: { slide: 1, step: 1 } },
    { from: { slide: 1, step: 0 }, move: "previous", to: { slide: 0, step: 0 } },
    { from: { slide: 2, step: 0 }, move: "previous", to: { slide: 1, step: 3 } },
    { from: { slide: 0, step: 0 }, move: "previous", to: { slide: 0, step: 0 } },
    { from: { slide: 1, step: 2 }, move: "first", to: { slide: 0, step: 0 } },
    { from: { slide: 0, step: 0 }, move: "last", to: { slide: 2, step: 0 } },
  ])("$move from $from.slide/$from.step goes to $to.slide/$to.step", ({ from, move, to }) => {
    expect(moveTo(from, move, SLIDES)).toEqual(to);
  });
});

describe("fromHash and toHash", () => {
  it.each([
    { hash: "#/intro/2", position: { slide: 1, step: 2 } },
    { hash: "#/intro", position: { slide: 1, step: 0 } },
    { hash: "#/outro", position: { slide: 2, step: 0 } },
  ])("$hash names slide $position.slide at step $position.step and back", ({ hash, position }) => {
    expect(fromHash(hash, SLIDES)).toEqual(position);
    expect(toHash(position, SLIDES)).toBe(hash);
  });

  it.each([
    { hash: "", position: { slide: 0, step: 0 } },
    { hash: "#/missing/2", position: { slide: 0, step: 0 } },
    { hash: "#/intro/9", position: { slide: 1, step: 3 } },
    { hash: "#intro", position: { slide: 0, step: 0 } },
  ])("reads $hash as the nearest real position", ({ hash, position }) => {
    expect(fromHash(hash, SLIDES)).toEqual(position);
  });
});

describe("moveForKey", () => {
  const key = (
    name: string,
    modifiers: Partial<Record<"shiftKey" | "altKey" | "ctrlKey" | "metaKey", boolean>> = {}
  ) => ({
    key: name,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    ...modifiers,
  });

  it.each([
    { event: key("ArrowRight"), move: "next" },
    { event: key(" "), move: "next" },
    { event: key(" ", { shiftKey: true }), move: "previous" },
    { event: key("ArrowLeft"), move: "previous" },
    { event: key("Home"), move: "first" },
    { event: key("End"), move: "last" },
    { event: key("ArrowRight", { metaKey: true }), move: null },
    { event: key("a"), move: null },
  ])("maps $event.key to $move", ({ event, move }) => {
    expect(moveForKey(event)).toBe(move);
  });
});
