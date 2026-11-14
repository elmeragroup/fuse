"use client";

import { Combobox } from "@elmeragroup/fuse/combobox";

const countries = ["Norway", "Sweden", "Finland", "Denmark"];

export function ComboboxPopupSearch() {
  return (
    <Combobox.Root items={countries} defaultValue="Norway">
      <Combobox.Trigger
        aria-label="Country"
        render={
          <button
            type="button"
            className="text-sm inline-flex h-9 w-56 items-center justify-between rounded-md border border-input px-3"
          />
        }>
        <Combobox.Value />
      </Combobox.Trigger>
      <Combobox.Content>
        <Combobox.Input showTrigger={false} aria-label="Search countries" placeholder="Search countries…" />
        <Combobox.Empty />
        <Combobox.List>
          <Combobox.Collection>
            {(item: string) => (
              <Combobox.Item key={item} value={item}>
                {item}
              </Combobox.Item>
            )}
          </Combobox.Collection>
        </Combobox.List>
      </Combobox.Content>
    </Combobox.Root>
  );
}
