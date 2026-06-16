import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

import type {
    CreateTimeEntryData,
    RedmineClient,
    TimeEntryMutationFields,
    UpdateTimeEntryData,
} from "../redmine.js";
import { parseIssueId } from "./utils.js";

const timeEntryIdSchema = z.number().int().positive().describe("Time entry ID");

const projectOrIssueIdSchema = z.union([z.string(), z.number()]);

const dateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

const customFieldsSchema = z
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
    .describe("Custom field values for the time entry");

const createTimeEntryInputSchema = z
    .object({
        issueId: projectOrIssueIdSchema
            .optional()
            .describe("Issue ID for issue-scoped time"),
        projectId: projectOrIssueIdSchema
            .optional()
            .describe("Numeric project ID for project time"),
        hours: z.number().describe("Hours to log"),
        activityId: z.number().optional().describe("Activity ID"),
        spentOn: dateSchema.optional().describe("Spent date (YYYY-MM-DD)"),
        comments: z.string().optional().describe("Time entry notes"),
        customFields: customFieldsSchema.optional(),
    })
    .superRefine(({ issueId, projectId }, context) => {
        if ((issueId === undefined) === (projectId === undefined)) {
            context.addIssue({
                code: "custom",
                message: "Exactly one of issueId or projectId is required.",
                path: ["issueId"],
            });
        }
    });

function parseProjectIdForCreate(
    projectId: string | number,
): { success: true; projectId: number } | { success: false; error: string } {
    const numericProjectId =
        typeof projectId === "number" ? projectId : Number(projectId);

    if (
        !Number.isSafeInteger(numericProjectId) ||
        numericProjectId <= 0 ||
        (typeof projectId === "string" && !/^\d+$/.test(projectId))
    ) {
        return {
            success: false,
            error: "Project ID for create-time-entry must be a numeric project ID.",
        };
    }

    return { success: true, projectId: numericProjectId };
}

function toolError(text: string): {
    isError: true;
    content: Array<{ type: "text"; text: string }>;
} {
    return {
        isError: true,
        content: [{ type: "text", text }],
    };
}

function toolJson(data: unknown): {
    content: Array<{ type: "text"; text: string }>;
} {
    return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
}

