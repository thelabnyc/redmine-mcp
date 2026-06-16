import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

import type { RedmineClient } from "../redmine.js";

export function registerListProjectVersionsTool(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    server.registerTool(
        "list-project-versions",
        {
            title: "List Project Versions",
            description:
                "List versions for a Redmine project. Use this to find fixed version IDs before setting fixedVersionId on create-issue or update-issue.",
            inputSchema: {
                projectId: z
                    .union([z.string(), z.number()])
                    .describe("Project identifier (string slug or numeric ID)"),
            },
        },
        async ({ projectId }) => {
            try {
                const result =
                    await redmineClient.listProjectVersions(projectId);

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
                            text: `Error listing project versions: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
