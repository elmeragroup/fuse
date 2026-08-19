import { renderFixture } from "./render";
import { DOCUMENT_COLOR_SCHEME, DOCUMENT_THEME } from "./theme";

renderFixture(
  DOCUMENT_THEME,
  DOCUMENT_COLOR_SCHEME.storageKey,
  DOCUMENT_COLOR_SCHEME.defaultColorScheme,
  DOCUMENT_COLOR_SCHEME.enableSystem,
  undefined
);
