/** The data and configs the polar suites share: a four-part bill and three two-series spokes. */

/** A bill of 100 kr, so each part's value is its own share. */
export const BILL = [
  { name: "strom", v: 50 },
  { name: "nettleie", v: 30 },
  { name: "avgifter", v: 15 },
  { name: "mva", v: 5 },
];

export const BILL_CONFIG = {
  strom: { label: "Strøm", color: "chart-1" },
  nettleie: { label: "Nettleie", color: "chart-2" },
  avgifter: { label: "Avgifter", color: "chart-3" },
  mva: { label: "Mva", color: "chart-4" },
} as const;

export const SPOKES = [
  { area: "NO1", v: 1, w: 3 },
  { area: "NO2", v: 2, w: 2 },
  { area: "NO3", v: 3, w: 1 },
];

export const SPOKE_CONFIG = {
  v: { label: "Forbruk", color: "chart-1" },
  w: { label: "Pris", color: "chart-2" },
} as const;
