import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    parseCurrentUserResult,
    setupTestEnv,
} from "../../test-utils.js";

// Sample current user response
const sampleCurrentUserResponse = {
    user: {
        id: 1,
        login: "jsmith",
        firstname: "John",
        lastname: "Smith",
        mail: "jsmith@example.com",
        created_on: "2023-01-15T10:30:00Z",
        updated_on: "2024-01-10T08:00:00Z",
        last_login_on: "2024-01-20T14:00:00Z",
        passwd_changed_on: "2023-06-15T12:00:00Z",
        avatar_url: "https://example.com/avatar.png",
        status: 1,
        api_key: "secret-api-key-should-not-be-exposed",
        custom_fields: [{ id: 1, name: "Department", value: "Engineering" }],
    },
};

describe("whoami tool", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("returns current user information", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleCurrentUserResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "whoami",
                arguments: {},
            })) as ToolResult;

            // Verify fetch was called with correct URL
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("https://test.redmine.com/users/current.json");
            expect(
                (options.headers as Record<string, string>)[
                    "X-Redmine-API-Key"
                ],
            ).toBe("test-api-key");

            // Verify response structure
            expect(result.isError).toBeFalsy();
            const user = parseCurrentUserResult(result);

            expect(user.id).toBe(1);
            expect(user.login).toBe("jsmith");
            expect(user.firstname).toBe("John");
            expect(user.lastname).toBe("Smith");
            expect(user.mail).toBe("jsmith@example.com");
            expect(user.status).toBe(1);
            expect(user.created_on).toBe("2023-01-15T10:30:00Z");
            expect(user.last_login_on).toBe("2024-01-20T14:00:00Z");
            expect(user.custom_fields).toHaveLength(1);
            expect(user.custom_fields?.[0].name).toBe("Department");
        } finally {
            await cleanup();
        }
    });

    it("excludes api_key from response", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleCurrentUserResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "whoami",
                arguments: {},
            })) as ToolResult;

            expect(result.isError).toBeFalsy();
            const text = getTextContent(result);

            // Verify api_key is not in the response
            expect(text).not.toContain("api_key");
            expect(text).not.toContain("secret-api-key-should-not-be-exposed");
        } finally {
            await cleanup();
        }
    });

    it("handles API error gracefully", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            statusText: "Unauthorized",
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "whoami",
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
                name: "whoami",
                arguments: {},
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("Network error");
        } finally {
            await cleanup();
        }
    });
});
