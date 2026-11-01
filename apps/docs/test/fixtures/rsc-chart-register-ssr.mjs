import { register } from "node:module";

register("./rsc-namespace-loader.ts", import.meta.url, { data: { layer: "ssr" } });
