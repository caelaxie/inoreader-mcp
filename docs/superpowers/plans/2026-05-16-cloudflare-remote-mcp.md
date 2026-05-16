# Cloudflare Remote MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Inoreader MCP to a Cloudflare-hosted remote MCP server only.

**Architecture:** Expose `/mcp` from a Cloudflare Worker using `agents/mcp`. Store Inoreader OAuth token state in a Durable Object; read the Inoreader App ID and App key from Worker secrets.

**Tech Stack:** Cloudflare Workers, Durable Objects, Cloudflare Agents `createMcpHandler`, TypeScript, Vitest.

---

## Dependency Graph

- `T1`: Add Worker dependencies, Wrangler config, and Worker entrypoint. `depends_on: []`
- `T2`: Add Durable Object token storage for pending OAuth state, refresh token, access token, and expiry. `depends_on: [T1]`
- `T3`: Expose `/setup`, `/authorize`, and `/callback` for Inoreader OAuth. `depends_on: [T2]`
- `T4`: Expose `/mcp` and wire tools to read access tokens from the Durable Object. `depends_on: [T2]`
- `T5`: Remove stdio/keyring CLI runtime and update docs. `depends_on: [T3, T4]`
- `T6`: Verify lint, typecheck, tests, and Worker build. `depends_on: [T5]`
