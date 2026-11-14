"use client";

import { useState } from "react";

import { Show } from "@elmeragroup/fuse/show";

export function ShowToggle() {
  const [applied, setApplied] = useState(false);
  return (
    <div className="flex flex-col items-start gap-3">
      <button type="button" aria-pressed={applied} onClick={() => setApplied(!applied)}>
        Apply welcome discount
      </button>
      <ul className="flex flex-col gap-1">
        <li>Electricity, 349 kr</li>
        <Show when={applied}>
          <li>Welcome discount, −50 kr</li>
        </Show>
        <li>Monthly fee, 50 kr</li>
      </ul>
    </div>
  );
}
