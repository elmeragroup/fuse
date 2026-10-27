"use client";

import { Combobox, ComboboxField } from "@elmeragroup/fuse/combobox";

const countries = ["Denmark", "Finland", "Iceland", "Norway", "Sweden"];

export function ComboboxFieldBasic() {
  return (
    <ComboboxField
      label="Country"
      name="country"
      description="Where the meter is installed."
      items={countries}
      placeholder="Search countries…"
      className="max-w-xs">
      <Combobox.Empty />
      <Combobox.List>
        {(country: string) => (
          <Combobox.Item key={country} value={country}>
            {country}
          </Combobox.Item>
        )}
      </Combobox.List>
    </ComboboxField>
  );
}
