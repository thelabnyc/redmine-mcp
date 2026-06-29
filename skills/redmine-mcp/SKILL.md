---
name: redmine-mcp
description: Use Redmine MCP to look up, create, update, triage, and summarize Redmine issues, projects, users, and metadata.
---

# Redmine MCP

Use this skill when the user asks to work with Redmine issues, tickets, projects, assignees, statuses, trackers, priorities, custom fields, notes, or time logging.

Use the configured Redmine MCP server. It requires `REDMINE_URL` and `REDMINE_API_KEY` to be configured in the MCP host environment. If the server is not available, tell the user to configure the host to launch `npx -y @thelabnyc/redmine-mcp@0.5.0`.

Available MCP tools include:

Issue tools:

- `get-issue`
- `list-issues`
- `list-my-issues`
- `create-issue`
- `update-issue`

Search and discovery:

- `search-redmine`
- `list-projects`
- `list-project-members`
- `list-queries`
- `list-issue-statuses`
- `list-issue-priorities`
- `list-trackers`
- `list-project-custom-fields`
- `list-project-versions`
- `list-project-issue-categories`
- `whoami`

Attachment tools:

- `get-attachment`
- `attach-file-to-issue`
- `download-attachment`
- `update-attachment`
- `delete-attachment`

Issue relation tools:

- `list-issue-relations`
- `get-issue-relation`
- `create-issue-relation`
- `delete-issue-relation`

Time entry tools:

- `list-time-entries`
- `get-time-entry`
- `create-time-entry`
- `update-time-entry`
- `delete-time-entry`
- `list-time-entry-activities`

Watcher tools:

- `add-issue-watcher`
- `remove-issue-watcher`

Guidance:

- Normalize issue references like `#12345` to the issue ID expected by the tool.
- Use listing tools to discover project IDs, saved query IDs, status IDs, priority IDs, tracker IDs, assignee IDs, custom field IDs, version IDs, category IDs, time-entry activity IDs, and relation IDs instead of guessing.
- Use `list-issues` for broad Redmine issue discovery and `list-my-issues` when the user specifically wants their assigned issues.
- Use `search-redmine` when the user has a keyword, title fragment, or cross-project lookup and does not already know the exact issue ID.
- Before creating or updating issues, relations, watchers, attachments, or time entries, make sure required fields and IDs are known. Ask for missing required values when the request is ambiguous.
- Treat `create-issue`, `update-issue`, notes, assignments, status changes, time entries, watcher changes, relation changes, attachment updates, and attachment deletes as user-visible writes.
- Before uploading, updating, or deleting attachments, summarize the target issue or attachment, file path, filename, description, content type, notes, and private-note setting as applicable, then get explicit user confirmation.
- Attachment uploads can read files only from `REDMINE_MCP_FILE_ROOT` or the OS temp directory. Downloaded attachments are saved to a generated OS temp directory and return `saved_path`.
- Some runtimes expose MCP tool names with underscores instead of hyphens. Match the available tool name in the current runtime while preserving the same logical operation.
