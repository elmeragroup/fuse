"use client";

import { useState } from "react";

import { SearchField } from "@elmeragroup/fuse/react-aria/search-field";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

export function SearchFieldValidation() {
  const [value, setValue] = useState("");

  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <SearchField
        label="Meter search"
        description="Search by meter number or address."
        placeholder="Meter number"
        value={value}
        onChange={setValue}
        isRequired
        isInvalid={value.length === 0}
        errorMessage={(result) =>
          result.validationErrors.length > 0 ? result.validationErrors.join(" ") : "Enter a search query."
        }
      />
    </UiProviders>
  );
}
