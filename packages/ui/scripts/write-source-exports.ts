import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { writeSourceExports } from "./generate-exports";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

writeSourceExports(packageRoot);
