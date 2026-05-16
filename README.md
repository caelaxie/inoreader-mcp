# inoreader-mcp

Local MCP server for Inoreader.

## Setup

```bash
pnpm install
pnpm build
```

## Run

```bash
pnpm dev
```

The server uses MCP stdio transport, so MCP clients should run the built binary:

```bash
pnpm build
node dist/index.js
```

Optional environment:

```bash
INOREADER_API_BASE_URL=https://www.inoreader.com/reader/api/0
```

## Scripts

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Current Tools

- `inoreader_status`: reports the configured Inoreader API base URL and confirms the local server can register tools.
