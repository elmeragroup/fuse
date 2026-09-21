import { join } from "node:path";

import { vendorFlags } from "./flag-assets";
import { packageRootFromScript } from "./paths";

const packageRoot = packageRootFromScript(import.meta.url);
vendorFlags(join(packageRoot, "../.."), packageRoot);
