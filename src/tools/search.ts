import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

import type { RedmineClient } from "../redmine.js";

export function registerSearchTool(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "search-redmine",
        {
            title: "Search Redmine",
            description:
                "Search Redmine globally across issues, projects, wiki pages, attachments, and other supported content types.",
            inputSchema: {
                query: z
                    .string()
                    .describe("Search query. Sent to Redmine as q."),
                scope: z
                    .string()
                    .optional()
                    .describe("Optional Redmine search scope."),
                allWords: z
                    .boolean()
                    .optional()
                    .describe("Require all query words to match."),
                titlesOnly: z
                    .boolean()
                    .optional()
                    .describe("Search result titles only."),
                issues: z.boolean().optional().describe("Search issues."),
                news: z.boolean().optional().describe("Search news."),
                documents: z.boolean().optional().describe("Search documents."),
                changesets: z
                    .boolean()
                    .optional()
                    .describe("Search changesets."),
                wikiPages: z
                    .boolean()
                    .optional()
                    .describe("Search wiki pages."),
                messages: z.boolean().optional().describe("Search messages."),
                projects: z.boolean().optional().describe("Search projects."),
                attachments: z
                    .union([z.boolean(), z.literal("only")])
                    .optional()
                    .describe(
                        "Attachment search mode: true searches descriptions and content, false searches descriptions only, 'only' searches attachment content only.",
                    ),
                openIssues: z
                    .boolean()
                    .optional()
                    .describe("Restrict issue results to open issues."),
                limit: z
                    .number()
                    .optional()
                    .describe("Maximum number of search results to return."),
                offset: z
                    .number()
                    .optional()
                    .describe("Number of search results to skip."),
            },
        },
        async ({
            query,
            scope,
            allWords,
            titlesOnly,
            issues,
            news,
            documents,
            changesets,
            wikiPages,
            messages,
            projects,
            attachments,
            openIssues,
            limit,
            offset,
        }) => {
            try {
                const result = await redmineClient.searchRedmine({
                    query,
                    scope,
                    allWords,
                    titlesOnly,
                    issues,
                    news,
                    documents,
                    changesets,
                    wikiPages,
                    messages,
                    projects,
                    attachments,
                    openIssues,
                    limit,
                    offset,
                });

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                return {
                    isError: true,
                    content: [
                        {
                            type: "text" as const,
                            text: `Error searching Redmine: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
