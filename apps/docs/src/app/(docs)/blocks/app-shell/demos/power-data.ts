/**
 * The block's data: the back office of a Nordic power retailer with 480 metering points.
 *
 * Every value comes from a seeded generator or a hand-written table, so each load, each
 * screenshot and each test sees the same rows. Replace this module with your API: the pages read
 * nothing else. The shapes are seasonal, as Nordic power is. Consumption peaks in January and is
 * lowest in July, solar production does the opposite, and the spot price dips at midday and peaks
 * in the evening. Every instant is in Europe/Oslo, so the dashboard's "today" is 29 March 2026, the
 * day summer time starts. That day has 23 hours, and so 92 quarter-hours of spot prices.
 */

/** The market's time zone, which every chart and date label uses. */
export const TIME_ZONE = "Europe/Oslo";

/** The moment the dashboard shows: 13:20 on Sunday 29 March 2026 in Oslo, in summer time. */
export const AS_OF = new Date("2026-03-29T13:20:00+02:00");

/** The five Norwegian price areas. */
export const PRICE_AREAS = ["NO1", "NO2", "NO3", "NO4", "NO5"] as const;

/** A Norwegian price area. */
export type PriceArea = (typeof PRICE_AREAS)[number];

/** Where each price area is, for its filter and its tooltip. */
export const PRICE_AREA_NAMES = {
  NO1: "Eastern Norway",
  NO2: "Southern Norway",
  NO3: "Central Norway",
  NO4: "Northern Norway",
  NO5: "Western Norway",
} as const satisfies Record<PriceArea, string>;

/** Where a metering point is in its customer's lifecycle. */
export const METERING_POINT_STATUSES = ["active", "onboarding", "moving-out", "disconnected"] as const;

/** A metering point's lifecycle status. */
export type MeteringPointStatus = (typeof METERING_POINT_STATUSES)[number];

/** Display labels for the statuses. */
export const STATUS_LABELS = {
  active: "Active",
  onboarding: "Onboarding",
  "moving-out": "Moving out",
  disconnected: "Disconnected",
} as const satisfies Record<MeteringPointStatus, string>;

/** How a customer pays for energy. */
export const CONTRACT_TYPES = ["spot", "fixed", "variable"] as const;

/** A customer's contract type. */
export type ContractType = (typeof CONTRACT_TYPES)[number];

/** Display labels for the contract types. */
export const CONTRACT_LABELS = {
  spot: "Spot",
  fixed: "Fixed price",
  variable: "Variable",
} as const satisfies Record<ContractType, string>;

/** A metering point the retailer supplies, with its last 30 days of consumption. */
export type MeteringPoint = {
  /** The 18-digit GSRN Elhub knows the point by, with its GS1 check digit. */
  readonly id: string;
  readonly customer: string;
  readonly address: string;
  readonly city: string;
  readonly priceArea: PriceArea;
  readonly status: MeteringPointStatus;
  readonly contract: ContractType;
  /** Expected consumption over a year, in kWh. */
  readonly annualKwh: number;
  /**
   * Consumption per day for the 30 days up to yesterday, in kWh. A point that is onboarding has no
   * readings before its start, and a disconnected point reads zero.
   */
  readonly last30Days: readonly (number | null)[];
};

/** One day of the month's consumption, this year against the same day last year. */
export type DailyConsumption = {
  /** Midnight in Oslo, the start of the day. */
  readonly day: Date;
  /** Consumption in MWh, or `null` for today and the days still to come. */
  readonly thisYear: number | null;
  /** Consumption on the same date last year, in MWh. */
  readonly lastYear: number;
};

/** One quarter-hour of the day-ahead spot price. */
export type SpotQuarter = {
  /** The quarter's first instant. */
  readonly start: Date;
  /** The NO1 price in øre per kWh, VAT excluded. */
  readonly price: number;
};

/** One month of the portfolio's consumption and its prosumers' solar production. */
export type MonthlyEnergy = {
  /** Midnight in Oslo on the month's first day. */
  readonly month: Date;
  /** Consumption in MWh. */
  readonly consumption: number;
  /** Solar production fed into the grid, in MWh. */
  readonly production: number;
};

