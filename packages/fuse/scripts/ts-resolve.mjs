// The package scripts and the root release scripts both preload this loader so that
// `packages/fuse/scripts/**` can use extension-less imports.
import { register } from "node:module";

register("./ts-hooks.mjs", import.meta.url);
