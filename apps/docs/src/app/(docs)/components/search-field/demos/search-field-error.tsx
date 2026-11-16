"use client";

import { SearchField } from "@elmeragroup/fuse/search-field";

export function SearchFieldError() {
  return (
    <SearchField
      label="Meter search"
      isRequired
      isInvalid
      errorMessage="Enter a meter number or an address."
    />
  );
}
