import { registerHooks } from "node:module";

import { rscHooks } from "./rsc-namespace-loader.ts";

registerHooks(rscHooks("ssr"));
