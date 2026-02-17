import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    parsePrioritiesResult,
    setupTestEnv,
} from "../../test-utils.js";

const samplePrioritiesResponse = {
    issue_priorities: [
        { id: 1, name: "Low", is_default: false },
        { id: 2, name: "Normal", is_default: true },
        { id: 3, name: "High", is_default: false },
        { id: 4, name: "Urgent", is_default: false },
        { id: 5, name: "Immediate", is_default: false },
    ],
};

describe("list-issue-priorities tool", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("returns all priorities with is_default field", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(samplePrioritiesResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-issue-priorities",
                arguments: {},
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe(
                "https://test.redmine.com/enumerations/issue_priorities.json",
            );
            expect(
                (options.headers as Record<string, string>)[
                    "X-Redmine-API-Key"
                ],
            ).toBe("test-api-key");

            expect(result.isError).toBeFalsy();
            const priorities = parsePrioritiesResult(result);

            expect(priorities).toHaveLength(5);
            expect(priorities[0].id).toBe(1);
            expect(priorities[0].name).toBe("Low");
            expect(priorities[0].is_default).toBe(false);

            expect(priorities[1].id).toBe(2);
            expect(priorities[1].name).toBe("Normal");
            expect(priorities[1].is_default).toBe(true);
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
                name: "list-issue-priorities",
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
