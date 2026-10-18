/**
 * Prints the runtime zone and the names of the judgements that disagree with their oracle, as
 * JSON. `format.test.ts` runs this in child processes under other `TZ` values.
 */
import { JUDGES } from "./judges";

process.stdout.write(
  JSON.stringify({
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    mismatches: JUDGES.flatMap(([, judge]) => judge())
      .filter((judgement) => JSON.stringify(judgement.actual) !== JSON.stringify(judgement.expected))
      .map((judgement) => judgement.name),
  })
);
