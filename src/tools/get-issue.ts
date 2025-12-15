import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

import type { RedmineClient } from "../redmine.js";
import { parseIssueId } from "./utils.js";

export function registerGetIssueTool(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "get-issue",
        {
            title: "Get Redmine Issue",
            description:
                "Fetch details about a Redmine issue by ID. Returns issue information including subject, description, status, priority, assignee, and change history (journals). Journals are paginated - use journalLimit and journalOffset to fetch more. IMPORTANT: Keep journalLimit at 10 or less to avoid response truncation. Fetch journals in small batches.",
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
                journalLimit: z
                    .number()
                    .optional()
                    .describe(
                        "Maximum number of journal entries to return (default 5)",
                    ),
                journalOffset: z
                    .number()
                    .optional()
                    .describe(
                        "Number of journal entries to skip for pagination (default 0)",
                    ),
            },
        },
        async ({
            issueId,
            includeAttachments,
            includeWatchers,
            includeRelations,
            includeChildren,
            journalLimit,
            journalOffset,
        }) => {
            try {
                const parsed = parseIssueId(issueId);
                if (!parsed.success) {
                    return {
                        isError: true,
                        content: [
                            {
                                type: "text" as const,
                                text: parsed.error,
                            },
                        ],
                    };
                }

                const result = await redmineClient.getIssue(parsed.numericId, {
                    includeAttachments,
                    includeWatchers,
                    includeRelations,
                    includeChildren,
                    journalLimit,
                    journalOffset,
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
                            text: `Error fetching issue: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
