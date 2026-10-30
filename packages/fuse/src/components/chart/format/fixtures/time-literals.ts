/** Time labels written by hand, which `time-judges.ts` compares with Fuse's output. */
import type { SupportedLocale } from "../../../../intl/locale-context";
import type { XFormat } from "../../chart-types";
import type { LabelRole } from "../formatted-text";
import type { Interval, TimePreset } from "../time-format";
import type { LiteralCase, Zone } from "./judgement";

/** A time slot and preset with one literal per locale. */
export type TimeCase = LiteralCase & {
  readonly zone: Zone;
  readonly start: string;
  readonly interval: Interval;
  readonly preset: TimePreset;
  readonly role: LabelRole;
};

/**
 * Time literals written by hand. The calendar names follow CLDR 48 `ca-gregorian`, and the spoken
 * clock words are the drafted dictionary entries that `TODO.md` lists for sign-off. The month and
 * year boundary cases read the offset from the EU summer-time rule: UTC+1 in winter and UTC+2 in
 * summer for Oslo and Stockholm, one hour more for Helsinki.
 */
export const TIME_CASES: readonly TimeCase[] = [
  {
    name: "afternoon hour range",
    zone: "Europe/Oslo",
    start: "2026-10-17T12:00:00Z",
    interval: "hour",
    preset: "hour-range",
    role: "full",
    text: {
      "nb-NO": "14\u201315",
      "sv-SE": "14\u201315",
      "fi-FI": "14\u201315",
      "en-US": "2\u00a0\u2013\u00a03\u00a0PM",
    },
    spoken: {
      "nb-NO": "kl.\u00a014\u00a0til\u00a015",
      "sv-SE": "kl.\u00a014\u00a0till\u00a015",
      "fi-FI": "klo\u00a014\u00a0ja\u00a015\u00a0välillä",
      "en-US": "2\u00a0PM\u00a0to\u00a03\u00a0PM",
    },
  },
  {
    name: "first repeated hour",
    zone: "Europe/Oslo",
    start: "2025-10-26T00:00:00Z",
    interval: "hour",
    preset: "hour-range",
    role: "full",
    text: {
      "nb-NO": "02\u201303\u00a0(CEST)",
      "sv-SE": "02\u201303\u00a0(CEST)",
      "fi-FI": "02\u201303\u00a0(UTC+2)",
      "en-US": "2\u00a0\u2013\u00a03\u00a0AM\u00a0(GMT+2)",
    },
    spoken: {
      "nb-NO": "kl.\u00a002\u00a0til\u00a003,\u00a0sentraleuropeisk\u00a0sommertid",
      "sv-SE": "kl.\u00a002\u00a0till\u00a003,\u00a0centraleuropeisk\u00a0sommartid",
      "fi-FI": "klo\u00a002\u00a0ja\u00a003\u00a0välillä,\u00a0Keski-Euroopan\u00a0kesäaika",
      "en-US": "2\u00a0AM\u00a0to\u00a03\u00a0AM,\u00a0Central\u00a0European\u00a0Summer\u00a0Time",
    },
  },
  {
    // Written by hand from CLDR 48 for layer 05's screen-reader judges: the second 02:00 hour of
    // the Oslo fall-back day, in the hour-range preset, with CLDR's long standard-time zone names.
    name: "second repeated hour",
    zone: "Europe/Oslo",
    start: "2025-10-26T01:00:00Z",
    interval: "hour",
    preset: "hour-range",
    role: "full",
    text: {
      "nb-NO": "02\u201303\u00a0(CET)",
      "sv-SE": "02\u201303\u00a0(CET)",
      "fi-FI": "02\u201303\u00a0(UTC+1)",
      "en-US": "2\u00a0\u2013\u00a03\u00a0AM\u00a0(GMT+1)",
    },
    spoken: {
      "nb-NO": "kl.\u00a002\u00a0til\u00a003,\u00a0sentraleuropeisk\u00a0normaltid",
      "sv-SE": "kl.\u00a002\u00a0till\u00a003,\u00a0centraleuropeisk\u00a0normaltid",
      "fi-FI": "klo\u00a002\u00a0ja\u00a003\u00a0välillä,\u00a0Keski-Euroopan\u00a0normaaliaika",
      "en-US": "2\u00a0AM\u00a0to\u00a03\u00a0AM,\u00a0Central\u00a0European\u00a0Standard\u00a0Time",
    },
  },
  {
    // Written by hand from CLDR 48: the date that heads the description of the fall-back day.
    name: "fall-back day date",
    zone: "Europe/Oslo",
    start: "2025-10-25T22:00:00Z",
    interval: "day",
    preset: "date",
    role: "full",
    text: {
      "nb-NO": "søndag\u00a026.\u00a0oktober",
      "sv-SE": "söndag\u00a026\u00a0oktober",
      "fi-FI": "sunnuntai\u00a026.\u00a0lokakuuta",
      "en-US": "Sunday,\u00a0October\u00a026",
    },
    spoken: {
      "nb-NO": "søndag\u00a026.\u00a0oktober",
      "sv-SE": "söndag\u00a026\u00a0oktober",
      "fi-FI": "sunnuntai\u00a026.\u00a0lokakuuta",
      "en-US": "Sunday,\u00a0October\u00a026",
    },
  },
  {
    // Written by hand from CLDR 48 for layer 05's spoken arrays. 1 October 2025 is a Wednesday,
    // and Oslo keeps summer time until 26 October.
    name: "S07 missing day date",
    zone: "Europe/Oslo",
    start: "2025-10-04T22:00:00Z",
    interval: "day",
    preset: "date",
    role: "full",
    text: {
      "nb-NO": "søndag\u00a05.\u00a0oktober",
      "sv-SE": "söndag\u00a05\u00a0oktober",
      "fi-FI": "sunnuntai\u00a05.\u00a0lokakuuta",
      "en-US": "Sunday,\u00a0October\u00a05",
    },
    spoken: {
      "nb-NO": "søndag\u00a05.\u00a0oktober",
      "sv-SE": "söndag\u00a05\u00a0oktober",
      "fi-FI": "sunnuntai\u00a05.\u00a0lokakuuta",
      "en-US": "Sunday,\u00a0October\u00a05",
    },
  },
  {
    // Written by hand from CLDR 48 for layer 05's spoken arrays. 1 October 2025 is a Wednesday,
    // and Oslo keeps summer time until 26 October.
    name: "S07 corrected day date",
    zone: "Europe/Oslo",
    start: "2025-10-08T22:00:00Z",
    interval: "day",
    preset: "date",
    role: "full",
    text: {
      "nb-NO": "torsdag\u00a09.\u00a0oktober",
      "sv-SE": "torsdag\u00a09\u00a0oktober",
      "fi-FI": "torstai\u00a09.\u00a0lokakuuta",
      "en-US": "Thursday,\u00a0October\u00a09",
    },
    spoken: {
      "nb-NO": "torsdag\u00a09.\u00a0oktober",
      "sv-SE": "torsdag\u00a09\u00a0oktober",
      "fi-FI": "torstai\u00a09.\u00a0lokakuuta",
      "en-US": "Thursday,\u00a0October\u00a09",
    },
  },
  {
    // Written by hand from CLDR 48 for layer 05's spoken arrays. 1 October 2025 is a Wednesday,
    // and Oslo keeps summer time until 26 October.
    name: "S07 estimated day date",
    zone: "Europe/Oslo",
    start: "2025-10-15T22:00:00Z",
    interval: "day",
    preset: "date",
    role: "full",
    text: {
      "nb-NO": "torsdag\u00a016.\u00a0oktober",
      "sv-SE": "torsdag\u00a016\u00a0oktober",
      "fi-FI": "torstai\u00a016.\u00a0lokakuuta",
      "en-US": "Thursday,\u00a0October\u00a016",
    },
    spoken: {
      "nb-NO": "torsdag\u00a016.\u00a0oktober",
      "sv-SE": "torsdag\u00a016\u00a0oktober",
      "fi-FI": "torstai\u00a016.\u00a0lokakuuta",
      "en-US": "Thursday,\u00a0October\u00a016",
    },
  },
  {
    // Written by hand from CLDR 48 for layer 05's spoken arrays. 1 October 2025 is a Wednesday,
    // and Oslo keeps summer time until 26 October.
    name: "S07 pending day date",
    zone: "Europe/Oslo",
    start: "2025-10-19T22:00:00Z",
    interval: "day",
    preset: "date",
    role: "full",
    text: {
      "nb-NO": "mandag\u00a020.\u00a0oktober",
      "sv-SE": "måndag\u00a020\u00a0oktober",
      "fi-FI": "maanantai\u00a020.\u00a0lokakuuta",
      "en-US": "Monday,\u00a0October\u00a020",
    },
    spoken: {
      "nb-NO": "mandag\u00a020.\u00a0oktober",
      "sv-SE": "måndag\u00a020\u00a0oktober",
      "fi-FI": "maanantai\u00a020.\u00a0lokakuuta",
      "en-US": "Monday,\u00a0October\u00a020",
    },
  },
  {
    // Written by hand from CLDR 48 for layer 05's spoken arrays. 1 October 2025 is a Wednesday,
    // and Oslo keeps summer time until 26 October.
    name: "S14 last day date",
    zone: "Europe/Oslo",
    start: "2025-10-30T23:00:00Z",
    interval: "day",
    preset: "date",
    role: "full",
    text: {
      "nb-NO": "fredag\u00a031.\u00a0oktober",
      "sv-SE": "fredag\u00a031\u00a0oktober",
      "fi-FI": "perjantai\u00a031.\u00a0lokakuuta",
      "en-US": "Friday,\u00a0October\u00a031",
    },
    spoken: {
      "nb-NO": "fredag\u00a031.\u00a0oktober",
      "sv-SE": "fredag\u00a031\u00a0oktober",
      "fi-FI": "perjantai\u00a031.\u00a0lokakuuta",
      "en-US": "Friday,\u00a0October\u00a031",
    },
  },
  {
    // Written by hand from CLDR 48: the date that heads S06's description.
    name: "S06 day date",
    zone: "Europe/Oslo",
    start: "2026-10-15T22:00:00Z",
    interval: "day",
    preset: "date",
    role: "full",
    text: {
      "nb-NO": "fredag\u00a016.\u00a0oktober",
      "sv-SE": "fredag\u00a016\u00a0oktober",
      "fi-FI": "perjantai\u00a016.\u00a0lokakuuta",
      "en-US": "Friday,\u00a0October\u00a016",
    },
    spoken: {
      "nb-NO": "fredag\u00a016.\u00a0oktober",
      "sv-SE": "fredag\u00a016\u00a0oktober",
      "fi-FI": "perjantai\u00a016.\u00a0lokakuuta",
      "en-US": "Friday,\u00a0October\u00a016",
    },
  },
  {
    name: "repeated hour with the hour preset",
    zone: "Europe/Oslo",
    start: "2025-10-26T01:00:00Z",
    interval: "hour",
    preset: "hour",
    role: "full",
    text: {
      "nb-NO": "02\u00a0(CET)",
      "sv-SE": "02\u00a0(CET)",
      "fi-FI": "02\u00a0(UTC+1)",
      "en-US": "2\u00a0AM\u00a0(GMT+1)",
    },
    spoken: {
      "nb-NO": "kl.\u00a002,\u00a0sentraleuropeisk\u00a0normaltid",
      "sv-SE": "kl.\u00a002,\u00a0centraleuropeisk\u00a0normaltid",
      "fi-FI": "klo\u00a002,\u00a0Keski-Euroopan\u00a0normaaliaika",
      "en-US": "2\u00a0AM,\u00a0Central\u00a0European\u00a0Standard\u00a0Time",
    },
  },
  {
    name: "repeated minute sample",
    zone: "Europe/Helsinki",
    start: "2025-10-26T00:30:00Z",
    interval: "minute",
    preset: "time",
    role: "full",
    text: {
      "nb-NO": "03:30\u00a0(EEST)",
      "sv-SE": "03:30\u00a0(EEST)",
      "fi-FI": "03.30\u00a0(UTC+3)",
      "en-US": "3:30\u00a0AM\u00a0(GMT+3)",
    },
    spoken: {
      "nb-NO": "kl.\u00a003:30,\u00a0østeuropeisk\u00a0sommertid",
      "sv-SE": "kl.\u00a003:30,\u00a0östeuropeisk\u00a0sommartid",
      "fi-FI": "klo\u00a003.30,\u00a0Itä-Euroopan\u00a0kesäaika",
      "en-US": "3:30\u00a0AM,\u00a0Eastern\u00a0European\u00a0Summer\u00a0Time",
    },
  },
  {
    name: "range across noon",
    zone: "Europe/Stockholm",
    start: "2026-10-17T09:45:00Z",
    interval: "quarter-hour",
    preset: "time-range",
    role: "full",
    text: {
      "nb-NO": "11:45\u201312:00",
      "sv-SE": "11:45\u201312:00",
      "fi-FI": "11.45\u201312.00",
      "en-US": "11:45\u00a0AM\u00a0\u2013\u00a012:00\u00a0PM",
    },
    spoken: {
      "nb-NO": "kl.\u00a011:45\u00a0til\u00a012:00",
      "sv-SE": "kl.\u00a011:45\u00a0till\u00a012:00",
      "fi-FI": "klo\u00a011.45\u00a0ja\u00a012.00\u00a0välillä",
      "en-US": "11:45\u00a0AM\u00a0to\u00a012:00\u00a0PM",
    },
  },
  {
    name: "last hour of a month",
    zone: "Europe/Oslo",
    start: "2026-10-31T22:00:00Z",
    interval: "hour",
    preset: "hour-range",
    role: "full",
    text: {
      "nb-NO": "23\u201324",
      "sv-SE": "23\u201324",
      "fi-FI": "23\u201324",
      "en-US": "11\u00a0PM\u00a0\u2013\u00a012\u00a0AM",
    },
    spoken: {
      "nb-NO": "kl.\u00a023\u00a0til\u00a024",
      "sv-SE": "kl.\u00a023\u00a0till\u00a024",
      "fi-FI": "klo\u00a023\u00a0ja\u00a024\u00a0välillä",
      "en-US": "11\u00a0PM\u00a0to\u00a012\u00a0AM",
    },
  },
  {
    name: "repeated hour on a tick",
    zone: "Europe/Oslo",
    start: "2025-10-26T01:00:00Z",
    interval: "hour",
    preset: "hour",
    role: "tick",
    text: { "nb-NO": "02", "sv-SE": "02", "fi-FI": "02", "en-US": "2\u00a0AM" },
    spoken: { "nb-NO": "kl.\u00a002", "sv-SE": "kl.\u00a002", "fi-FI": "klo\u00a002", "en-US": "2\u00a0AM" },
  },
  {
    name: "axis end tick",
    zone: "Europe/Oslo",
    start: "2026-10-17T22:00:00Z",
    interval: "hour",
    preset: "hour",
    role: "tick",
    text: { "nb-NO": "00", "sv-SE": "00", "fi-FI": "00", "en-US": "12\u00a0AM" },
    spoken: { "nb-NO": "kl.\u00a000", "sv-SE": "kl.\u00a000", "fi-FI": "klo\u00a000", "en-US": "12\u00a0AM" },
  },
  {
    name: "quarter-hour range",
    zone: "Europe/Helsinki",
    start: "2026-10-17T11:15:00Z",
    interval: "quarter-hour",
    preset: "time-range",
    role: "full",
    text: {
      "nb-NO": "14:15\u201314:30",
      "sv-SE": "14:15\u201314:30",
      "fi-FI": "14.15\u201314.30",
      "en-US": "2:15\u00a0\u2013\u00a02:30\u00a0PM",
    },
    spoken: {
      "nb-NO": "kl.\u00a014:15\u00a0til\u00a014:30",
      "sv-SE": "kl.\u00a014:15\u00a0till\u00a014:30",
      "fi-FI": "klo\u00a014.15\u00a0ja\u00a014.30\u00a0välillä",
      "en-US": "2:15\u00a0PM\u00a0to\u00a02:30\u00a0PM",
    },
  },
  {
    name: "minute sample",
    zone: "Europe/Oslo",
    start: "2026-10-17T11:06:00Z",
    interval: "minute",
    preset: "time",
    role: "tick",
    text: { "nb-NO": "13:06", "sv-SE": "13:06", "fi-FI": "13.06", "en-US": "1:06\u00a0PM" },
    spoken: {
      "nb-NO": "kl.\u00a013:06",
      "sv-SE": "kl.\u00a013:06",
      "fi-FI": "klo\u00a013.06",
      "en-US": "1:06\u00a0PM",
    },
  },
  {
    // F1: CLDR 48's Hms with the two-digit hour of TIME-CONVENTIONS rule 2, written by hand.
    name: "second sample",
    zone: "Europe/Oslo",
    start: "2026-10-17T11:42:04Z",
    interval: "second",
    preset: "time-seconds",
    role: "tick",
    text: { "nb-NO": "13:42:04", "sv-SE": "13:42:04", "fi-FI": "13.42.04", "en-US": "1:42:04\u00a0PM" },
    spoken: {
      "nb-NO": "kl.\u00a013:42:04",
      "sv-SE": "kl.\u00a013:42:04",
      "fi-FI": "klo\u00a013.42.04",
      "en-US": "1:42:04\u00a0PM",
    },
  },
  {
    name: "morning second sample",
    zone: "Europe/Oslo",
    start: "2026-10-17T07:05:07Z",
    interval: "second",
    preset: "time-seconds",
    role: "tick",
    text: { "nb-NO": "09:05:07", "sv-SE": "09:05:07", "fi-FI": "09.05.07", "en-US": "9:05:07\u00a0AM" },
    spoken: {
      "nb-NO": "kl.\u00a009:05:07",
      "sv-SE": "kl.\u00a009:05:07",
      "fi-FI": "klo\u00a009.05.07",
      "en-US": "9:05:07\u00a0AM",
    },
  },
  {
    name: "minute range",
    zone: "Europe/Oslo",
    start: "2026-10-17T11:06:00Z",
    interval: "minute",
    preset: "time-range",
    role: "full",
    text: {
      "nb-NO": "13:06\u201313:07",
      "sv-SE": "13:06\u201313:07",
      "fi-FI": "13.06\u201313.07",
      "en-US": "1:06\u00a0\u2013\u00a01:07\u00a0PM",
    },
    spoken: {
      "nb-NO": "kl.\u00a013:06\u00a0til\u00a013:07",
      "sv-SE": "kl.\u00a013:06\u00a0till\u00a013:07",
      "fi-FI": "klo\u00a013.06\u00a0ja\u00a013.07\u00a0välillä",
      "en-US": "1:06\u00a0PM\u00a0to\u00a01:07\u00a0PM",
    },
  },
  {
    name: "last day of July in summer time",
    zone: "Europe/Oslo",
    start: "2026-07-31T10:00:00Z",
    interval: "hour",
    preset: "hour-range",
    role: "full",
    text: {
      "nb-NO": "12\u201313",
      "sv-SE": "12\u201313",
      "fi-FI": "12\u201313",
      "en-US": "12\u00a0\u2013\u00a01\u00a0PM",
    },
    spoken: {
      "nb-NO": "kl.\u00a012\u00a0til\u00a013",
      "sv-SE": "kl.\u00a012\u00a0till\u00a013",
      "fi-FI": "klo\u00a012\u00a0ja\u00a013\u00a0välillä",
      "en-US": "12\u00a0PM\u00a0to\u00a01\u00a0PM",
    },
  },
  {
    name: "last day of February",
    zone: "Europe/Oslo",
    start: "2026-02-28T12:00:00Z",
    interval: "hour",
    preset: "hour-range",
    role: "full",
    text: {
      "nb-NO": "13\u201314",
      "sv-SE": "13\u201314",
      "fi-FI": "13\u201314",
      "en-US": "1\u00a0\u2013\u00a02\u00a0PM",
    },
    spoken: {
      "nb-NO": "kl.\u00a013\u00a0til\u00a014",
      "sv-SE": "kl.\u00a013\u00a0till\u00a014",
      "fi-FI": "klo\u00a013\u00a0ja\u00a014\u00a0välillä",
      "en-US": "1\u00a0PM\u00a0to\u00a02\u00a0PM",
    },
  },
  {
    name: "last quarter-hour of the year",
    zone: "Europe/Stockholm",
    start: "2026-12-31T22:45:00Z",
    interval: "quarter-hour",
    preset: "time-range",
    role: "full",
    text: {
      "nb-NO": "23:45\u201324:00",
      "sv-SE": "23:45\u201324:00",
      "fi-FI": "23.45\u201324.00",
      "en-US": "11:45\u00a0PM\u00a0\u2013\u00a012:00\u00a0AM",
    },
    spoken: {
      "nb-NO": "kl.\u00a023:45\u00a0til\u00a024:00",
      "sv-SE": "kl.\u00a023:45\u00a0till\u00a024:00",
      "fi-FI": "klo\u00a023.45\u00a0ja\u00a024.00\u00a0välillä",
      "en-US": "11:45\u00a0PM\u00a0to\u00a012:00\u00a0AM",
    },
  },
  {
    name: "first hour of the year",
    zone: "Europe/Helsinki",
    start: "2025-12-31T22:00:00Z",
    interval: "hour",
    preset: "hour-range",
    role: "full",
    text: {
      "nb-NO": "00\u201301",
      "sv-SE": "00\u201301",
      "fi-FI": "00\u201301",
      "en-US": "12\u00a0\u2013\u00a01\u00a0AM",
    },
    spoken: {
      "nb-NO": "kl.\u00a000\u00a0til\u00a001",
      "sv-SE": "kl.\u00a000\u00a0till\u00a001",
      "fi-FI": "klo\u00a000\u00a0ja\u00a001\u00a0välillä",
      "en-US": "12\u00a0AM\u00a0to\u00a01\u00a0AM",
    },
  },
  {
    name: "full date",
    zone: "Europe/Oslo",
    start: "2026-10-19T22:00:00Z",
    interval: "day",
    preset: "date",
    role: "full",
    text: {
      "nb-NO": "tirsdag\u00a020.\u00a0oktober",
      "sv-SE": "tisdag\u00a020\u00a0oktober",
      "fi-FI": "tiistai\u00a020.\u00a0lokakuuta",
      "en-US": "Tuesday,\u00a0October\u00a020",
    },
    spoken: {
      "nb-NO": "tirsdag\u00a020.\u00a0oktober",
      "sv-SE": "tisdag\u00a020\u00a0oktober",
      "fi-FI": "tiistai\u00a020.\u00a0lokakuuta",
      "en-US": "Tuesday,\u00a0October\u00a020",
    },
  },
  {
    name: "spoken short calendar forms",
    zone: "Europe/Oslo",
    start: "2026-10-19T22:00:00Z",
    interval: "day",
    preset: "weekday",
    role: "tick",
    text: { "nb-NO": "tir.", "sv-SE": "tis", "fi-FI": "ti", "en-US": "Tue" },
    spoken: { "nb-NO": "tirsdag", "sv-SE": "tisdag", "fi-FI": "tiistai", "en-US": "Tuesday" },
  },
  {
    name: "spoken month",
    zone: "Europe/Oslo",
    start: "2026-09-30T22:00:00Z",
    interval: "month",
    preset: "month",
    role: "tick",
    text: { "nb-NO": "okt", "sv-SE": "okt.", "fi-FI": "loka", "en-US": "Oct" },
    spoken: { "nb-NO": "oktober", "sv-SE": "oktober", "fi-FI": "lokakuu", "en-US": "October" },
  },
  {
    name: "spoken day",
    zone: "Europe/Oslo",
    start: "2026-10-19T22:00:00Z",
    interval: "day",
    preset: "day",
    role: "tick",
    text: { "nb-NO": "20.", "sv-SE": "20", "fi-FI": "20", "en-US": "20" },
    spoken: {
      "nb-NO": "20.\u00a0oktober",
      "sv-SE": "20\u00a0oktober",
      "fi-FI": "20.\u00a0lokakuuta",
      "en-US": "October\u00a020",
    },
  },
  {
    name: "year",
    zone: "Europe/Helsinki",
    start: "2025-12-31T22:00:00Z",
    interval: "year",
    preset: "year",
    role: "tick",
    text: { "nb-NO": "2026", "sv-SE": "2026", "fi-FI": "2026", "en-US": "2026" },
    spoken: { "nb-NO": "2026", "sv-SE": "2026", "fi-FI": "2026", "en-US": "2026" },
  },
];

