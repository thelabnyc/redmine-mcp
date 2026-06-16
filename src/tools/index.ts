import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { RedmineClient } from "../redmine.js";
import { registerCreateIssueTool } from "./create-issue.js";
import { registerGetIssueTool } from "./get-issue.js";
import { registerIssueRelationTools } from "./issue-relations.js";
import { registerListIssuePrioritiesTool } from "./list-issue-priorities.js";
import { registerListIssueStatusesTool } from "./list-issue-statuses.js";
import { registerListMyIssuesTool } from "./list-my-issues.js";
import { registerListProjectCustomFieldsTool } from "./list-project-custom-fields.js";
import { registerListProjectMembersTool } from "./list-project-members.js";
import { registerListProjectsTool } from "./list-projects.js";
import { registerListTrackersTool } from "./list-trackers.js";
import { registerUpdateIssueTool } from "./update-issue.js";
import { registerWhoamiTool } from "./whoami.js";

export function registerAllTools(
    server: McpServer,
    redmineClient: RedmineClient,
): void {
    registerCreateIssueTool(server, redmineClient);
    registerGetIssueTool(server, redmineClient);
    registerIssueRelationTools(server, redmineClient);
    registerListIssuePrioritiesTool(server, redmineClient);
    registerListIssueStatusesTool(server, redmineClient);
    registerListMyIssuesTool(server, redmineClient);
    registerListProjectCustomFieldsTool(server, redmineClient);
    registerListProjectMembersTool(server, redmineClient);
    registerListProjectsTool(server, redmineClient);
    registerListTrackersTool(server, redmineClient);
    registerUpdateIssueTool(server, redmineClient);
    registerWhoamiTool(server, redmineClient);
}

export {
    registerCreateIssueTool,
    registerGetIssueTool,
    registerIssueRelationTools,
    registerListIssuePrioritiesTool,
    registerListIssueStatusesTool,
    registerListMyIssuesTool,
    registerListProjectCustomFieldsTool,
    registerListProjectMembersTool,
    registerListProjectsTool,
    registerListTrackersTool,
    registerUpdateIssueTool,
    registerWhoamiTool,
};
