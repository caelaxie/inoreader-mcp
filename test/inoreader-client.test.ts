import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  createInoreaderClient,
  type InoreaderAccessTokenProvider,
  type InoreaderHttpTransport
} from "../src/inoreader/client.js";
import { InoreaderAuthError } from "../src/inoreader/errors.js";
import {
  OkResponseSchema,
  StreamContentsSchema,
  SubscriptionListSchema,
  UnreadCountsSchema,
  UserInfoSchema
} from "../src/inoreader/schemas.js";

describe("Inoreader schemas", () => {
  it("decodes representative read responses", () => {
    expect(
      Schema.decodeUnknownSync(UserInfoSchema)({
        userId: "1001921515",
        userName: "reader",
        userProfileId: "1001921515",
        userEmail: "reader@example.test",
        isBloggerUser: false,
        signupTimeSec: 1163850013,
        isMultiLoginEnabled: false
      }).userName
    ).toBe("reader");

    expect(
      Schema.decodeUnknownSync(SubscriptionListSchema)({
        subscriptions: [
          {
            id: "feed/https://example.test/feed.xml",
            title: "Example",
            categories: [{ id: "user/-/label/Tech", label: "Tech" }],
            sortid: "001",
            firstitemmsec: 1424501776942006,
            url: "https://example.test/feed.xml",
            htmlUrl: "https://example.test",
            iconUrl: ""
          }
        ]
      }).subscriptions[0]?.title
    ).toBe("Example");

    expect(
      Schema.decodeUnknownSync(UnreadCountsSchema)({
        max: "1000",
        unreadcounts: [
          {
            id: "user/-/state/com.google/reading-list",
            count: 3,
            newestItemTimestampUsec: "1415620910006331"
          }
        ]
      }).unreadcounts[0]?.count
    ).toBe(3);

    expect(
      Schema.decodeUnknownSync(StreamContentsSchema)({
        direction: "ltr",
        id: "feed/https://example.test/feed.xml",
        title: "Example",
        description: "",
        updated: 1618212570,
        updatedUsec: "1618212570146918",
        items: [
          {
            crawlTimeMsec: "1618211779000",
            timestampUsec: "1618211779000000",
            id: "tag:google.com,2005:reader/item/0001",
            categories: ["user/-/state/com.google/reading-list"],
            title: "Article",
            published: 1617969599,
            updated: 1617990787,
            canonical: [{ href: "https://example.test/article" }],
            alternate: [
              { href: "https://example.test/article", type: "text/html" }
            ],
            summary: { direction: "ltr", content: "Summary" }
          }
        ]
      }).items[0]?.title
    ).toBe("Article");
  });

  it("decodes plain OK write responses", () => {
    expect(Schema.decodeUnknownSync(OkResponseSchema)("OK")).toEqual({
      ok: true
    });
  });
});

