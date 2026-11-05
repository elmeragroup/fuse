/**
 * A Slack channel through Slack's Web API, authenticated with a bot token that has `chat:write`
 * and `channels:history` (`groups:history` for a private channel).
 *
 * The history check reads `conversations.history` with each message's metadata, following
 * `next_cursor` for at most `MAX_PAGES` pages of `PAGE_LIMIT` messages. That covers far more
 * traffic than GitHub's 30-day re-run window brings; past it the check fails rather than guess,
 * as it does when Slack says more history follows without a cursor to read it. A history read
 * changes nothing, so it is retried by `http-retry.ts`'s policy. A post is sent once and never
 * retried: a post whose answer was lost may have landed, and only the next history check can tell.
 * Each call, from the request to the end of its body, runs under one timeout.
 *
 * Slack answers most errors with HTTP 200 and `ok: false`; those are `SlackRefused` with Slack's
 * error code, such as `not_in_channel`, `missing_scope` or `invalid_auth`.
 */

import { DateTime, Duration, Effect, Layer, Option, Schema, Stream } from "effect";
import type { Redacted } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

import { baseUrlSetting, PathSegment, under } from "./addresses.ts";
import * as Announcement from "./announcement.ts";
import type { ChatPostMessage, SlackChannelId } from "./announcement.ts";
import { attemptTimeout, describe, requestedWait, retryReads, withinTimeout } from "./http-retry.ts";
import type { ReadFailure } from "./http-retry.ts";
import {
  HistoryBeyondBound,
  HistoryIncomplete,
  PostUnconfirmed,
  SlackChannel,
  SlackRefused,
  SlackUnavailable,
} from "./release-announcement.ts";
import type { RecordTag } from "./release-record.ts";

/** Messages per history page, Slack's recommended maximum. */
const PAGE_LIMIT = 200;

/** History pages read before the check gives up. */
const MAX_PAGES = 10;

const HistoryAnswer = Schema.Union([
  Schema.Struct({
    ok: Schema.Literal(true),
    messages: Schema.Array(
      Schema.Struct({ ts: Schema.String, metadata: Schema.optionalKey(Schema.Unknown) })
    ),
    has_more: Schema.optionalKey(Schema.Boolean),
    response_metadata: Schema.optionalKey(Schema.Struct({ next_cursor: Schema.optionalKey(Schema.String) })),
  }),
  Schema.Struct({ ok: Schema.Literal(false), error: Schema.String }),
]);

const PostAnswer = Schema.Union([
  Schema.Struct({ ok: Schema.Literal(true), ts: Schema.String }),
  Schema.Struct({ ok: Schema.Literal(false), error: Schema.String }),
]);

/** Where one history read starts. */
type PageState = { readonly cursor: string; readonly page: number };

/** What a post's answer was, before its body is decoded. */
type PostFailure =
  /** Slack refused the post before storing it: a rate limit or another client error. */
  | { readonly _tag: "Refused"; readonly error: string }
  /** No answer said whether Slack stored the post. */
  | { readonly _tag: "Unconfirmed"; readonly reason: string };

/**
 * Reads and posts with `token` at `SLACK_API_URL` (`https://slack.com/api` unless set).
 *
 * @param token - The bot token.
 * @returns The Slack channel adapter.
 */
