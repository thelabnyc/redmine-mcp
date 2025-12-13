import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    parseIssueResult,
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

const sampleIssueWithAttachments = {
    issue: {
        ...sampleIssueResponse.issue,
        attachments: [
            {
                id: 1,
                filename: "screenshot.png",
                filesize: 12345,
                content_type: "image/png",
                description: "Screenshot of the bug",
                author: { id: 1, name: "John Doe" },
                created_on: "2024-01-15T10:00:00Z",
            },
        ],
    },
};

describe("get-issue tool", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("returns issue details with journals included by default", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleIssueResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "get-issue",
                arguments: { issueId: "12345" },
            })) as ToolResult;

            // Verify fetch was called with correct URL and headers
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe(
                "https://test.redmine.com/issues/12345.json?include=journals",
            );
            expect(
                (options.headers as Record<string, string>)[
                    "X-Redmine-API-Key"
                ],
            ).toBe("test-api-key");

            // Verify response structure
            expect(result.isError).toBeFalsy();
            expect(result.content).toBeDefined();
            expect(result.content.length).toBeGreaterThan(0);

            // Parse the response
            const responseData = parseIssueResult(result);
            const issueData = responseData.issue;

            // Verify issue fields
            expect(issueData.id).toBe(12345);
            expect(issueData.subject).toBe("Test issue subject");
            expect(issueData.description).toBe(
                "This is a test issue description",
            );
            expect(issueData.project.name).toBe("Test Project");
            expect(issueData.status.name).toBe("New");
            expect(issueData.priority.name).toBe("Normal");
            expect(issueData.author.name).toBe("John Doe");
            expect(issueData.assigned_to?.name).toBe("Jane Smith");
            expect(issueData.done_ratio).toBe(50);

            // Verify journals are included
            expect(issueData.journals).toBeDefined();
            expect(issueData.journals).toHaveLength(2);
            expect(issueData.journals?.[0].notes).toBe(
                "Added initial description",
            );
            expect(issueData.journals?.[1].notes).toBe("Working on this now");

            // Verify journal pagination metadata
            expect(responseData.journalPagination).toBeDefined();
            expect(responseData.journalPagination?.total_count).toBe(2);
            expect(responseData.journalPagination?.offset).toBe(0);
            expect(responseData.journalPagination?.limit).toBe(5);
        } finally {
            await cleanup();
        }
    });

    it("handles issue ID with # prefix", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleIssueResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "get-issue",
                arguments: { issueId: "#12345" },
            });

            // Verify the # was stripped from the URL
            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toBe(
                "https://test.redmine.com/issues/12345.json?include=journals",
            );
        } finally {
            await cleanup();
        }
    });

    it("includes optional data when requested", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleIssueWithAttachments),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "get-issue",
                arguments: {
                    issueId: "12345",
                    includeAttachments: true,
                    includeWatchers: true,
                },
            })) as ToolResult;

            // Verify fetch was called with correct include params
            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain("include=");
            expect(url).toContain("journals");
            expect(url).toContain("attachments");
            expect(url).toContain("watchers");

            // Verify response includes attachments
            expect(result.isError).toBeFalsy();
            const responseData = parseIssueResult(result);
            expect(responseData.issue.attachments).toBeDefined();
            expect(responseData.issue.attachments).toHaveLength(1);
            expect(responseData.issue.attachments?.[0].filename).toBe(
                "screenshot.png",
            );
        } finally {
            await cleanup();
        }
    });

    it("handles 404 error gracefully", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: "Not Found",
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "get-issue",
                arguments: { issueId: "99999" },
            })) as ToolResult;

            // Verify error response
            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("404");
        } finally {
            await cleanup();
        }
    });

    it("handles network errors gracefully", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "get-issue",
                arguments: { issueId: "12345" },
            })) as ToolResult;

            // Verify error response
            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("Network error");
        } finally {
            await cleanup();
        }
    });

    it("paginates journals with limit and offset", async () => {
        // Create an issue with many journals
        const manyJournals = Array.from({ length: 50 }, (_, i) => ({
            id: i + 1,
            user: { id: 1, name: "John Doe" },
            notes: `Journal entry ${i + 1}`,
            created_on: "2024-01-15T10:00:00Z",
            details: [],
        }));

        const issueWithManyJournals = {
            issue: {
                ...sampleIssueResponse.issue,
                journals: manyJournals,
            },
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(issueWithManyJournals),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "get-issue",
                arguments: {
                    issueId: "12345",
                    journalLimit: 10,
                    journalOffset: 5,
                },
            })) as ToolResult;

            expect(result.isError).toBeFalsy();
            const responseData = parseIssueResult(result);

            // Should return only 10 journals starting from offset 5
            expect(responseData.issue.journals).toHaveLength(10);
            expect(responseData.issue.journals?.[0].notes).toBe(
                "Journal entry 6",
            );
            expect(responseData.issue.journals?.[9].notes).toBe(
                "Journal entry 15",
            );

            // Pagination metadata should reflect the full count
            expect(responseData.journalPagination?.total_count).toBe(50);
            expect(responseData.journalPagination?.offset).toBe(5);
            expect(responseData.journalPagination?.limit).toBe(10);
        } finally {
            await cleanup();
        }
    });

    it("applies default journal limit of 10", async () => {
        // Create an issue with 50 journals
        const manyJournals = Array.from({ length: 50 }, (_, i) => ({
            id: i + 1,
            user: { id: 1, name: "John Doe" },
            notes: `Journal entry ${i + 1}`,
            created_on: "2024-01-15T10:00:00Z",
            details: [],
        }));

        const issueWithManyJournals = {
            issue: {
                ...sampleIssueResponse.issue,
                journals: manyJournals,
            },
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(issueWithManyJournals),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "get-issue",
                arguments: { issueId: "12345" },
            })) as ToolResult;

            expect(result.isError).toBeFalsy();
            const responseData = parseIssueResult(result);

            // Should return only first 5 journals by default
            expect(responseData.issue.journals).toHaveLength(5);
            expect(responseData.issue.journals?.[0].notes).toBe(
                "Journal entry 1",
            );
            expect(responseData.issue.journals?.[4].notes).toBe(
                "Journal entry 5",
            );

            // Pagination metadata should show total count
            expect(responseData.journalPagination?.total_count).toBe(50);
            expect(responseData.journalPagination?.offset).toBe(0);
            expect(responseData.journalPagination?.limit).toBe(5);
        } finally {
            await cleanup();
        }
    });
});
