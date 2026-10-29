import { describe, expect, it } from "vitest";

import { pinCoverageGroups } from "./shard-sequencer";

const GROUPS = [1, 2, 3, 4].map(
  (group) => `/repo/apps/docs/test/demo-coverage-${String(group)}.browser.test.ts`
);
const OTHERS = Array.from(
  { length: 33 },
  (_, index) => `/repo/apps/docs/test/suite-${String(index)}.browser.test.ts`
);

describe("pinCoverageGroups", () => {
  it("runs demo coverage group N on shard N and leaves every other file to Vitest's sharding", () => {
    const shards = [1, 2, 3, 4].map((index) =>
      pinCoverageGroups([...OTHERS, ...GROUPS], { index, count: 4 })
    );
    expect(shards.map(({ pinned }) => pinned)).toEqual(GROUPS.map((group) => [group]));
    for (const { rest } of shards) {
      expect(rest).toEqual(OTHERS);
    }
  });

  it("wraps the groups past a smaller shard count", () => {
    const shards = [1, 2].map((index) => pinCoverageGroups(GROUPS, { index, count: 2 }));
    expect(shards.map(({ pinned }) => pinned)).toEqual([
      [GROUPS[0], GROUPS[2]],
      [GROUPS[1], GROUPS[3]],
    ]);
  });
});
