"use client";

import { Show } from "@elmeragroup/fuse/show";

export function ShowHidden() {
  return (
    <ul className="flex flex-col gap-1">
      <li>Electricity, 349 kr</li>
      <Show when={false}>
        <li>Welcome discount, −50 kr</li>
      </Show>
      <li>Monthly fee, 50 kr</li>
    </ul>
  );
}
