/** A Vite `?raw` import: the file's text, which browser tests compile as a consumer would. */
declare module "*?raw" {
  const content: string;
  export default content;
}
