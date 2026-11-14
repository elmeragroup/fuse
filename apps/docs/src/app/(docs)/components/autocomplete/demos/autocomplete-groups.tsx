"use client";

import { Fragment } from "react";

import { Autocomplete } from "@elmeragroup/fuse/autocomplete";

const regions = [
  { value: "Western Norway", items: ["Bergen", "Stavanger"] },
  { value: "Northern Norway", items: ["Bodø", "Tromsø"] },
];

export function AutocompleteGroups() {
  return (
    <Autocomplete.Root items={regions}>
      <Autocomplete.Input aria-label="Municipality" placeholder="Type a municipality…" />
      <Autocomplete.Content>
        <Autocomplete.Empty />
        <Autocomplete.List>
          <Autocomplete.Collection>
            {(region: (typeof regions)[number], index: number) => (
              <Fragment key={region.value}>
                {index > 0 ? <Autocomplete.Separator /> : null}
                <Autocomplete.Group items={region.items}>
                  <Autocomplete.Label>{region.value}</Autocomplete.Label>
                  <Autocomplete.Collection>
                    {(municipality: string) => (
                      <Autocomplete.Item key={municipality} value={municipality}>
                        {municipality}
                      </Autocomplete.Item>
                    )}
                  </Autocomplete.Collection>
                </Autocomplete.Group>
              </Fragment>
            )}
          </Autocomplete.Collection>
        </Autocomplete.List>
      </Autocomplete.Content>
    </Autocomplete.Root>
  );
}
