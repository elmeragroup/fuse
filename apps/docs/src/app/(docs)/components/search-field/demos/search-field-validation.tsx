"use client";

import { useState } from "react";

import { SearchField } from "@elmeragroup/fuse/search-field";

export function SearchFieldValidation() {
  const [value, setValue] = useState("");

  return (
    <SearchField
      label="Meter search"
      description="Search by meter number or address."
      placeholder="Meter number"
      value={value}
      onChange={setValue}
      isRequired
      isInvalid={value.length === 0}
      errorMessage="Enter a search query."
      className="w-72"
    />
  );
}