/** Where an invoice is in its life. Each state carries what only it knows. */
export type InvoiceState =
  | { readonly _tag: "Paid"; readonly paidOn: Date }
  | { readonly _tag: "Open" }
  | { readonly _tag: "Overdue" }
  | { readonly _tag: "Credited"; readonly creditNote: string };

/** One line of an invoice, in kr with VAT excluded. */
export type InvoiceLine = {
  readonly label: string;
  /** What the line counts, such as `1 234 kWh × 92.10 øre`, or empty for a fixed fee. */
  readonly detail: string;
  readonly amount: number;
};

/** One customer's invoice for February 2026. */
export type Invoice = {
  readonly number: string;
  readonly customer: string;
  readonly meteringPointId: string;
  readonly priceArea: PriceArea;
  readonly contract: ContractType;
  readonly issuedOn: Date;
  readonly dueOn: Date;
  readonly energyKwh: number;
  readonly lines: readonly InvoiceLine[];
  /** The VAT in kr; zero in NO4, where households in Northern Norway pay no VAT on electricity. */
  readonly vat: number;
  /** What the customer pays, in kr. */
  readonly total: number;
  readonly state: InvoiceState;
};

/** What happened in the activity list. */
export type ActivityKind = "invoice-run" | "price-alert" | "move-in" | "reading" | "payment";

/** One entry in the overview's activity list. */
export type Activity = {
  readonly id: string;
  readonly kind: ActivityKind;
  readonly title: string;
  readonly detail: string;
  readonly at: Date;
};

/** A small seeded generator (mulberry32): the same seed gives the same sequence everywhere. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function pick<T>(random: () => number, items: readonly [T, ...T[]]): T {
  return items[Math.floor(random() * items.length)] ?? items[0];
}

/** The date of the last Sunday of a month, which is when Europe's clocks change. */
function lastSunday(year: number, monthIndex: number): number {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  return last.getUTCDate() - last.getUTCDay();
}

/**
 * Midnight in Oslo on a calendar date. Summer time (UTC+2) runs from the last Sunday of March to
 * the last Sunday of October; the midnight that starts each of those Sundays is still on the old
 * offset, because the clocks change at night.
 */
export function osloMidnight(year: number, monthIndex: number, day: number): Date {
  const date = monthIndex * 100 + day;
  const summer = date > 200 + lastSunday(year, 2) && date <= 900 + lastSunday(year, 9);
  return new Date(Date.UTC(year, monthIndex, day, summer ? -2 : -1));
}

const QUARTER_MS = 15 * 60 * 1000;

// NO1's day-ahead price per elapsed hour of 29 March 2026, in øre per kWh with VAT excluded.
// Elapsed hour 2 is 03:00, because 02:00 does not exist that day. Typed by hand, not market data.
const HOURLY_PRICE = [
  61.8, 58.2, 55.1, 54.6, 56.9, 61.3, 68.4, 77.9, 81.2, 72.5, 58.7, 44.3, 36.8, 35.2, 41.9, 57.4, 79.6, 104.8,
  118.3, 109.1, 91.7, 78.4, 69.0,
] as const;

/** Today's 92 quarter-hours of NO1 spot price, each eased toward the next hour. */
export const SPOT_TODAY: readonly SpotQuarter[] = (() => {
  const random = seeded(29_03_2026);
  const start = osloMidnight(2026, 2, 29).getTime();
  return HOURLY_PRICE.flatMap((price, hour) => {
    const next = HOURLY_PRICE[hour + 1] ?? price;
    return [0, 1, 2, 3].map((quarter) => ({
      start: new Date(start + (hour * 4 + quarter) * QUARTER_MS),
      price: round(price + ((next - price) * quarter) / 8 + (random() - 0.5) * 2.4, 2),
    }));
  });
})();

/** NO1's average spot price over the last 30 days, in øre per kWh with VAT excluded. */
export const SPOT_30_DAY_AVERAGE = 72.4;

/** How a price compares with the 30-day average, as a price-level badge says it. */
export type PriceLevel = "low" | "normal" | "high";

