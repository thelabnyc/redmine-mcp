import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { RedmineClient } from "../redmine.js";

export function registerListIssueStatusesTool(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "list-issue-statuses",
        {
            title: "List Issue Statuses",
            description:
                "List all available issue statuses in Redmine. Returns status IDs, names, and whether they represent a closed state. Use this to find valid status IDs when updating issues.",
            inputSchema: {},
        },
        async () => {
            try {
                const statuses = await redmineClient.listIssueStatuses();

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(statuses, null, 2),
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
                            text: `Error fetching issue statuses: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
