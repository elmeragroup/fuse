"use client";

import { useState } from "react";

import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

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
      <ToggleGroup.Root
        aria-label="Market"
        value={[countryCode]}
        onValueChange={(value: string[]) => {
          const next = marketCode(value[0]);
          if (next !== undefined) setCountryCode(next);
        }}>
        {MARKETS.map((market) => (
          <ToggleGroup.Item key={market.code} value={market.code}>
            {market.name}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <PhoneNumberField
        label="Mobile"
        description="The market steers the country, and a pick in the field moves the market."
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