describe("createInoreaderClient", () => {
  const accessTokenProvider: InoreaderAccessTokenProvider = () =>
    Effect.succeed("oauth-access-token");

  it("sends bearer authentication on read requests", async () => {
    const requests: Parameters<InoreaderHttpTransport>[0][] = [];
    const transport: InoreaderHttpTransport = (request) =>
      Effect.sync(() => {
        requests.push(request);
        return {
          status: 200,
          body: {
            userId: "1001921515",
            userName: "reader",
            userProfileId: "1001921515",
            userEmail: "reader@example.test",
            isBloggerUser: false,
            signupTimeSec: 1163850013,
            isMultiLoginEnabled: false
          }
        };
      });

    const client = createInoreaderClient(accessTokenProvider, transport);

    await Effect.runPromise(client.getUserInfo());

    expect(requests[0]).toMatchObject({
      method: "GET",
      path: "/user-info",
      headers: { Authorization: "Bearer oauth-access-token" }
    });
  });

  it("encodes repeated item IDs for article write requests", async () => {
    const requests: Parameters<InoreaderHttpTransport>[0][] = [];
    const transport: InoreaderHttpTransport = (request) =>
      Effect.sync(() => {
        requests.push(request);
        return { status: 200, body: "OK" };
      });

    const client = createInoreaderClient(accessTokenProvider, transport);

    await Effect.runPromise(client.markRead(["item-1", "item-2"]));

    expect(requests[0]?.query).toEqual([
      ["a", "user/-/state/com.google/read"],
      ["i", "item-1"],
      ["i", "item-2"]
    ]);
  });

  it("fails authenticated methods when OAuth token retrieval fails", async () => {
    const client = createInoreaderClient(
      () =>
        Effect.fail(
          new InoreaderAuthError({
            message: "Inoreader OAuth token refresh failed"
          })
        ),
      () => Effect.succeed({ status: 200, body: "OK" })
    );

    await expect(
      Effect.runPromise(Effect.flip(client.getUserInfo()))
    ).resolves.toMatchObject({
      _tag: "InoreaderAuthError"
    });
  });

  it("maps rate limits to tagged errors", async () => {
    const client = createInoreaderClient(accessTokenProvider, () =>
      Effect.succeed({ status: 429, body: "Too many requests" })
    );

    await expect(
      Effect.runPromise(Effect.flip(client.getUnreadCounts()))
    ).resolves.toMatchObject({
      _tag: "InoreaderRateLimitError"
    });
  });

  it("maps HTTP 401 and 403 responses to auth errors", async () => {
    for (const status of [401, 403]) {
      const client = createInoreaderClient(accessTokenProvider, () =>
        Effect.succeed({ status, body: "Unauthorized" })
      );

      await expect(
        Effect.runPromise(Effect.flip(client.getUserInfo()))
      ).resolves.toMatchObject({
        _tag: "InoreaderAuthError",
        status
      });
    }
  });

  it("maps invalid response bodies to decode errors", async () => {
    const client = createInoreaderClient(accessTokenProvider, () =>
      Effect.succeed({ status: 200, body: { unexpected: true } })
    );

    await expect(
      Effect.runPromise(Effect.flip(client.getUnreadCounts()))
    ).resolves.toMatchObject({
      _tag: "InoreaderDecodeError"
    });
  });

  it("maps non-auth HTTP failures to HTTP errors with status and body", async () => {
    const client = createInoreaderClient(accessTokenProvider, () =>
      Effect.succeed({ status: 500, body: { error: "upstream" } })
    );

    await expect(
      Effect.runPromise(Effect.flip(client.getUnreadCounts()))
    ).resolves.toMatchObject({
      _tag: "InoreaderHttpError",
      status: 500,
      body: "{\"error\":\"upstream\"}"
    });
  });

  it("encodes subscription edit actions with descriptive client options", async () => {
    const requests: Parameters<InoreaderHttpTransport>[0][] = [];
    const transport: InoreaderHttpTransport = (request) =>
      Effect.sync(() => {
        requests.push(request);
        return { status: 200, body: "OK" };
      });

    const client = createInoreaderClient(accessTokenProvider, transport);

    await Effect.runPromise(
      client.editSubscription({
        streamId: "feed/https://example.test/feed.xml",
        title: "Example Feed",
        addFolderId: "user/-/label/Tech",
        removeFolderId: "user/-/label/Old"
      })
    );

    expect(requests[0]).toMatchObject({
      method: "POST",
      path: "/subscription/edit"
    });
    expect(requests[0]?.query).toEqual([
      ["ac", "edit"],
      ["s", "feed/https://example.test/feed.xml"],
      ["t", "Example Feed"],
      ["a", "user/-/label/Tech"],
      ["r", "user/-/label/Old"]
    ]);
  });

  it("encodes tag rename and delete requests", async () => {
    const requests: Parameters<InoreaderHttpTransport>[0][] = [];
    const transport: InoreaderHttpTransport = (request) =>
      Effect.sync(() => {
        requests.push(request);
        return { status: 200, body: "OK" };
      });

    const client = createInoreaderClient(accessTokenProvider, transport);

    await Effect.runPromise(client.renameTag("user/-/label/Old", "New Label"));
    await Effect.runPromise(client.deleteTag("user/-/label/New Label"));

    expect(requests[0]).toMatchObject({
      method: "POST",
      path: "/rename-tag",
      query: [
        ["s", "user/-/label/Old"],
        ["dest", "New Label"]
      ]
    });
    expect(requests[1]).toMatchObject({
      method: "POST",
      path: "/disable-tag",
      query: [["s", "user/-/label/New Label"]]
    });
  });
});