/**
 * The level of a spot price: low under 80 % of the 30-day average, high over 125 %.
 *
 * @param price - A spot price in øre per kWh.
 * @returns The price's level.
 */
export function priceLevel(price: number): PriceLevel {
  if (price < SPOT_30_DAY_AVERAGE * 0.8) return "low";
  if (price > SPOT_30_DAY_AVERAGE * 1.25) return "high";
  return "normal";
}

/**
 * The quarter-hour that holds `at`: the one that starts at or before it and ends after it.
 *
 * @param at - Any instant.
 * @returns The quarter, or `undefined` outside today's 92 quarters.
 */
export function spotAt(at: Date): SpotQuarter | undefined {
  const time = at.getTime();
  return SPOT_TODAY.find(
    (quarter) => quarter.start.getTime() <= time && time < quarter.start.getTime() + QUARTER_MS
  );
}

/** Expected consumption of the whole portfolio over a year, in MWh. */
export const PORTFOLIO_ANNUAL_MWH = 7680;

/** Expected solar production of the portfolio's prosumers over a year, in MWh. */
export const SOLAR_ANNUAL_MWH = 312;

// Each month's share of a year's consumption and of a year's solar production, in percent, January
// first. Both columns add up to 100: heating drives the winter peak, daylight the summer one.
const CONSUMPTION_SHARE = [12.6, 11.2, 10.4, 8.0, 6.2, 4.9, 4.6, 5.0, 6.0, 8.0, 10.2, 12.9] as const;
const SOLAR_SHARE = [1, 3, 7, 11, 15, 16, 15, 13, 10, 6, 2, 1] as const;

/** The twelve complete months up to the current one, March 2025 to February 2026. */
export const MONTHLY_ENERGY: readonly MonthlyEnergy[] = Array.from({ length: 12 }, (_, offset) => {
  const monthIndex = (2 + offset) % 12;
  const year = offset < 10 ? 2025 : 2026;
  return {
    month: osloMidnight(year, monthIndex, 1),
    consumption: round((PORTFOLIO_ANNUAL_MWH * (CONSUMPTION_SHARE[monthIndex] ?? 0)) / 100, 1),
    production: round((SOLAR_ANNUAL_MWH * (SOLAR_SHARE[monthIndex] ?? 0)) / 100, 1),
  };
});

const MARCH_SHARE = CONSUMPTION_SHARE[2] / 100;

/** Days of March whose readings are in: the 1st to the 28th. Today's are still arriving. */
export const COMPLETE_DAYS = 28;

/**
 * A March day's consumption in MWh: the month's mean, colder early in the month, a little more at
 * weekends, and a few percent of weather on top.
 */
function marchDay(day: number, weekday: number, random: () => number, scale: number): number {
  const trend = 1.12 - (0.2 * (day - 1)) / 30;
  const weekend = weekday === 0 || weekday === 6 ? 1.05 : 1;
  const weather = 0.96 + random() * 0.08;
  return round(((PORTFOLIO_ANNUAL_MWH * MARCH_SHARE) / 31) * trend * weekend * weather * scale, 1);
}

/** March 2026 day by day, against March 2025, which was a little colder. */
export const DAILY_CONSUMPTION: readonly DailyConsumption[] = (() => {
  const thisYear = seeded(2026);
  const lastYear = seeded(2025);
  return Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    const now = marchDay(day, new Date(Date.UTC(2026, 2, day)).getUTCDay(), thisYear, 1);
    return {
      day: osloMidnight(2026, 2, day),
      thisYear: day <= COMPLETE_DAYS ? now : null,
      lastYear: marchDay(day, new Date(Date.UTC(2025, 2, day)).getUTCDay(), lastYear, 1.04),
    };
  });
})();

