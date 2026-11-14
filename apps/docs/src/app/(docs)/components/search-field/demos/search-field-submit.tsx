"use client";

import { useState } from "react";

import { SearchField } from "@elmeragroup/fuse/search-field";

export function SearchFieldSubmit() {
  const [query, setQuery] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <SearchField
        label="Meter search"
        placeholder="Meter number or address"
        onSubmit={setQuery}
        onClear={() => setQuery(null)}
      />
      <p role="status" className="text-sm text-muted-foreground">
        {query === null ? "Press Enter to search." : `Searching for "${query}".`}
      </p>
    </div>
  );
}
