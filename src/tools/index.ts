import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { Config } from "../config.js";
import type { RedmineClient } from "../redmine.js";
import { registerAttachmentTools } from "./attachments.js";
import { registerCreateIssueTool } from "./create-issue.js";
import { registerGetIssueTool } from "./get-issue.js";
import { registerIssueRelationTools } from "./issue-relations.js";
import { registerListIssuePrioritiesTool } from "./list-issue-priorities.js";
import { registerListIssueStatusesTool } from "./list-issue-statuses.js";
import { registerListIssuesTool } from "./list-issues.js";
import { registerListMyIssuesTool } from "./list-my-issues.js";
import { registerListProjectCustomFieldsTool } from "./list-project-custom-fields.js";
import { registerListProjectIssueCategoriesTool } from "./list-project-issue-categories.js";
import { registerListProjectMembersTool } from "./list-project-members.js";
import { registerListProjectVersionsTool } from "./list-project-versions.js";
import { registerListProjectsTool } from "./list-projects.js";
import { registerListQueriesTool } from "./list-queries.js";
import { registerListTrackersTool } from "./list-trackers.js";
import { registerTimeEntryTools } from "./time-entries.js";
import { registerUpdateIssueTool } from "./update-issue.js";
import { registerWatcherTools } from "./watchers.js";
import { registerWhoamiTool } from "./whoami.js";

export function registerAllTools(
    server: McpServer,
    redmineClient: RedmineClient,
    config: Config,
): void {
    registerAttachmentTools(server, redmineClient, config);
    registerCreateIssueTool(server, redmineClient);
    registerGetIssueTool(server, redmineClient);
    registerIssueRelationTools(server, redmineClient);
    registerListIssuePrioritiesTool(server, redmineClient);
    registerListIssueStatusesTool(server, redmineClient);
    registerListIssuesTool(server, redmineClient);
    registerListMyIssuesTool(server, redmineClient);
    registerListProjectCustomFieldsTool(server, redmineClient);
    registerListProjectIssueCategoriesTool(server, redmineClient);
    registerListProjectMembersTool(server, redmineClient);
    registerListProjectVersionsTool(server, redmineClient);
    registerListProjectsTool(server, redmineClient);
    registerListQueriesTool(server, redmineClient);
    registerListTrackersTool(server, redmineClient);
    registerTimeEntryTools(server, redmineClient);
    registerUpdateIssueTool(server, redmineClient);
    registerWatcherTools(server, redmineClient);
    registerWhoamiTool(server, redmineClient);
}

export {
    registerAttachmentTools,
    registerCreateIssueTool,
    registerGetIssueTool,
    registerIssueRelationTools,
    registerListIssuePrioritiesTool,
    registerListIssueStatusesTool,
    registerListIssuesTool,
    registerListMyIssuesTool,
    registerListProjectCustomFieldsTool,
    registerListProjectIssueCategoriesTool,
    registerListProjectMembersTool,
    registerListProjectVersionsTool,
    registerListProjectsTool,
    registerListQueriesTool,
    registerListTrackersTool,
    registerTimeEntryTools,
    registerUpdateIssueTool,
    registerWatcherTools,
    registerWhoamiTool,
};
