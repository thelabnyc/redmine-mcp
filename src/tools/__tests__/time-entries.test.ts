import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RedmineActivity, RedmineTimeEntry } from "../../redmine.js";
import {
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    setupTestEnv,
} from "../../test-utils.js";

interface ListTimeEntriesResult {
    time_entries: RedmineTimeEntry[];
    total_count: number;
    offset: number;
    limit: number;
}

interface TimeEntryRequestBody {
    time_entry: {
        issue_id?: number;
        project_id?: number;
        hours?: number;
        activity_id?: number;
        spent_on?: string;
        comments?: string;
        custom_fields?: Array<{ id: number; value: string | string[] }>;
    };
}

function parseJsonResult<T>(result: ToolResult): T {
    return JSON.parse(getTextContent(result)) as T;
}

function getCalledUrl(callIndex = 0): URL {
    const [url] = mockFetch.mock.calls[callIndex] as [string, RequestInit];
    return new URL(url);
}

const sampleTimeEntry: RedmineTimeEntry = {
    id: 100,
    project: { id: 1, name: "Test Project" },
    issue: { id: 12345 },
    user: { id: 7, name: "Jane Smith" },
    activity: { id: 2, name: "Development" },
    hours: 2.5,
    comments: "Implemented time entry tooling",
    spent_on: "2026-06-16",
    created_on: "2026-06-16T14:00:00Z",
    updated_on: "2026-06-16T14:00:00Z",
};

const sampleListResponse: ListTimeEntriesResult = {
    time_entries: [sampleTimeEntry],
    total_count: 1,
    offset: 5,
    limit: 10,
};

const sampleActivities: RedmineActivity[] = [
    { id: 1, name: "Design", is_default: false },
    { id: 2, name: "Development", is_default: true },
];

