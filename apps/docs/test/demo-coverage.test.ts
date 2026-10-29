import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { COMPONENT_INVENTORY } from "./component-inventory";
import { GROUP_FILE } from "./demo-coverage";
import { SWEEP_GROUPS, sweepGroup } from "./demo-sweep";

/**
 * The demo coverage gates split the sweep into one browser suite file per group, named for the
 * group it sweeps. Unit under test: the suite files and the groups they sweep. Oracle: the
 * component page list the sweep reads, which the files must sweep whole, each page once.
 */
describe("the demo coverage split", () => {
  it("sweeps every component page exactly once, one suite file per group", () => {
    const files = readdirSync(path.dirname(fileURLToPath(import.meta.url))).flatMap((name) => {
      const group = GROUP_FILE.exec(name)?.groups?.group;
      return group === undefined ? [] : [Number(group)];
    });
    expect(files.toSorted((a, b) => a - b)).toEqual(
      Array.from({ length: SWEEP_GROUPS }, (_, index) => index + 1)
    );
    expect(files.flatMap((group) => sweepGroup(group)).toSorted()).toEqual(
      [...COMPONENT_INVENTORY.keys()].toSorted()
    );
  });
});
