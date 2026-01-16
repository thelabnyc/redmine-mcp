import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    parseProjectsResult,
    setupTestEnv,
} from "../../test-utils.js";

const sampleProjectsResponse = {
    projects: [
        {
            id: 154,
            name: "Tula",
            identifier: "tula",
            description: "Tula project description",
            status: 1,
            is_public: false,
            created_on: "2024-01-01T00:00:00Z",
            updated_on: "2024-01-15T00:00:00Z",
        },
        {
            id: 164,
            name: "First Aid Beauty",
            identifier: "pg_fab",
            description: "FAB project",
            status: 1,
            is_public: false,
            created_on: "2024-01-02T00:00:00Z",
            updated_on: "2024-01-16T00:00:00Z",
        },
        {
            id: 134,
            name: "Emtek",
            identifier: "emtek-website",
            description: "Emtek website project",
            status: 1,
            is_public: false,
            created_on: "2024-01-03T00:00:00Z",
            updated_on: "2024-01-17T00:00:00Z",
        },
    ],
    total_count: 3,
    offset: 0,
    limit: 100,
};

describe("list-projects tool", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("returns projects as JSON", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleProjectsResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-projects",
                arguments: {},
            })) as ToolResult;

            expect(result.isError).toBeFalsy();
            const parsed = parseProjectsResult(result);

            expect(parsed.total_count).toBe(3);
            expect(parsed.projects).toHaveLength(3);

            // Check slim response (only id, identifier, name)
            expect(parsed.projects[0]).toEqual({
                id: 154,
                identifier: "tula",
                name: "Tula",
            });
            expect(parsed.projects[1]).toEqual({
                id: 164,
                identifier: "pg_fab",
                name: "First Aid Beauty",
            });
            expect(parsed.projects[2]).toEqual({
                id: 134,
                identifier: "emtek-website",
                name: "Emtek",
            });

            // Verify extra fields are stripped
            expect(parsed.projects[0]).not.toHaveProperty("description");
            expect(parsed.projects[0]).not.toHaveProperty("status");
            expect(parsed.projects[0]).not.toHaveProperty("is_public");
            expect(parsed.projects[0]).not.toHaveProperty("created_on");
            expect(parsed.projects[0]).not.toHaveProperty("updated_on");

            // Verify fetch was called correctly
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toContain("/projects.json");
            expect(url).toContain("limit=100");
            expect(
                (options.headers as Record<string, string>)[
                    "X-Redmine-API-Key"
                ],
            ).toBe("test-api-key");
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
                    ...sampleProjectsResponse,
                    offset: 10,
                    limit: 25,
                }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-projects",
                arguments: { limit: 25, offset: 10 },
            })) as ToolResult;

            const parsed = parseProjectsResult(result);
            expect(parsed.offset).toBe(10);
            expect(parsed.limit).toBe(25);

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain("limit=25");
            expect(url).toContain("offset=10");
        } finally {
            await cleanup();
        }
    });

    it("returns pagination info when more projects exist", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    projects: sampleProjectsResponse.projects.slice(0, 2),
                    total_count: 68,
                    offset: 0,
                    limit: 2,
                }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-projects",
                arguments: { limit: 2 },
            })) as ToolResult;

            const parsed = parseProjectsResult(result);
            expect(parsed.total_count).toBe(68);
            expect(parsed.projects).toHaveLength(2);
            expect(parsed.offset).toBe(0);
            expect(parsed.limit).toBe(2);
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
                name: "list-projects",
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
                name: "list-projects",
                arguments: {},
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("Network error");
        } finally {
            await cleanup();
        }
    });

    it("returns empty list when no projects", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    projects: [],
                    total_count: 0,
                    offset: 0,
                    limit: 100,
                }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-projects",
                arguments: {},
            })) as ToolResult;

            expect(result.isError).toBeFalsy();
            const parsed = parseProjectsResult(result);
            expect(parsed.total_count).toBe(0);
            expect(parsed.projects).toHaveLength(0);
        } finally {
            await cleanup();
        }
    });
});
