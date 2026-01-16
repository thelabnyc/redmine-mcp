import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

import type { RedmineClient } from "../redmine.js";

export function registerListProjectsTool(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "list-projects",
        {
            title: "List Redmine Projects",
            description: `List all Redmine/Planio projects the user has access to.
            Returns project ID, identifier (slug), and name. Use this to find project
            IDs for filtering issues or to help users set up CLAUDE.md project mappings.
            IMPORTANT: Always present results directly in your response text so the
            user can see them without expanding tool output. If the user asks for
            specific projects (e.g., "list sks projects"), filter the results to show
            only matching projects.`,
            inputSchema: {
                limit: z
                    .number()
                    .optional()
                    .describe(
                        "Maximum number of projects to return (default 100)",
                    ),
                offset: z
                    .number()
                    .optional()
                    .describe("Number of projects to skip for pagination"),
            },
        },
        async ({ limit, offset }) => {
            try {
                const result = await redmineClient.listProjects({
                    limit: limit ?? 100,
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
                            text: `Error listing projects: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
