# Inoreader MCP Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap a local TypeScript MCP server for Inoreader with Effect-based configuration and executable verification.

**Architecture:** The repo exposes a stdio MCP entrypoint from `src/index.ts`. Configuration lives in `src/config.ts`, and MCP tool registration lives in `src/server.ts` so future Inoreader API tools can be added without coupling to process startup.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, Effect, Zod, Vitest, tsup, ESLint, pnpm.

---

## Dependency Graph

```text
T1: Install runtime and dev dependencies -> depends_on: [] -> verify: package.json and pnpm-lock.yaml contain the selected dependencies
T2: Add TypeScript/build/test config -> depends_on: [T1] -> verify: config files are present and scripts resolve
T3: Add failing smoke tests -> depends_on: [T2] -> verify: pnpm test fails because src/config.ts and src/server.ts are absent
T4: Implement MCP server scaffold -> depends_on: [T3] -> verify: pnpm test passes
T5: Add README and ignore/build hygiene -> depends_on: [T4] -> verify: README commands match package scripts and generated paths are ignored
T6: Run full verification -> depends_on: [T1, T2, T3, T4, T5] -> verify: pnpm lint, pnpm typecheck, pnpm test, and pnpm build pass
```

### Task T1: Dependencies

**Files:**
- Modify: `package.json`
- Create: `pnpm-lock.yaml`

- [x] Add runtime dependencies: `@modelcontextprotocol/sdk`, `effect`, and `zod`.
- [x] Add dev dependencies: `typescript`, `tsx`, `tsup`, `vitest`, `@types/node`, `eslint`, `@eslint/js`, and `typescript-eslint`.

### Task T2: Project Config

**Files:**
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `eslint.config.js`
- Modify: `package.json`

- [x] Configure ESM TypeScript for Node 24 with strict checking.
- [x] Add scripts for `build`, `dev`, `lint`, `test`, and `typecheck`.

### Task T3: Smoke Tests

**Files:**
- Create: `test/config.test.ts`
- Create: `test/server.test.ts`

- [x] Test config defaults, explicit API base URL, and invalid API base URL rejection.
- [x] Test server metadata and the initial `inoreader_status` tool registration.
- [x] Run `pnpm test` and confirm the suite fails before implementation because source modules are missing.

### Task T4: MCP Scaffold

**Files:**
- Create: `src/config.ts`
- Create: `src/server.ts`
- Create: `src/index.ts`

- [x] Implement Effect-based configuration loading and URL validation.
- [x] Register an MCP stdio server with the `inoreader_status` smoke tool.
- [x] Add a Node executable entrypoint that connects `StdioServerTransport`.

### Task T5: Documentation And Hygiene

**Files:**
- Modify: `.gitignore`
- Create: `README.md`

- [x] Ignore `node_modules`, `dist`, and `coverage`.
- [x] Document setup, run commands, verification scripts, and the current smoke tool.

### Task T6: Verification

**Files:**
- All changed files.

- [x] Run `pnpm lint`.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm test`.
- [x] Run `pnpm build`.
