import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RedmineRelation } from "../../redmine.js";
import {
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    setupTestEnv,
} from "../../test-utils.js";

interface RelationsResponse {
    relations: RedmineRelation[];
}

interface RelationResponse {
    relation: RedmineRelation;
}

interface CreateRelationRequestBody {
    relation: {
        issue_to_id: number;
        relation_type?: string;
        delay?: number;
    };
}

function parseRelationsResult(result: ToolResult): RedmineRelation[] {
    return JSON.parse(getTextContent(result)) as RedmineRelation[];
}

function parseRelationResult(result: ToolResult): RedmineRelation {
    return JSON.parse(getTextContent(result)) as RedmineRelation;
}

function parseDeleteResult(result: ToolResult): {
    deleted: boolean;
    relationId: number;
} {
    return JSON.parse(getTextContent(result)) as {
        deleted: boolean;
        relationId: number;
    };
}

const sampleRelation: RedmineRelation = {
    id: 1819,
    issue_id: 8470,
    issue_to_id: 8469,
    relation_type: "relates",
    delay: undefined,
};

const sampleRelationsResponse: RelationsResponse = {
    relations: [
        sampleRelation,
        {
            id: 1820,
            issue_id: 8470,
            issue_to_id: 8467,
            relation_type: "blocks",
            delay: undefined,
        },
    ],
};

const sampleRelationResponse: RelationResponse = {
    relation: sampleRelation,
};

describe("issue relation tools", () => {
    beforeEach(() => {
        setupTestEnv();
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    it("lists relations for an issue", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleRelationsResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-issue-relations",
                arguments: { issueId: "#8470" },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe(
                "https://test.redmine.com/issues/8470/relations.json",
            );
            expect(options.method).toBe("GET");
            expect(
                (options.headers as Record<string, string>)[
                    "X-Redmine-API-Key"
                ],
            ).toBe("test-api-key");

            expect(result.isError).toBeFalsy();
            const relations = parseRelationsResult(result);
            expect(relations).toHaveLength(2);
            expect(relations[0].issue_to_id).toBe(8469);
            expect(relations[1].relation_type).toBe("blocks");
        } finally {
            await cleanup();
        }
    });

    it("rejects invalid issue IDs when listing relations", async () => {
        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "list-issue-relations",
                arguments: { issueId: "not-an-id" },
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

    it("gets one issue relation by relation ID", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(sampleRelationResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "get-issue-relation",
                arguments: { relationId: 1819 },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("https://test.redmine.com/relations/1819.json");
            expect(options.method).toBe("GET");

            expect(result.isError).toBeFalsy();
            const relation = parseRelationResult(result);
            expect(relation.id).toBe(1819);
            expect(relation.issue_id).toBe(8470);
        } finally {
            await cleanup();
        }
    });

    it("omits relation type when using the default relates type", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: () => Promise.resolve(sampleRelationResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "create-issue-relation",
                arguments: {
                    issueId: "8470",
                    issueToId: 8469,
                },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe(
                "https://test.redmine.com/issues/8470/relations.json",
            );
            expect(options.method).toBe("POST");
            expect(
                (options.headers as Record<string, string>)["Content-Type"],
            ).toBe("application/json");
            const body = JSON.parse(
                options.body as string,
            ) as CreateRelationRequestBody;
            expect(body.relation.issue_to_id).toBe(8469);
            expect(body.relation.relation_type).toBeUndefined();
            expect(body.relation.delay).toBeUndefined();

            expect(result.isError).toBeFalsy();
            const relation = parseRelationResult(result);
            expect(relation.relation_type).toBe("relates");
        } finally {
            await cleanup();
        }
    });

    it("creates a relation with relation type and delay", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: () =>
                Promise.resolve({
                    relation: {
                        ...sampleRelation,
                        relation_type: "precedes",
                        delay: 3,
                    },
                }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "create-issue-relation",
                arguments: {
                    issueId: "#8470",
                    issueToId: 8469,
                    relationType: "precedes",
                    delay: 3,
                },
            });

            const [, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            const body = JSON.parse(
                options.body as string,
            ) as CreateRelationRequestBody;
            expect(body.relation.issue_to_id).toBe(8469);
            expect(body.relation.relation_type).toBe("precedes");
            expect(body.relation.delay).toBe(3);
        } finally {
            await cleanup();
        }
    });

    it("creates a relation with a target issue ID string", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: () => Promise.resolve(sampleRelationResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "create-issue-relation",
                arguments: {
                    issueId: "#8470",
                    issueToId: "#8469",
                },
            });

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            const body = JSON.parse(
                options.body as string,
            ) as CreateRelationRequestBody;
            expect(body.relation.issue_to_id).toBe(8469);
        } finally {
            await cleanup();
        }
    });

    it("rejects negative delay when creating a relation", async () => {
        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "create-issue-relation",
                arguments: {
                    issueId: "#8470",
                    issueToId: "#8469",
                    relationType: "precedes",
                    delay: -3,
                },
            })) as ToolResult;

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain("delay");
        } finally {
            await cleanup();
        }
    });

    it("surfaces Redmine validation errors when creating a relation", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 422,
            statusText: "Unprocessable Entity",
            json: () =>
                Promise.resolve({
                    errors: ["Relation already exists"],
                }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "create-issue-relation",
                arguments: {
                    issueId: "8470",
                    issueToId: 8469,
                    relationType: "relates",
                },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("422");
            expect(errorText).toContain("Relation already exists");
        } finally {
            await cleanup();
        }
    });

    it("rejects invalid issue IDs when creating relations", async () => {
        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "create-issue-relation",
                arguments: {
                    issueId: "bad-id",
                    issueToId: 8469,
                },
            })) as ToolResult;

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                "Invalid issue ID: bad-id",
            );
        } finally {
            await cleanup();
        }
    });

    it("deletes a relation by relation ID", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 204,
            json: () => Promise.resolve({}),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "delete-issue-relation",
                arguments: { relationId: 1819 },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("https://test.redmine.com/relations/1819.json");
            expect(options.method).toBe("DELETE");

            expect(result.isError).toBeFalsy();
            expect(parseDeleteResult(result)).toEqual({
                deleted: true,
                relationId: 1819,
            });
        } finally {
            await cleanup();
        }
    });

    it("surfaces Redmine errors when deleting a relation", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 422,
            statusText: "Unprocessable Entity",
            json: () =>
                Promise.resolve({
                    errors: ["Relation cannot be deleted"],
                }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "delete-issue-relation",
                arguments: { relationId: 1819 },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            const errorText = getTextContent(result);
            expect(errorText).toContain("422");
            expect(errorText).toContain("Relation cannot be deleted");
        } finally {
            await cleanup();
        }
    });
});
