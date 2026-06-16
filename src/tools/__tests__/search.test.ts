import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    setupTestEnv,
} from "../../test-utils.js";

interface ParsedSearchResult {
    results: Array<{
        id: number;
        title: string;
        type: string;
        url: string;
        description?: string;
        datetime?: string;
    }>;
    total_count: number;
    offset: number;
    limit: number;
}

function parseSearchResult(result: ToolResult): ParsedSearchResult {
    return JSON.parse(getTextContent(result)) as ParsedSearchResult;
}

function getCalledUrl(): URL {
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    return new URL(url);
}

const sampleSearchResponse = {
    results: [
        {
            id: 123,
            title: "Fix cache invalidation",
            type: "issue",
            url: "https://test.redmine.com/issues/123",
            description: "Search result description",
            datetime: "2024-01-15T10:00:00Z",
        },
        {
            id: 154,
            title: "Cache documentation",
            type: "wiki-page",
            url: "https://test.redmine.com/projects/app/wiki/Cache",
        },
    ],
    total_count: 2,
    offset: 0,
    limit: 25,
};

describe("search-redmine tool", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("searches Redmine with query and returns results with metadata", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleSearchResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "search-redmine",
                arguments: { query: "cache" },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("https://test.redmine.com/search.json?q=cache");
            expect(
                (options.headers as Record<string, string>)[
                    "X-Redmine-API-Key"
                ],
            ).toBe("test-api-key");
            expect((options.headers as Record<string, string>)["Accept"]).toBe(
                "application/json",
            );

            expect(result.isError).toBeFalsy();
            expect(parseSearchResult(result)).toEqual(sampleSearchResponse);
        } finally {
            await cleanup();
        }
    });

    it("serializes enabled filters using Redmine parameter names", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({ ...sampleSearchResponse, results: [] }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "search-redmine",
                arguments: {
                    query: "release notes",
                    scope: "all",
                    allWords: true,
                    titlesOnly: true,
                    issues: true,
                    documents: true,
                    wikiPages: true,
                    projects: true,
                    attachments: true,
                    openIssues: true,
                    limit: 10,
                    offset: 20,
                },
            });

            const url = getCalledUrl();
            const params = url.searchParams;
            expect(url.pathname).toBe("/search.json");
            expect(params.get("q")).toBe("release notes");
            expect(params.get("scope")).toBe("all");
            expect(params.get("all_words")).toBe("1");
            expect(params.get("titles_only")).toBe("1");
            expect(params.get("issues")).toBe("1");
            expect(params.get("documents")).toBe("1");
            expect(params.get("wiki_pages")).toBe("1");
            expect(params.get("projects")).toBe("1");
            expect(params.get("attachments")).toBe("1");
            expect(params.get("open_issues")).toBe("1");
            expect(params.get("limit")).toBe("10");
            expect(params.get("offset")).toBe("20");
        } finally {
            await cleanup();
        }
    });

    it("omits false presence-based filters", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({ ...sampleSearchResponse, results: [] }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "search-redmine",
                arguments: {
                    query: "cache",
                    titlesOnly: false,
                    issues: false,
                    news: false,
                    documents: false,
                    changesets: false,
                    wikiPages: false,
                    messages: false,
                    projects: false,
                    openIssues: false,
                },
            });

            const params = getCalledUrl().searchParams;
            expect(params.has("titles_only")).toBe(false);
            expect(params.has("issues")).toBe(false);
            expect(params.has("news")).toBe(false);
            expect(params.has("documents")).toBe(false);
            expect(params.has("changesets")).toBe(false);
            expect(params.has("wiki_pages")).toBe(false);
            expect(params.has("messages")).toBe(false);
            expect(params.has("projects")).toBe(false);
            expect(params.has("open_issues")).toBe(false);
        } finally {
            await cleanup();
        }
    });

    it("serializes allWords false as an empty value", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({ ...sampleSearchResponse, results: [] }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "search-redmine",
                arguments: { query: "cache", allWords: false },
            });

            const params = getCalledUrl().searchParams;
            expect(params.has("all_words")).toBe(true);
            expect(params.get("all_words")).toBe("");
        } finally {
            await cleanup();
        }
    });

    it("serializes attachment search modes", async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({ ...sampleSearchResponse, results: [] }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({ ...sampleSearchResponse, results: [] }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({ ...sampleSearchResponse, results: [] }),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "search-redmine",
                arguments: { query: "cache", attachments: true },
            });
            await client.callTool({
                name: "search-redmine",
                arguments: { query: "cache", attachments: false },
            });
            await client.callTool({
                name: "search-redmine",
                arguments: { query: "cache", attachments: "only" },
            });

            const firstCall = new URL(mockFetch.mock.calls[0]?.[0] as string);
            const secondCall = new URL(mockFetch.mock.calls[1]?.[0] as string);
            const thirdCall = new URL(mockFetch.mock.calls[2]?.[0] as string);

            expect(firstCall.searchParams.get("attachments")).toBe("1");
            expect(secondCall.searchParams.get("attachments")).toBe("0");
            expect(thirdCall.searchParams.get("attachments")).toBe("only");
        } finally {
            await cleanup();
        }
    });

    it("omits optional booleans when they are undefined", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({ ...sampleSearchResponse, results: [] }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "search-redmine",
                arguments: { query: "cache", limit: 5 },
            });

            const params = getCalledUrl().searchParams;
            expect(params.get("q")).toBe("cache");
            expect(params.get("limit")).toBe("5");
            expect(params.has("all_words")).toBe(false);
            expect(params.has("titles_only")).toBe(false);
            expect(params.has("issues")).toBe(false);
            expect(params.has("news")).toBe(false);
            expect(params.has("documents")).toBe(false);
            expect(params.has("changesets")).toBe(false);
            expect(params.has("wiki_pages")).toBe(false);
            expect(params.has("messages")).toBe(false);
            expect(params.has("projects")).toBe(false);
            expect(params.has("attachments")).toBe(false);
            expect(params.has("open_issues")).toBe(false);
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
                name: "search-redmine",
                arguments: { query: "cache" },
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
                name: "search-redmine",
                arguments: { query: "cache" },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain("Network unavailable");
        } finally {
            await cleanup();
        }
    });
});
