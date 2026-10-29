/**
 * Prints the runtime zone and the names of the x-domain judgements that disagree with their
 * oracle, as JSON. `x-domain.test.ts` runs this in child processes under other `TZ` values.
 */
import { slotJudgements } from "./slot-judges";

process.stdout.write(
  JSON.stringify({
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    mismatches: slotJudgements()
      .filter((judgement) => JSON.stringify(judgement.actual) !== JSON.stringify(judgement.expected))
      .map((judgement) => judgement.name),
  })
);