/** A slot label through the public `formatChartSlot`, written by hand for one locale. */
export type SlotLabelCase = {
  readonly name: string;
  readonly locale: SupportedLocale;
  readonly zone: string;
  readonly at: string;
  readonly interval: Interval;
  /** The preset or Intl options, or the interval's default label preset when absent. */
  readonly format?: XFormat;
  readonly text: string;
  /** The spoken label, where the case checks it. */
  readonly spoken?: string;
};

/**
 * Slot labels written by hand from CLDR 48's nb patterns and the zone changes the slot-start
 * oracle covers. Each case lands in a slot whose start a wall-clock rule would get wrong.
 */
export const SLOT_START_CASES: readonly SlotLabelCase[] = [
  // Amman fell back from 01:00+03 to 00:00+02 at 2021-10-28T22:00Z, so midnight repeats and the
  // day's first hour is the one at +03. Jordan kept Eastern European time then, which CLDR's nb
  // short name writes as EEST in summer.
  {
    name: "Amman's first midnight",
    locale: "nb-NO",
    zone: "Asia/Amman",
    at: "2021-10-28T21:30:00Z",
    interval: "hour",
    format: "time-range",
    text: "00:00\u201301:00\u00a0(EEST)",
  },
  // Lord Howe moved from 02:00+10:30 to 02:30+11 at 2025-10-04T15:30Z, a 23.5-hour day.
  {
    name: "Lord Howe's short day",
    locale: "nb-NO",
    zone: "Australia/Lord_Howe",
    at: "2025-10-04T16:00:00Z",
    interval: "hour",
    format: "time-range",
    text: "02:30\u201303:30",
  },
  // Lord Howe moved from 02:00+11 to 01:30+10:30 at 2025-04-05T15:00Z, a 24.5-hour day, so 01:30
  // repeats and its full label names the offset.
  {
    name: "Lord Howe's long day",
    locale: "nb-NO",
    zone: "Australia/Lord_Howe",
    at: "2025-04-05T15:15:00Z",
    interval: "hour",
    format: "time-range",
    text: "01:30\u201302:30\u00a0(GMT+10:30)",
  },
  // Santiago moved from 00:00-04 to 01:00-03 at 2025-09-07T04:00Z, so its day starts there.
  {
    name: "Santiago's gap day",
    locale: "nb-NO",
    zone: "America/Santiago",
    at: "2025-09-07T04:30:00Z",
    interval: "hour",
    format: "time-range",
    text: "01:00\u201302:00",
  },
  // Chatham keeps +12:45 in June, so 2025-06-15T10:20Z is local 23:05 in the day's last hour.
  {
    name: "Chatham's +12:45 hour",
    locale: "nb-NO",
    zone: "Pacific/Chatham",
    at: "2025-06-15T10:20:00Z",
    interval: "hour",
    format: "time-range",
    text: "23:00\u201324:00",
  },
  // Toronto moved from 23:30 EST to 00:30 EDT at 1919-03-31T04:30Z, so its day's first hour starts
  // at 00:30. CLDR's nb `Hm` pattern writes it with a colon, and the range ends an hour later.
  {
    name: "Toronto's 1919 gap day",
    locale: "nb-NO",
    zone: "America/Toronto",
    at: "1919-03-31T04:45:00Z",
    interval: "hour",
    format: "time-range",
    text: "00:30\u201301:30",
  },
  // Monrovia kept -00:44:30 until 1972-01-07T00:44:30Z, so 1971-01-01 starts at 00:44:30Z, and
  // 00:44:45Z is 15 seconds into its first hour. The hour's default label is CLDR's padded nb `H`
  // range.
  {
    name: "Monrovia's seconds offset",
    locale: "nb-NO",
    zone: "Africa/Monrovia",
    at: "1971-01-01T00:44:45Z",
    interval: "hour",
    text: "00\u201301",
  },
];

