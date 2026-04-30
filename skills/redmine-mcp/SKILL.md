---
name: redmine-mcp
description: Use Redmine MCP to look up, create, update, triage, and summarize Redmine issues, projects, users, and metadata.
---

# Redmine MCP

Use this skill when the user asks to work with Redmine issues, tickets, projects, assignees, statuses, trackers, priorities, custom fields, notes, or time logging.

Use the Redmine MCP server exposed by this plugin. It requires `REDMINE_URL` and `REDMINE_API_KEY` to be configured in the environment.

Available MCP tools include:

- `get-issue`
- `create-issue`
- `update-issue`
- `list-my-issues`
- `list-projects`
- `list-project-members`
- `list-issue-statuses`
- `list-issue-priorities`
- `list-trackers`
- `list-project-custom-fields`
- `whoami`

Guidance:

- Normalize issue references like `#12345` to the issue ID expected by the tool.
- Use listing tools to discover project IDs, status IDs, priority IDs, tracker IDs, assignee IDs, and custom field IDs instead of guessing.
- Before creating or updating issues, make sure required fields and IDs are known. Ask for missing required values when the request is ambiguous.
- Treat `create-issue`, `update-issue`, notes, assignments, status changes, and time logging as user-visible writes.
