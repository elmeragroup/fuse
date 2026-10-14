/** A Vite `?raw` import: the file's text, which the consumer-build helper compiles as a consumer would. */
declare module "*?raw" {
  const content: string;
  export default content;
}
