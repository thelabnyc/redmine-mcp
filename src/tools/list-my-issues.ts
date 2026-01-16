import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

import type { RedmineClient } from "../redmine.js";

export function registerListMyIssuesTool(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "list-my-issues",
        {
            title: "List My Redmine Issues",
            description: `List all Redmine issues assigned to the current user.
            Results are paginated - use limit and offset to fetch more.
            IMPORTANT: When the user asks for issues for "this project" or similar:
            1. First check the project's CLAUDE.md for a Redmine or Planio project
               mapping (e.g., "Redmine Project ID: 154" or "Planio Project: my-project")
            2. If no mapping exists, DO NOT guess the project ID from folder/repo names
            3. Instead, inform the user that no Redmine/Planio project is configured for
               this codebase and suggest they add it to CLAUDE.md
            4. Offer to list all assigned issues instead, but wait for confirmation
            IMPORTANT: Always present results directly in your response text so the user
            can see them without expanding tool output.`,
            inputSchema: {
                statusId: z
                    .union([z.number(), z.enum(["open", "closed", "*"])])
                    .optional()
                    .describe(
                        "Filter by status: a status ID, 'open' for open issues, 'closed' for closed issues, or '*' for all (Redmine defaults to open when not specified)",
                    ),
                projectId: z
                    .union([z.string(), z.number()])
                    .optional()
                    .describe(
                        "Filter by project ID or identifier (e.g., 'my-project' or 154)",
                    ),
                limit: z
                    .number()
                    .optional()
                    .describe(
                        "Maximum number of issues to return (default 25)",
                    ),
                offset: z
                    .number()
                    .optional()
                    .describe("Number of issues to skip for pagination"),
                sort: z
                    .string()
                    .optional()
                    .describe(
                        "Sort field and direction, e.g., 'priority:desc', 'updated_on:desc', 'due_date:asc' (default: priority:desc,updated_on:desc)",
                    ),
            },
        },
        async ({ statusId, projectId, limit, offset, sort }) => {
            try {
                const result = await redmineClient.listMyIssues({
                    statusId,
                    projectId,
                    limit,
                    offset,
                    sort,
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
                            text: `Error listing issues: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
