import { writeArtifactBatch } from "./artifact-batch-writer.ts";
import type { ArtifactBatchRequest, ArtifactBatchResult } from "./artifact-batch-writer.ts";

type ArtifactBatchFailure = Extract<ArtifactBatchResult, { readonly status: "failure" }>["error"];
type ArtifactBatchSuccess = Extract<ArtifactBatchResult, { readonly status: "success" }>;

/** A command-facing error that keeps the writer's structured failure context. */
export class ArtifactBatchCommandError extends Error {
  readonly category: ArtifactBatchFailure["category"];
  readonly destination: ArtifactBatchFailure["destination"];
  readonly recovery: ArtifactBatchFailure["recovery"];

  constructor(operation: string, failure: ArtifactBatchFailure) {
    const destination = failure.destination === undefined ? "" : ` for ${failure.destination}`;
    super(`${operation} failed${destination} (${failure.category}): ${failure.message}`);
    this.name = "ArtifactBatchCommandError";
    this.category = failure.category;
    this.destination = failure.destination;
    this.recovery = failure.recovery;
  }
}

/** Write one batch for a CLI command, throwing without flattening failure details. */
export async function writeArtifactBatchOrThrow(
  request: ArtifactBatchRequest,
  operation: string
): Promise<ArtifactBatchSuccess> {
  const result = await writeArtifactBatch(request);
  if (result.status === "failure") throw new ArtifactBatchCommandError(operation, result.error);
  if (result.cleanup !== undefined) {
    process.stderr.write(`${operation} completed. ${result.cleanup.message}\n`);
  }
  return result;
}
