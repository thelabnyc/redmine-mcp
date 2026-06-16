import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

import type { CreateIssueData, RedmineClient } from "../redmine.js";

export function registerCreateIssueTool(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "create-issue",
        {
            title: "Create Redmine Issue",
            description:
                "Create a new Redmine issue. Requires projectId and subject. Use list-trackers, list-issue-priorities, list-issue-statuses, list-project-versions, list-project-issue-categories, and list-project-custom-fields to discover valid field values first. IMPORTANT: Before calling this tool, you MUST present the user with a summary of all the issue fields you plan to set and get their explicit confirmation before proceeding. Use human-readable labels (e.g. 'Priority: High', 'Tracker: Bug') in the summary, not raw numeric IDs.",
            inputSchema: {
                projectId: z
                    .union([z.string(), z.number()])
                    .describe("Project identifier (string slug or numeric ID)"),
                subject: z.string().describe("Issue subject/title"),
                description: z
                    .string()
                    .optional()
                    .describe("Issue description"),
                statusId: z.number().optional().describe("Status ID to set"),
                priorityId: z
                    .number()
                    .optional()
                    .describe("Priority ID to set"),
                assignedToId: z
                    .number()
                    .optional()
                    .describe("User ID to assign"),
                trackerId: z.number().optional().describe("Tracker ID to set"),
                parentIssueId: z
                    .number()
                    .optional()
                    .describe("Parent issue ID"),
                fixedVersionId: z
                    .number()
                    .optional()
                    .describe("Fixed version ID to set"),
                categoryId: z
                    .number()
                    .optional()
                    .describe("Issue category ID to set"),
                startDate: z
                    .string()
                    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
                    .optional()
                    .describe("Start date (YYYY-MM-DD format)"),
                dueDate: z
                    .string()
                    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
                    .optional()
                    .describe("Due date (YYYY-MM-DD format)"),
                doneRatio: z
                    .number()
                    .min(0)
                    .max(100)
                    .optional()
                    .describe("Percent done (0-100)"),
                estimatedHours: z
                    .number()
                    .optional()
                    .describe("Estimated hours for the issue"),
                isPrivate: z
                    .boolean()
                    .optional()
                    .describe("Whether the issue is private"),
                watcherUserIds: z
                    .array(z.number().int().positive())
                    .optional()
                    .describe("User IDs to add as issue watchers"),
                customFields: z
                    .array(
                        z.object({
                            id: z.number().describe("Custom field ID"),
                            value: z
                                .union([z.string(), z.array(z.string())])
                                .describe(
                                    "Field value (string, or array for multi-value fields)",
                                ),
                        }),
                    )
                    .optional()
                    .describe(
                        "Custom field values. Use list-project-custom-fields to discover available fields.",
                    ),
            },
        },
        async ({
            projectId,
            subject,
            description,
            statusId,
            priorityId,
            assignedToId,
            trackerId,
            parentIssueId,
            fixedVersionId,
            categoryId,
            startDate,
            dueDate,
            doneRatio,
            estimatedHours,
            isPrivate,
            watcherUserIds,
            customFields,
        }) => {
            try {
                const createData: CreateIssueData = {
                    project_id: projectId,
                    subject,
                };
                if (description !== undefined)
                    createData.description = description;
                if (statusId !== undefined) createData.status_id = statusId;
                if (priorityId !== undefined)
                    createData.priority_id = priorityId;
                if (assignedToId !== undefined)
                    createData.assigned_to_id = assignedToId;
                if (trackerId !== undefined) createData.tracker_id = trackerId;
                if (parentIssueId !== undefined)
                    createData.parent_issue_id = parentIssueId;
                if (fixedVersionId !== undefined)
                    createData.fixed_version_id = fixedVersionId;
                if (categoryId !== undefined)
                    createData.category_id = categoryId;
                if (startDate !== undefined) createData.start_date = startDate;
                if (dueDate !== undefined) createData.due_date = dueDate;
                if (doneRatio !== undefined) createData.done_ratio = doneRatio;
                if (estimatedHours !== undefined)
                    createData.estimated_hours = estimatedHours;
                if (isPrivate !== undefined) createData.is_private = isPrivate;
                if (watcherUserIds !== undefined)
                    createData.watcher_user_ids = watcherUserIds;
                if (customFields !== undefined)
                    createData.custom_fields = customFields;

                const result = await redmineClient.createIssue(createData);

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
                            text: `Error creating issue: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
