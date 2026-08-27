import { parentPort, workerData } from "node:worker_threads";

import { writeGeneratedJsonFiles } from "../scripts/generated-artifacts.ts";

type WriterWorkerData = {
  readonly fixtureDirectory: string;
  readonly destinationPath: string;
};

// SAFETY: the parent test supplies exactly WriterWorkerData to this dedicated worker entrypoint.
const data = workerData as WriterWorkerData;
const beforeWorkingDirectory = process.cwd();

try {
  writeGeneratedJsonFiles(
    [{ path: data.destinationPath, value: { workerSafe: true } }],
    data.fixtureDirectory
  );
  parentPort?.postMessage({ status: "pass", beforeWorkingDirectory, afterWorkingDirectory: process.cwd() });
} catch (error) {
  parentPort?.postMessage({
    status: "failed",
    beforeWorkingDirectory,
    afterWorkingDirectory: process.cwd(),
    error: error instanceof Error ? error.message : String(error),
  });
}
