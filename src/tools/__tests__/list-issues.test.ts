import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RedmineIssue } from "../../redmine.js";
import {
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    setupTestEnv,
} from "../../test-utils.js";

interface ParsedIssuesResult {
    issues: RedmineIssue[];
    total_count: number;
    offset: number;
    limit: number;
}

function parseIssuesResult(result: ToolResult): ParsedIssuesResult {
    return JSON.parse(getTextContent(result)) as ParsedIssuesResult;
}

function getCalledUrl(): URL {
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    return new URL(url);
}

const sampleIssuesResponse = {
    issues: [
        {
            id: 123,
            project: { id: 1, name: "Project A" },
            tracker: { id: 1, name: "Bug" },
            status: { id: 1, name: "New" },
            priority: { id: 2, name: "Normal" },
            author: { id: 1, name: "John Doe" },
            assigned_to: { id: 2, name: "Jane Smith" },
            subject: "First issue",
            description: "Description of first issue",
            done_ratio: 0,
            created_on: "2024-01-15T10:00:00Z",
            updated_on: "2024-01-20T14:30:00Z",
            custom_fields: [{ id: 7, name: "Severity", value: "High" }],
        },
        {
            id: 456,
            project: { id: 2, name: "Project B" },
            tracker: { id: 2, name: "Feature" },
            status: { id: 2, name: "In Progress" },
            priority: { id: 3, name: "High" },
            author: { id: 3, name: "Bob Wilson" },
            assigned_to: { id: 2, name: "Jane Smith" },
            subject: "Second issue",
            description: "Description of second issue",
            done_ratio: 50,
            created_on: "2024-01-10T09:00:00Z",
            updated_on: "2024-01-18T11:00:00Z",
            attachments: [
                {
                    id: 9,
                    filename: "spec.txt",
                    filesize: 1234,
                    content_type: "text/plain",
                    author: { id: 3, name: "Bob Wilson" },
                    created_on: "2024-01-18T10:00:00Z",
                },
            ],
            relations: [
                {
                    id: 3,
                    issue_id: 456,
                    issue_to_id: 789,
                    relation_type: "relates",
                },
            ],
        },
    ],
    total_count: 2,
    offset: 0,
    limit: 25,
};

describe("list-issues tool", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("returns full issues with pagination metadata", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleIssuesResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-issues",
                arguments: {},
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("https://test.redmine.com/issues.json");
            expect(
                (options.headers as Record<string, string>)[
                    "X-Redmine-API-Key"
                ],
            ).toBe("test-api-key");
            expect((options.headers as Record<string, string>)["Accept"]).toBe(
                "application/json",
            );

            expect(result.isError).toBeFalsy();
            const parsed = parseIssuesResult(result);
            expect(parsed).toEqual(sampleIssuesResponse);
            expect(parsed.issues[0]).toHaveProperty("description");
            expect(parsed.issues[0]).toHaveProperty("author");
            expect(parsed.issues[0]).toHaveProperty("assigned_to");
            expect(parsed.issues[0]).toHaveProperty("created_on");
        } finally {
            await cleanup();
        }
    });

    it("serializes ordinary filters", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({ ...sampleIssuesResponse, issues: [] }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "list-issues",
                arguments: {
                    projectId: "project-alpha",
                    trackerId: 1,
                    statusId: "open",
                    assignedToId: "me",
                    parentId: 77,
                    queryId: 12,
                    sort: "updated_on:desc",
                    limit: 10,
                    offset: 20,
                },
            });

            const url = getCalledUrl();
            expect(url.pathname).toBe("/issues.json");
            expect(url.searchParams.get("project_id")).toBe("project-alpha");
            expect(url.searchParams.get("tracker_id")).toBe("1");
            expect(url.searchParams.get("status_id")).toBe("open");
            expect(url.searchParams.get("assigned_to_id")).toBe("me");
            expect(url.searchParams.get("parent_id")).toBe("77");
            expect(url.searchParams.get("query_id")).toBe("12");
            expect(url.searchParams.get("sort")).toBe("updated_on:desc");
            expect(url.searchParams.get("limit")).toBe("10");
            expect(url.searchParams.get("offset")).toBe("20");
        } finally {
            await cleanup();
        }
    });

    it("serializes issue IDs with optional number signs", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({ ...sampleIssuesResponse, issues: [] }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "list-issues",
                arguments: { issueIds: ["#123", 456, "789"] },
            });

            expect(getCalledUrl().searchParams.get("issue_id")).toBe(
                "123,456,789",
            );
        } finally {
            await cleanup();
        }
    });

    it("serializes date filters, custom fields, and includes", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({ ...sampleIssuesResponse, issues: [] }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "list-issues",
                arguments: {
                    createdOn: ">=2024-01-01",
                    updatedOn: "><2024-02-01|2024-02-29",
                    customFields: [
                        { id: 5, value: "client-a" },
                        { id: 9, value: ">=2024-02-15" },
                    ],
                    includeAttachments: true,
                    includeRelations: true,
                },
            });

            const params = getCalledUrl().searchParams;
            expect(params.get("created_on")).toBe(">=2024-01-01");
            expect(params.get("updated_on")).toBe("><2024-02-01|2024-02-29");
            expect(params.get("cf_5")).toBe("client-a");
            expect(params.get("cf_9")).toBe(">=2024-02-15");
            expect(params.get("include")).toBe("attachments,relations");
        } finally {
            await cleanup();
        }
    });

    it("surfaces API errors with status and Redmine error details", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 422,
            statusText: "Unprocessable Entity",
            json: () =>
                Promise.resolve({
                    errors: ["Status is invalid"],
                }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-issues",
                arguments: {},
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("422");
            expect(errorText).toContain("Status is invalid");
        } finally {
            await cleanup();
        }
    });

    it("surfaces network errors", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network unavailable"));

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-issues",
                arguments: {},
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain("Network unavailable");
        } finally {
            await cleanup();
        }
    });
});
