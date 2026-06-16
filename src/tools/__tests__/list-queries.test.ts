import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    setupTestEnv,
} from "../../test-utils.js";

interface ParsedQueriesResult {
    queries: Array<{
        id: number;
        name: string;
        is_public: boolean;
        project_id?: number;
    }>;
    total_count: number;
    offset: number;
    limit: number;
}

function parseQueriesResult(result: ToolResult): ParsedQueriesResult {
    return JSON.parse(getTextContent(result)) as ParsedQueriesResult;
}

const sampleQueriesResponse = {
    queries: [
        {
            id: 1,
            name: "Open bugs",
            is_public: true,
            project_id: 154,
        },
        {
            id: 2,
            name: "My private issues",
            is_public: false,
        },
    ],
    total_count: 2,
    offset: 0,
    limit: 25,
};

describe("list-queries tool", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("returns saved queries with pagination metadata", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleQueriesResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-queries",
                arguments: {},
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("https://test.redmine.com/queries.json");
            expect(
                (options.headers as Record<string, string>)[
                    "X-Redmine-API-Key"
                ],
            ).toBe("test-api-key");
            expect((options.headers as Record<string, string>)["Accept"]).toBe(
                "application/json",
            );

            expect(result.isError).toBeFalsy();
            const parsed = parseQueriesResult(result);
            expect(parsed).toEqual(sampleQueriesResponse);
        } finally {
            await cleanup();
        }
    });

    it("passes limit and offset to the API", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    ...sampleQueriesResponse,
                    offset: 50,
                    limit: 25,
                }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-queries",
                arguments: { limit: 25, offset: 50 },
            })) as ToolResult;

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toBe(
                "https://test.redmine.com/queries.json?limit=25&offset=50",
            );

            const parsed = parseQueriesResult(result);
            expect(parsed.offset).toBe(50);
            expect(parsed.limit).toBe(25);
        } finally {
            await cleanup();
        }
    });

    it("surfaces API errors with status and Redmine error details", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 403,
            statusText: "Forbidden",
            json: () =>
                Promise.resolve({
                    errors: ["You are not authorized to access this page."],
                }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-queries",
                arguments: {},
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("403");
            expect(errorText).toContain(
                "You are not authorized to access this page.",
            );
        } finally {
            await cleanup();
        }
    });

    it("surfaces network errors", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network unavailable"));

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-queries",
                arguments: {},
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain("Network unavailable");
        } finally {
            await cleanup();
        }
    });
});
