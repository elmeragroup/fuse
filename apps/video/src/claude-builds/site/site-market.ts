import type { BrandCode } from "@elmeragroup/fuse/theme";

import { currencyOf } from "../../brand/brand-market";
import type { MarketCurrency } from "../../brand/brand-market";
import { numberFormat } from "../../copy/intl";

/** A day's spot price in one price area, per kWh in the market's currency. */
export type SpotDay = {
  readonly average: number;
  readonly low: number;
  readonly high: number;
};

/** The figures a brand's site shows, in its market's currency. */
export type SiteMarket = {
  readonly currency: MarketCurrency;
  readonly spot: SpotDay;
  /** Each plan's monthly fee. */
  readonly fees: { readonly spot: number; readonly fixed: number; readonly green: number };
};

/**
 * One market per currency: the Norwegian brands and Elmera, Fjordkraft Företag and Telinet, and
 * Nordic Green Energy, each in its own price area (named in the copy). The prices are a
 * plausible autumn day, not live data.
 */
const MARKETS = {
  NOK: {
    currency: "NOK",
    spot: { average: 0.84, low: 0.41, high: 1.32 },
    fees: { spot: 39, fixed: 49, green: 59 },
  },
  SEK: {
    currency: "SEK",
    spot: { average: 0.62, low: 0.28, high: 1.05 },
    fees: { spot: 39, fixed: 49, green: 59 },
  },
  EUR: {
    currency: "EUR",
    spot: { average: 0.071, low: 0.032, high: 0.118 },
    fees: { spot: 3.9, fixed: 4.9, green: 5.9 },
  },
} as const satisfies Record<MarketCurrency, SiteMarket>;

/**
 * The figures a brand's site shows, in the currency of the brand's market.
 *
 * @param brand - The brand.
 * @returns Its market's currency, spot prices and plan fees.
 */
export function marketOf(brand: BrandCode): SiteMarket {
  return MARKETS[currencyOf(brand)];
}

/**
 * Amounts of a currency to the cent, for prices per kWh and monthly fees. A whole amount drops
 * its cents, as a fee of 39 kroner reads on a price list.
 *
 * @param locale - The video's locale, which sets the number format.
 * @param currency - The market's currency.
 * @returns The formatter.
 */
export function centsFormat(locale: string, currency: MarketCurrency): Intl.NumberFormat {
  return numberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    trailingZeroDisplay: "stripIfInteger",
  });
}

/**
 * How a day's price moves across its 24 hours, from 0 at the night low to 1 at the morning peak,
 * with a second peak at dinner. {@link hourlyPrices} scales it between the day's low and high.
 */
const HOURLY_PROFILE = [
  0.32, 0.24, 0.16, 0.08, 0, 0.14, 0.52, 0.86, 1, 0.8, 0.62, 0.5, 0.42, 0.36, 0.34, 0.4, 0.58, 0.8, 0.94,
  0.88, 0.7, 0.56, 0.46, 0.38,
] as const;

/** One hour of the site's day and its spot price, per kWh in the market's currency. */
export type HourPrice = { readonly hour: Date; readonly price: number };

/**
 * The first hour of the site's day, 12 October 2026, on UTC. The chart draws the area's own hours
 * on UTC, which keeps no daylight saving, so they read 00 to 23 in every market and on every
 * render machine.
 */
const DAY_START_UTC = Date.UTC(2026, 9, 12);
const HOUR_MS = 3_600_000;

/** The day's prices hour by hour, {@link HOURLY_PROFILE} scaled between its low and its high. */
function hoursOf(day: SpotDay): readonly HourPrice[] {
  return HOURLY_PROFILE.map((share, hour) => ({
    hour: new Date(DAY_START_UTC + hour * HOUR_MS),
    price: day.low + share * (day.high - day.low),
  }));
}

/** Each market's hours, built once, so every frame hands the chart the same rows. */
const HOURS = {
  NOK: hoursOf(MARKETS.NOK.spot),
  SEK: hoursOf(MARKETS.SEK.spot),
  EUR: hoursOf(MARKETS.EUR.spot),
} as const satisfies Record<MarketCurrency, readonly HourPrice[]>;

/**
 * A market's spot price for each hour of the site's day, the same rows on every call.
 *
 * @param market - The brand's market.
 * @returns 24 hours from 00:00 UTC, each with its price.
 */
export function hourlyPrices(market: SiteMarket): readonly HourPrice[] {
  return HOURS[market.currency];
}

/**
 * The hour the site's day has reached, 10:00 UTC on its day: the hero's chart fades the hours
 * before it.
 */
export const SITE_NOW = new Date(DAY_START_UTC + 10 * HOUR_MS);

/**
 * A month's estimated cost on the spot plan: the year's use at the day's average price, spread
 * over twelve months, plus the plan's fee.
 *
 * @param market - The brand's market.
 * @param yearlyKwh - The year's use in kWh.
 * @returns The monthly cost in the market's currency.
 */
export function monthlyEstimate(market: SiteMarket, yearlyKwh: number): number {
  return (yearlyKwh * market.spot.average) / 12 + market.fees.spot;
}
