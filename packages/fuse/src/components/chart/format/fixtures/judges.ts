/**
 * Every judge the format tests run, as `[name, judge]` pairs. `format.test.ts` runs them in Node,
 * `format.engines.browser.test.ts` in Chromium, Firefox and WebKit, and `zone-probe.ts` under
 * other process zones.
 */
import { calendarJudgements, marketJudgements, slotJudgements, timeLiteralJudgements } from "./time-judges";
import { presetJudgements, wordJudgements } from "./value-judges";

/** The judges, by what they judge. */
export const JUDGES = [
  ["hourly and quarter-hour slots", slotJudgements],
  ["days, months and ISO weeks", calendarJudgements],
  ["frozen fall-back price rows", marketJudgements],
  ["time preset literals", timeLiteralJudgements],
  ["value preset literals", presetJudgements],
  ["drafted unit and subunit words", wordJudgements],
] as const;
