import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    setupTestEnv,
} from "../../test-utils.js";

interface AddWatcherRequestBody {
    user_id: number;
}

function parseAddWatcherResult(result: ToolResult): {
    added: boolean;
    issueId: number;
    userId: number;
} {
    return JSON.parse(getTextContent(result)) as {
        added: boolean;
        issueId: number;
        userId: number;
    };
}

function parseRemoveWatcherResult(result: ToolResult): {
    removed: boolean;
    issueId: number;
    userId: number;
} {
    return JSON.parse(getTextContent(result)) as {
        removed: boolean;
        issueId: number;
        userId: number;
    };
}

describe("watcher tools", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("adds a watcher to an issue", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 204,
            statusText: "No Content",
            json: () => Promise.resolve({}),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "add-issue-watcher",
                arguments: {
                    issueId: "#8470",
                    userId: 15,
                },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe(
                "https://test.redmine.com/issues/8470/watchers.json",
            );
            expect(options.method).toBe("POST");
            expect(
                (options.headers as Record<string, string>)[
                    "X-Redmine-API-Key"
                ],
            ).toBe("test-api-key");
            expect(
                (options.headers as Record<string, string>)["Content-Type"],
            ).toBe("application/json");
            const body = JSON.parse(
                options.body as string,
            ) as AddWatcherRequestBody;
            expect(body).toEqual({ user_id: 15 });

            expect(result.isError).toBeFalsy();
            expect(parseAddWatcherResult(result)).toEqual({
                added: true,
                issueId: 8470,
                userId: 15,
            });
        } finally {
            await cleanup();
        }
    });

    it("removes a watcher from an issue", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 204,
            statusText: "No Content",
            json: () => Promise.resolve({}),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "remove-issue-watcher",
                arguments: {
                    issueId: 8470,
                    userId: 15,
                },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe(
                "https://test.redmine.com/issues/8470/watchers/15.json",
            );
            expect(options.method).toBe("DELETE");
            expect(
                (options.headers as Record<string, string>)[
                    "X-Redmine-API-Key"
                ],
            ).toBe("test-api-key");

            expect(result.isError).toBeFalsy();
            expect(parseRemoveWatcherResult(result)).toEqual({
                removed: true,
                issueId: 8470,
                userId: 15,
            });
        } finally {
            await cleanup();
        }
    });

    it("rejects invalid issue IDs before adding watchers", async () => {
        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "add-issue-watcher",
                arguments: {
                    issueId: "not-an-id",
                    userId: 15,
                },
            })) as ToolResult;

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                "Invalid issue ID: not-an-id",
            );
        } finally {
            await cleanup();
        }
    });

    it("rejects malformed issue ID strings before adding watchers", async () => {
        const { client, cleanup } = await createTestClientServer();

        try {
            for (const issueId of ["-1", "123abc", "1.5", "0"]) {
                mockFetch.mockClear();

                const result = (await client.callTool({
                    name: "add-issue-watcher",
                    arguments: {
                        issueId,
                        userId: 15,
                    },
                })) as ToolResult;

                expect(mockFetch).not.toHaveBeenCalled();
                expect(result.isError).toBe(true);
                expect(getTextContent(result)).toContain(
                    `Invalid issue ID: ${issueId}`,
                );
            }
        } finally {
            await cleanup();
        }
    });

    it("rejects unsafe integer issue ID strings before adding watchers", async () => {
        const issueId = "9007199254740993";
        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "add-issue-watcher",
                arguments: {
                    issueId,
                    userId: 15,
                },
            })) as ToolResult;

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                `Invalid issue ID: ${issueId}`,
            );
        } finally {
            await cleanup();
        }
    });

    it("rejects invalid issue IDs before removing watchers", async () => {
        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "remove-issue-watcher",
                arguments: {
                    issueId: "not-an-id",
                    userId: 15,
                },
            })) as ToolResult;

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                "Invalid issue ID: not-an-id",
            );
        } finally {
            await cleanup();
        }
    });

    it("rejects malformed issue ID strings before removing watchers", async () => {
        const { client, cleanup } = await createTestClientServer();

        try {
            for (const issueId of ["-1", "123abc", "1.5", "0"]) {
                mockFetch.mockClear();

                const result = (await client.callTool({
                    name: "remove-issue-watcher",
                    arguments: {
                        issueId,
                        userId: 15,
                    },
                })) as ToolResult;

                expect(mockFetch).not.toHaveBeenCalled();
                expect(result.isError).toBe(true);
                expect(getTextContent(result)).toContain(
                    `Invalid issue ID: ${issueId}`,
                );
            }
        } finally {
            await cleanup();
        }
    });

    it("rejects unsafe integer issue ID strings before removing watchers", async () => {
        const issueId = "9007199254740993";
        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "remove-issue-watcher",
                arguments: {
                    issueId,
                    userId: 15,
                },
            })) as ToolResult;

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                `Invalid issue ID: ${issueId}`,
            );
        } finally {
            await cleanup();
        }
    });

    it("surfaces Redmine validation errors when adding watchers", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 422,
            statusText: "Unprocessable Entity",
            json: () =>
                Promise.resolve({
                    errors: ["User is already watching this issue"],
                }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "add-issue-watcher",
                arguments: {
                    issueId: "#8470",
                    userId: 15,
                },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("422");
            expect(errorText).toContain("User is already watching this issue");
        } finally {
            await cleanup();
        }
    });

    it("surfaces Redmine errors when removing watchers", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: "Not Found",
            json: () =>
                Promise.resolve({
                    errors: ["Watcher not found"],
                }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "remove-issue-watcher",
                arguments: {
                    issueId: "#8470",
                    userId: 15,
                },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("404");
            expect(errorText).toContain("Watcher not found");
        } finally {
            await cleanup();
        }
    });

    it("surfaces network errors when adding watchers", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "add-issue-watcher",
                arguments: {
                    issueId: "#8470",
                    userId: 15,
                },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain("Network error");
        } finally {
            await cleanup();
        }
    });
});
