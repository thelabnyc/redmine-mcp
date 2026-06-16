import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RedmineVersion } from "../../redmine.js";
import {
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    setupTestEnv,
} from "../../test-utils.js";

const sampleVersionsResponse = {
    versions: [
        {
            id: 1,
            project: { id: 1, name: "Test Project" },
            name: "1.0.0",
            description: "Initial release",
            status: "open",
            due_date: "2026-07-01",
            sharing: "none",
            created_on: "2026-06-01T10:00:00Z",
            updated_on: "2026-06-02T11:00:00Z",
            wiki_page_title: "Version 1.0.0",
            estimated_hours: 12,
            spent_hours: 4.5,
        },
        {
            id: 2,
            project: { id: 1, name: "Test Project" },
            name: "1.1.0",
            status: "locked",
            sharing: "system",
            created_on: "2026-06-03T10:00:00Z",
            updated_on: "2026-06-04T11:00:00Z",
        },
    ],
    total_count: 2,
};

function parseVersionsResult(result: ToolResult): {
    versions: RedmineVersion[];
    total_count: number;
} {
    return JSON.parse(getTextContent(result)) as {
        versions: RedmineVersion[];
        total_count: number;
    };
}

describe("list-project-versions tool", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("returns project versions", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleVersionsResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-project-versions",
                arguments: { projectId: "test-project" },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe(
                "https://test.redmine.com/projects/test-project/versions.json",
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
            const data = parseVersionsResult(result);
            expect(data.versions).toHaveLength(2);
            expect(data.total_count).toBe(2);
            expect(data.versions[0].name).toBe("1.0.0");
            expect(data.versions[0].estimated_hours).toBe(12);
            expect(data.versions[0].spent_hours).toBe(4.5);
        } finally {
            await cleanup();
        }
    });

    it("URL-encodes string project IDs in path segments", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleVersionsResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "list-project-versions",
                arguments: { projectId: "client/app?#main" },
            });

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toBe(
                "https://test.redmine.com/projects/client%2Fapp%3F%23main/versions.json",
            );
        } finally {
            await cleanup();
        }
    });

    it("handles API error", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: "Not Found",
            json: () => Promise.resolve({ errors: ["Project not found"] }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-project-versions",
                arguments: { projectId: "missing-project" },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("404");
            expect(errorText).toContain("Project not found");
        } finally {
            await cleanup();
        }
    });

    it("handles network error", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-project-versions",
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
