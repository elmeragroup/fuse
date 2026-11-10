// chart.css loads as its own stylesheet ahead of the Tailwind entry, the order where its layer
// statement must keep Tailwind's layer order.
import "@elmeragroup/fuse/chart.css";
import { LocaleProvider, ThemeProvider, documentAttributes } from "@elmeragroup/fuse/theme";

import "./globals.css";

const THEME = { identity: "branded", brand: "fkas", segment: "private" };

export default function RootLayout({ children }) {
  return (
    <html
      lang="en-US"
      {...documentAttributes({ theme: THEME, density: "comfortable" })}
      suppressHydrationWarning>
      <body>
        <ThemeProvider theme={THEME}>
          <LocaleProvider locale="en-US">{children}</LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
