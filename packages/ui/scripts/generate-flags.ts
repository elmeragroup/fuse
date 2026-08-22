import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { vendorFlags } from "./flag-assets";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
vendorFlags(join(packageRoot, "../.."), packageRoot);
