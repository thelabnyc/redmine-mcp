import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    parseMembershipsResult,
    setupTestEnv,
} from "../../test-utils.js";

// Sample project memberships response
const sampleMembershipsResponse = {
    memberships: [
        {
            id: 1,
            project: { id: 1, name: "Test Project" },
            user: { id: 1, name: "John Doe" },
            roles: [{ id: 3, name: "Manager" }],
        },
        {
            id: 2,
            project: { id: 1, name: "Test Project" },
            user: { id: 2, name: "Jane Smith" },
            roles: [{ id: 4, name: "Developer" }],
        },
        {
            id: 3,
            project: { id: 1, name: "Test Project" },
            group: { id: 5, name: "QA Team" },
            roles: [{ id: 5, name: "Reporter" }],
        },
    ],
    total_count: 3,
    offset: 0,
    limit: 25,
};

describe("list-project-members tool", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("returns project members", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleMembershipsResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-project-members",
                arguments: { projectId: "test-project" },
            })) as ToolResult;

            // Verify fetch was called with correct URL
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe(
                "https://test.redmine.com/projects/test-project/memberships.json",
            );
            expect(
                (options.headers as Record<string, string>)[
                    "X-Redmine-API-Key"
                ],
            ).toBe("test-api-key");

            // Verify response structure
            expect(result.isError).toBeFalsy();
            const data = parseMembershipsResult(result);

            expect(data.memberships).toHaveLength(3);
            expect(data.total_count).toBe(3);

            // Check user membership
            expect(data.memberships[0].user?.name).toBe("John Doe");
            expect(data.memberships[0].roles[0].name).toBe("Manager");

            // Check group membership
            expect(data.memberships[2].group?.name).toBe("QA Team");
        } finally {
            await cleanup();
        }
    });

    it("supports pagination with limit and offset", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleMembershipsResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "list-project-members",
                arguments: { projectId: "1", limit: 10, offset: 5 },
            });

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain("limit=10");
            expect(url).toContain("offset=5");
        } finally {
            await cleanup();
        }
    });

    it("handles 404 error for non-existent project", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: "Not Found",
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-project-members",
                arguments: { projectId: "non-existent" },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("404");
        } finally {
            await cleanup();
        }
    });
});
