"use client";

import { useState } from "react";

import { SearchField } from "@elmeragroup/fuse/search-field";
import { Text } from "@elmeragroup/fuse/text";

export function SearchFieldBasic() {
  const [query, setQuery] = useState<string | null>(null);

  return (
    <div className="flex w-72 flex-col gap-3">
      <SearchField
        label="Meter search"
        placeholder="Meter number or address"
        onSubmit={setQuery}
        onClear={() => setQuery(null)}
      />
      <Text size="sm" variant="muted">
        {query === null ? "Press Enter to search." : `Searching for “${query}”.`}
      </Text>
    </div>
  );
}