/**
 * Intl options with no prototype, as `Object.create(null)` or a parsed payload gives them. The
 * literal's `__proto__` key sets the prototype and adds no property.
 */
const NULL_PROTOTYPE_OPTIONS = { __proto__: null, month: "short", day: "numeric" } as const;

/**
 * Slot labels written by hand from CLDR 48's nb and en patterns, in Oslo's summer time of UTC+2
 * unless a case names another zone. Each instant lies inside its slot, so the label names the
 * slot's start and not the instant, and a week or month `date` label names its first day.
 */
export const SLOT_LABEL_CASES: readonly SlotLabelCase[] = [
  {
    name: "a second slot's time label",
    locale: "nb-NO",
    zone: "Europe/Oslo",
    at: "2026-10-17T14:07:09.400Z",
    interval: "second",
    format: "time",
    text: "16:07",
  },
  {
    name: "the minute range that holds the instant",
    locale: "nb-NO",
    zone: "Europe/Oslo",
    at: "2026-10-17T14:07:41Z",
    interval: "minute",
    format: "time-range",
    text: "16:07–16:08",
  },
  {
    name: "the hour range that holds the instant",
    locale: "nb-NO",
    zone: "Europe/Oslo",
    at: "2026-10-17T15:30:00Z",
    interval: "hour",
    format: "time-range",
    text: "17:00–18:00",
  },
  {
    name: "a minute's default label",
    locale: "nb-NO",
    zone: "Europe/Oslo",
    at: "2026-10-17T14:07:41Z",
    interval: "minute",
    text: "16:07",
  },
  {
    name: "a quarter hour's default label",
    locale: "nb-NO",
    zone: "Europe/Oslo",
    at: "2026-10-17T14:07:00Z",
    interval: "quarter-hour",
    text: "16:00–16:15",
  },
  {
    name: "an hour's default label",
    locale: "nb-NO",
    zone: "Europe/Oslo",
    at: "2026-10-17T15:30:00Z",
    interval: "hour",
    text: "17–18",
  },
  {
    name: "a day's default label",
    locale: "nb-NO",
    zone: "Europe/Oslo",
    at: "2026-10-17T15:30:00Z",
    interval: "day",
    text: "lørdag 17. oktober",
  },
  {
    name: "a month's default label",
    locale: "nb-NO",
    zone: "Europe/Oslo",
    at: "2026-10-17T15:30:00Z",
    interval: "month",
    text: "oktober 2026",
  },
  {
    name: "a year's default label",
    locale: "nb-NO",
    zone: "Europe/Oslo",
    at: "2026-10-17T15:30:00Z",
    interval: "year",
    text: "2026",
  },
  {
    name: "a week's date names its Monday",
    locale: "nb-NO",
    zone: "Europe/Oslo",
    at: "2026-10-17T15:30:00Z",
    interval: "week",
    format: "date",
    text: "mandag 12. oktober",
  },
  {
    name: "a month's date names its first day",
    locale: "nb-NO",
    zone: "Europe/Oslo",
    at: "2026-10-17T15:30:00Z",
    interval: "month",
    format: "date",
    text: "torsdag 1. oktober",
  },
  // Santiago's 2025-09-07 starts at 01:00-03, after its skipped midnight, so the day keeps its date.
  {
    name: "Santiago's gap day by its own date",
    locale: "en-US",
    zone: "America/Santiago",
    at: "2025-09-07T12:00:00Z",
    interval: "day",
    format: "date",
    text: "Sunday, September 7",
  },
  {
    name: "Intl clock options at a day's start",
    locale: "nb-NO",
    zone: "Europe/Oslo",
    at: "2026-10-17T15:30:00Z",
    interval: "day",
    format: { hour: "2-digit", minute: "2-digit" },
    text: "00:00",
  },
  // 2026-10-17T23:30Z is 01:30 on 18 October in Oslo, so the day is the 18th in the given zone.
  {
    name: "Intl date options in the given zone",
    locale: "en-US",
    zone: "Europe/Oslo",
    at: "2026-10-17T23:30:00Z",
    interval: "day",
    format: { month: "short", day: "numeric" },
    text: "Oct 18",
    spoken: "Oct 18",
  },
  {
    name: "Intl date options with no prototype",
    locale: "en-US",
    zone: "Europe/Oslo",
    at: "2026-10-17T23:30:00Z",
    interval: "day",
    format: NULL_PROTOTYPE_OPTIONS,
    text: "Oct 18",
    spoken: "Oct 18",
  },
];

