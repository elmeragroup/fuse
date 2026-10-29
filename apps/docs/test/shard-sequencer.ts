import { BaseSequencer } from "vitest/node";
import type { TestSpecification } from "vitest/node";

import { GROUP_FILE } from "./demo-coverage-file.ts";

/** The shard Vitest runs: its 1-based index and the shard count. */
type Shard = { readonly index: number; readonly count: number };

/**
 * Splits a shard's files into the demo coverage groups it runs, group N on shard N (wrapping past
 * the shard count), and every other file, which Vitest shards as usual.
 *
 * @param files - Every file the run selected, by module id.
 * @param shard - The shard this run is.
 * @returns The groups this shard runs, and the files left to shard.
 */
export function pinCoverageGroups(files: readonly string[], shard: Shard) {
  const groupOf = (file: string) => GROUP_FILE.exec(file)?.groups?.group;
  return {
    pinned: files.filter((file) => {
      const group = groupOf(file);
      return group !== undefined && (Number(group) - 1) % shard.count === shard.index - 1;
    }),
    rest: files.filter((file) => groupOf(file) === undefined),
  };
}

/**
 * Vitest's sharding sorts files by a hash of their path and slices the list evenly, so it can put
 * two demo coverage groups, the browser suite's heaviest files, on one CI leg. This sequencer gives
 * each group a shard of its own and shards every other file as Vitest does.
 */
export class DocsShardSequencer extends BaseSequencer {
  override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { shard } = this.ctx.config;
    if (shard === undefined) {
      return files;
    }
    const { pinned, rest } = pinCoverageGroups(
      files.map((file) => file.moduleId),
      shard
    );
    const pick = (ids: readonly string[]) => files.filter((file) => ids.includes(file.moduleId));
    return [...pick(pinned), ...(await super.shard(pick(rest)))];
  }
}