describe("time entry tools", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("advertises create target fields in the input schema", async () => {
        const { client, cleanup } = await createTestClientServer();

        try {
            const tools = await client.listTools();
            const tool = tools.tools.find(
                (candidate) => candidate.name === "create-time-entry",
            );
            const schema = tool?.inputSchema as {
                properties?: Record<string, unknown>;
            };

            expect(schema.properties).toHaveProperty("issueId");
            expect(schema.properties).toHaveProperty("projectId");
        } finally {
            await cleanup();
        }
    });

    it("lists time entries with filters and pagination", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleListResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-time-entries",
                arguments: {
                    issueId: 12345,
                    projectId: "project-alpha",
                    userId: "me",
                    spentOn: "2026-06-16",
                    from: "2026-06-01",
                    to: "2026-06-30",
                    activityId: 2,
                    limit: 10,
                    offset: 5,
                },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const url = getCalledUrl();
            expect(url.pathname).toBe("/time_entries.json");
            expect(url.searchParams.get("issue_id")).toBe("12345");
            expect(url.searchParams.get("project_id")).toBe("project-alpha");
            expect(url.searchParams.get("user_id")).toBe("me");
            expect(url.searchParams.get("spent_on")).toBe("2026-06-16");
            expect(url.searchParams.get("from")).toBe("2026-06-01");
            expect(url.searchParams.get("to")).toBe("2026-06-30");
            expect(url.searchParams.get("activity_id")).toBe("2");
            expect(url.searchParams.get("limit")).toBe("10");
            expect(url.searchParams.get("offset")).toBe("5");

            expect(result.isError).toBeFalsy();
            expect(parseJsonResult<ListTimeEntriesResult>(result)).toEqual(
                sampleListResponse,
            );
        } finally {
            await cleanup();
        }
    });

    it("normalizes a number-sign issue ID when listing time entries", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleListResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "list-time-entries",
                arguments: { issueId: "#12345" },
            });

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(getCalledUrl().searchParams.get("issue_id")).toBe("12345");
        } finally {
            await cleanup();
        }
    });

    it("gets a time entry by ID", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ time_entry: sampleTimeEntry }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "get-time-entry",
                arguments: { timeEntryId: 100 },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("https://test.redmine.com/time_entries/100.json");
            expect(options.method).toBe("GET");
            expect(parseJsonResult<RedmineTimeEntry>(result)).toEqual(
                sampleTimeEntry,
            );
        } finally {
            await cleanup();
        }
    });

    it("creates a time entry for an issue with custom fields", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: () => Promise.resolve({ time_entry: sampleTimeEntry }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "create-time-entry",
                arguments: {
                    issueId: 12345,
                    hours: 2.5,
                    activityId: 2,
                    spentOn: "2026-06-16",
                    comments: "Implemented time entry tooling",
                    customFields: [
                        { id: 8, value: "Billable" },
                        { id: 9, value: ["client-a", "support"] },
                    ],
                },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("https://test.redmine.com/time_entries.json");
            expect(options.method).toBe("POST");
            const body = JSON.parse(
                options.body as string,
            ) as TimeEntryRequestBody;
            expect(body).toEqual({
                time_entry: {
                    issue_id: 12345,
                    hours: 2.5,
                    activity_id: 2,
                    spent_on: "2026-06-16",
                    comments: "Implemented time entry tooling",
                    custom_fields: [
                        { id: 8, value: "Billable" },
                        { id: 9, value: ["client-a", "support"] },
                    ],
                },
            });
            expect(parseJsonResult<RedmineTimeEntry>(result)).toEqual(
                sampleTimeEntry,
            );
        } finally {
            await cleanup();
        }
    });

    it("normalizes a number-sign issue ID when creating a time entry", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: () => Promise.resolve({ time_entry: sampleTimeEntry }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "create-time-entry",
                arguments: {
                    issueId: "#12345",
                    hours: 1.25,
                },
            });

            const [, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            const body = JSON.parse(
                options.body as string,
            ) as TimeEntryRequestBody;
            expect(body.time_entry.issue_id).toBe(12345);
        } finally {
            await cleanup();
        }
    });

    it.each([
        ["malformed string", "123abc"],
        ["number float", 1.5],
        ["string float", "1.5"],
        ["negative number", -1],
        ["negative string", "-1"],
        ["zero", 0],
    ] as const)(
        "rejects %s issue IDs when creating before fetching",
        async (_label, issueId) => {
            const { client, cleanup } = await createTestClientServer();

            try {
                const result = (await client.callTool({
                    name: "create-time-entry",
                    arguments: {
                        issueId,
                        hours: 1,
                    },
                })) as ToolResult;

                expect(result.isError).toBe(true);
                expect(getTextContent(result)).toContain(
                    "Issue ID for create-time-entry must be a positive integer issue ID.",
                );
                expect(mockFetch).not.toHaveBeenCalled();
            } finally {
                await cleanup();
            }
        },
    );

    it("creates a time entry for a numeric project ID string", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: () =>
                Promise.resolve({
                    time_entry: {
                        ...sampleTimeEntry,
                        issue: undefined,
                    },
                }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "create-time-entry",
                arguments: {
                    projectId: "123",
                    hours: 1.25,
                },
            });

            const [, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            const body = JSON.parse(
                options.body as string,
            ) as TimeEntryRequestBody;
            expect(body.time_entry.project_id).toBe(123);
            expect(body.time_entry.issue_id).toBeUndefined();
            expect(body.time_entry.hours).toBe(1.25);
        } finally {
            await cleanup();
        }
    });

    it("rejects nonnumeric project IDs when creating before fetching", async () => {
        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "create-time-entry",
                arguments: {
                    projectId: "project-alpha",
                    hours: 1,
                },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                "Project ID for create-time-entry must be a numeric project ID.",
            );
            expect(mockFetch).not.toHaveBeenCalled();
        } finally {
            await cleanup();
        }
    });

    it("rejects unsafe integer project IDs when creating before fetching", async () => {
        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "create-time-entry",
                arguments: {
                    projectId: "9007199254740993",
                    hours: 1,
                },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                "Project ID for create-time-entry must be a numeric project ID.",
            );
            expect(mockFetch).not.toHaveBeenCalled();
        } finally {
            await cleanup();
        }
    });

    it("rejects create without issueId or projectId before fetching", async () => {
        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "create-time-entry",
                arguments: { hours: 1 },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                "Exactly one of issueId or projectId is required",
            );
            expect(mockFetch).not.toHaveBeenCalled();
        } finally {
            await cleanup();
        }
    });

    it("rejects create with both issueId and projectId before fetching", async () => {
        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "create-time-entry",
                arguments: {
                    issueId: 12345,
                    projectId: "project-alpha",
                    hours: 1,
                },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                "Exactly one of issueId or projectId is required",
            );
            expect(mockFetch).not.toHaveBeenCalled();
        } finally {
            await cleanup();
        }
    });

    it("updates a time entry and returns the refreshed entry", async () => {
        const refreshedEntry = {
            ...sampleTimeEntry,
            hours: 3,
            comments: "Updated notes",
            updated_on: "2026-06-16T15:00:00Z",
        };
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 204,
                json: () => Promise.resolve({}),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ time_entry: refreshedEntry }),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "update-time-entry",
                arguments: {
                    timeEntryId: 100,
                    hours: 3,
                    activityId: 2,
                    spentOn: "2026-06-16",
                    comments: "Updated notes",
                    customFields: [{ id: 8, value: "Non-billable" }],
                },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(2);
            const [putUrl, putOptions] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(putUrl).toBe(
                "https://test.redmine.com/time_entries/100.json",
            );
            expect(putOptions.method).toBe("PUT");
            const body = JSON.parse(
                putOptions.body as string,
            ) as TimeEntryRequestBody;
            expect(body).toEqual({
                time_entry: {
                    hours: 3,
                    activity_id: 2,
                    spent_on: "2026-06-16",
                    comments: "Updated notes",
                    custom_fields: [{ id: 8, value: "Non-billable" }],
                },
            });
            const [getUrl, getOptions] = mockFetch.mock.calls[1] as [
                string,
                RequestInit,
            ];
            expect(getUrl).toBe(
                "https://test.redmine.com/time_entries/100.json",
            );
            expect(getOptions.method).toBe("GET");
            expect(parseJsonResult<RedmineTimeEntry>(result)).toEqual(
                refreshedEntry,
            );
        } finally {
            await cleanup();
        }
    });

    it("surfaces refresh errors after a successful update", async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 204,
                json: () => Promise.resolve({}),
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: "Not Found",
                json: () =>
                    Promise.resolve({ errors: ["Time entry not found"] }),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "update-time-entry",
                arguments: {
                    timeEntryId: 100,
                    hours: 3,
                },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                "Error updating time entry: Failed to fetch time entry 100: 404 Not Found - Time entry not found",
            );
        } finally {
            await cleanup();
        }
    });

    it("deletes a time entry", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 204,
            json: () => Promise.resolve({}),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "delete-time-entry",
                arguments: { timeEntryId: 100 },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("https://test.redmine.com/time_entries/100.json");
            expect(options.method).toBe("DELETE");
            expect(
                parseJsonResult<{
                    deleted: true;
                    timeEntryId: number;
                }>(result),
            ).toEqual({ deleted: true, timeEntryId: 100 });
        } finally {
            await cleanup();
        }
    });

    it("lists time entry activities", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({ time_entry_activities: sampleActivities }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-time-entry-activities",
                arguments: {},
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe(
                "https://test.redmine.com/enumerations/time_entry_activities.json",
            );
            expect(options.method).toBe("GET");
            expect(parseJsonResult<RedmineActivity[]>(result)).toEqual(
                sampleActivities,
            );
        } finally {
            await cleanup();
        }
    });

    it("surfaces API errors", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 422,
            statusText: "Unprocessable Entity",
            json: () => Promise.resolve({ errors: ["Hours is invalid"] }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-time-entries",
                arguments: {},
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain("422");
            expect(getTextContent(result)).toContain("Hours is invalid");
        } finally {
            await cleanup();
        }
    });

    it("surfaces network errors", async () => {
        mockFetch.mockRejectedValueOnce(new Error("socket disconnected"));

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "get-time-entry",
                arguments: { timeEntryId: 100 },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain("socket disconnected");
        } finally {
            await cleanup();
        }
    });
});
