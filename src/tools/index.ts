import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { RedmineClient } from "../redmine.js";
import { registerGetIssueTool } from "./get-issue.js";
import { registerListIssueStatusesTool } from "./list-issue-statuses.js";
import { registerListProjectMembersTool } from "./list-project-members.js";
import { registerUpdateIssueTool } from "./update-issue.js";
import { registerWhoamiTool } from "./whoami.js";

export function registerAllTools(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    registerGetIssueTool(server, redmineClient);
    registerListProjectMembersTool(server, redmineClient);
    registerUpdateIssueTool(server, redmineClient);
    registerListIssueStatusesTool(server, redmineClient);
    registerWhoamiTool(server, redmineClient);
}

export {
    registerGetIssueTool,
    registerListIssueStatusesTool,
    registerListProjectMembersTool,
    registerUpdateIssueTool,
    registerWhoamiTool,
};
