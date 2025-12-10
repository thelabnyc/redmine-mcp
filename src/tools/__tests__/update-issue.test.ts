import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    type IssueRequestBody,
    type TimeEntryRequestBody,
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    parseUpdateResult,
    setupTestEnv,
} from "../../test-utils.js";

// Sample Redmine API responses
const sampleIssueResponse = {
    issue: {
        id: 12345,
        project: { id: 1, name: "Test Project" },
        tracker: { id: 1, name: "Bug" },
        status: { id: 1, name: "New" },
        priority: { id: 2, name: "Normal" },
        author: { id: 1, name: "John Doe" },
        assigned_to: { id: 2, name: "Jane Smith" },
        subject: "Test issue subject",
        description: "This is a test issue description",
        start_date: "2024-01-15",
        due_date: "2024-01-30",
        done_ratio: 50,
        estimated_hours: 8,
        created_on: "2024-01-15T10:00:00Z",
        updated_on: "2024-01-20T14:30:00Z",
        journals: [
            {
                id: 1,
                user: { id: 1, name: "John Doe" },
                notes: "Added initial description",
                created_on: "2024-01-15T10:30:00Z",
                details: [],
            },
            {
                id: 2,
                user: { id: 2, name: "Jane Smith" },
                notes: "Working on this now",
                created_on: "2024-01-16T09:00:00Z",
                details: [
                    {
                        property: "attr",
                        name: "status_id",
                        old_value: "1",
                        new_value: "2",
                    },
                ],
            },
        ],
    },
};

// Sample time entry activities response
const sampleActivitiesResponse = {
    time_entry_activities: [
        { id: 1, name: "Design", is_default: false },
        { id: 2, name: "Development", is_default: true },
        { id: 3, name: "Testing", is_default: false },
    ],
};

// Sample time entry response
const sampleTimeEntryResponse = {
    time_entry: {
        id: 100,
        project: { id: 1, name: "Test Project" },
        issue: { id: 12345 },
        user: { id: 1, name: "John Doe" },
        activity: { id: 2, name: "Development" },
        hours: 1.5,
        comments: "Worked on bug fix",
        spent_on: "2024-01-20",
        created_on: "2024-01-20T15:00:00Z",
        updated_on: "2024-01-20T15:00:00Z",
    },
};

// Sample updated issue response (same structure, different values)
const sampleUpdatedIssueResponse = {
    issue: {
        ...sampleIssueResponse.issue,
        status: { id: 2, name: "In Progress" },
        assigned_to: { id: 3, name: "Bob Wilson" },
        done_ratio: 75,
        updated_on: "2024-01-21T10:00:00Z",
        journals: [
            ...sampleIssueResponse.issue.journals,
            {
                id: 3,
                user: { id: 1, name: "John Doe" },
                notes: "Updated status and assignment",
                created_on: "2024-01-21T10:00:00Z",
                details: [
                    {
                        property: "attr",
                        name: "status_id",
                        old_value: "1",
                        new_value: "2",
                    },
                    {
                        property: "attr",
                        name: "assigned_to_id",
                        old_value: "2",
                        new_value: "3",
                    },
                ],
            },
        ],
    },
};

