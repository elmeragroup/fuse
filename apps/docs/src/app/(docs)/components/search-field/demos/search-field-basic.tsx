"use client";

import { SearchField } from "@elmeragroup/ui/react-aria/search-field";
import { UiProviders } from "@elmeragroup/ui/react-aria/ui-providers";

export function SearchFieldBasic() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <SearchField label="Meter search" placeholder="Meter number or address" onSubmit={() => undefined} />
    </UiProviders>
  );
}
