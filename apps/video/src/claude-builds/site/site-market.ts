import type { BrandCode } from "@elmeragroup/fuse/theme";

import { currencyOf } from "../../brand/brand-market";
import type { MarketCurrency } from "../../brand/brand-market";

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

/** One to-the-cent formatter per locale and currency, so a frame-by-frame caller builds each once. */
const centsFormats = new Map<string, Intl.NumberFormat>();

/**
 * Amounts of a currency to the cent, for prices per kWh and monthly fees. A whole amount drops
 * its cents, as a fee of 39 kroner reads on a price list.
 *
 * @param locale - The video's locale, which sets the number format.
 * @param currency - The market's currency.
 * @returns The formatter.
 */
export function centsFormat(locale: string, currency: MarketCurrency): Intl.NumberFormat {
  const key = `${locale}/${currency}`;
  let format = centsFormats.get(key);
  if (format === undefined) {
    format = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      trailingZeroDisplay: "stripIfInteger",
    });
    centsFormats.set(key, format);
  }
  return format;
}

/**
 * How a day's price moves across its 24 hours, from 0 at the night low to 1 at the morning peak,
 * with a second peak at dinner. The hero's chart scales it between the day's low and high.
 */
export const HOURLY_PROFILE = [
  0.32, 0.24, 0.16, 0.08, 0, 0.14, 0.52, 0.86, 1, 0.8, 0.62, 0.5, 0.42, 0.36, 0.34, 0.4, 0.58, 0.8, 0.94,
  0.88, 0.7, 0.56, 0.46, 0.38,
] as const;

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
