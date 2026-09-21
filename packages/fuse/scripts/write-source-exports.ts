import { writeSourceExports } from "./generate-exports";
import { packageRootFromScript } from "./paths";

const packageRoot = packageRootFromScript(import.meta.url);

writeSourceExports(packageRoot);
