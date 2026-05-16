import { Schema } from "effect";

const LinkSchema = Schema.Struct({
  href: Schema.String,
  type: Schema.optional(Schema.String)
});

const CategorySchema = Schema.Struct({
  id: Schema.String,
  label: Schema.optional(Schema.String)
});

export const UserInfoSchema = Schema.Struct({
  userId: Schema.String,
  userName: Schema.String,
  userProfileId: Schema.String,
  userEmail: Schema.String,
  isBloggerUser: Schema.Boolean,
  signupTimeSec: Schema.Number,
  isMultiLoginEnabled: Schema.Boolean
});

export type UserInfo = Schema.Schema.Type<typeof UserInfoSchema>;

export const SubscriptionSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  categories: Schema.Array(CategorySchema),
  sortid: Schema.String,
  firstitemmsec: Schema.Number,
  url: Schema.String,
  htmlUrl: Schema.String,
  iconUrl: Schema.String,
  description: Schema.optional(Schema.String),
  feedType: Schema.optional(Schema.String)
});

export const SubscriptionListSchema = Schema.Struct({
  subscriptions: Schema.Array(SubscriptionSchema)
});

export type SubscriptionList = Schema.Schema.Type<
  typeof SubscriptionListSchema
>;

export const UnreadCountSchema = Schema.Struct({
  id: Schema.String,
  count: Schema.Number,
  newestItemTimestampUsec: Schema.String
});

export const UnreadCountsSchema = Schema.Struct({
  max: Schema.String,
  unreadcounts: Schema.Array(UnreadCountSchema)
});

export type UnreadCounts = Schema.Schema.Type<typeof UnreadCountsSchema>;

export const StreamItemSchema = Schema.Struct({
  crawlTimeMsec: Schema.String,
  timestampUsec: Schema.String,
  id: Schema.String,
  categories: Schema.Array(Schema.String),
  title: Schema.String,
  published: Schema.Number,
  updated: Schema.Number,
  canonical: Schema.optional(Schema.Array(LinkSchema)),
  alternate: Schema.optional(Schema.Array(LinkSchema)),
  summary: Schema.optional(
    Schema.Struct({
      direction: Schema.optional(Schema.String),
      content: Schema.optional(Schema.String)
    })
  )
});

export const StreamContentsSchema = Schema.Struct({
  direction: Schema.String,
  id: Schema.String,
  title: Schema.String,
  description: Schema.String,
  updated: Schema.Number,
  updatedUsec: Schema.String,
  continuation: Schema.optional(Schema.String),
  items: Schema.Array(StreamItemSchema)
});

export type StreamContents = Schema.Schema.Type<typeof StreamContentsSchema>;

export const OkResponseSchema = Schema.transform(
  Schema.Literal("OK"),
  Schema.Struct({ ok: Schema.Literal(true) }),
  {
    strict: true,
    decode: () => ({ ok: true as const }),
    encode: () => "OK" as const
  }
);

export type OkResponse = Schema.Schema.Type<typeof OkResponseSchema>;
