import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    parseTrackersResult,
    setupTestEnv,
} from "../../test-utils.js";

const sampleTrackersResponse = {
    trackers: [
        {
            id: 1,
            name: "Bug",
            default_status: { id: 1, name: "New" },
            description: "Bug reports",
            enabled_standard_fields: [
                "assigned_to_id",
                "category_id",
                "fixed_version_id",
                "parent_issue_id",
                "start_date",
                "due_date",
                "estimated_hours",
                "done_ratio",
                "description",
            ],
        },
        {
            id: 2,
            name: "Feature",
            default_status: { id: 1, name: "New" },
            description: "",
            enabled_standard_fields: [
                "assigned_to_id",
                "category_id",
                "fixed_version_id",
                "parent_issue_id",
                "start_date",
                "due_date",
                "estimated_hours",
                "done_ratio",
                "description",
            ],
        },
        {
            id: 3,
            name: "Support",
            default_status: { id: 1, name: "New" },
        },
    ],
};

describe("list-trackers tool", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("returns all trackers with detail fields", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleTrackersResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-trackers",
                arguments: {},
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("https://test.redmine.com/trackers.json");
            expect(
                (options.headers as Record<string, string>)[
                    "X-Redmine-API-Key"
                ],
            ).toBe("test-api-key");

            expect(result.isError).toBeFalsy();
            const trackers = parseTrackersResult(result);

            expect(trackers).toHaveLength(3);
            expect(trackers[0].id).toBe(1);
            expect(trackers[0].name).toBe("Bug");
            expect(trackers[0].default_status).toEqual({
                id: 1,
                name: "New",
            });
            expect(trackers[0].description).toBe("Bug reports");
            expect(trackers[0].enabled_standard_fields).toContain(
                "assigned_to_id",
            );

            expect(trackers[2].id).toBe(3);
            expect(trackers[2].name).toBe("Support");
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
                name: "list-trackers",
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
