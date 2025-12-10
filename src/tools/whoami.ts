import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { RedmineClient } from "../redmine.js";

export function registerWhoamiTool(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "whoami",
        {
            title: "Who Am I",
            description:
                "Get the current user's account information. Returns the user ID, login, name, email, and other account details. Use this to identify yourself when you need to assign issues to yourself or perform other user-specific actions.",
            inputSchema: {},
        },
        async () => {
            try {
                const user = await redmineClient.getCurrentUser();

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(user, null, 2),
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
                            text: `Error fetching current user: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
