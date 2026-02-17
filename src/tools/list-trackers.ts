import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { RedmineClient } from "../redmine.js";

export function registerListTrackersTool(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "list-trackers",
        {
            title: "List Trackers",
            description:
                "List all available trackers in Redmine. Returns tracker IDs, names, default statuses, and enabled fields. Use this to find valid tracker IDs when creating or updating issues.",
            inputSchema: {},
        },
        async () => {
            try {
                const trackers = await redmineClient.listTrackers();

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(trackers, null, 2),
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
                            text: `Error fetching trackers: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
