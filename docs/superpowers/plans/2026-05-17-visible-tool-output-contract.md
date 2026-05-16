# Visible Tool Output Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every successful Inoreader MCP tool response include the actual payload in visible `content` while preserving existing `structuredContent` and `outputSchema`.

**Architecture:** Update the central `successResult(message, payload)` helper in `src/server.ts` so all tools automatically return self-sufficient text content. Keep error handling and per-tool registration unchanged. Update server tests to prove read, write, and status tools include visible JSON while structured payloads remain unchanged.

**Tech Stack:** TypeScript, MCP TypeScript SDK `CallToolResult`, Effect, Zod v4, Vitest, pnpm.

---

## File Structure

- Modify: `src/server.ts`
  - Responsibility: central MCP tool registration and shared success/error response formatting.
- Modify: `test/server.test.ts`
  - Responsibility: regression coverage for MCP tool metadata and response contracts.

## Dependency Graph

- `T1`: Add failing tests for visible successful payloads. `depends_on: []`
- `T2`: Implement central visible payload formatting. `depends_on: [T1]`
- `T3`: Verify focused and full checks. `depends_on: [T2]`
- `T4`: Commit implementation. `depends_on: [T3]`

### Task 1: Add Response Contract Regression Tests

**Files:**
- Modify: `test/server.test.ts`

- [ ] **Step 1: Update the successful write-tool assertion**

Replace the existing `returns concise text and structured content for successful write tool calls` test body with:

```ts
  it("returns visible payload text and structured content for successful write tool calls", async () => {
    const server = createInoreaderMcpServer(config, { client: makeFakeClient() });

    const tool = server.registeredTools.find(
      ({ name }) => name === "inoreader_star_article"
    );

    const result = await tool?.handler({ itemIds: ["item-1"] });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: 'Starred Inoreader article items.\n\n{\n  "ok": true\n}'
        }
      ],
      structuredContent: { ok: true }
    });
  });
```

- [ ] **Step 2: Update the successful read-tool assertion**

Replace the existing `returns concise text and structured content for successful tool calls` test body with:

```ts
  it("returns visible payload text and structured content for successful read tool calls", async () => {
    const server = createInoreaderMcpServer(config, { client: makeFakeClient() });

    const tool = server.registeredTools.find(
      ({ name }) => name === "inoreader_get_user_info"
    );

    const result = await tool?.handler({});

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text:
            'Fetched authenticated Inoreader user info.\n\n{\n  "userId": "1001921515",\n  "userName": "reader",\n  "userProfileId": "1001921515",\n  "userEmail": "reader@example.test",\n  "isBloggerUser": false,\n  "signupTimeSec": 1163850013,\n  "isMultiLoginEnabled": false\n}'
        }
      ],
      structuredContent: {
        userId: "1001921515",
        userName: "reader",
        userProfileId: "1001921515",
        userEmail: "reader@example.test",
        isBloggerUser: false,
        signupTimeSec: 1163850013,
        isMultiLoginEnabled: false
      }
    });
  });
```

- [ ] **Step 3: Update the status-tool assertion**

Replace the expected result in `reports OAuth configuration in the status tool` with:

```ts
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text:
            'Inoreader MCP server configuration loaded.\n\n{\n  "ok": true,\n  "service": "inoreader-mcp",\n  "inoreaderApiBaseUrl": "https://www.inoreader.com/reader/api/0",\n  "inoreaderOAuthConfigured": true\n}'
        }
      ],
      structuredContent: {
        ok: true,
        service: "inoreader-mcp",
        inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0",
        inoreaderOAuthConfigured: true
      }
    });
```

- [ ] **Step 4: Run focused server tests and confirm they fail**

Run:

```bash
pnpm vitest run test/server.test.ts
```

Expected: FAIL because `content[0].text` still contains only the concise success message without JSON payload text.

### Task 2: Implement Central Visible Payload Formatting

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Add a shared payload formatter**

Insert this helper immediately before `successResult`:

```ts
  const formatPayload = (payload: Record<string, unknown>): string => {
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  };
```

- [ ] **Step 2: Update `successResult` to append payload JSON**

Replace the current `successResult` implementation with:

```ts
  const successResult = (
    message: string,
    payload: Record<string, unknown>
  ): CallToolResult => ({
    content: [
      {
        type: "text" as const,
        text: `${message}\n\n${formatPayload(payload)}`
      }
    ],
    structuredContent: payload
  });
```

- [ ] **Step 3: Run focused server tests and confirm they pass**

Run:

```bash
pnpm vitest run test/server.test.ts
```

Expected: PASS.

### Task 3: Run Verification

**Files:**
- No additional file changes.

- [ ] **Step 1: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
pnpm build
```

Expected: PASS.

### Task 4: Commit Implementation

**Files:**
- Modify: `src/server.ts`
- Modify: `test/server.test.ts`

- [ ] **Step 1: Review final diff**

Run:

```bash
git diff -- src/server.ts test/server.test.ts
```

Expected: Diff only changes central success response formatting and server response-contract tests.

- [ ] **Step 2: Check staged diff hygiene**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add src/server.ts test/server.test.ts
git commit -m "fix: include payloads in visible tool output"
```

Expected: commit succeeds with only implementation and test files staged.
