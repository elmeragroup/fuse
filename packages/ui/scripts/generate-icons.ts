import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { writeGeneratedIcons } from "../src/icons/generate";

writeGeneratedIcons(join(dirname(fileURLToPath(import.meta.url)), ".."));
