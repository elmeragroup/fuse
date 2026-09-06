import { rmSync, writeFileSync } from "node:fs";

/**
 * File writes the docs generator and shadow snapshot updater share.
 * Shadow runs inject a refusing writer instead of spying on `node:fs`.
 */
export type DocsWriter = {
  readonly writeFile: (target: string, contents: string) => void;
  readonly rm: (target: string) => void;
};

export const nodeDocsWriter: DocsWriter = {
  writeFile: (target, contents) => {
    writeFileSync(target, contents, "utf8");
  },
  rm: (target) => {
    rmSync(target, { recursive: true, force: true });
  },
};

/** Writer that records the operation and throws, so a shadow run cannot persist. */
export function refusingDocsWriter(onWrite: (operation: string) => void): DocsWriter {
  const refuse = (operation: string) => (): never => {
    onWrite(operation);
    throw new Error(`docs shadow run must not write (${operation})`);
  };
  return {
    writeFile: refuse("writeFile"),
    rm: refuse("rm"),
  };
}