export const layer = (token: Redacted.Redacted<string>) =>
  Layer.effect(
    SlackChannel,
    Effect.gen(function* () {
      const api = yield* baseUrlSetting("SLACK_API_URL", "https://slack.com/api");
      const historyUrl = under(api, [PathSegment.make("conversations.history")]);
      const postUrl = under(api, [PathSegment.make("chat.postMessage")]);
      const timeout = yield* attemptTimeout;
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.mapRequest((request) => request.pipe(HttpClientRequest.bearerToken(token)))
      );

      /** One read of a history page: its JSON. Only this read is retried. */
      const historyRead = (channel: SlackChannelId, oldest: string, cursor: string) =>
        Effect.gen(function* () {
          const response = yield* client
            .execute(
              HttpClientRequest.post(historyUrl).pipe(
                HttpClientRequest.bodyUrlParams({
                  channel,
                  oldest,
                  limit: String(PAGE_LIMIT),
                  include_all_metadata: "true",
                  // An empty cursor reads the first page.
                  cursor,
                })
              )
            )
            .pipe(
              Effect.mapError((error): ReadFailure => ({ _tag: "Unanswered", reason: error.reason._tag }))
            );
          if (response.status === 429 || response.status >= 500) {
            const wait = yield* requestedWait(response.headers);
            return yield* Effect.fail<ReadFailure>({ _tag: "Throttled", status: response.status, wait });
          }
          if (response.status !== 200)
            return yield* Effect.fail<ReadFailure>({ _tag: "Rejected", status: response.status });
          // The body is part of the answer: a stall while reading it counts against the timeout.
          return yield* response.json.pipe(
            Effect.mapError((error): ReadFailure => ({ _tag: "Unanswered", reason: error.reason._tag }))
          );
        }).pipe(withinTimeout(timeout), retryReads("Slack conversations.history"));

      /** One page of the channel's history, decoded, or why Slack did not give it. */
      const historyPage = Effect.fnUntraced(function* (
        channel: SlackChannelId,
        oldest: string,
        cursor: string
      ) {
        const json = yield* historyRead(channel, oldest, cursor).pipe(
          Effect.mapError((failure) =>
            failure._tag === "Rejected"
              ? new SlackRefused({
                  message: `Slack conversations.history answered ${String(failure.status)}`,
                  method: "conversations.history",
                  error: `http_${String(failure.status)}`,
                })
              : new SlackUnavailable({
                  message: `Slack conversations.history ${describe(failure)}`,
                  method: "conversations.history",
                })
          )
        );
        const answer = yield* Schema.decodeUnknownEffect(HistoryAnswer)(json).pipe(
          Effect.mapError(
            () =>
              new SlackUnavailable({
                message: "Slack conversations.history answered with a body that is not a history page",
                method: "conversations.history",
              })
          )
        );
        if (!answer.ok) {
          return yield* new SlackRefused({
            message: `Slack conversations.history failed: ${answer.error}`,
            method: "conversations.history",
            error: answer.error,
          });
        }
        return answer;
      });

      const findAnnouncement = Effect.fn("SlackWebApi.findAnnouncement")(function* (
        channel: SlackChannelId,
        tag: RecordTag,
        postedAfter: DateTime.Utc
      ) {
        yield* Effect.annotateCurrentSpan({ channel, tag });
        const oldest = String(DateTime.toEpochSeconds(postedAfter));
        const messages = Stream.paginate({ cursor: "", page: 1 } satisfies PageState, (state: PageState) =>
          Effect.gen(function* () {
            if (state.page > MAX_PAGES) {
              return yield* new HistoryBeyondBound({
                message: `The channel holds more than ${String(PAGE_LIMIT * MAX_PAGES)} messages since ${tag} was published, so its announcement could not be ruled out`,
                messages: PAGE_LIMIT * MAX_PAGES,
              });
            }
            const page = yield* historyPage(channel, oldest, state.cursor);
            const next = page.response_metadata?.next_cursor ?? "";
            // Slack's own end of history is `has_more: false`; a page that says more follows but
            // names no cursor cannot be read past, so it is not taken as the end.
            if (page.has_more === true && next === "") {
              return yield* new HistoryIncomplete({
                message: `Slack said more of the channel's history follows page ${String(state.page)} but gave no cursor, so the announcement of ${tag} could not be ruled out`,
              });
            }
            yield* Effect.logDebug(`Read history page ${String(state.page)} of ${channel}`);
            return [
              page.messages,
              next === "" ? Option.none() : Option.some({ cursor: next, page: state.page + 1 }),
            ] as const;
          })
        );
        const receipt = yield* messages.pipe(
          // Another app's metadata, or none, is simply not a receipt.
          Stream.filter((message) =>
            Option.exists(Schema.decodeUnknownOption(Announcement.Receipt)(message.metadata), (found) =>
              Announcement.isReceiptFor(tag, found)
            )
          ),
          Stream.runHead
        );
        return Option.map(receipt, (message) => ({ ts: message.ts }));
      });

      const post = Effect.fn("SlackWebApi.post")(function* (message: ChatPostMessage) {
        yield* Effect.annotateCurrentSpan({
          channel: message.channel,
          tag: message.metadata.event_payload.tag,
        });
        const json = yield* Effect.gen(function* () {
          const response = yield* client
            .execute(
              // SAFETY: bodyJsonUnsafe throws only for a body JSON.stringify cannot write: a BigInt
              // or a cycle. ChatPostMessage is a tree of strings, booleans and arrays built by
              // Announcement, so it holds neither, and a throw here would be a defect.
              HttpClientRequest.post(postUrl).pipe(HttpClientRequest.bodyJsonUnsafe(message))
            )
            .pipe(
              Effect.mapError((error): PostFailure => ({ _tag: "Unconfirmed", reason: error.reason._tag }))
            );
          // A rate limit or another client error is refused before Slack does anything; a server
          // error may come after the message is stored.
          if (response.status >= 400 && response.status < 500) {
            return yield* Effect.fail<PostFailure>({
              _tag: "Refused",
              error: `http_${String(response.status)}`,
            });
          }
          if (response.status !== 200) {
            return yield* Effect.fail<PostFailure>({
              _tag: "Unconfirmed",
              reason: `HTTP ${String(response.status)}`,
            });
          }
          return yield* response.json.pipe(
            Effect.mapError((error): PostFailure => ({ _tag: "Unconfirmed", reason: error.reason._tag }))
          );
        }).pipe(
          // The whole answer, its body included, must arrive in time; the post is never repeated.
          Effect.timeoutOrElse({
            duration: timeout,
            orElse: () =>
              Effect.fail<PostFailure>({
                _tag: "Unconfirmed",
                reason: `no answer within ${Duration.format(timeout)}`,
              }),
          }),
          Effect.mapError((failure) =>
            failure._tag === "Refused"
              ? new SlackRefused({
                  message: `Slack chat.postMessage failed: ${failure.error}`,
                  method: "chat.postMessage",
                  error: failure.error,
                })
              : new PostUnconfirmed({
                  message: `Slack did not confirm the post (${failure.reason}), so it may have landed`,
                })
          )
        );
        const answer = yield* Schema.decodeUnknownEffect(PostAnswer)(json).pipe(
          Effect.mapError(
            () =>
              new PostUnconfirmed({
                message:
                  "Slack did not confirm the post (an answer that does not read as one), so it may have landed",
              })
          )
        );
        if (!answer.ok) {
          return yield* new SlackRefused({
            message: `Slack chat.postMessage failed: ${answer.error}`,
            method: "chat.postMessage",
            error: answer.error,
          });
        }
        return { ts: answer.ts };
      });

      return SlackChannel.of({ findAnnouncement, post });
    })
  );
