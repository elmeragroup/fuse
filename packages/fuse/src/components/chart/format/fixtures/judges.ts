/**
 * Every judge the format tests run, as `[name, judge]` pairs. `format.test.ts` runs them in Node,
 * `format.engines.browser.test.ts` in Chromium, Firefox and WebKit, and `zone-probe.ts` under
 * other process zones.
 */
import {
  calendarJudgements,
  foreignJoinJudgements,
  marketJudgements,
  slotJudgements,
  publicSlotJudgements,
  timeLiteralJudgements,
} from "./time-judges";
import { DATE_TIME_CASES, SLOT_LABEL_CASES, SLOT_START_CASES } from "./time-literals";
import { presetJudgements, publicValueJudgements, wordJudgements } from "./value-judges";

/** The judges, by what they judge. */
export const JUDGES = [
  ["hourly and quarter-hour slots", slotJudgements],
  ["days, months and ISO weeks", calendarJudgements],
  ["fall-back day rows", marketJudgements],
  ["time preset literals", timeLiteralJudgements],
  ["slot labels across zone changes", () => publicSlotJudgements(SLOT_START_CASES)],
  ["slot labels and their default presets", () => publicSlotJudgements(SLOT_LABEL_CASES)],
  ["date-times that Fuse joins", () => publicSlotJudgements(DATE_TIME_CASES)],
  ["date-times outside the joined languages", foreignJoinJudgements],
  ["value preset literals", presetJudgements],
  ["values through formatChartValue", publicValueJudgements],
  ["drafted unit and subunit words", wordJudgements],
] as const;
