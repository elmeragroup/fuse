/**
 * Unit under test: `DOCS_ORIGIN`, the origin each kit page's `View documentation` link opens.
 * Oracle: the `origin` input the merge workflow's production deploy builds the docs image with,
 * which the published docs site serves at. A domain change there that the kit misses would leave
 * every link on the old domain.
 */

import * as Schema from "effect/Schema";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { DOCS_ORIGIN } from "./docs-pages";

/** The parts of a workflow the check reads: each job's steps, their action and inputs. */
const Workflow = Schema.Struct({
  jobs: Schema.Record(
    Schema.String,
    Schema.Struct({
      steps: Schema.optionalKey(
        Schema.Array(
          Schema.Struct({
            uses: Schema.optionalKey(Schema.String),
            with: Schema.optionalKey(
              Schema.Struct({
                registry: Schema.optionalKey(Schema.String),
                origin: Schema.optionalKey(Schema.String),
              })
            ),
          })
        )
      ),
    })
  ),
});

describe("the docs origin the kit links to", () => {
  it("is the origin the merge workflow builds the production docs image with", () => {
    const source: unknown = parse(
      readFileSync(new URL("../../../../.github/workflows/merge.yml", import.meta.url), "utf8")
    );
    const workflow = Schema.decodeUnknownSync(Workflow)(source);
    const origins = Object.values(workflow.jobs)
      .flatMap((job) => job.steps ?? [])
      .filter(
        (step) =>
          step.uses === "./.github/actions/push-docs-image" &&
          step.with?.registry?.includes("AZURE_ACR_NAME_PROD") === true
      )
      .map((step) => step.with?.origin);
    expect(origins).toEqual([DOCS_ORIGIN]);
  });
});
