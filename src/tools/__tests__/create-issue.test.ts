import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    type CreateIssueRequestBody,
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    parseCreateResult,
    setupTestEnv,
} from "../../test-utils.js";

const sampleCreatedIssueResponse = {
    issue: { id: 42 },
};

const sampleGetIssueResponse = {
    issue: {
        id: 42,
        project: { id: 1, name: "Test Project" },
        tracker: { id: 1, name: "Bug" },
        status: { id: 1, name: "New" },
        priority: { id: 2, name: "Normal" },
        author: { id: 1, name: "John Doe" },
        subject: "New test issue",
        description: "A description",
        start_date: "2024-01-15",
        due_date: null,
        done_ratio: 0,
        estimated_hours: null,
        created_on: "2024-01-15T10:00:00Z",
        updated_on: "2024-01-15T10:00:00Z",
        journals: [],
    },
};

describe("create-issue tool", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("creates issue with required fields only", async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: () => Promise.resolve(sampleCreatedIssueResponse),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(sampleGetIssueResponse),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "create-issue",
                arguments: {
                    projectId: "test-project",
                    subject: "New test issue",
                },
            })) as ToolResult;

            // Verify POST was called with correct URL and body
            expect(mockFetch).toHaveBeenCalledTimes(2);
            const [postUrl, postOptions] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(postUrl).toBe("https://test.redmine.com/issues.json");
            expect(postOptions.method).toBe("POST");

            const body = JSON.parse(
                postOptions.body as string,
            ) as CreateIssueRequestBody;
            expect(body.issue.project_id).toBe("test-project");
            expect(body.issue.subject).toBe("New test issue");

            // Verify GET was called to fetch full issue details
            const [getUrl] = mockFetch.mock.calls[1] as [string, RequestInit];
            expect(getUrl).toContain("/issues/42.json");

            // Verify response
            expect(result.isError).toBeFalsy();
            const data = parseCreateResult(result);
            expect(data.issue.id).toBe(42);
            expect(data.issue.subject).toBe("New test issue");
            expect(data.journalPagination).toBeDefined();
        } finally {
            await cleanup();
        }
    });

    it("creates issue with all optional fields", async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: () => Promise.resolve(sampleCreatedIssueResponse),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(sampleGetIssueResponse),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "create-issue",
                arguments: {
                    projectId: "test-project",
                    subject: "Full issue",
                    description: "A detailed description",
                    statusId: 2,
                    priorityId: 3,
                    assignedToId: 5,
                    trackerId: 1,
                    parentIssueId: 10,
                    startDate: "2024-01-15",
                    dueDate: "2024-02-15",
                    doneRatio: 25,
                    estimatedHours: 16,
                    isPrivate: true,
                },
            });

            const [, postOptions] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            const body = JSON.parse(
                postOptions.body as string,
            ) as CreateIssueRequestBody;
            expect(body.issue.project_id).toBe("test-project");
            expect(body.issue.subject).toBe("Full issue");
            expect(body.issue.description).toBe("A detailed description");
            expect(body.issue.status_id).toBe(2);
            expect(body.issue.priority_id).toBe(3);
            expect(body.issue.assigned_to_id).toBe(5);
            expect(body.issue.tracker_id).toBe(1);
            expect(body.issue.parent_issue_id).toBe(10);
            expect(body.issue.start_date).toBe("2024-01-15");
            expect(body.issue.due_date).toBe("2024-02-15");
            expect(body.issue.done_ratio).toBe(25);
            expect(body.issue.estimated_hours).toBe(16);
            expect(body.issue.is_private).toBe(true);
        } finally {
            await cleanup();
        }
    });

    it("accepts numeric projectId", async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: () => Promise.resolve(sampleCreatedIssueResponse),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(sampleGetIssueResponse),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "create-issue",
                arguments: {
                    projectId: 1,
                    subject: "Numeric project",
                },
            });

            const [, postOptions] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            const body = JSON.parse(
                postOptions.body as string,
            ) as CreateIssueRequestBody;
            expect(body.issue.project_id).toBe(1);
        } finally {
            await cleanup();
        }
    });

    it("handles 422 validation error", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 422,
            statusText: "Unprocessable Entity",
            json: () =>
                Promise.resolve({
                    errors: ["Subject cannot be blank", "Project is invalid"],
                }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "create-issue",
                arguments: {
                    projectId: "invalid",
                    subject: "",
                },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("422");
            expect(errorText).toContain("Subject cannot be blank");
            expect(errorText).toContain("Project is invalid");
        } finally {
            await cleanup();
        }
    });

    it("handles 403 permission denied", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 403,
            statusText: "Forbidden",
            json: () => Promise.reject(new Error("not json")),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "create-issue",
                arguments: {
                    projectId: "secret-project",
                    subject: "Unauthorized",
                },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("403");
        } finally {
            await cleanup();
        }
    });

    it("creates issue with custom fields", async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: () => Promise.resolve(sampleCreatedIssueResponse),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(sampleGetIssueResponse),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "create-issue",
                arguments: {
                    projectId: "test-project",
                    subject: "Issue with custom fields",
                    customFields: [
                        { id: 1, value: "Sprint 5" },
                        { id: 2, value: ["val1", "val2"] },
                    ],
                },
            });

            const [, postOptions] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            const body = JSON.parse(
                postOptions.body as string,
            ) as CreateIssueRequestBody;
            expect(body.issue.custom_fields).toEqual([
                { id: 1, value: "Sprint 5" },
                { id: 2, value: ["val1", "val2"] },
            ]);
        } finally {
            await cleanup();
        }
    });

    it("creates issue with watcher user IDs", async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: () => Promise.resolve(sampleCreatedIssueResponse),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(sampleGetIssueResponse),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "create-issue",
                arguments: {
                    projectId: "test-project",
                    subject: "Issue with watchers",
                    watcherUserIds: [11, 12],
                },
            });

            const [, postOptions] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            const body = JSON.parse(
                postOptions.body as string,
            ) as CreateIssueRequestBody;
            expect(body.issue.watcher_user_ids).toEqual([11, 12]);
        } finally {
            await cleanup();
        }
    });

    it("creates issue with fixed version and category", async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: () => Promise.resolve(sampleCreatedIssueResponse),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(sampleGetIssueResponse),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "create-issue",
                arguments: {
                    projectId: "test-project",
                    subject: "Issue with release metadata",
                    fixedVersionId: 7,
                    categoryId: 3,
                },
            });

            const [, postOptions] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            const body = JSON.parse(
                postOptions.body as string,
            ) as CreateIssueRequestBody;
            expect(body.issue.fixed_version_id).toBe(7);
            expect(body.issue.category_id).toBe(3);
        } finally {
            await cleanup();
        }
    });

    it("handles network error", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "create-issue",
                arguments: {
                    projectId: "test",
                    subject: "Test",
                },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("Network error");
        } finally {
            await cleanup();
        }
    });

    it("returns full issue details with journalPagination after creation", async () => {
        const responseWithJournals = {
            issue: {
                ...sampleGetIssueResponse.issue,
                journals: [
                    {
                        id: 1,
                        user: { id: 1, name: "John Doe" },
                        notes: "Created",
                        created_on: "2024-01-15T10:00:00Z",
                        details: [],
                    },
                ],
            },
        };

        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: () => Promise.resolve(sampleCreatedIssueResponse),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(responseWithJournals),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "create-issue",
                arguments: {
                    projectId: "test-project",
                    subject: "New issue",
                },
            })) as ToolResult;

            expect(result.isError).toBeFalsy();
            const data = parseCreateResult(result);
            expect(data.issue.id).toBe(42);
            expect(data.journalPagination).toBeDefined();
            expect(data.journalPagination?.total_count).toBe(1);
        } finally {
            await cleanup();
        }
    });
});
