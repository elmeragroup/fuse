"use client";

import { useState } from "react";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

const MARKETS = [
  { code: "NO", name: "Norway" },
  { code: "SE", name: "Sweden" },
  { code: "FI", name: "Finland" },
] as const;

type MarketCode = (typeof MARKETS)[number]["code"];

function marketCode(code: string | undefined): MarketCode | undefined {
  return MARKETS.find((market) => market.code === code)?.code;
}

export function PhoneNumberFieldControlledCountry() {
  const [countryCode, setCountryCode] = useState<MarketCode>("NO");

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm flex flex-col gap-1">
        Market
        <select
          className="self-start"
          value={countryCode}
          onChange={(event) => {
            const next = marketCode(event.target.value);
            if (next !== undefined) setCountryCode(next);
          }}>
          {MARKETS.map((market) => (
            <option key={market.code} value={market.code}>
              {market.name}
            </option>
          ))}
        </select>
      </label>
      <PhoneNumberField
        label="Mobile"
        countries={MARKETS.map((market) => market.code)}
        countryCode={countryCode}
        onCountryChange={(country) => {
          const next = marketCode(country.code);
          if (next !== undefined) setCountryCode(next);
        }}
      />
    </div>
  );
}
