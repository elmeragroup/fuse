/**
 * Starts a zone probe, such as `zone-probe.ts`, in a fresh Node process whose runtime zone is
 * `zone`. A test starts every probe while its file collects, so the children run beside each other
 * and beside the file's in-process tests, and each test awaits its child's output.
 */
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const RESOLVER = fileURLToPath(new URL("../../../../../scripts/ts-resolve.mjs", import.meta.url));

/**
 * Run a probe module under another process zone.
 *
 * @param probe - The probe module's URL.
 * @param zone - The `TZ` the child runs in. The child gets no other environment.
 * @returns The child's standard output, or a rejection with its standard error.
 */
export function spawnZoneProbe(probe: URL, zone: string): Promise<string> {
  const output = new Promise<string>((resolve, reject) => {
    execFile(
      process.execPath,
      [
        "--experimental-strip-types",
        "--experimental-transform-types",
        "--import",
        RESOLVER,
        fileURLToPath(probe),
      ],
      { env: { TZ: zone }, encoding: "utf8" },
      (error, stdout, stderr) => {
        if (error) reject(new Error(`The ${zone} zone probe failed: ${stderr}`, { cause: error }));
        else resolve(stdout);
      }
    );
  });
  // The test that awaits the output reports a failure. This only keeps an early one from counting
  // as unhandled before that test runs.
  output.catch(() => undefined);
  return output;
}
