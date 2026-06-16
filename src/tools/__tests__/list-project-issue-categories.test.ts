import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RedmineIssueCategory } from "../../redmine.js";
import {
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    setupTestEnv,
} from "../../test-utils.js";

const sampleIssueCategoriesResponse = {
    issue_categories: [
        {
            id: 1,
            project: { id: 1, name: "Test Project" },
            name: "Backend",
            assigned_to: { id: 5, name: "Jane Developer" },
        },
        {
            id: 2,
            project: { id: 1, name: "Test Project" },
            name: "Frontend",
        },
    ],
    total_count: 2,
};

function parseIssueCategoriesResult(result: ToolResult): {
    issue_categories: RedmineIssueCategory[];
    total_count: number;
} {
    return JSON.parse(getTextContent(result)) as {
        issue_categories: RedmineIssueCategory[];
        total_count: number;
    };
}

describe("list-project-issue-categories tool", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("returns project issue categories", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleIssueCategoriesResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-project-issue-categories",
                arguments: { projectId: 1 },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe(
                "https://test.redmine.com/projects/1/issue_categories.json",
            );
            expect(
                (options.headers as Record<string, string>)[
                    "X-Redmine-API-Key"
                ],
            ).toBe("test-api-key");
            expect((options.headers as Record<string, string>)["Accept"]).toBe(
                "application/json",
            );

            expect(result.isError).toBeFalsy();
            const data = parseIssueCategoriesResult(result);
            expect(data.issue_categories).toHaveLength(2);
            expect(data.total_count).toBe(2);
            expect(data.issue_categories[0].name).toBe("Backend");
            expect(data.issue_categories[0].assigned_to?.id).toBe(5);
            expect(data.issue_categories[1].assigned_to).toBeUndefined();
        } finally {
            await cleanup();
        }
    });

    it("URL-encodes string project IDs in path segments", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleIssueCategoriesResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "list-project-issue-categories",
                arguments: { projectId: "client/app?#main" },
            });

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toBe(
                "https://test.redmine.com/projects/client%2Fapp%3F%23main/issue_categories.json",
            );
        } finally {
            await cleanup();
        }
    });

    it("handles API error", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 403,
            statusText: "Forbidden",
            json: () => Promise.resolve({ errors: ["Access denied"] }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-project-issue-categories",
                arguments: { projectId: "private-project" },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("403");
            expect(errorText).toContain("Access denied");
        } finally {
            await cleanup();
        }
    });

    it("handles network error", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-project-issue-categories",
                arguments: { projectId: "test-project" },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("Network error");
        } finally {
            await cleanup();
        }
    });
});
