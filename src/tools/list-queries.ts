import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

import type { RedmineClient } from "../redmine.js";

export function registerListQueriesTool(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "list-queries",
        {
            title: "List Saved Queries",
            description:
                "List saved Redmine issue queries visible to the current user. Returns query IDs, names, visibility, optional project IDs, and pagination metadata.",
            inputSchema: {
                limit: z
                    .number()
                    .optional()
                    .describe("Maximum number of saved queries to return"),
                offset: z
                    .number()
                    .optional()
                    .describe("Number of saved queries to skip"),
            },
        },
        async ({ limit, offset }) => {
            try {
                const result = await redmineClient.listQueries({
                    limit,
                    offset,
                });

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                return {
                    isError: true,
                    content: [
                        {
                            type: "text" as const,
                            text: `Error listing queries: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
