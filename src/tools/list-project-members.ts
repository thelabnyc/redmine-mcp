import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

import type { RedmineClient } from "../redmine.js";

export function registerListProjectMembersTool(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "list-project-members",
        {
            title: "List Project Members",
            description:
                "List all members of a Redmine project. Returns users and groups with their roles. Use this to find user IDs for assigning issues.",
            inputSchema: {
                projectId: z
                    .string()
                    .describe(
                        "Project ID or identifier (e.g., 'my-project' or '1')",
                    ),
                limit: z
                    .number()
                    .optional()
                    .describe(
                        "Maximum number of members to return (default 25)",
                    ),
                offset: z
                    .number()
                    .optional()
                    .describe("Number of members to skip for pagination"),
            },
        },
        async ({ projectId, limit, offset }) => {
            try {
                const result = await redmineClient.listProjectMembers(
                    projectId,
                    {
                        limit,
                        offset,
                    },
                );

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
                            text: `Error listing project members: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
