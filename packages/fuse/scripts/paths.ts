import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function packageRootFromScript(scriptUrl: string): string {
  return join(dirname(fileURLToPath(scriptUrl)), "..");
}

export function toPosix(path: string): string {
  return path.replaceAll("\\", "/");
}
