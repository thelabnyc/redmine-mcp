import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

import type { RedmineClient, UpdateIssueData } from "../redmine.js";
import { parseIssueId } from "./utils.js";

export function registerUpdateIssueTool(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "update-issue",
        {
            title: "Update Redmine Issue",
            description:
                "Update a Redmine issue. Can update fields like status, assignee, fixed version, category, add notes, and optionally log time spent. All parameters except issueId are optional. Use list-trackers, list-issue-priorities, list-issue-statuses, list-project-versions, list-project-issue-categories, and list-project-custom-fields to discover valid field values first. IMPORTANT: Before calling this tool, you MUST present the user with a summary of all issue fields you plan to change and get their explicit confirmation before proceeding. Use human-readable labels (e.g. 'Status: In Progress', 'Fixed version: 1.0.0') in the summary, not raw numeric IDs.",
            inputSchema: {
                issueId: z
                    .string()
                    .describe("Issue ID (e.g., '#12345' or '12345')"),
                // Issue fields
                subject: z
                    .string()
                    .optional()
                    .describe("New issue subject/title"),
                description: z
                    .string()
                    .optional()
                    .describe("New issue description"),
                statusId: z.number().optional().describe("Status ID to set"),
                priorityId: z
                    .number()
                    .optional()
                    .describe("Priority ID to set"),
                assignedToId: z
                    .number()
                    .optional()
                    .describe("User ID to assign (use 0 to unassign)"),
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
                notes: z
                    .string()
                    .optional()
                    .describe("Comment/note to add to the issue journal"),
                privateNotes: z
                    .boolean()
                    .optional()
                    .describe("Make the notes private (default false)"),
                // Time logging
                logHours: z
                    .number()
                    .optional()
                    .describe("Hours to log as a time entry"),
                logActivityId: z
                    .number()
                    .optional()
                    .describe(
                        "Activity ID for time entry (uses default activity if omitted)",
                    ),
                logComments: z
                    .string()
                    .optional()
                    .describe("Comments for the time entry"),
                logSpentOn: z
                    .string()
                    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
                    .optional()
                    .describe(
                        "Date for time entry (YYYY-MM-DD, defaults to today)",
                    ),
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
            issueId,
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
            notes,
            privateNotes,
            logHours,
            logActivityId,
            logComments,
            logSpentOn,
            customFields,
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
                const numericId = parsed.numericId;

                // Build update data (convert camelCase to snake_case)
                const updateData: UpdateIssueData = {};
                if (subject !== undefined) updateData.subject = subject;
                if (description !== undefined)
                    updateData.description = description;
                if (statusId !== undefined) updateData.status_id = statusId;
                if (priorityId !== undefined)
                    updateData.priority_id = priorityId;
                if (assignedToId !== undefined)
                    updateData.assigned_to_id = assignedToId;
                if (trackerId !== undefined) updateData.tracker_id = trackerId;
                if (parentIssueId !== undefined)
                    updateData.parent_issue_id = parentIssueId;
                if (fixedVersionId !== undefined)
                    updateData.fixed_version_id = fixedVersionId;
                if (categoryId !== undefined)
                    updateData.category_id = categoryId;
                if (startDate !== undefined) updateData.start_date = startDate;
                if (dueDate !== undefined) updateData.due_date = dueDate;
                if (doneRatio !== undefined) updateData.done_ratio = doneRatio;
                if (estimatedHours !== undefined)
                    updateData.estimated_hours = estimatedHours;
                if (notes !== undefined) updateData.notes = notes;
                if (privateNotes !== undefined)
                    updateData.private_notes = privateNotes;
                if (customFields !== undefined)
                    updateData.custom_fields = customFields;

                // Update the issue
                const updatedIssue = await redmineClient.updateIssue(
                    numericId,
                    updateData,
                );

                // Handle time logging if requested
                let timeEntry = undefined;
                let timeEntryError = undefined;

                if (logHours !== undefined) {
                    try {
                        // Get activity ID - use provided or find default
                        let activityId = logActivityId;
                        if (activityId === undefined) {
                            const activities =
                                await redmineClient.getTimeEntryActivities();
                            const defaultActivity = activities.find(
                                (a) => a.is_default,
                            );
                            if (defaultActivity) {
                                activityId = defaultActivity.id;
                            } else if (activities.length > 0) {
                                // Fall back to first activity if no default
                                activityId = activities[0].id;
                            }
                        }

                        timeEntry = await redmineClient.createTimeEntry({
                            issue_id: numericId,
                            hours: logHours,
                            activity_id: activityId,
                            comments: logComments,
                            spent_on: logSpentOn,
                        });
                    } catch (error) {
                        const message =
                            error instanceof Error
                                ? error.message
                                : String(error);
                        timeEntryError = `Failed to create time entry: ${message}`;
                    }
                }

                // Build response
                const response: Record<string, unknown> = {
                    issue: updatedIssue.issue,
                    journalPagination: updatedIssue.journalPagination,
                };
                if (timeEntry) {
                    response.time_entry = timeEntry;
                }
                if (timeEntryError) {
                    response.time_entry_error = timeEntryError;
                }

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(response, null, 2),
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
                            text: `Error updating issue: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
