/** A box as `figma:probe` measures it, for the suites that hold its sizing rules and its pairing. */
import type { ProbedBox } from "../src/capture/perturbation.ts";

/** A 100px box below a widened root that widened neither with its container nor with its text. */
export const KEPT: ProbedBox = {
  slot: "box",
  place: "0/root/0",
  root: false,
  text: true,
  textReaches: true,
  parentWidened: true,
  base: 100,
  wider: 100,
  longer: 100,
  longest: 100,
  tracksParent: false,
  overflows: false,
  fixedInViewport: false,
  capsAtParent: false,
  widened: true,
  tableCell: false,
};
