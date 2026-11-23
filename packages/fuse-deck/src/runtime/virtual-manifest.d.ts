/** The deck manifest the bundler generates (`src/bundler/bundler.ts`). */
declare module "virtual:fuse-deck" {
  // oxlint-disable-next-line typescript/consistent-type-imports -- an ambient module cannot import through a relative path (TS2439), and a top-level import would turn this file into an augmentation of a module that does not exist
  const manifest: import("./manifest.ts").DeckManifest;
  export default manifest;
}
