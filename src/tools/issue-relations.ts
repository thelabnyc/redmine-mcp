import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

import type { CreateIssueRelationData, RedmineClient } from "../redmine.js";
import { relationTypes } from "../redmine.js";
import { parseIssueId } from "./utils.js";

const relationTypeSchema = z.enum(relationTypes);
const issueIdInputSchema = z.union([z.string(), z.number().int().positive()]);

export function registerIssueRelationTools(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "list-issue-relations",
        {
            title: "List Redmine Issue Relations",
            description:
                "List relation records for a Redmine issue. Use this to inspect links such as relates, blocks, duplicates, precedes, and follows.",
            inputSchema: {
                issueId: issueIdInputSchema.describe(
                    "Source issue ID (e.g., '#12345', '12345', or 12345)",
                ),
            },
        },
        async ({ issueId }) => {
            try {
                const parsed = parseIssueId(String(issueId));
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

                const relations = await redmineClient.listIssueRelations(
                    parsed.numericId,
                );

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(relations, null, 2),
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
                            text: `Error listing issue relations: ${message}`,
                        },
                    ],
                };
            }
        },
    );

    server.registerTool(
        "get-issue-relation",
        {
            title: "Get Redmine Issue Relation",
            description:
                "Fetch one Redmine issue relation record by relation ID when you already know the relation ID. Use list-issue-relations first to discover relation IDs for a source issue.",
            inputSchema: {
                relationId: z
                    .number()
                    .int()
                    .positive()
                    .describe("Relation record ID"),
            },
        },
        async ({ relationId }) => {
            try {
                const relation =
                    await redmineClient.getIssueRelation(relationId);

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(relation, null, 2),
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
                            text: `Error fetching issue relation: ${message}`,
                        },
                    ],
                };
            }
        },
    );

    server.registerTool(
        "create-issue-relation",
        {
            title: "Create Redmine Issue Relation",
            description:
                "Create a Redmine issue relation. IMPORTANT: Before calling this tool, you MUST present the user with the source issue, target issue, relation type, and delay you plan to set and get their explicit confirmation. Creates one relation record only; for multiple targets, call this tool once per target.",
            inputSchema: {
                issueId: issueIdInputSchema.describe(
                    "Source/from issue ID (e.g., '#12345', '12345', or 12345)",
                ),
                issueToId: issueIdInputSchema.describe(
                    "Target/to related issue ID (e.g., '#12345', '12345', or 12345)",
                ),
                relationType: relationTypeSchema
                    .optional()
                    .describe(
                        "Relation type. Defaults to 'relates' when omitted.",
                    ),
                delay: z
                    .number()
                    .int()
                    .nonnegative()
                    .optional()
                    .describe(
                        "Delay in days for 'precedes' or 'follows' relations",
                    ),
            },
        },
        async ({ issueId, issueToId, relationType, delay }) => {
            try {
                const parsed = parseIssueId(String(issueId));
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

                const parsedTarget = parseIssueId(String(issueToId));
                if (!parsedTarget.success) {
                    return {
                        isError: true,
                        content: [
                            {
                                type: "text" as const,
                                text: parsedTarget.error,
                            },
                        ],
                    };
                }

                const relationData: CreateIssueRelationData = {
                    issue_to_id: parsedTarget.numericId,
                };
                if (relationType !== undefined) {
                    relationData.relation_type = relationType;
                }
                if (delay !== undefined) {
                    relationData.delay = delay;
                }

                const relation = await redmineClient.createIssueRelation(
                    parsed.numericId,
                    relationData,
                );

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(relation, null, 2),
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
                            text: `Error creating issue relation: ${message}`,
                        },
                    ],
                };
            }
        },
    );

    server.registerTool(
        "delete-issue-relation",
        {
            title: "Delete Redmine Issue Relation",
            description:
                "Delete a Redmine issue relation record by relation ID. IMPORTANT: Before calling this tool, you MUST present the user with the relation ID and relation details you plan to delete and get their explicit confirmation.",
            inputSchema: {
                relationId: z
                    .number()
                    .int()
                    .positive()
                    .describe("Relation record ID to delete"),
            },
        },
        async ({ relationId }) => {
            try {
                await redmineClient.deleteIssueRelation(relationId);

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                { deleted: true, relationId },
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
                            text: `Error deleting issue relation: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
