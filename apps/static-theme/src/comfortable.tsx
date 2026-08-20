import { Button } from "@elmeragroup/ui/button";

import { renderFixture } from "./render";
import { DOCUMENT_COLOR_SCHEME, DOCUMENT_THEME } from "./theme";

function ComfortablePreview() {
  return (
    <main>
      <h1>Comfortable density</h1>
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
    </main>
  );
}

renderFixture(
  DOCUMENT_THEME,
  DOCUMENT_COLOR_SCHEME.storageKey,
  DOCUMENT_COLOR_SCHEME.defaultColorScheme,
  DOCUMENT_COLOR_SCHEME.enableSystem,
  undefined,
  <ComfortablePreview />
);
