import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

import type { RedmineClient } from "../redmine.js";

export function registerGetIssueTool(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "get-issue",
        {
            title: "Get Redmine Issue",
            description:
                "Fetch details about a Redmine issue by ID. Returns issue information including subject, description, status, priority, assignee, and change history (journals).",
            inputSchema: {
                issueId: z
                    .string()
                    .describe("Issue ID (e.g., '#12345' or '12345')"),
                includeAttachments: z
                    .boolean()
                    .optional()
                    .describe("Include file attachments"),
                includeWatchers: z
                    .boolean()
                    .optional()
                    .describe("Include watchers list"),
                includeRelations: z
                    .boolean()
                    .optional()
                    .describe("Include related issues"),
                includeChildren: z
                    .boolean()
                    .optional()
                    .describe("Include child issues"),
            },
        },
        async ({
            issueId,
            includeAttachments,
            includeWatchers,
            includeRelations,
            includeChildren,
        }) => {
            try {
                // Strip # prefix if present and parse as number
                const cleanId = issueId.replace(/^#/, "");
                const numericId = parseInt(cleanId, 10);

                if (isNaN(numericId)) {
                    return {
                        isError: true,
                        content: [
                            {
                                type: "text" as const,
                                text: `Invalid issue ID: ${issueId}`,
                            },
                        ],
                    };
                }

                const issue = await redmineClient.getIssue(numericId, {
                    includeAttachments,
                    includeWatchers,
                    includeRelations,
                    includeChildren,
                });

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(issue, null, 2),
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
                            text: `Error fetching issue: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
