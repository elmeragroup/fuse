"use client";

import { Fragment } from "react";

import { Autocomplete, AutocompleteField } from "@elmeragroup/fuse/autocomplete";

type PowerPlant = { readonly name: string; readonly municipality: string };

type County = { readonly value: string; readonly items: readonly PowerPlant[] };

const counties: readonly County[] = [
  {
    value: "Vestland",
    items: [
      { name: "Aurland I", municipality: "Aurland" },
      { name: "Sima", municipality: "Eidfjord" },
    ],
  },
  {
    value: "Telemark",
    items: [
      { name: "Tokke", municipality: "Tokke" },
      { name: "Vinje", municipality: "Vinje" },
    ],
  },
  {
    value: "Nordland",
    items: [
      { name: "Kobbelv", municipality: "Sørfold" },
      { name: "Svartisen", municipality: "Meløy" },
    ],
  },
];

export function AutocompleteGroups() {
  return (
    <AutocompleteField
      label="Power plant"
      name="powerPlant"
      description="Suggestions are grouped by county."
      items={counties}
      itemToStringValue={(plant) => plant.name}
      placeholder="Type a power plant…"
      showClear
      className="max-w-xs">
      <Autocomplete.Empty>No power plant matches. The text you typed is kept.</Autocomplete.Empty>
      <Autocomplete.List>
        <Autocomplete.Collection>
          {(county: County, index: number) => (
            <Fragment key={county.value}>
              {index > 0 ? <Autocomplete.Separator /> : null}
              <Autocomplete.Group items={county.items}>
                <Autocomplete.Label>{county.value}</Autocomplete.Label>
                <Autocomplete.Collection>
                  {(plant: PowerPlant) => (
                    <Autocomplete.Item key={plant.name} value={plant}>
                      <span className="flex flex-col">
                        <span>{plant.name}</span>
                        <span className="text-xs text-muted-foreground">{plant.municipality}</span>
                      </span>
                    </Autocomplete.Item>
                  )}
                </Autocomplete.Collection>
              </Autocomplete.Group>
            </Fragment>
          )}
        </Autocomplete.Collection>
      </Autocomplete.List>
    </AutocompleteField>
  );
}
