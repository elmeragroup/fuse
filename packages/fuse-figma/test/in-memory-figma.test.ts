import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

import { InMemoryFigma } from "./in-memory-figma.ts";

const FILE_KEY = "FuseFile123";
const TOKEN = "figd_test-token";

/**
 * Create one variable with these scopes in a fresh file, straight through the REST route.
 *
 * @returns The status and message the fake answers with, and the scopes it stored.
 */
function createWithScopes(resolvedType: "COLOR" | "FLOAT" | "STRING", scopes: readonly string[]) {
  const figma = new InMemoryFigma(FILE_KEY, TOKEN);
  const collection = figma.addCollection("Probe", ["Value"]);
  return Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.execute(
      HttpClientRequest.post(`https://api.figma.com/v1/files/${FILE_KEY}/variables`).pipe(
        HttpClientRequest.setHeader("X-Figma-Token", TOKEN),
        HttpClientRequest.bodyJsonUnsafe({
          variables: [
            {
              action: "CREATE",
              id: "probe",
              name: "probe",
              variableCollectionId: collection,
              resolvedType,
              scopes,
            },
          ],
        })
      )
    );
    const body: unknown = yield* response.json;
    const message = body instanceof Object && "message" in body ? body.message : undefined;
    const stored: readonly string[] | undefined =
      response.status === 200 ? figma.metadata("Probe", "probe").scopes : undefined;
    return { status: response.status, message, stored };
  }).pipe(Effect.provide(figma.layer()));
}

// The expectations come from https://developers.figma.com/docs/rest-api/variables-types/,
// except the FONT_STYLE rows, which a real Enterprise file answered on 2026-10-16.
describe("the in-memory Figma file's scope rules", () => {
  it.effect.each([
    {
      rule: "accepts FONT_VARIATIONS on a STRING variable",
      type: "STRING",
      scopes: ["FONT_FAMILY", "FONT_VARIATIONS"],
      reply: { status: 200, message: undefined, stored: ["FONT_FAMILY", "FONT_VARIATIONS"] },
    },
    {
      rule: "refuses FONT_VARIATIONS on a FLOAT variable",
      type: "FLOAT",
      scopes: ["FONT_VARIATIONS"],
      reply: {
        status: 400,
        message: "Scope FONT_VARIATIONS does not apply to a FLOAT variable",
        stored: undefined,
      },
    },
    {
      rule: "keeps FONT_STYLE on a FLOAT variable",
      type: "FLOAT",
      scopes: ["FONT_STYLE"],
      reply: { status: 200, message: undefined, stored: ["FONT_STYLE"] },
    },
    {
      rule: "stores FONT_WEIGHT on a FLOAT variable as FONT_STYLE",
      type: "FLOAT",
      scopes: ["FONT_WEIGHT"],
      reply: { status: 200, message: undefined, stored: ["FONT_STYLE"] },
    },
    {
      rule: "accepts ALL_FILLS beside a stroke scope",
      type: "COLOR",
      scopes: ["ALL_FILLS", "STROKE_COLOR"],
      reply: { status: 200, message: undefined, stored: ["ALL_FILLS", "STROKE_COLOR"] },
    },
    {
      rule: "refuses ALL_FILLS beside another fill scope",
      type: "COLOR",
      scopes: ["ALL_FILLS", "FRAME_FILL"],
      reply: { status: 400, message: "ALL_FILLS cannot combine with other fill scopes", stored: undefined },
    },
    {
      rule: "refuses ALL_SCOPES beside any other scope",
      type: "FLOAT",
      scopes: ["ALL_SCOPES", "GAP"],
      reply: { status: 400, message: "ALL_SCOPES cannot combine with other scopes", stored: undefined },
    },
  ] as const)("$rule", ({ type, scopes, reply }) =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* createWithScopes(type, scopes), reply);
    })
  );
});
