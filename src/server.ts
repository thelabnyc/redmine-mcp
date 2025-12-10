import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { getConfig } from "./config.js";
import { RedmineClient } from "./redmine.js";
import { registerAllTools } from "./tools/index.js";

/**
 * Creates and configures the Redmine MCP server instance
 */
export function createServer(): McpServer {
    const config = getConfig();
    const redmineClient = new RedmineClient(config);

    const server = new McpServer({
        name: "redmine-mcp",
        version: "1.0.0",
    });

    registerAllTools(server, redmineClient);

    return server;
}

/**
 * Starts the MCP server with stdio transport
 */
export async function startServer(): Promise<void> {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