/** The prosumers' solar production for each complete day of March 2026 and of March 2025, in MWh. */
export const DAILY_SOLAR: readonly { readonly thisYear: number; readonly lastYear: number }[] = (() => {
  const thisYear = seeded(326);
  const lastYear = seeded(325);
  const mean = (SOLAR_ANNUAL_MWH * (SOLAR_SHARE[2] / 100)) / 31;
  // Days lengthen through March, and clouds take a share of each day.
  const day = (index: number, random: () => number) =>
    round(mean * (0.6 + (0.8 * index) / 30) * (0.45 + random() * 0.85), 2);
  return Array.from({ length: COMPLETE_DAYS }, (_, index) => ({
    thisYear: day(index, thisYear),
    lastYear: day(index, lastYear),
  }));
})();

const FIRST_NAMES = [
  "Ingrid",
  "Ola",
  "Kari",
  "Lars",
  "Sofie",
  "Henrik",
  "Nora",
  "Magnus",
  "Emma",
  "Jonas",
  "Ida",
  "Sindre",
  "Marte",
  "Eirik",
  "Thea",
  "Anders",
  "Silje",
  "Kristian",
  "Hanna",
  "Petter",
] as const;

const LAST_NAMES = [
  "Hansen",
  "Johansen",
  "Olsen",
  "Larsen",
  "Andersen",
  "Pedersen",
  "Nilsen",
  "Kristiansen",
  "Jensen",
  "Karlsen",
  "Berg",
  "Haugen",
  "Hagen",
  "Bakken",
  "Lunde",
  "Solberg",
  "Moen",
  "Dahl",
] as const;

const STREETS = [
  "Storgata",
  "Kirkegata",
  "Skolegata",
  "Parkveien",
  "Fjordveien",
  "Bjørkeveien",
  "Granveien",
  "Elveveien",
  "Solbakken",
  "Strandgata",
  "Høgdaveien",
  "Lønneveien",
] as const;

const CITIES = {
  NO1: ["Oslo", "Drammen", "Lillestrøm", "Fredrikstad", "Hamar"],
  NO2: ["Kristiansand", "Stavanger", "Arendal", "Sandnes"],
  NO3: ["Trondheim", "Molde", "Ålesund"],
  NO4: ["Tromsø", "Bodø", "Narvik"],
  NO5: ["Bergen", "Voss", "Førde"],
} as const satisfies Record<PriceArea, readonly [string, ...string[]]>;

// The attributes cycle with the row's index before the rows are shuffled, so every count and
// every combination is known by hand: price areas repeat every 10 rows, statuses every 12 and
// contracts every 4. Of 480 points, 48 are in NO4, 40 are disconnected and 120 are on a fixed
// price; 24 are NO4 on a fixed price (index 18 mod 20), and none is a disconnected point in NO4
// (an index of 8 mod 10 is even, one of 11 mod 12 is odd).
const AREA_CYCLE = ["NO1", "NO5", "NO1", "NO2", "NO3", "NO1", "NO2", "NO1", "NO4", "NO5"] as const;
const STATUS_CYCLE = [
  "active",
  "active",
  "active",
  "active",
  "active",
  "active",
  "active",
  "active",
  "active",
  "onboarding",
  "moving-out",
  "disconnected",
] as const;
const CONTRACT_CYCLE = ["spot", "spot", "fixed", "variable"] as const;

/** How many metering points the portfolio holds. */
export const METERING_POINT_COUNT = 480;

