import { renderFixture } from "./render";
import { DOCUMENT_THEME, FORCED_DARK_COLOR_SCHEME } from "./theme";

renderFixture(
  DOCUMENT_THEME,
  FORCED_DARK_COLOR_SCHEME.storageKey,
  FORCED_DARK_COLOR_SCHEME.defaultColorScheme,
  FORCED_DARK_COLOR_SCHEME.enableSystem,
  FORCED_DARK_COLOR_SCHEME.forcedColorScheme
);