/** A slot label case whose format is Intl options with date and time fields. */
export type DateTimeCase = Omit<SlotLabelCase, "format"> & {
  readonly format: Omit<Intl.DateTimeFormatOptions, "timeZone" | "timeZoneName">;
};

/** A date-time case's fields, at 12:30 on Sunday 18 October 2026 in Oslo, a minute slot. */
const AT_OSLO_NOON = { zone: "Europe/Oslo", at: "2026-10-18T10:30:00Z", interval: "minute" } as const;

/**
 * Each language's `dateStyle` lengths with a short time, as `[locale, dateStyle, label]`. The date
 * halves follow CLDR 48's `dateFormats` and the time halves its short `timeFormats`.
 */
const STYLE_JOINS: ReadonlyArray<readonly [SupportedLocale, "full" | "long" | "medium" | "short", string]> = [
  ["en-US", "full", "Sunday,\u00a0October\u00a018,\u00a02026\u00a0at\u00a012:30\u00a0PM"],
  ["en-US", "long", "October\u00a018,\u00a02026\u00a0at\u00a012:30\u00a0PM"],
  ["en-US", "medium", "Oct\u00a018,\u00a02026,\u00a012:30\u00a0PM"],
  ["en-US", "short", "10/18/26,\u00a012:30\u00a0PM"],
  ["nb-NO", "full", "søndag\u00a018.\u00a0oktober\u00a02026\u00a0kl.\u00a012:30"],
  ["nb-NO", "long", "18.\u00a0oktober\u00a02026\u00a0kl.\u00a012:30"],
  ["nb-NO", "medium", "18.\u00a0okt.\u00a02026,\u00a012:30"],
  ["nb-NO", "short", "18.10.2026,\u00a012:30"],
  ["sv-SE", "full", "söndag\u00a018\u00a0oktober\u00a02026\u00a0kl.\u00a012:30"],
  ["sv-SE", "long", "18\u00a0oktober\u00a02026\u00a0kl.\u00a012:30"],
  ["sv-SE", "medium", "18\u00a0okt.\u00a02026\u00a012:30"],
  ["sv-SE", "short", "2026-10-18\u00a012:30"],
  ["fi-FI", "full", "sunnuntai\u00a018.\u00a0lokakuuta\u00a02026\u00a0klo\u00a012.30"],
  ["fi-FI", "long", "18.\u00a0lokakuuta\u00a02026\u00a0klo\u00a012.30"],
  ["fi-FI", "medium", "18.10.2026\u00a0klo\u00a012.30"],
  ["fi-FI", "short", "18.10.2026\u00a0klo\u00a012.30"],
];

