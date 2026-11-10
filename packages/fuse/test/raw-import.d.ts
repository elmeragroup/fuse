/** A Vite `?raw` import: the file's text, which the consumer-build helper compiles as a consumer would. */
declare module "*?raw" {
  const content: string;
  export default content;
}

/** A Vite `?url` import: the URL the dev server serves the file at, as a test loads a font face from. */
declare module "*?url" {
  const url: string;
  export default url;
}
