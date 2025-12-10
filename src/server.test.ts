import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./server.js";
import type { RedmineIssue } from "./redmine.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Sample Redmine API responses
const sampleIssueResponse = {
    issue: {
        id: 12345,
        project: { id: 1, name: "Test Project" },
        tracker: { id: 1, name: "Bug" },
        status: { id: 1, name: "New" },
        priority: { id: 2, name: "Normal" },
        author: { id: 1, name: "John Doe" },
        assigned_to: { id: 2, name: "Jane Smith" },
        subject: "Test issue subject",
        description: "This is a test issue description",
        start_date: "2024-01-15",
        due_date: "2024-01-30",
        done_ratio: 50,
        estimated_hours: 8,
        created_on: "2024-01-15T10:00:00Z",
        updated_on: "2024-01-20T14:30:00Z",
        journals: [
            {
                id: 1,
                user: { id: 1, name: "John Doe" },
                notes: "Added initial description",
                created_on: "2024-01-15T10:30:00Z",
                details: [],
            },
            {
                id: 2,
                user: { id: 2, name: "Jane Smith" },
                notes: "Working on this now",
                created_on: "2024-01-16T09:00:00Z",
                details: [
                    {
                        property: "attr",
                        name: "status_id",
                        old_value: "1",
                        new_value: "2",
                    },
                ],
            },
        ],
    },
};

const sampleIssueWithAttachments = {
    issue: {
        ...sampleIssueResponse.issue,
        attachments: [
            {
                id: 1,
                filename: "screenshot.png",
                filesize: 12345,
                content_type: "image/png",
                description: "Screenshot of the bug",
                author: { id: 1, name: "John Doe" },
                created_on: "2024-01-15T10:00:00Z",
            },
        ],
    },
};

interface TextContent {
    type: "text";
    text: string;
}

interface ToolResult {
    isError?: boolean;
    content: Array<TextContent | { type: string }>;
}

/**
 * Helper to create connected client-server pair for testing
 */
async function createTestClientServer() {
    const server = createServer();
    const client = new Client({
        name: "test-client",
        version: "1.0.0",
    });

    const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();

    await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
    ]);

    return { client, server, cleanup: () => client.close() };
}

function getTextContent(result: ToolResult): string {
    const textContent = result.content.find(
        (c): c is TextContent => c.type === "text"
    );
    if (!textContent) {
        throw new Error("No text content found");
    }
    return textContent.text;
}

function parseIssueResult(result: ToolResult): RedmineIssue {
    const text = getTextContent(result);
    return JSON.parse(text) as RedmineIssue;
}

describe("Redmine MCP Server", () => {
    beforeEach(() => {
        mockFetch.mockReset();
        // Set required env vars
        process.env.REDMINE_URL = "https://test.redmine.com";
        process.env.REDMINE_API_KEY = "test-api-key";
    });

    afterEach(() => {
        delete process.env.REDMINE_URL;
        delete process.env.REDMINE_API_KEY;
    });

    describe("get-issue tool", () => {
        it("returns issue details with journals included by default", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(sampleIssueResponse),
            });

            const { client, cleanup } = await createTestClientServer();

            try {
                const result = (await client.callTool({
                    name: "get-issue",
                    arguments: { issueId: "12345" },
                })) as ToolResult;

                // Verify fetch was called with correct URL and headers
                expect(mockFetch).toHaveBeenCalledTimes(1);
                const [url, options] = mockFetch.mock.calls[0] as [
                    string,
                    RequestInit,
                ];
                expect(url).toBe(
                    "https://test.redmine.com/issues/12345.json?include=journals"
                );
                expect(
                    (options.headers as Record<string, string>)[
                        "X-Redmine-API-Key"
                    ]
                ).toBe("test-api-key");

                // Verify response structure
                expect(result.isError).toBeFalsy();
                expect(result.content).toBeDefined();
                expect(result.content.length).toBeGreaterThan(0);

                // Parse the response
                const issueData = parseIssueResult(result);

                // Verify issue fields
                expect(issueData.id).toBe(12345);
                expect(issueData.subject).toBe("Test issue subject");
                expect(issueData.description).toBe(
                    "This is a test issue description"
                );
                expect(issueData.project.name).toBe("Test Project");
                expect(issueData.status.name).toBe("New");
                expect(issueData.priority.name).toBe("Normal");
                expect(issueData.author.name).toBe("John Doe");
                expect(issueData.assigned_to?.name).toBe("Jane Smith");
                expect(issueData.done_ratio).toBe(50);

                // Verify journals are included
                expect(issueData.journals).toBeDefined();
                expect(issueData.journals).toHaveLength(2);
                expect(issueData.journals?.[0].notes).toBe(
                    "Added initial description"
                );
                expect(issueData.journals?.[1].notes).toBe(
                    "Working on this now"
                );
            } finally {
                await cleanup();
            }
        });

        it("handles issue ID with # prefix", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(sampleIssueResponse),
            });

            const { client, cleanup } = await createTestClientServer();

            try {
                await client.callTool({
                    name: "get-issue",
                    arguments: { issueId: "#12345" },
                });

                // Verify the # was stripped from the URL
                const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
                expect(url).toBe(
                    "https://test.redmine.com/issues/12345.json?include=journals"
                );
            } finally {
                await cleanup();
            }
        });

        it("includes optional data when requested", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve(sampleIssueWithAttachments),
            });

            const { client, cleanup } = await createTestClientServer();

            try {
                const result = (await client.callTool({
                    name: "get-issue",
                    arguments: {
                        issueId: "12345",
                        includeAttachments: true,
                        includeWatchers: true,
                    },
                })) as ToolResult;

                // Verify fetch was called with correct include params
                const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
                expect(url).toContain("include=");
                expect(url).toContain("journals");
                expect(url).toContain("attachments");
                expect(url).toContain("watchers");

                // Verify response includes attachments
                expect(result.isError).toBeFalsy();
                const issueData = parseIssueResult(result);
                expect(issueData.attachments).toBeDefined();
                expect(issueData.attachments).toHaveLength(1);
                expect(issueData.attachments?.[0].filename).toBe(
                    "screenshot.png"
                );
            } finally {
                await cleanup();
            }
        });

        it("handles 404 error gracefully", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: "Not Found",
            });

            const { client, cleanup } = await createTestClientServer();

            try {
                const result = (await client.callTool({
                    name: "get-issue",
                    arguments: { issueId: "99999" },
                })) as ToolResult;

                // Verify error response
                expect(result.isError).toBe(true);
                const errorText = getTextContent(result);
                expect(errorText).toContain("404");
            } finally {
                await cleanup();
            }
        });

        it("handles network errors gracefully", async () => {
            mockFetch.mockRejectedValueOnce(new Error("Network error"));

            const { client, cleanup } = await createTestClientServer();

            try {
                const result = (await client.callTool({
                    name: "get-issue",
                    arguments: { issueId: "12345" },
                })) as ToolResult;

                // Verify error response
                expect(result.isError).toBe(true);
                const errorText = getTextContent(result);
                expect(errorText).toContain("Network error");
            } finally {
                await cleanup();
            }
        });
    });
});