/**
 * A weekday alone with a time, which CLDR 48 prints through one skeleton, en's `Ehm` of
 * `E h:mm a`, with no join.
 */
export const WEEKDAY_TIME_CASE: DateTimeCase = {
  name: "a weekday with a time takes one skeleton",
  locale: "en-US",
  ...AT_OSLO_NOON,
  format: { weekday: "short", hour: "numeric", minute: "2-digit" },
  text: "Sun\u00a012:30\u00a0PM",
  spoken: "Sun\u00a012:30\u00a0PM",
};

/**
 * Date-times whose format holds date and time fields, written by hand from CLDR 48. Each label is
 * the date half, the `dateTimeFormats-atTime` join and the time half. en joins full and long with
 * ` at ` and medium and short with `, `. nb joins with ` kl. ` and `, `, sv with ` kl. ` and a
 * space, and fi with ` klo ` at every length. A `dateStyle` names the length, and otherwise
 * UTS #35 picks it from the date fields. The last case is {@link WEEKDAY_TIME_CASE}.
 */
export const DATE_TIME_CASES: readonly DateTimeCase[] = [
  ...STYLE_JOINS.map(([locale, dateStyle, label]): DateTimeCase => ({
    name: `a ${locale} ${dateStyle} date with a short time`,
    locale,
    ...AT_OSLO_NOON,
    format: { dateStyle, timeStyle: "short" },
    text: label,
    spoken: label,
  })),
  // The hour cycle stays with the time half, so the 24-hour clock replaces en-US's 12-hour one.
  {
    name: "an en-US medium date with a 24-hour time",
    locale: "en-US",
    ...AT_OSLO_NOON,
    format: { dateStyle: "medium", timeStyle: "short", hourCycle: "h23" },
    text: "Oct\u00a018,\u00a02026,\u00a012:30",
    spoken: "Oct\u00a018,\u00a02026,\u00a012:30",
  },
  {
    name: "a weekday and a wide month join at full length",
    locale: "en-US",
    ...AT_OSLO_NOON,
    format: { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" },
    text: "Sunday,\u00a0October\u00a018\u00a0at\u00a012:30\u00a0PM",
    spoken: "Sunday,\u00a0October\u00a018\u00a0at\u00a012:30\u00a0PM",
  },
  {
    name: "a wide month joins at long length",
    locale: "nb-NO",
    ...AT_OSLO_NOON,
    format: { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" },
    text: "18.\u00a0oktober\u00a0kl.\u00a012:30",
    spoken: "18.\u00a0oktober\u00a0kl.\u00a012:30",
  },
  {
    name: "an abbreviated month joins at medium length",
    locale: "en-US",
    ...AT_OSLO_NOON,
    format: { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
    text: "Oct\u00a018,\u00a012:30\u00a0PM",
    spoken: "Oct\u00a018,\u00a012:30\u00a0PM",
  },
  {
    name: "a numeric month joins at short length",
    locale: "sv-SE",
    ...AT_OSLO_NOON,
    format: { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" },
    text: "18/10\u00a012:30",
    spoken: "18/10\u00a012:30",
  },
  WEEKDAY_TIME_CASE,
];

/** A slot of a time domain whose first and last slot starts the case names. */
export type DatedSlotCase = {
  readonly name: string;
  readonly locale: SupportedLocale;
  readonly interval: Interval;
  /** The domain's first and last slot starts, in UTC. */
  readonly first: string;
  readonly last: string;
  /** The labelled slot, by index. */
  readonly slot: number;
  readonly text: string;
  readonly spoken: string;
};

/**
 * Slot labels on domains of more than one local date in Oslo, after CONTRACT section 9.4's date
 * rule, written by hand. The dates follow CLDR 48's long weekday, numeric day and long month,
 * with the year after them, the clock ranges are the hour-range literals above, and the joiner is
 * the drafted dictionary's `, `. Every space inside a formatted half is U+00A0.
 */
export const DATED_SLOT_CASES: readonly DatedSlotCase[] = [
  {
    name: "an hour on a two-day domain in en-US",
    locale: "en-US",
    interval: "hour",
    first: "2025-09-30T22:00:00Z",
    last: "2025-10-02T21:00:00Z",
    slot: 0,
    text: "Wednesday, October 1, 12 – 1 AM",
    spoken: "Wednesday, October 1, 12 AM to 1 AM",
  },
  {
    name: "an hour on a two-day domain in nb-NO",
    locale: "nb-NO",
    interval: "hour",
    first: "2025-09-30T22:00:00Z",
    last: "2025-10-02T21:00:00Z",
    slot: 0,
    text: "onsdag 1. oktober, 00–01",
    spoken: "onsdag 1. oktober, kl. 00 til 01",
  },
  {
    name: "an hour on a two-day domain in sv-SE",
    locale: "sv-SE",
    interval: "hour",
    first: "2025-09-30T22:00:00Z",
    last: "2025-10-02T21:00:00Z",
    slot: 0,
    text: "onsdag\u00a01\u00a0oktober, 00\u201301",
    spoken: "onsdag\u00a01\u00a0oktober, kl.\u00a000\u00a0till\u00a001",
  },
  {
    name: "an hour on a two-day domain in fi-FI",
    locale: "fi-FI",
    interval: "hour",
    first: "2025-09-30T22:00:00Z",
    last: "2025-10-02T21:00:00Z",
    slot: 0,
    text: "keskiviikko\u00a01.\u00a0lokakuuta, 00\u201301",
    spoken: "keskiviikko\u00a01.\u00a0lokakuuta, klo\u00a000\u00a0ja\u00a001\u00a0välillä",
  },
  {
    name: "New Year's Eve's last hour on a domain into 2026, in en-US",
    locale: "en-US",
    interval: "hour",
    first: "2025-12-31T22:00:00Z",
    last: "2025-12-31T23:00:00Z",
    slot: 0,
    text: "Wednesday, December 31, 2025, 11 PM – 12 AM",
    spoken: "Wednesday, December 31, 2025, 11 PM to 12 AM",
  },
  {
    name: "New Year's Eve's last hour on a domain into 2026, in nb-NO",
    locale: "nb-NO",
    interval: "hour",
    first: "2025-12-31T22:00:00Z",
    last: "2025-12-31T23:00:00Z",
    slot: 0,
    text: "onsdag 31. desember 2025, 23–24",
    spoken: "onsdag 31. desember 2025, kl. 23 til 24",
  },
  {
    name: "a day on a domain into 2026, in nb-NO",
    locale: "nb-NO",
    interval: "day",
    first: "2025-12-30T23:00:00Z",
    last: "2025-12-31T23:00:00Z",
    slot: 0,
    text: "onsdag 31. desember 2025",
    spoken: "onsdag 31. desember 2025",
  },
];
