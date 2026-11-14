"use client";

import { SearchField } from "@elmeragroup/fuse/search-field";

export function SearchFieldReadOnly() {
  return <SearchField label="Meter search" defaultValue="7070" isReadOnly />;
}
