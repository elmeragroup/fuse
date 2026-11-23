/**
 * Unit under test: `parseCaptureShard` and `shardItems`, which split the capture check over CI's
 * parallel jobs. Oracle: seven keys dealt round-robin into three slices by hand, so every key lands
 * in exactly one slice and the slices together hold the whole list, and the argument forms the
 * README's `--shard <k>/<n>` names.
 */
import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import { parseCaptureShard, shardItems } from "./capture-shard.ts";

const KEYS = ["accordion", "alert", "avatar", "badge", "button", "card", "text-styles"];

describe("shardItems", () => {
  it.each([
    ["1/3", ["accordion", "badge", "text-styles"]],
    ["2/3", ["alert", "button"]],
    ["3/3", ["avatar", "card"]],
    ["1/1", KEYS],
  ])("shard %s keeps its round-robin slice", (text, expected) => {
    const shard = Result.getOrThrow(parseCaptureShard(text));
    expect(shardItems(KEYS, shard)).toEqual(expected);
  });
});

describe("parseCaptureShard", () => {
  it.each([
    "0/4",
    "5/4",
    "1/0",
    "-1/4",
    "1",
    "1/4/2",
    "a/b",
    "1.5/4",
    "",
    " 1/4",
    "9007199254740993/9007199254740992",
  ])("rejects %j", (text) => {
    const parsed = parseCaptureShard(text);
    expect(Result.isFailure(parsed) && parsed.failure._tag).toBe("InvalidCaptureShard");
  });
});
