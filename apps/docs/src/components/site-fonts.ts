/**
 * The faces the docs load, following the fonts handbook page. `next/font/local` loads Inter and
 * Roboto from the Latin files `@fontsource` ships, so a build downloads nothing. Each face's
 * generated family is in a variable, `--font-inter` or `--font-roboto`, and `styles/globals.css`
 * sets `--font-sans` from it. Fuse parts and the docs set these four weights.
 */
import localFont from "next/font/local";

/** Inter, the site's own face and the internal themes' body font. */
export const inter = localFont({
  src: [
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2", weight: "400" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2", weight: "500" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2", weight: "600" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2", weight: "700" },
  ],
  style: "normal",
  variable: "--font-inter",
});

/**
 * Roboto, the external themes' body font, which the docs draw in external theme previews. The
 * site chrome never draws Roboto, so it loads when a theme scope draws it, not as a preload on
 * every route.
 */
export const roboto = localFont({
  src: [
    { path: "../../node_modules/@fontsource/roboto/files/roboto-latin-400-normal.woff2", weight: "400" },
    { path: "../../node_modules/@fontsource/roboto/files/roboto-latin-500-normal.woff2", weight: "500" },
    { path: "../../node_modules/@fontsource/roboto/files/roboto-latin-600-normal.woff2", weight: "600" },
    { path: "../../node_modules/@fontsource/roboto/files/roboto-latin-700-normal.woff2", weight: "700" },
  ],
  style: "normal",
  variable: "--font-roboto",
  preload: false,
});
