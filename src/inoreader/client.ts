import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest
} from "@effect/platform";
import { Effect, Schema } from "effect";

import type { InoreaderMcpConfig } from "../config.js";
import {
  InoreaderAuthError,
  type InoreaderClientError,
  InoreaderDecodeError,
  InoreaderHttpError,
  InoreaderRateLimitError
} from "./errors.js";
import {
  OkResponseSchema,
  StreamContentsSchema,
  SubscriptionListSchema,
  UnreadCountsSchema,
  UserInfoSchema,
  type OkResponse,
  type StreamContents,
  type SubscriptionList,
  type UnreadCounts,
  type UserInfo
} from "./schemas.js";

export interface InoreaderHttpRequest {
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly query?: readonly (readonly [string, string])[];
  readonly headers: Record<string, string>;
}

export interface InoreaderHttpResponse {
  readonly status: number;
  readonly body: unknown;
}

export type InoreaderHttpTransport = (
  request: InoreaderHttpRequest
) => Effect.Effect<InoreaderHttpResponse, InoreaderClientError>;

export const createLiveInoreaderHttpTransport =
  (baseUrl: string): InoreaderHttpTransport =>
  (request) =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const url = new URL(`${baseUrl}${request.path}`);

      for (const [key, value] of request.query ?? []) {
        url.searchParams.append(key, value);
      }

      const response = yield* HttpClientRequest.make(request.method)(url).pipe(
        HttpClientRequest.setHeaders(request.headers),
        client.execute
      );
      const contentType = response.headers["content-type"] ?? "";
      const body = contentType.includes("application/json")
        ? yield* response.json
        : yield* response.text;

      return {
        status: response.status,
        body
      };
    }).pipe(
      Effect.provide(FetchHttpClient.layer),
      Effect.mapError(
        (error) =>
          new InoreaderHttpError({
            message: `Inoreader request failed: ${String(error)}`,
            status: 0
          })
      )
    );

export interface ListSubscriptionsOptions {
  readonly teamAssets?: boolean;
}

export interface GetStreamContentsOptions {
  readonly streamId: string;
  readonly count?: number;
  readonly order?: "newest" | "oldest";
  readonly olderThanUnixTime?: number;
  readonly excludeRead?: boolean;
  readonly continuation?: string;
}

export interface EditSubscriptionOptions {
  readonly streamId: string;
  readonly title?: string;
  readonly addFolderId?: string;
  readonly removeFolderId?: string;
}

export interface FollowSubscriptionOptions extends EditSubscriptionOptions {}

export interface InoreaderClient {
  readonly getUserInfo: () => Effect.Effect<UserInfo, InoreaderClientError>;
  readonly listSubscriptions: (
    options?: ListSubscriptionsOptions
  ) => Effect.Effect<SubscriptionList, InoreaderClientError>;
  readonly getUnreadCounts: () => Effect.Effect<
    UnreadCounts,
    InoreaderClientError
  >;
  readonly getStreamContents: (
    options: GetStreamContentsOptions
  ) => Effect.Effect<StreamContents, InoreaderClientError>;
  readonly markRead: (
    itemIds: readonly string[]
  ) => Effect.Effect<OkResponse, InoreaderClientError>;
  readonly markUnread: (
    itemIds: readonly string[]
  ) => Effect.Effect<OkResponse, InoreaderClientError>;
  readonly star: (
    itemIds: readonly string[]
  ) => Effect.Effect<OkResponse, InoreaderClientError>;
  readonly unstar: (
    itemIds: readonly string[]
  ) => Effect.Effect<OkResponse, InoreaderClientError>;
  readonly like: (
    itemIds: readonly string[]
  ) => Effect.Effect<OkResponse, InoreaderClientError>;
  readonly unlike: (
    itemIds: readonly string[]
  ) => Effect.Effect<OkResponse, InoreaderClientError>;
  readonly broadcast: (
    itemIds: readonly string[]
  ) => Effect.Effect<OkResponse, InoreaderClientError>;
  readonly unbroadcast: (
    itemIds: readonly string[]
  ) => Effect.Effect<OkResponse, InoreaderClientError>;
  readonly addArticleTag: (
    itemIds: readonly string[],
    tagName: string
  ) => Effect.Effect<OkResponse, InoreaderClientError>;
  readonly removeArticleTag: (
    itemIds: readonly string[],
    tagName: string
  ) => Effect.Effect<OkResponse, InoreaderClientError>;
  readonly editSubscription: (
    options: EditSubscriptionOptions
  ) => Effect.Effect<OkResponse, InoreaderClientError>;
  readonly followSubscription: (
    options: FollowSubscriptionOptions
  ) => Effect.Effect<OkResponse, InoreaderClientError>;
  readonly unfollowSubscription: (
    streamId: string
  ) => Effect.Effect<OkResponse, InoreaderClientError>;
  readonly renameTag: (
    sourceTagId: string,
    destinationName: string
  ) => Effect.Effect<OkResponse, InoreaderClientError>;
  readonly deleteTag: (
    tagId: string
  ) => Effect.Effect<OkResponse, InoreaderClientError>;
}

const readTag = "user/-/state/com.google/read";
const starredTag = "user/-/state/com.google/starred";
const likeTag = "user/-/state/com.google/like";
const broadcastTag = "user/-/state/com.google/broadcast";

