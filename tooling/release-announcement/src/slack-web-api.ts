/**
 * A Slack channel through Slack's Web API, authenticated with a bot token that has `chat:write`
 * and `channels:history` (`groups:history` for a private channel).
 *
 * The history check reads `conversations.history` with each message's metadata, following
 * `next_cursor` for at most `MAX_PAGES` pages of `PAGE_LIMIT` messages. That covers far more
 * traffic than GitHub's 30-day re-run window brings; past it the check fails rather than guess,
 * as it does when Slack says more history follows without a cursor to read it, and when Slack
 * marks the history `is_limited` and the visible history ends without a receipt: a free workspace
 * past its history limit hides older messages, so an earlier announcement may be among them. A
 * history read
 * changes nothing, so it is retried by `http-retry.ts`'s policy. A post is sent once and never
 * retried: a post whose answer was lost may have landed, and only the next history check can tell.
 * Each call, from the request to the end of its body, runs under one timeout.
 *
 * Slack answers most errors with HTTP 200 and `ok: false`; those are `SlackRefused` with Slack's
 * error code, such as `not_in_channel`, `missing_scope` or `invalid_auth`.
 */

import { DateTime, Effect, Layer, Option, Schema, Stream } from "effect";
import type { Redacted } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import type { HttpClientResponse } from "effect/http";

import { baseUrlSetting, PathSegment, under } from "./addresses.ts";
import * as Announcement from "./announcement.ts";
import type { ChatPostMessage, SlackChannelId } from "./announcement.ts";
import { attemptTimeout, describe, readJson, withinTimeout } from "./http-retry.ts";
import {
  HistoryUnchecked,
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

/** A Web API method's answer: `ok: true` with `fields`, or `ok: false` with Slack's error code. */
const answer = <Fields extends Schema.Struct.Fields>(fields: Fields) =>
  Schema.Union([
    Schema.Struct({ ok: Schema.Literal(true), ...fields }),
    Schema.Struct({ ok: Schema.Literal(false), error: Schema.String }),
  ]);

const HistoryAnswer = answer({
  messages: Schema.Array(Schema.Struct({ ts: Schema.String, metadata: Schema.optionalKey(Schema.Unknown) })),
  has_more: Schema.optionalKey(Schema.Boolean),
  /** Whether a free workspace's history limit hides older messages. */
  is_limited: Schema.optionalKey(Schema.Boolean),
  response_metadata: Schema.optionalKey(Schema.Struct({ next_cursor: Schema.optionalKey(Schema.String) })),
});

const PostAnswer = answer({ ts: Schema.String });

/** Slack refused a call of `method` with `error`, its error code or `http_<status>`. */
function refused(method: "conversations.history" | "chat.postMessage", error: string): SlackRefused {
  return new SlackRefused({ message: `Slack ${method} failed: ${error}` });
}

/** Whether a history answer is a rate limit or a server error. */
function isThrottled(response: HttpClientResponse.HttpClientResponse): boolean {
  return response.status === 429 || response.status >= 500;
}

/**
 * The next step of the history search: a page to read, with whether a page already read said Slack
 * hides older history, or the end of the visible history after such a page, where the search fails
 * because the receipt may be among the hidden messages.
 */
type PageState =
  | { readonly _tag: "Read"; readonly cursor: string; readonly page: number; readonly limited: boolean }
  | { readonly _tag: "Hidden" };

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

      /** One page of the channel's history, decoded, or why Slack did not give it. */
      const historyPage = Effect.fnUntraced(function* (
        channel: SlackChannelId,
        oldest: string,
        cursor: string
      ) {
        const request = client.execute(
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
        );
        const json = yield* readJson(request, {
          read: "Slack conversations.history",
          timeout,
          throttled: isThrottled,
        }).pipe(
          Effect.mapError((failure) =>
            failure._tag === "Rejected"
              ? new SlackRefused({
                  message: `Slack conversations.history answered ${String(failure.status)}`,
                })
              : new SlackUnavailable({ message: `Slack conversations.history ${describe(failure)}` })
          )
        );
        const page = yield* Schema.decodeUnknownEffect(HistoryAnswer)(json).pipe(
          Effect.mapError(
            () =>
              new SlackUnavailable({
                message: "Slack conversations.history answered with a body that is not a history page",
              })
          )
        );
        if (!page.ok) return yield* refused("conversations.history", page.error);
        return page;
      });

      const findAnnouncement = Effect.fn("SlackWebApi.findAnnouncement")(function* (
        channel: SlackChannelId,
        tag: RecordTag,
        postedAfter: DateTime.Utc
      ) {
        yield* Effect.annotateCurrentSpan({ channel, tag });
        const oldest = String(DateTime.toEpochSeconds(postedAfter));
        const first: PageState = { _tag: "Read", cursor: "", page: 1, limited: false };
        const messages = Stream.paginate(first, (state: PageState) =>
          Effect.gen(function* () {
            if (state._tag === "Hidden") {
              return yield* new HistoryUnchecked({
                message: `Slack hides the channel's older history past the free plan's history limit, so the announcement of ${tag} could not be ruled out`,
              });
            }
            if (state.page > MAX_PAGES) {
              return yield* new HistoryUnchecked({
                message: `The channel holds more than ${String(PAGE_LIMIT * MAX_PAGES)} messages since ${tag} was published, so its announcement could not be ruled out`,
              });
            }
            const page = yield* historyPage(channel, oldest, state.cursor);
            const next = page.response_metadata?.next_cursor ?? "";
            // Slack's own end of history is `has_more: false`; a page that says more follows but
            // names no cursor cannot be read past, so it is not taken as the end.
            if (page.has_more === true && next === "") {
              return yield* new HistoryUnchecked({
                message: `Slack said more of the channel's history follows page ${String(state.page)} but gave no cursor, so the announcement of ${tag} could not be ruled out`,
              });
            }
            yield* Effect.logDebug(`Read history page ${String(state.page)} of ${channel}`);
            // Slack answers newest first, so the receipt, posted when the release was announced,
            // is on the last page; a limited page does not end the search early. A receipt among
            // the messages Slack shows settles it; once the visible history ends without one, the
            // receipt may be among those it hides, so the search fails rather than end.
            const limited = state.limited || page.is_limited === true;
            const following: Option.Option<PageState> =
              next !== ""
                ? Option.some({ _tag: "Read", cursor: next, page: state.page + 1, limited })
                : limited
                  ? Option.some({ _tag: "Hidden" })
                  : Option.none();
            return [page.messages, following] as const;
          })
        );
        const receipt = yield* messages.pipe(
          // Another app's metadata, or none, is simply not a receipt.
          Stream.filter((message) =>
            Option.exists(
              Schema.decodeUnknownOption(Announcement.Receipt)(message.metadata),
              (found) => found.event_payload.tag === tag
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
          withinTimeout(timeout, (reason): PostFailure => ({ _tag: "Unconfirmed", reason })),
          Effect.mapError((failure) =>
            failure._tag === "Refused"
              ? refused("chat.postMessage", failure.error)
              : new PostUnconfirmed({
                  message: `Slack did not confirm the post (${failure.reason}), so it may have landed`,
                })
          )
        );
        const posted = yield* Schema.decodeUnknownEffect(PostAnswer)(json).pipe(
          Effect.mapError(
            () =>
              new PostUnconfirmed({
                message:
                  "Slack did not confirm the post (an answer that does not read as one), so it may have landed",
              })
          )
        );
        if (!posted.ok) return yield* refused("chat.postMessage", posted.error);
        return { ts: posted.ts };
      });

      return SlackChannel.of({ findAnnouncement, post });
    })
  );
