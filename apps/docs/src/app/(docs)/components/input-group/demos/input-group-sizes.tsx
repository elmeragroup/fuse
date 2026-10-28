"use client";

import { useState } from "react";

import { MagnifyingGlass, X } from "@elmeragroup/fuse/icons";
import { InputGroup } from "@elmeragroup/fuse/input-group";

/** A search box whose trailing button clears what the user typed. */
function SearchGroup({ label, size }: { label: string; size?: "sm" | "default" }) {
  const [query, setQuery] = useState("");
  return (
    <InputGroup.Root size={size} className="w-64">
      <InputGroup.Addon>
        <MagnifyingGlass />
      </InputGroup.Addon>
      <InputGroup.Input
        aria-label={label}
        placeholder={label}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      <InputGroup.Addon align="inline-end">
        <InputGroup.Button
          size="icon-sm"
          aria-label={`Clear ${label.toLowerCase()} search`}
          disabled={!query}
          onClick={() => {
            setQuery("");
          }}>
          <X />
        </InputGroup.Button>
      </InputGroup.Addon>
    </InputGroup.Root>
  );
}

export function InputGroupSizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchGroup label="Small" size="sm" />
      <SearchGroup label="Default" />
    </div>
  );
}
