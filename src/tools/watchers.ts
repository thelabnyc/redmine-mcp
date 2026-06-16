import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

import type { RedmineClient } from "../redmine.js";
import { parseIssueId } from "./utils.js";

const issueIdInputSchema = z.union([z.string(), z.number().int().positive()]);
const userIdSchema = z.number().int().positive().describe("Redmine user ID");

export function registerWatcherTools(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "add-issue-watcher",
        {
            title: "Add Redmine Issue Watcher",
            description:
                "Add a watcher to a Redmine issue. IMPORTANT: Before calling this tool, you MUST present the user with the target issue and watcher user you plan to add and get their explicit confirmation.",
            inputSchema: {
                issueId: issueIdInputSchema.describe(
                    "Issue ID (e.g., '#12345', '12345', or 12345)",
                ),
                userId: userIdSchema,
            },
        },
        async ({ issueId, userId }) => {
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

                await redmineClient.addIssueWatcher(parsed.numericId, userId);

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                {
                                    added: true,
                                    issueId: parsed.numericId,
                                    userId,
                                },
                                null,
                                2,
                            ),
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
                            text: `Error adding issue watcher: ${message}`,
                        },
                    ],
                };
            }
        },
    );

    server.registerTool(
        "remove-issue-watcher",
        {
            title: "Remove Redmine Issue Watcher",
            description:
                "Remove a watcher from a Redmine issue. IMPORTANT: Before calling this tool, you MUST present the user with the target issue and watcher user you plan to remove and get their explicit confirmation.",
            inputSchema: {
                issueId: issueIdInputSchema.describe(
                    "Issue ID (e.g., '#12345', '12345', or 12345)",
                ),
                userId: userIdSchema,
            },
        },
        async ({ issueId, userId }) => {
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

                await redmineClient.removeIssueWatcher(
                    parsed.numericId,
                    userId,
                );

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                {
                                    removed: true,
                                    issueId: parsed.numericId,
                                    userId,
                                },
                                null,
                                2,
                            ),
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
                            text: `Error removing issue watcher: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