describe("update-issue tool", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("updates a single field", async () => {
        // First call: PUT to update, Second call: GET to fetch updated issue
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(sampleUpdatedIssueResponse),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "update-issue",
                arguments: {
                    issueId: "12345",
                    subject: "Updated subject",
                },
            })) as ToolResult;

            // Verify PUT was called
            expect(mockFetch).toHaveBeenCalledTimes(2);
            const [putUrl, putOptions] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(putUrl).toBe("https://test.redmine.com/issues/12345.json");
            expect(putOptions.method).toBe("PUT");

            const body = JSON.parse(
                putOptions.body as string,
            ) as IssueRequestBody;
            expect(body.issue.subject).toBe("Updated subject");

            // Verify response
            expect(result.isError).toBeFalsy();
            const data = parseUpdateResult(result);
            expect(data.issue).toBeDefined();
        } finally {
            await cleanup();
        }
    });

    it("updates multiple fields", async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(sampleUpdatedIssueResponse),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "update-issue",
                arguments: {
                    issueId: "12345",
                    statusId: 2,
                    assignedToId: 3,
                    doneRatio: 75,
                },
            });

            const [, putOptions] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            const body = JSON.parse(
                putOptions.body as string,
            ) as IssueRequestBody;
            expect(body.issue.status_id).toBe(2);
            expect(body.issue.assigned_to_id).toBe(3);
            expect(body.issue.done_ratio).toBe(75);
        } finally {
            await cleanup();
        }
    });

    it("adds notes to an issue", async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(sampleUpdatedIssueResponse),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "update-issue",
                arguments: {
                    issueId: "12345",
                    notes: "This is a comment",
                    privateNotes: true,
                },
            });

            const [, putOptions] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            const body = JSON.parse(
                putOptions.body as string,
            ) as IssueRequestBody;
            expect(body.issue.notes).toBe("This is a comment");
            expect(body.issue.private_notes).toBe(true);
        } finally {
            await cleanup();
        }
    });

    it("updates issue and logs time in same call", async () => {
        // PUT update, GET updated issue, POST time entry
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(sampleUpdatedIssueResponse),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: () => Promise.resolve(sampleTimeEntryResponse),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "update-issue",
                arguments: {
                    issueId: "12345",
                    statusId: 2,
                    logHours: 1.5,
                    logActivityId: 2,
                    logComments: "Worked on bug fix",
                },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(3);

            // Verify time entry POST
            const [timeUrl, timeOptions] = mockFetch.mock.calls[2] as [
                string,
                RequestInit,
            ];
            expect(timeUrl).toBe("https://test.redmine.com/time_entries.json");
            expect(timeOptions.method).toBe("POST");

            const timeBody = JSON.parse(
                timeOptions.body as string,
            ) as TimeEntryRequestBody;
            expect(timeBody.time_entry.issue_id).toBe(12345);
            expect(timeBody.time_entry.hours).toBe(1.5);
            expect(timeBody.time_entry.activity_id).toBe(2);
            expect(timeBody.time_entry.comments).toBe("Worked on bug fix");

            // Verify response includes both
            expect(result.isError).toBeFalsy();
            const data = parseUpdateResult(result);
            expect(data.issue).toBeDefined();
            expect(data.time_entry).toBeDefined();
            expect(data.time_entry?.hours).toBe(1.5);
        } finally {
            await cleanup();
        }
    });

    it("logs time only with notes (no field changes)", async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(sampleIssueResponse),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: () => Promise.resolve(sampleTimeEntryResponse),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "update-issue",
                arguments: {
                    issueId: "12345",
                    notes: "Logging time",
                    logHours: 2.0,
                    logActivityId: 1,
                },
            })) as ToolResult;

            expect(result.isError).toBeFalsy();
            const data = parseUpdateResult(result);
            expect(data.time_entry).toBeDefined();
        } finally {
            await cleanup();
        }
    });

    it("uses default activity when not specified", async () => {
        // PUT update, GET updated issue, GET activities, POST time entry
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(sampleUpdatedIssueResponse),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(sampleActivitiesResponse),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: () => Promise.resolve(sampleTimeEntryResponse),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "update-issue",
                arguments: {
                    issueId: "12345",
                    logHours: 1.0,
                    // No logActivityId provided
                },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(4);

            // Verify activities were fetched
            const [activitiesUrl] = mockFetch.mock.calls[2] as [
                string,
                RequestInit,
            ];
            expect(activitiesUrl).toContain(
                "/enumerations/time_entry_activities.json",
            );

            // Verify default activity (id: 2) was used
            const [, timeOptions] = mockFetch.mock.calls[3] as [
                string,
                RequestInit,
            ];
            const timeBody = JSON.parse(
                timeOptions.body as string,
            ) as TimeEntryRequestBody;
            expect(timeBody.time_entry.activity_id).toBe(2); // Development is default

            expect(result.isError).toBeFalsy();
        } finally {
            await cleanup();
        }
    });

    it("handles issue ID with # prefix", async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(sampleUpdatedIssueResponse),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "update-issue",
                arguments: {
                    issueId: "#12345",
                    subject: "Test",
                },
            });

            const [putUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(putUrl).toBe("https://test.redmine.com/issues/12345.json");
        } finally {
            await cleanup();
        }
    });

    it("handles 404 error for non-existent issue", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: "Not Found",
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "update-issue",
                arguments: {
                    issueId: "99999",
                    subject: "Test",
                },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("404");
        } finally {
            await cleanup();
        }
    });

    it("handles partial failure when time entry fails", async () => {
        // PUT succeeds, GET succeeds, POST time entry fails
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(sampleUpdatedIssueResponse),
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 422,
                statusText: "Unprocessable Entity",
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "update-issue",
                arguments: {
                    issueId: "12345",
                    statusId: 2,
                    logHours: 1.5,
                    logActivityId: 999, // Invalid activity
                },
            })) as ToolResult;

            // Should not be a total error since issue was updated
            expect(result.isError).toBeFalsy();
            const data = parseUpdateResult(result);
            expect(data.issue).toBeDefined();
            expect(data.time_entry_error).toBeDefined();
            expect(data.time_entry_error).toContain("422");
        } finally {
            await cleanup();
        }
    });

    it("returns error for invalid issue ID format", async () => {
        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "update-issue",
                arguments: {
                    issueId: "not-a-number",
                    subject: "Test",
                },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("Invalid issue ID");
        } finally {
            await cleanup();
        }
    });
});