/** The GS1 check digit of a GSRN's first 17 digits: weights 3 and 1 from the right, mod 10. */
function gs1CheckDigit(digits: string): number {
  let sum = 0;
  for (let index = 0; index < digits.length; index++) {
    const fromRight = digits.length - 1 - index;
    sum += Number(digits[index]) * (fromRight % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** The last 30 days of one point, around its daily mean for late March. */
function last30Days(annualKwh: number, status: MeteringPointStatus, random: () => number): (number | null)[] {
  // Late March runs at about 1.2 times a year's average day, falling as spring arrives.
  const mean = (annualKwh / 365) * 1.2;
  // An onboarding point started supply on a day in the last two weeks.
  const firstReading = status === "onboarding" ? 16 + Math.floor(random() * 12) : 0;
  return Array.from({ length: 30 }, (_, day) => {
    if (day < firstReading) return null;
    if (status === "disconnected") return 0;
    return round(mean * (1.08 - (0.16 * day) / 29) * (0.85 + random() * 0.3), 1);
  });
}

/** Every metering point, in a seeded order. */
export const METERING_POINTS: readonly MeteringPoint[] = (() => {
  const random = seeded(7070575);
  const points = Array.from({ length: METERING_POINT_COUNT }, (_, index): MeteringPoint => {
    const priceArea = AREA_CYCLE[index % AREA_CYCLE.length] ?? "NO1";
    const status = STATUS_CYCLE[index % STATUS_CYCLE.length] ?? "active";
    const annualKwh = Math.round((6000 + random() * 22_000) / 10) * 10;
    const body = `7070575${String(1_000_000_000 + index * 7919 + Math.floor(random() * 7000)).slice(0, 10)}`;
    return {
      id: `${body}${String(gs1CheckDigit(body))}`,
      customer: `${pick(random, FIRST_NAMES)} ${pick(random, LAST_NAMES)}`,
      address: `${pick(random, STREETS)} ${String(1 + Math.floor(random() * 120))}`,
      city: pick(random, CITIES[priceArea]),
      priceArea,
      status,
      contract: CONTRACT_CYCLE[index % CONTRACT_CYCLE.length] ?? "spot",
      annualKwh,
      last30Days: last30Days(annualKwh, status, random),
    };
  });
  // Fisher–Yates with the same generator: the order looks like a real list, the counts stay.
  for (let index = points.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    const held = points[index];
    const swapped = points[other];
    if (held !== undefined && swapped !== undefined) {
      points[index] = swapped;
      points[other] = held;
    }
  }
  return points;
})();

/** February's average spot price per area, in øre per kWh with VAT excluded. Typed by hand. */
const FEBRUARY_SPOT = {
  NO1: 88.2,
  NO2: 84.6,
  NO3: 41.3,
  NO4: 18.9,
  NO5: 79.8,
} as const satisfies Record<PriceArea, number>;

/** The retailer's markup on spot, in øre per kWh. */
export const SPOT_MARKUP_ORE = 4.9;

/** The energy price of the other contracts, in øre per kWh with VAT excluded. */
const CONTRACT_PRICE_ORE = { fixed: 99, variable: 89.9 } as const;

/** The monthly fee, in kr with VAT excluded. */
export const MONTHLY_FEE_KR = 49;

/** The VAT rate on electricity, which households in NO4 do not pay. */
export const VAT_RATE = 0.25;

// NO1's average day-ahead price on each complete day of March 2026, in øre per kWh with VAT
// excluded: cheaper at weekends and as the month warms. Typed by hand, not market data.
const MARCH_SPOT = [
  96.4, 102.8, 108.1, 99.5, 93.2, 81.7, 74.9, 90.3, 97.8, 104.6, 95.1, 88.4, 72.6, 66.3, 84.9, 91.2, 86.7,
  79.4, 82.8, 69.5, 58.2, 63.7, 77.1, 80.6, 74.3, 68.9, 55.4, 51.8,
] as const;

/**
 * What each complete day of March will invoice, in kr: the day's consumption at the day's spot
 * price plus the markup, with VAT. An estimate, because NO4 pays no VAT and fixed contracts pay
 * their own price, which the bills will settle.
 */
export const DAILY_INVOICING: readonly number[] = DAILY_CONSUMPTION.slice(0, COMPLETE_DAYS).map(
  (day, index) =>
    round(
      (((day.thisYear ?? 0) * 1000 * ((MARCH_SPOT[index] ?? 0) + SPOT_MARKUP_ORE)) / 100) * (1 + VAT_RATE),
      2
    )
);

/** How many February invoices went out. */
export const INVOICE_COUNT = 72;

// Invoice states cycle every 12 invoices: 8 paid, 2 open, 1 overdue and 1 credited, so the 72
// invoices hold 48 paid, 12 open, 6 overdue and 6 credited.
const STATE_CYCLE = [
  "Paid",
  "Paid",
  "Open",
  "Paid",
  "Paid",
  "Overdue",
  "Paid",
  "Paid",
  "Open",
  "Paid",
  "Paid",
  "Credited",
] as const;

/** The price a contract paid per kWh in February, in øre with VAT excluded. */
export function februaryPriceOre(contract: ContractType, priceArea: PriceArea): number {
  return contract === "spot" ? FEBRUARY_SPOT[priceArea] + SPOT_MARKUP_ORE : CONTRACT_PRICE_ORE[contract];
}

/** February's invoices, for the first 72 points that were supplied all month. */
export const INVOICES: readonly Invoice[] = (() => {
  const random = seeded(202_602);
  const issuedOn = new Date("2026-03-06T09:00:00+01:00");
  return METERING_POINTS.filter((point) => point.status !== "onboarding")
    .slice(0, INVOICE_COUNT)
    .map((point, index): Invoice => {
      const energyKwh = Math.round(point.annualKwh * (CONSUMPTION_SHARE[1] / 100));
      const priceOre = februaryPriceOre(point.contract, point.priceArea);
      const energy = round((energyKwh * priceOre) / 100, 2);
      const subtotal = round(energy + MONTHLY_FEE_KR, 2);
      const vat = point.priceArea === "NO4" ? 0 : round(subtotal * VAT_RATE, 2);
      const tag = STATE_CYCLE[index % STATE_CYCLE.length] ?? "Paid";
      const number = `INV-2602-${String(index + 1).padStart(4, "0")}`;
      const state: InvoiceState =
        tag === "Paid"
          ? { _tag: "Paid", paidOn: osloMidnight(2026, 2, 10 + Math.floor(random() * 10)) }
          : tag === "Credited"
            ? { _tag: "Credited", creditNote: `CN-2603-${String(index + 1).padStart(4, "0")}` }
            : { _tag: tag };
      return {
        number,
        customer: point.customer,
        meteringPointId: point.id,
        priceArea: point.priceArea,
        contract: point.contract,
        issuedOn,
        // Open invoices are direct-debit customers', due a month after the others.
        dueOn: tag === "Open" ? osloMidnight(2026, 3, 7) : osloMidnight(2026, 2, 20),
        energyKwh,
        lines: [
          {
            label: `Energy, ${CONTRACT_LABELS[point.contract].toLowerCase()}`,
            detail: `${energyKwh.toLocaleString("en-US")} kWh × ${priceOre.toFixed(2)} øre`,
            amount: energy,
          },
          { label: "Monthly fee", detail: "", amount: MONTHLY_FEE_KR },
        ],
        vat,
        total: round(subtotal + vat, 2),
        state,
      };
    });
})();

/** The overview's latest activity, newest first. */
export const ACTIVITY: readonly Activity[] = [
  {
    id: "price-alert-no1",
    kind: "price-alert",
    title: "Evening price peak in NO1",
    detail: "Spot passes 115 øre/kWh at 7 PM. Price alerts went to 312 customers.",
    at: new Date("2026-03-29T12:45:00+02:00"),
  },
  {
    id: "readings-0328",
    kind: "reading",
    title: "Readings for March 28 are in",
    detail: "Elhub delivered a reading for every point we supplied that day.",
    at: new Date("2026-03-29T07:10:00+02:00"),
  },
  {
    id: "move-in-0328",
    kind: "move-in",
    title: "12 customers moved in",
    detail: "Supply starts on April 1 for 9 of them, and at once for 3.",
    at: new Date("2026-03-28T16:30:00+01:00"),
  },
  {
    id: "payments-0327",
    kind: "payment",
    title: "Payments matched",
    detail: "48 February invoices are paid. 6 are overdue.",
    at: new Date("2026-03-27T09:05:00+01:00"),
  },
  {
    id: "invoice-run-0306",
    kind: "invoice-run",
    title: "February invoices sent",
    detail: "72 invoices, due March 20, and April 7 for direct debit.",
    at: new Date("2026-03-06T09:00:00+01:00"),
  },
];

/** Who is signed in. */
export const SIGNED_IN = {
  name: "Ingrid Haugen",
  initials: "IH",
  email: "ingrid.haugen@example.com",
  role: "Customer operations",
} as const;