const customTag = (tagName: string): string => `user/-/label/${tagName}`;

export const createInoreaderClient = (
  config: InoreaderMcpConfig,
  transport: InoreaderHttpTransport
): InoreaderClient => {
  const request = <S extends Schema.Schema.Any>(
    method: "GET" | "POST",
    path: string,
    query: readonly (readonly [string, string])[],
    schema: S
  ): Effect.Effect<
    Schema.Schema.Type<S>,
    InoreaderClientError,
    Schema.Schema.Context<S>
  > =>
    Effect.gen(function* () {
      const token = config.inoreaderAccessToken;
      if (!token) {
        return yield* Effect.fail(
          new InoreaderAuthError({
            message: "INOREADER_ACCESS_TOKEN is required for this tool"
          })
        );
      }

      const response = yield* transport({
        method,
        path,
        query,
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401 || response.status === 403) {
        return yield* Effect.fail(
          new InoreaderAuthError({
            message: "Inoreader authentication failed",
            status: response.status
          })
        );
      }

      if (response.status === 429) {
        return yield* Effect.fail(
          new InoreaderRateLimitError({
            message: "Inoreader rate limit exceeded",
            status: 429
          })
        );
      }

      if (response.status < 200 || response.status >= 300) {
        return yield* Effect.fail(
          new InoreaderHttpError({
            message: `Inoreader request failed with HTTP ${response.status}`,
            status: response.status,
            body:
              typeof response.body === "string"
                ? response.body
                : JSON.stringify(response.body)
          })
        );
      }

      return yield* Schema.decodeUnknown(schema)(response.body).pipe(
        Effect.mapError(
          (error) =>
            new InoreaderDecodeError({
              message: String(error)
            })
        )
      );
    }) as Effect.Effect<
      Schema.Schema.Type<S>,
      InoreaderClientError,
      Schema.Schema.Context<S>
    >;

  const editTag = (
    itemIds: readonly string[],
    add: readonly string[],
    remove: readonly string[]
  ) =>
    request(
      "POST",
      "/edit-tag",
      [
        ...add.map((tag) => ["a", tag] as const),
        ...remove.map((tag) => ["r", tag] as const),
        ...itemIds.map((itemId) => ["i", itemId] as const)
      ],
      OkResponseSchema
    );

  const subscriptionEdit = (
    action: "edit" | "follow" | "unfollow",
    options: EditSubscriptionOptions
  ) =>
    request(
      "POST",
      "/subscription/edit",
      [
        ["ac", action],
        ["s", options.streamId],
        ...(options.title ? [["t", options.title] as const] : []),
        ...(options.addFolderId ? [["a", options.addFolderId] as const] : []),
        ...(options.removeFolderId
          ? [["r", options.removeFolderId] as const]
          : [])
      ],
      OkResponseSchema
    );

  return {
    getUserInfo: () => request("GET", "/user-info", [], UserInfoSchema),
    listSubscriptions: (options = {}) =>
      request(
        "GET",
        "/subscription/list",
        options.teamAssets ? [["team_assets", "1"]] : [],
        SubscriptionListSchema
      ),
    getUnreadCounts: () =>
      request("GET", "/unread-count", [], UnreadCountsSchema),
    getStreamContents: (options) =>
      request(
        "GET",
        `/stream/contents/${encodeURIComponent(options.streamId)}`,
        [
          ["output", "json"],
          ...(options.count ? [["n", String(options.count)] as const] : []),
          ...(options.order === "oldest" ? [["r", "o"] as const] : []),
          ...(options.olderThanUnixTime
            ? [["ot", String(options.olderThanUnixTime)] as const]
            : []),
          ...(options.excludeRead
            ? [["xt", "user/-/state/com.google/read"] as const]
            : []),
          ...(options.continuation ? [["c", options.continuation] as const] : [])
        ],
        StreamContentsSchema
      ),
    markRead: (itemIds) => editTag(itemIds, [readTag], []),
    markUnread: (itemIds) => editTag(itemIds, [], [readTag]),
    star: (itemIds) => editTag(itemIds, [starredTag], []),
    unstar: (itemIds) => editTag(itemIds, [], [starredTag]),
    like: (itemIds) => editTag(itemIds, [likeTag], []),
    unlike: (itemIds) => editTag(itemIds, [], [likeTag]),
    broadcast: (itemIds) => editTag(itemIds, [broadcastTag], []),
    unbroadcast: (itemIds) => editTag(itemIds, [], [broadcastTag]),
    addArticleTag: (itemIds, tagName) =>
      editTag(itemIds, [customTag(tagName)], []),
    removeArticleTag: (itemIds, tagName) =>
      editTag(itemIds, [], [customTag(tagName)]),
    editSubscription: (options) => subscriptionEdit("edit", options),
    followSubscription: (options) => subscriptionEdit("follow", options),
    unfollowSubscription: (streamId) =>
      subscriptionEdit("unfollow", { streamId }),
    renameTag: (sourceTagId, destinationName) =>
      request(
        "POST",
        "/rename-tag",
        [
          ["s", sourceTagId],
          ["dest", destinationName]
        ],
        OkResponseSchema
      ),
    deleteTag: (tagId) =>
      request("POST", "/disable-tag", [["s", tagId]], OkResponseSchema)
  };
};
