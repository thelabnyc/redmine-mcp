import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

import type { RedmineClient } from "../redmine.js";

export function registerListProjectCustomFieldsTool(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "list-project-custom-fields",
        {
            title: "List Project Custom Fields",
            description:
                "List the custom fields available for issues in a given project. Use this before setting custom fields on create-issue or update-issue to discover valid custom field IDs.",
            inputSchema: {
                projectId: z
                    .union([z.string(), z.number()])
                    .describe("Project identifier (string slug or numeric ID)"),
            },
        },
        async ({ projectId }) => {
            try {
                const customFields =
                    await redmineClient.getProjectCustomFields(projectId);

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(customFields, null, 2),
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
                            text: `Error fetching project custom fields: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
