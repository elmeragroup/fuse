import { fileURLToPath } from "node:url";

/** Repository root, shared by the repository-policy suites. */
export const repoRoot = fileURLToPath(new URL("..", import.meta.url));
