import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    parseCustomFieldsResult,
    setupTestEnv,
} from "../../test-utils.js";

const sampleProjectWithCustomFields = {
    project: {
        id: 1,
        name: "Test Project",
        identifier: "test-project",
        issue_custom_fields: [
            { id: 1, name: "Sprint" },
            { id: 2, name: "Story Points" },
            { id: 3, name: "Environment" },
        ],
    },
};

const sampleProjectWithoutCustomFields = {
    project: {
        id: 2,
        name: "Empty Project",
        identifier: "empty-project",
    },
};

describe("list-project-custom-fields tool", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("returns custom fields for a project", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleProjectWithCustomFields),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-project-custom-fields",
                arguments: { projectId: "test-project" },
            })) as ToolResult;

            // Verify fetch URL includes ?include=issue_custom_fields
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toBe(
                "https://test.redmine.com/projects/test-project.json?include=issue_custom_fields",
            );

            // Verify response
            expect(result.isError).toBeFalsy();
            const fields = parseCustomFieldsResult(result);
            expect(fields).toHaveLength(3);
            expect(fields[0].id).toBe(1);
            expect(fields[0].name).toBe("Sprint");
            expect(fields[2].id).toBe(3);
            expect(fields[2].name).toBe("Environment");
        } finally {
            await cleanup();
        }
    });

    it("returns empty array when project has no custom fields", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleProjectWithoutCustomFields),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-project-custom-fields",
                arguments: { projectId: "empty-project" },
            })) as ToolResult;

            expect(result.isError).toBeFalsy();
            const fields = parseCustomFieldsResult(result);
            expect(fields).toHaveLength(0);
        } finally {
            await cleanup();
        }
    });

    it("handles API error", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: "Not Found",
            json: () => Promise.reject(new Error("not json")),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-project-custom-fields",
                arguments: { projectId: "nonexistent" },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("404");
        } finally {
            await cleanup();
        }
    });
});
