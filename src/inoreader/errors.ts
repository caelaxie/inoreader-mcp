import { Data } from "effect";

export class InoreaderAuthError extends Data.TaggedError(
  "InoreaderAuthError"
)<{
  readonly message: string;
  readonly status?: number;
}> {}

export class InoreaderRateLimitError extends Data.TaggedError(
  "InoreaderRateLimitError"
)<{
  readonly message: string;
  readonly status: 429;
}> {}

export class InoreaderHttpError extends Data.TaggedError(
  "InoreaderHttpError"
)<{
  readonly message: string;
  readonly status: number;
  readonly body?: string;
}> {}

export class InoreaderDecodeError extends Data.TaggedError(
  "InoreaderDecodeError"
)<{
  readonly message: string;
}> {}

export type InoreaderClientError =
  | InoreaderAuthError
  | InoreaderRateLimitError
  | InoreaderHttpError
  | InoreaderDecodeError;
