"use client";

import { SearchField } from "@elmeragroup/fuse/search-field";

export function SearchFieldSizes() {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <SearchField size="sm" label="Small" placeholder="Meter number" defaultValue="7070" className="w-56" />
      <SearchField label="Default" placeholder="Meter number" defaultValue="7070" className="w-56" />
    </div>
  );
}
