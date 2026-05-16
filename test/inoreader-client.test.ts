import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  createInoreaderClient,
  type InoreaderHttpTransport
} from "../src/inoreader/client.js";
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

    const client = createInoreaderClient(
      {
        appName: "inoreader-mcp",
        appVersion: "1.0.0",
        inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0",
        inoreaderAccessToken: "secret-token"
      },
      transport
    );

    await Effect.runPromise(client.getUserInfo());

    expect(requests[0]).toMatchObject({
      method: "GET",
      path: "/user-info",
      headers: { Authorization: "Bearer secret-token" }
    });
  });

  it("encodes repeated item IDs for article write requests", async () => {
    const requests: Parameters<InoreaderHttpTransport>[0][] = [];
    const transport: InoreaderHttpTransport = (request) =>
      Effect.sync(() => {
        requests.push(request);
        return { status: 200, body: "OK" };
      });

    const client = createInoreaderClient(
      {
        appName: "inoreader-mcp",
        appVersion: "1.0.0",
        inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0",
        inoreaderAccessToken: "secret-token"
      },
      transport
    );

    await Effect.runPromise(client.markRead(["item-1", "item-2"]));

    expect(requests[0]?.query).toEqual([
      ["a", "user/-/state/com.google/read"],
      ["i", "item-1"],
      ["i", "item-2"]
    ]);
  });

  it("fails authenticated methods when the token is missing", async () => {
    const client = createInoreaderClient(
      {
        appName: "inoreader-mcp",
        appVersion: "1.0.0",
        inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0"
      },
      () => Effect.succeed({ status: 200, body: "OK" })
    );

    await expect(
      Effect.runPromise(Effect.flip(client.getUserInfo()))
    ).resolves.toMatchObject({
      _tag: "InoreaderAuthError"
    });
  });

  it("maps rate limits to tagged errors", async () => {
    const client = createInoreaderClient(
      {
        appName: "inoreader-mcp",
        appVersion: "1.0.0",
        inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0",
        inoreaderAccessToken: "secret-token"
      },
      () => Effect.succeed({ status: 429, body: "Too many requests" })
    );

    await expect(
      Effect.runPromise(Effect.flip(client.getUnreadCounts()))
    ).resolves.toMatchObject({
      _tag: "InoreaderRateLimitError"
    });
  });
});
