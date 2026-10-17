import type { BrandCode } from "@elmeragroup/fuse/theme";

/** The currency of each brand's market. */
const CURRENCY = {
  fkas: "NOK",
  tkas: "NOK",
  guen: "NOK",
  elma: "NOK",
  fkab: "SEK",
  fkse: "SEK",
  ngfi: "EUR",
} as const satisfies Record<BrandCode, "NOK" | "SEK" | "EUR">;

/** The currency a brand's customers pay in. */
export type MarketCurrency = (typeof CURRENCY)[BrandCode];

/** A month's spend against its budget, in the market's currency, as the product shot shows it. */
const BUDGET = {
  NOK: { spent: 1240, limit: 1700 },
  SEK: { spent: 1180, limit: 1600 },
  EUR: { spent: 112, limit: 150 },
} as const satisfies Record<MarketCurrency, { spent: number; limit: number }>;

/**
 * The currency of a brand's market: NOK for the Norwegian brands and Elmera, SEK for Fjordkraft
 * Företag and Telinet, EUR for Nordic Green Energy.
 *
 * @param brand - The brand.
 * @returns Its ISO 4217 currency code.
 */
export function currencyOf(brand: BrandCode): MarketCurrency {
  return CURRENCY[brand];
}

/** The product shot's budget line, formatted, and how much of the budget is spent. */
export type Budget = {
  readonly spent: string;
  readonly limit: string;
  /** The share spent, from 0 to 1. */
  readonly share: number;
};

/** One whole-amount formatter per locale and currency, so a frame-by-frame caller builds each once. */
const moneyFormats = new Map<string, Intl.NumberFormat>();

/**
 * Whole amounts of a currency, formatted for the video's locale.
 *
 * @param locale - The video's locale, which sets the number format.
 * @param currency - The market's currency.
 * @returns The formatter.
 */
export function moneyFormat(locale: string, currency: MarketCurrency): Intl.NumberFormat {
  const key = `${locale}/${currency}`;
  let format = moneyFormats.get(key);
  if (format === undefined) {
    format = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 });
    moneyFormats.set(key, format);
  }
  return format;
}

/**
 * The product shot's budget figures in a brand's currency, formatted for the video's locale.
 *
 * @param brand - The brand whose market sets the currency.
 * @param locale - The video's locale, which sets the number format.
 * @returns The formatted amount spent, the limit, and the share spent from 0 to 1.
 */
export function budgetFor(brand: BrandCode, locale: string): Budget {
  const currency = currencyOf(brand);
  const { spent, limit } = BUDGET[currency];
  const format = moneyFormat(locale, currency);
  return { spent: format.format(spent), limit: format.format(limit), share: spent / limit };
}

/** Each market's electricity price areas, by code, as a price-area picker lists them. */
const PRICE_AREAS = {
  NOK: {
    NO1: "NO1 Oslo",
    NO2: "NO2 Kristiansand",
    NO3: "NO3 Trondheim",
    NO4: "NO4 Tromsø",
    NO5: "NO5 Bergen",
  },
  SEK: {
    SE1: "SE1 Luleå",
    SE2: "SE2 Sundsvall",
    SE3: "SE3 Stockholm",
    SE4: "SE4 Malmö",
  },
  EUR: { FI: "FI Finland" },
} as const satisfies Record<MarketCurrency, Readonly<Record<string, string>>>;

/** The area each market's picker shows chosen. */
const PICKED_AREA = {
  NOK: "NO5",
  SEK: "SE3",
  EUR: "FI",
} as const satisfies { readonly [Currency in MarketCurrency]: keyof (typeof PRICE_AREAS)[Currency] };

/** A market's price areas, labelled by code, and the one its picker shows chosen. */
export type PriceAreaChoice = {
  readonly areas: Readonly<Record<string, string>>;
  readonly picked: string;
};

/**
 * The price areas of a brand's market: Norway's five, Sweden's four or Finland's one.
 *
 * @param brand - The brand whose market sets the areas.
 * @returns The areas by code and the one a picker shows chosen.
 */
export function priceAreasOf(brand: BrandCode): PriceAreaChoice {
  const currency = currencyOf(brand);
  return { areas: PRICE_AREAS[currency], picked: PICKED_AREA[currency] };
}
