# Agent Instructions

This file provides guidance to coding agents working in this repository.

## Build Commands

```bash
npm run build      # Compile TypeScript to dist/
npm run lint       # Run ESLint
npm test           # Run tests with vitest
npm run test:watch # Run tests in watch mode
```

## Architecture

This is an MCP (Model Context Protocol) server that allows AI agents to interact with Redmine. It uses the `@modelcontextprotocol/sdk` to expose tools that fetch Redmine data via the REST API.

### Source Structure

- `src/cli.ts` - CLI entry point, runs the MCP server via stdio transport
- `src/server.ts` - MCP server setup and tool registration
- `src/redmine.ts` - `RedmineClient` class with typed interfaces for Redmine API responses
- `src/config.ts` - Configuration from environment variables (`REDMINE_URL`, `REDMINE_API_KEY`)
- `src/tools/` - Individual MCP tool registration modules
- `src/index.ts` - Public API exports for library usage

### Testing Approach

Tests use vitest with in-memory MCP transports. The pattern creates a linked client-server pair using `InMemoryTransport.createLinkedPair()` and mocks the global `fetch` to simulate Redmine API responses.

### Adding New MCP Tools

Register tools in a focused module under `src/tools/` using `server.registerTool()` with:

1. Tool name
2. Tool metadata, including title, description, and `inputSchema` using Zod
3. Handler function returning `{ content: [...] }` or `{ isError: true, content: [...] }`

Export the registration function from `src/tools/index.ts` and call it from `registerAllTools()`.
