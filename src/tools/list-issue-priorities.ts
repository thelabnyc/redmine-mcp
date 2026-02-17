import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { RedmineClient } from "../redmine.js";

export function registerListIssuePrioritiesTool(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "list-issue-priorities",
        {
            title: "List Issue Priorities",
            description:
                "List all available issue priorities in Redmine. Returns priority IDs, names, and which one is the default. Use this to find valid priority IDs when creating or updating issues.",
            inputSchema: {},
        },
        async () => {
            try {
                const priorities = await redmineClient.listIssuePriorities();

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(priorities, null, 2),
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
                            text: `Error fetching issue priorities: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
