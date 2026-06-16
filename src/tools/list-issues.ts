import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

import type { RedmineClient } from "../redmine.js";

export function registerListIssuesTool(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "list-issues",
        {
            title: "List Redmine Issues",
            description:
                "List Redmine issues with optional filters. Returns full issue objects from Redmine plus pagination metadata. Use list-queries to discover saved query IDs for queryId.",
            inputSchema: {
                issueIds: z
                    .array(z.union([z.string(), z.number()]))
                    .optional()
                    .describe(
                        "Filter by issue IDs. Strings may include a leading #, e.g. '#123'.",
                    ),
                projectId: z
                    .union([z.string(), z.number()])
                    .optional()
                    .describe(
                        "Filter by project ID or identifier (e.g., 'my-project' or 154)",
                    ),
                trackerId: z
                    .number()
                    .optional()
                    .describe("Filter by tracker ID"),
                statusId: z
                    .union([z.number(), z.enum(["open", "closed", "*"])])
                    .optional()
                    .describe(
                        "Filter by status: a status ID, 'open', 'closed', or '*' for all",
                    ),
                assignedToId: z
                    .union([z.number(), z.literal("me")])
                    .optional()
                    .describe("Filter by assignee user ID, or 'me'"),
                parentId: z
                    .number()
                    .optional()
                    .describe("Filter by parent issue ID"),
                createdOn: z
                    .string()
                    .optional()
                    .describe("Filter by Redmine created_on expression"),
                updatedOn: z
                    .string()
                    .optional()
                    .describe("Filter by Redmine updated_on expression"),
                customFields: z
                    .array(z.object({ id: z.number(), value: z.string() }))
                    .optional()
                    .describe(
                        "Filter by custom fields. Each item becomes cf_<id>=value.",
                    ),
                queryId: z
                    .number()
                    .optional()
                    .describe(
                        "Saved query ID. Use list-queries to discover available IDs.",
                    ),
                includeAttachments: z
                    .boolean()
                    .optional()
                    .describe("Include issue attachments"),
                includeRelations: z
                    .boolean()
                    .optional()
                    .describe("Include issue relations"),
                sort: z
                    .string()
                    .optional()
                    .describe(
                        "Sort field and direction, e.g. 'updated_on:desc'",
                    ),
                limit: z
                    .number()
                    .optional()
                    .describe("Maximum number of issues to return"),
                offset: z
                    .number()
                    .optional()
                    .describe("Number of issues to skip for pagination"),
            },
        },
        async ({
            issueIds,
            projectId,
            trackerId,
            statusId,
            assignedToId,
            parentId,
            createdOn,
            updatedOn,
            customFields,
            queryId,
            includeAttachments,
            includeRelations,
            sort,
            limit,
            offset,
        }) => {
            try {
                const result = await redmineClient.listIssues({
                    issueIds,
                    projectId,
                    trackerId,
                    statusId,
                    assignedToId,
                    parentId,
                    createdOn,
                    updatedOn,
                    customFields,
                    queryId,
                    includeAttachments,
                    includeRelations,
                    sort,
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
                            text: `Error listing issues: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
