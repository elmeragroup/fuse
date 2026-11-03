/**
 * The faces the docs load, as the fonts handbook page tells an app to load them: Inter and Roboto
 * through `next/font`, from the Latin files `@fontsource` ships, so a build downloads nothing. Each
 * exposes its generated family as a variable, `--font-inter` and `--font-roboto`, which
 * `styles/globals.css` turns into `--font-sans`. The four weights are the ones Fuse parts and the
 * docs set.
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

/** Roboto, the external themes' body font, which the docs draw in external theme previews. */
export const roboto = localFont({
  src: [
    { path: "../../node_modules/@fontsource/roboto/files/roboto-latin-400-normal.woff2", weight: "400" },
    { path: "../../node_modules/@fontsource/roboto/files/roboto-latin-500-normal.woff2", weight: "500" },
    { path: "../../node_modules/@fontsource/roboto/files/roboto-latin-600-normal.woff2", weight: "600" },
    { path: "../../node_modules/@fontsource/roboto/files/roboto-latin-700-normal.woff2", weight: "700" },
  ],
  style: "normal",
  variable: "--font-roboto",
});