export function registerTimeEntryTools(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "list-time-entries",
        {
            title: "List Redmine Time Entries",
            description:
                "List Redmine time entries with optional filters. Returns time entry objects plus pagination metadata.",
            inputSchema: {
                issueId: projectOrIssueIdSchema
                    .optional()
                    .describe("Filter by issue ID"),
                projectId: projectOrIssueIdSchema
                    .optional()
                    .describe("Filter by project ID or identifier"),
                userId: z
                    .union([z.number(), z.literal("me")])
                    .optional()
                    .describe("Filter by user ID, or 'me'"),
                spentOn: dateSchema
                    .optional()
                    .describe("Filter by exact spent_on date (YYYY-MM-DD)"),
                from: dateSchema
                    .optional()
                    .describe("Filter by start date (YYYY-MM-DD)"),
                to: dateSchema
                    .optional()
                    .describe("Filter by end date (YYYY-MM-DD)"),
                activityId: z.number().optional().describe("Activity ID"),
                limit: z
                    .number()
                    .optional()
                    .describe("Maximum number of time entries to return"),
                offset: z
                    .number()
                    .optional()
                    .describe("Number of time entries to skip"),
            },
        },
        async ({
            issueId,
            projectId,
            userId,
            spentOn,
            from,
            to,
            activityId,
            limit,
            offset,
        }) => {
            try {
                const result = await redmineClient.listTimeEntries({
                    issueId,
                    projectId,
                    userId,
                    spentOn,
                    from,
                    to,
                    activityId,
                    limit,
                    offset,
                });

                return toolJson(result);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                return toolError(`Error listing time entries: ${message}`);
            }
        },
    );

    server.registerTool(
        "get-time-entry",
        {
            title: "Get Redmine Time Entry",
            description:
                "Fetch a Redmine time entry by ID. Returns the time entry JSON from Redmine.",
            inputSchema: {
                timeEntryId: timeEntryIdSchema,
            },
        },
        async ({ timeEntryId }) => {
            try {
                const timeEntry = await redmineClient.getTimeEntry(timeEntryId);
                return toolJson(timeEntry);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                return toolError(`Error fetching time entry: ${message}`);
            }
        },
    );

    server.registerTool(
        "create-time-entry",
        {
            title: "Create Redmine Time Entry",
            description:
                "Create a Redmine time entry for exactly one issue or project. IMPORTANT: Before calling this tool, you MUST present the user with a human-readable summary of the target issue or project, hours, activity, spent date, comments, and custom fields, then get their explicit confirmation before proceeding.",
            inputSchema: createTimeEntryInputSchema,
        },
        async ({
            issueId,
            projectId,
            hours,
            activityId,
            spentOn,
            comments,
            customFields,
        }) => {
            try {
                const hasIssueId = issueId !== undefined;
                const hasProjectId = projectId !== undefined;
                if (hasIssueId === hasProjectId) {
                    return toolError(
                        "Exactly one of issueId or projectId is required.",
                    );
                }

                const data: TimeEntryMutationFields = { hours };
                if (activityId !== undefined) {
                    data.activity_id = activityId;
                }
                if (spentOn !== undefined) {
                    data.spent_on = spentOn;
                }
                if (comments !== undefined) {
                    data.comments = comments;
                }
                if (customFields !== undefined) {
                    data.custom_fields = customFields;
                }

                let createData: CreateTimeEntryData;
                if (issueId !== undefined) {
                    const parsedIssueId = parseIssueId(issueId);
                    if (!parsedIssueId.success) {
                        return toolError(
                            "Issue ID for create-time-entry must be a positive integer issue ID.",
                        );
                    }
                    createData = { ...data, issue_id: parsedIssueId.numericId };
                } else if (projectId !== undefined) {
                    const parsedProjectId = parseProjectIdForCreate(projectId);
                    if (!parsedProjectId.success) {
                        return toolError(parsedProjectId.error);
                    }
                    createData = {
                        ...data,
                        project_id: parsedProjectId.projectId,
                    };
                } else {
                    return toolError(
                        "Exactly one of issueId or projectId is required.",
                    );
                }

                const timeEntry = await redmineClient.createTimeEntry(
                    createData,
                );
                return toolJson(timeEntry);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                return toolError(`Error creating time entry: ${message}`);
            }
        },
    );

    server.registerTool(
        "update-time-entry",
        {
            title: "Update Redmine Time Entry",
            description:
                "Update a Redmine time entry. IMPORTANT: Before calling this tool, you MUST present the user with a human-readable summary of the time entry ID, hours, activity, spent date, comments, and custom fields you plan to change, then get their explicit confirmation before proceeding.",
            inputSchema: {
                timeEntryId: timeEntryIdSchema,
                hours: z.number().optional().describe("Hours to set"),
                activityId: z.number().optional().describe("Activity ID"),
                spentOn: dateSchema
                    .optional()
                    .describe("Spent date (YYYY-MM-DD)"),
                comments: z.string().optional().describe("Time entry notes"),
                customFields: customFieldsSchema.optional(),
            },
        },
        async ({
            timeEntryId,
            hours,
            activityId,
            spentOn,
            comments,
            customFields,
        }) => {
            try {
                const data: UpdateTimeEntryData = {};
                if (hours !== undefined) {
                    data.hours = hours;
                }
                if (activityId !== undefined) {
                    data.activity_id = activityId;
                }
                if (spentOn !== undefined) {
                    data.spent_on = spentOn;
                }
                if (comments !== undefined) {
                    data.comments = comments;
                }
                if (customFields !== undefined) {
                    data.custom_fields = customFields;
                }

                const timeEntry = await redmineClient.updateTimeEntry(
                    timeEntryId,
                    data,
                );
                return toolJson(timeEntry);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                return toolError(`Error updating time entry: ${message}`);
            }
        },
    );

    server.registerTool(
        "delete-time-entry",
        {
            title: "Delete Redmine Time Entry",
            description:
                "Delete a Redmine time entry by ID. IMPORTANT: Before calling this tool, you MUST present the user with a human-readable summary of the time entry ID and delete action, then get their explicit confirmation before proceeding.",
            inputSchema: {
                timeEntryId: timeEntryIdSchema,
            },
        },
        async ({ timeEntryId }) => {
            try {
                await redmineClient.deleteTimeEntry(timeEntryId);
                return toolJson({ deleted: true, timeEntryId });
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                return toolError(`Error deleting time entry: ${message}`);
            }
        },
    );

    server.registerTool(
        "list-time-entry-activities",
        {
            title: "List Redmine Time Entry Activities",
            description:
                "List Redmine time entry activities. Use this to discover activity IDs before creating or updating time entries.",
            inputSchema: {},
        },
        async () => {
            try {
                const activities = await redmineClient.getTimeEntryActivities();
                return toolJson(activities);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                return toolError(
                    `Error listing time entry activities: ${message}`,
                );
            }
        },
    );
}
