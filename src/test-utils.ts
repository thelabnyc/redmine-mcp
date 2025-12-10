import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { vi } from "vitest";

import type {
    RedmineCurrentUser,
    RedmineIssue,
    RedmineIssueStatusDetail,
    RedmineMembership,
    RedmineTimeEntry,
} from "./redmine.js";
import { createServer } from "./server.js";

// Mock fetch globally
export const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Type definitions for test results
export interface TextContent {
    type: "text";
    text: string;
}

export interface ToolResult {
    isError?: boolean;
    content: Array<TextContent | { type: string }>;
}

// Type for parsing request body in tests
export interface IssueRequestBody {
    issue: {
        subject?: string;
        description?: string;
        status_id?: number;
        priority_id?: number;
        assigned_to_id?: number;
        tracker_id?: number;
        parent_issue_id?: number;
        start_date?: string;
        due_date?: string;
        done_ratio?: number;
        estimated_hours?: number;
        notes?: string;
        private_notes?: boolean;
    };
}

export interface TimeEntryRequestBody {
    time_entry: {
        issue_id: number;
        hours: number;
        activity_id?: number;
        comments?: string;
        spent_on?: string;
    };
}

/**
 * Helper to create connected client-server pair for testing
 */
export async function createTestClientServer() {
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

export function getTextContent(result: ToolResult): string {
    const textContent = result.content.find(
        (c): c is TextContent => c.type === "text",
    );
    if (!textContent) {
        throw new Error("No text content found");
    }
    return textContent.text;
}

export function parseIssueResult(result: ToolResult): RedmineIssue {
    const text = getTextContent(result);
    return JSON.parse(text) as RedmineIssue;
}

export function parseMembershipsResult(result: ToolResult): {
    memberships: RedmineMembership[];
    total_count: number;
} {
    const text = getTextContent(result);
    return JSON.parse(text) as {
        memberships: RedmineMembership[];
        total_count: number;
    };
}

export function parseUpdateResult(result: ToolResult): {
    issue: RedmineIssue;
    time_entry?: RedmineTimeEntry;
    time_entry_error?: string;
} {
    const text = getTextContent(result);
    return JSON.parse(text) as {
        issue: RedmineIssue;
        time_entry?: RedmineTimeEntry;
        time_entry_error?: string;
    };
}

export function parseIssueStatusesResult(
    result: ToolResult,
): RedmineIssueStatusDetail[] {
    const text = getTextContent(result);
    return JSON.parse(text) as RedmineIssueStatusDetail[];
}

export function parseCurrentUserResult(result: ToolResult): RedmineCurrentUser {
    const text = getTextContent(result);
    return JSON.parse(text) as RedmineCurrentUser;
}

/**
 * Setup environment for tests - call in beforeEach
 */
export function setupTestEnv() {
    mockFetch.mockReset();
    process.env.REDMINE_URL = "https://test.redmine.com";
    process.env.REDMINE_API_KEY = "test-api-key";
}

/**
 * Cleanup environment after tests - call in afterEach
 */
export function cleanupTestEnv() {
    delete process.env.REDMINE_URL;
    delete process.env.REDMINE_API_KEY;
}
