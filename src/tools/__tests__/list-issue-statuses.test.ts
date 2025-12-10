import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    parseIssueStatusesResult,
    setupTestEnv,
} from "../../test-utils.js";

// Sample issue statuses response
const sampleIssueStatusesResponse = {
    issue_statuses: [
        { id: 1, name: "New", is_closed: false },
        { id: 2, name: "In Progress", is_closed: false },
        { id: 3, name: "Resolved", is_closed: false },
        { id: 4, name: "Feedback", is_closed: false },
        { id: 5, name: "Closed", is_closed: true },
        { id: 6, name: "Rejected", is_closed: true },
    ],
};

describe("list-issue-statuses tool", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("returns all issue statuses", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleIssueStatusesResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-issue-statuses",
                arguments: {},
            })) as ToolResult;

            // Verify fetch was called with correct URL
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("https://test.redmine.com/issue_statuses.json");
            expect(
                (options.headers as Record<string, string>)[
                    "X-Redmine-API-Key"
                ],
            ).toBe("test-api-key");

            // Verify response structure
            expect(result.isError).toBeFalsy();
            const statuses = parseIssueStatusesResult(result);

            expect(statuses).toHaveLength(6);
            expect(statuses[0].id).toBe(1);
            expect(statuses[0].name).toBe("New");
            expect(statuses[0].is_closed).toBe(false);

            // Check closed status
            expect(statuses[4].id).toBe(5);
            expect(statuses[4].name).toBe("Closed");
            expect(statuses[4].is_closed).toBe(true);
        } finally {
            await cleanup();
        }
    });

    it("handles API error gracefully", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-issue-statuses",
                arguments: {},
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("500");
        } finally {
            await cleanup();
        }
    });
});
