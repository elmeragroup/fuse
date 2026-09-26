import {
  LocaleProvider,
  ThemeProvider,
  defaultDensityForVariant,
  densityAttributes,
  themeAttributes,
} from "@elmeragroup/fuse/theme";

import "./globals.css";

const THEME = { variant: "external", brand: "fkas", segment: "private" };

export default function RootLayout({ children }) {
  return (
    <html
      lang="en-US"
      {...themeAttributes(THEME)}
      {...densityAttributes(defaultDensityForVariant(THEME.variant))}
      suppressHydrationWarning>
      <body>
        <ThemeProvider theme={THEME}>
          <LocaleProvider locale="en-US">{children}</LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
