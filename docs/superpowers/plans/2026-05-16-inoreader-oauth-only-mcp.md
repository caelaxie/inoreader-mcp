# Inoreader OAuth-Only MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static `INOREADER_ACCESS_TOKEN` configuration with OAuth refresh-token based Inoreader API authentication that can start without MCP environment variables after one local setup command.

**Architecture:** Keep the stdio MCP runtime and tool surface. Add system-keyring credential storage, a local non-secret config file for URL overrides, a focused OAuth token provider, env overrides for automation, and make the Inoreader API client request a fresh bearer token from that provider before each API call.

**Tech Stack:** TypeScript ESM, Effect, Zod, MCP TypeScript SDK, Vitest, `@napi-rs/keyring`, Inoreader OAuth 2.0.

---

## Dependency Graph

- T1: Add OAuth-only config tests -> depends_on: []
- T2: Add credential-store and CLI setup tests -> depends_on: [T1]
- T3: Add OAuth token-provider tests -> depends_on: [T2]
- T4: Add client/server regression tests -> depends_on: [T3]
- T5: Implement config store, CLI setup, and OAuth provider -> depends_on: [T4]
- T6: Wire client/server to OAuth provider -> depends_on: [T5]
- T7: Update README -> depends_on: [T6]
- T8: Verify full repo checks -> depends_on: [T7]

## File Structure

- Modify `src/config.ts`: parse and validate OAuth-only environment configuration.
- Create `src/config-store.ts`: read and write OAuth secrets through system keyring and non-secret URL overrides through local config.
- Create `src/cli.ts`: implement `auth save` for env-free local setup.
- Create `src/inoreader/oauth.ts`: exchange refresh tokens, decode responses, and cache access tokens.
- Modify `src/inoreader/client.ts`: replace config-owned static tokens with an access-token provider.
- Modify `src/server.ts`: construct the OAuth provider and update status metadata.
- Modify `test/config.test.ts`: cover required OAuth env and token URL validation.
- Create `test/config-store.test.ts`: cover keyring-based credential loading, env overrides, and non-secret private JSON writes.
- Create `test/cli.test.ts`: cover the one-time credential save command.
- Create `test/inoreader-oauth.test.ts`: cover refresh request shape, caching, and auth failures.
- Modify `test/inoreader-client.test.ts`: cover OAuth-derived authorization headers and provider failures.
- Modify `test/server.test.ts`: cover OAuth status shape and test fixtures.
- Modify `README.md`: document OAuth-only setup for Codex and OpenCode.

## Tasks

### Task 1: OAuth-Only Config Tests

**Files:**
- Modify: `test/config.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that expect `INOREADER_CLIENT_ID`, `INOREADER_CLIENT_SECRET`, and `INOREADER_REFRESH_TOKEN` to be required, and `INOREADER_OAUTH_TOKEN_URL` to be validated.

- [ ] **Step 2: Run red check**

Run: `pnpm test test/config.test.ts`
Expected: tests fail because config still accepts missing OAuth credentials and still exposes `inoreaderAccessToken`.

### Task 2: OAuth Provider Tests

**Files:**
- Create: `test/inoreader-oauth.test.ts`

- [ ] **Step 1: Write failing tests**

Cover refresh request body, access-token caching, and non-2xx token endpoint failures.

- [ ] **Step 2: Run red check**

Run: `pnpm test test/inoreader-oauth.test.ts`
Expected: tests fail because `src/inoreader/oauth.ts` does not exist yet.

### Task 3: Client And Server Regression Tests

**Files:**
- Modify: `test/inoreader-client.test.ts`
- Modify: `test/server.test.ts`

- [ ] **Step 1: Write failing tests**

Update client fixtures to pass an access-token provider, assert the bearer header uses that provider value, and assert provider failure maps to `InoreaderAuthError`. Update server status expectations to report OAuth configuration.

- [ ] **Step 2: Run red check**

Run: `pnpm test test/inoreader-client.test.ts test/server.test.ts`
Expected: tests fail because production code still expects `inoreaderAccessToken`.

### Task 4: Implement Config And OAuth Provider

**Files:**
- Modify: `src/config.ts`
- Create: `src/inoreader/oauth.ts`

- [ ] **Step 1: Implement config shape**

Replace static token config with OAuth fields and token URL validation.

- [ ] **Step 2: Implement token provider**

Use Effect to POST form-encoded refresh-token requests, decode `access_token` and `expires_in`, cache with an expiry skew, and map token failures to `InoreaderAuthError`.

- [ ] **Step 3: Run focused tests**

Run: `pnpm test test/config.test.ts test/inoreader-oauth.test.ts`
Expected: config and OAuth provider tests pass.

### Task 5: Wire Client And Server

**Files:**
- Modify: `src/inoreader/client.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Change client constructor**

Make `createInoreaderClient` receive an access-token provider and call it before each request.

- [ ] **Step 2: Change server construction**

Create the OAuth token provider in `createInoreaderMcpServer` when no test client is supplied, and update status output fields.

- [ ] **Step 3: Run focused tests**

Run: `pnpm test test/inoreader-client.test.ts test/server.test.ts`
Expected: client and server tests pass.

### Task 6: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace static-token setup**

Document `INOREADER_CLIENT_ID`, `INOREADER_CLIENT_SECRET`, `INOREADER_REFRESH_TOKEN`, optional `INOREADER_API_BASE_URL`, and optional `INOREADER_OAUTH_TOKEN_URL`.

- [ ] **Step 2: Verify token wording**

Run: `rg -n "INOREADER_ACCESS_TOKEN|access token configured|static token" README.md src test docs/superpowers/specs/2026-05-16-inoreader-oauth-only-mcp-design.md`
Expected: no stale static-token setup remains outside older historical docs.

### Task 7: Full Verification

**Files:**
- All changed files

- [ ] **Step 1: Run checks**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all commands exit 0.

- [ ] **Step 2: Inspect git diff**

Run: `git diff -- src test README.md docs/superpowers`
Expected: diff only contains OAuth-only MCP changes.
