import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    parseMyIssuesResult,
    setupTestEnv,
} from "../../test-utils.js";

// Full API response (what Redmine returns)
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
            agile_data_attributes: { story_points: null, position: 5 },
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
            agile_data_attributes: { story_points: 3, position: 2 },
        },
    ],
    total_count: 2,
    offset: 0,
    limit: 25,
};

describe("list-my-issues tool", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("returns issues assigned to current user", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleIssuesResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-my-issues",
                arguments: {},
            })) as ToolResult;

            // Verify fetch was called with correct URL and default sort
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toContain("/issues.json");
            expect(url).toContain("assigned_to_id=me");
            expect(url).toContain("sort=priority%3Adesc%2Cupdated_on%3Adesc");
            expect(
                (options.headers as Record<string, string>)[
                    "X-Redmine-API-Key"
                ],
            ).toBe("test-api-key");

            // Verify response - should be slim (no description, author, etc.)
            expect(result.isError).toBeFalsy();
            const responseData = parseMyIssuesResult(result);
            expect(responseData.issues).toHaveLength(2);
            expect(responseData.total_count).toBe(2);
            expect(responseData.issues[0].id).toBe(123);
            expect(responseData.issues[0].subject).toBe("First issue");
            expect(responseData.issues[0].done_ratio).toBe(0);
            expect(responseData.issues[0].position).toBe(5);
            expect(responseData.issues[1].id).toBe(456);
            expect(responseData.issues[1].subject).toBe("Second issue");
            expect(responseData.issues[1].done_ratio).toBe(50);
            expect(responseData.issues[1].position).toBe(2);

            // Verify slim fields only - these should NOT be present
            expect(responseData.issues[0]).not.toHaveProperty("description");
            expect(responseData.issues[0]).not.toHaveProperty("author");
            expect(responseData.issues[0]).not.toHaveProperty("assigned_to");
            expect(responseData.issues[0]).not.toHaveProperty("created_on");
        } finally {
            await cleanup();
        }
    });

    it("passes status filter to API", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({ ...sampleIssuesResponse, issues: [] }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "list-my-issues",
                arguments: { statusId: "closed" },
            });

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain("status_id=closed");
        } finally {
            await cleanup();
        }
    });

    it("passes project filter to API", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({ ...sampleIssuesResponse, issues: [] }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "list-my-issues",
                arguments: { projectId: "my-project" },
            });

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain("project_id=my-project");
        } finally {
            await cleanup();
        }
    });

    it("passes pagination parameters to API", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    ...sampleIssuesResponse,
                    offset: 10,
                    limit: 5,
                }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-my-issues",
                arguments: { limit: 5, offset: 10 },
            })) as ToolResult;

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain("limit=5");
            expect(url).toContain("offset=10");

            const responseData = parseMyIssuesResult(result);
            expect(responseData.offset).toBe(10);
            expect(responseData.limit).toBe(5);
        } finally {
            await cleanup();
        }
    });

    it("passes sort parameter to API", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleIssuesResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "list-my-issues",
                arguments: { sort: "priority:desc" },
            });

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain("sort=priority%3Adesc");
        } finally {
            await cleanup();
        }
    });

    it("handles API errors gracefully", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            statusText: "Unauthorized",
            json: () => Promise.resolve({ errors: ["Invalid API key"] }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-my-issues",
                arguments: {},
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("401");
        } finally {
            await cleanup();
        }
    });

    it("handles network errors gracefully", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-my-issues",
                arguments: {},
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("Network error");
        } finally {
            await cleanup();
        }
    });

    it("returns empty list when no issues assigned", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    issues: [],
                    total_count: 0,
                    offset: 0,
                    limit: 25,
                }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-my-issues",
                arguments: {},
            })) as ToolResult;

            expect(result.isError).toBeFalsy();
            const responseData = parseMyIssuesResult(result);
            expect(responseData.issues).toHaveLength(0);
            expect(responseData.total_count).toBe(0);
        } finally {
            await cleanup();
        }
    });
});
