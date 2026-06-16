# @thelabnyc/redmine-mcp

An MCP (Model Context Protocol) server that allows AI agents like Claude to interact with Redmine project management data.

## Features

- **Create issues** with full field support including custom fields
- **Fetch issue details** by ID, including subject, description, status, priority, and assignee
- **Update issues**: change status, assign users, add notes, set custom fields, and more
- **Log time** spent on issues with integrated time tracking
- **List issues** with general Redmine filters, saved queries, and optional includes
- **List issues** assigned to the current user, with filtering and sorting
- **List projects** accessible to the current user
- **List saved queries** visible to the current user
- **List project members** to find user IDs for assignments
- **Manage issue relations**: list, fetch, create, and delete Redmine relation records
- **Discover metadata**: list available statuses, trackers, priorities, and custom fields
- **Retrieve change history** (journals) with every request
- Optionally include attachments, watchers, relations, and child issues

## Installation

```bash
npm install @thelabnyc/redmine-mcp
```

Or clone and build from source:

```bash
git clone https://gitlab.com/thelabnyc/redmine-mcp.git
cd redmine-mcp
npm install
npm run build
```

## Configuration

The server requires two environment variables:

| Variable          | Description                       | Example                     |
| ----------------- | --------------------------------- | --------------------------- |
| `REDMINE_URL`     | Base URL of your Redmine instance | `https://mycompany.plan.io` |
| `REDMINE_API_KEY` | Your Redmine API key              | `abc123def456...`           |

### Getting your Redmine API Key

1. Log into your Redmine instance
2. Go to **My Account** (click your name in the top right)
3. In the right sidebar, find **API access key**
4. Click **Show** to reveal your key, or **Reset** to generate a new one

## Usage with Claude Code

Add the server to your Claude Code configuration:

### Project-level configuration

Create or edit `.claude/settings.json` in your project:

```json
{
    "mcpServers": {
        "redmine": {
            "command": "npx",
            "args": ["@thelabnyc/redmine-mcp"],
            "env": {
                "REDMINE_URL": "https://your-instance.plan.io",
                "REDMINE_API_KEY": "your-api-key-here"
            }
        }
    }
}
```

### User-level configuration

Add to `~/.claude.json` to make available across all projects:

```json
{
    "mcpServers": {
        "redmine": {
            "command": "npx",
            "args": ["@thelabnyc/redmine-mcp"],
            "env": {
                "REDMINE_URL": "https://your-instance.plan.io",
                "REDMINE_API_KEY": "your-api-key-here"
            }
        }
    }
}
```

### Using a local build

If you've cloned the repository:

```json
{
    "mcpServers": {
        "redmine": {
            "command": "node",
            "args": ["/path/to/redmine-mcp/dist/cli.js"],
            "env": {
                "REDMINE_URL": "https://your-instance.plan.io",
                "REDMINE_API_KEY": "your-api-key-here"
            }
        }
    }
}
```

## Available Tools

### get-issue

Fetch details about a Redmine issue by ID.

**Parameters:**

| Parameter            | Type    | Required | Description                          |
| -------------------- | ------- | -------- | ------------------------------------ |
| `issueId`            | string  | Yes      | Issue ID (e.g., `#12345` or `12345`) |
| `includeAttachments` | boolean | No       | Include file attachments             |
| `includeWatchers`    | boolean | No       | Include watchers list                |
| `includeRelations`   | boolean | No       | Include related issues               |
| `includeChildren`    | boolean | No       | Include child issues                 |

**Note:** Change history (journals) is always included by default.

**Example usage in Claude:**

> "Look up Redmine issue #12345 and summarize the recent activity"

### list-issue-relations

List relation records for a Redmine issue. This exposes Redmine's `GET /issues/:issue_id/relations.json` endpoint.

**Parameters:**

| Parameter | Type   | Required | Description                                 |
| --------- | ------ | -------- | ------------------------------------------- |
| `issueId` | string | Yes      | Source issue ID (e.g., `#12345` or `12345`) |

**Example usage in Claude:**

> "List the related tickets for issue #12345"

### get-issue-relation

Fetch one Redmine issue relation record by relation ID.

**Parameters:**

| Parameter    | Type   | Required | Description        |
| ------------ | ------ | -------- | ------------------ |
| `relationId` | number | Yes      | Relation record ID |

**Example usage in Claude:**

> "Show me relation 1819"

### create-issue-relation

Create a Redmine issue relation. This exposes Redmine's `POST /issues/:issue_id/relations.json` endpoint. The `issueId` parameter is the source/from issue, and `issueToId` is the target/to issue.

**Parameters:**

| Parameter      | Type   | Required | Description                                         |
| -------------- | ------ | -------- | --------------------------------------------------- |
| `issueId`      | string | Yes      | Source/from issue ID (e.g., `#12345` or `12345`)    |
| `issueToId`    | number | Yes      | Target/to related issue ID                          |
| `relationType` | string | No       | Relation type; defaults to `relates`                |
| `delay`        | number | No       | Delay in days for `precedes` or `follows` relations |

Supported relation types are `relates`, `duplicates`, `duplicated`, `blocks`, `blocked`, `precedes`, `follows`, `copied_to`, and `copied_from`.

**Example usage in Claude:**

> "Relate issue #12345 to issue #67890"

### delete-issue-relation

Delete a Redmine issue relation record by relation ID. Redmine does not provide an update endpoint for relation records; callers that need to change a relation should delete the old relation and create the desired new relation explicitly.

**Parameters:**

| Parameter    | Type   | Required | Description                  |
| ------------ | ------ | -------- | ---------------------------- |
| `relationId` | number | Yes      | Relation record ID to delete |

**Example usage in Claude:**

> "Delete relation 1819"

### create-issue

Create a new Redmine issue.

**Parameters:**

| Parameter        | Type          | Required | Description                                               |
| ---------------- | ------------- | -------- | --------------------------------------------------------- |
| `projectId`      | string/number | Yes      | Project identifier (string slug or numeric ID)            |
| `subject`        | string        | Yes      | Issue subject/title                                       |
| `description`    | string        | No       | Issue description                                         |
| `statusId`       | number        | No       | Status ID to set                                          |
| `priorityId`     | number        | No       | Priority ID to set                                        |
| `assignedToId`   | number        | No       | User ID to assign                                         |
| `trackerId`      | number        | No       | Tracker ID to set                                         |
| `parentIssueId`  | number        | No       | Parent issue ID                                           |
| `startDate`      | string        | No       | Start date (YYYY-MM-DD format)                            |
| `dueDate`        | string        | No       | Due date (YYYY-MM-DD format)                              |
| `doneRatio`      | number        | No       | Percent done (0-100)                                      |
| `estimatedHours` | number        | No       | Estimated hours for the issue                             |
| `isPrivate`      | boolean       | No       | Whether the issue is private                              |
| `customFields`   | array         | No       | Custom field values (see [Custom Fields](#custom-fields)) |

**Example usage in Claude:**

> "Create a bug in project 'my-app' titled 'Login page crashes on submit'"

### update-issue

Update a Redmine issue. Can change fields, add notes, and log time spent.

**Parameters:**

| Parameter        | Type    | Required | Description                                               |
| ---------------- | ------- | -------- | --------------------------------------------------------- |
| `issueId`        | string  | Yes      | Issue ID (e.g., `#12345` or `12345`)                      |
| `subject`        | string  | No       | New issue subject/title                                   |
| `description`    | string  | No       | New issue description                                     |
| `statusId`       | number  | No       | Status ID to set                                          |
| `priorityId`     | number  | No       | Priority ID to set                                        |
| `assignedToId`   | number  | No       | User ID to assign (use 0 to unassign)                     |
| `trackerId`      | number  | No       | Tracker ID to set                                         |
| `parentIssueId`  | number  | No       | Parent issue ID                                           |
| `startDate`      | string  | No       | Start date (YYYY-MM-DD format)                            |
| `dueDate`        | string  | No       | Due date (YYYY-MM-DD format)                              |
| `doneRatio`      | number  | No       | Percent done (0-100)                                      |
| `estimatedHours` | number  | No       | Estimated hours for the issue                             |
| `notes`          | string  | No       | Comment/note to add to the issue journal                  |
| `privateNotes`   | boolean | No       | Make the notes private                                    |
| `logHours`       | number  | No       | Hours to log as a time entry                              |
| `logActivityId`  | number  | No       | Activity ID for time entry (uses default if omitted)      |
| `logComments`    | string  | No       | Comments for the time entry                               |
| `logSpentOn`     | string  | No       | Date for time entry (YYYY-MM-DD, defaults to today)       |
| `customFields`   | array   | No       | Custom field values (see [Custom Fields](#custom-fields)) |

**Example usage in Claude:**

> "Update issue #12345 to status 2 and assign to user 5"
>
> "Add a note to issue #6789 saying 'Fixed the bug' and log 1.5 hours"

### list-my-issues

List issues assigned to the current user, with optional filtering and sorting.

**Parameters:**

| Parameter   | Type          | Required | Description                                           |
| ----------- | ------------- | -------- | ----------------------------------------------------- |
| `statusId`  | number/string | No       | Filter by status ID, or `"open"`, `"closed"`, `"*"`   |
| `projectId` | string/number | No       | Filter by project                                     |
| `limit`     | number        | No       | Maximum results to return                             |
| `offset`    | number        | No       | Number of results to skip for pagination              |
| `sort`      | string        | No       | Sort order (default: `priority:desc,updated_on:desc`) |

**Example usage in Claude:**

> "What issues are assigned to me?"

### list-issues

List Redmine issues using general issue filters. This calls Redmine `GET /issues.json` and returns full issue objects plus `total_count`, `offset`, and `limit` metadata. Use `list-queries` to discover saved query IDs for the `queryId` parameter.

**Parameters:**

| Parameter            | Type          | Required | Description                                         |
| -------------------- | ------------- | -------- | --------------------------------------------------- |
| `issueIds`           | array         | No       | Issue IDs; strings may include `#` prefixes         |
| `projectId`          | string/number | No       | Filter by project ID or identifier                  |
| `trackerId`          | number        | No       | Filter by tracker ID                                |
| `statusId`           | number/string | No       | Filter by status ID, or `"open"`, `"closed"`, `"*"` |
| `assignedToId`       | number/string | No       | Filter by assignee user ID, or `"me"`               |
| `parentId`           | number        | No       | Filter by parent issue ID                           |
| `createdOn`          | string        | No       | Redmine `created_on` filter expression              |
| `updatedOn`          | string        | No       | Redmine `updated_on` filter expression              |
| `customFields`       | array         | No       | Custom field filters, serialized as `cf_<id>=value` |
| `queryId`            | number        | No       | Saved query ID; use `list-queries` to discover IDs  |
| `includeAttachments` | boolean       | No       | Include issue attachments                           |
| `includeRelations`   | boolean       | No       | Include issue relations                             |
| `sort`               | string        | No       | Sort order, e.g. `updated_on:desc`                  |
| `limit`              | number        | No       | Maximum results to return                           |
| `offset`             | number        | No       | Number of results to skip for pagination            |

**Example usage in Claude:**

> "List open bugs in project 'my-app' updated this month"

### list-projects

List all projects accessible to the current user.

**Parameters:**

| Parameter | Type   | Required | Description                              |
| --------- | ------ | -------- | ---------------------------------------- |
| `limit`   | number | No       | Maximum results to return                |
| `offset`  | number | No       | Number of results to skip for pagination |

**Example usage in Claude:**

> "What Redmine projects do I have access to?"

### list-queries

List saved Redmine issue queries visible to the current user.

**Parameters:**

| Parameter | Type   | Required | Description                              |
| --------- | ------ | -------- | ---------------------------------------- |
| `limit`   | number | No       | Maximum results to return                |
| `offset`  | number | No       | Number of results to skip for pagination |

**Example usage in Claude:**

> "What saved Redmine queries can I use?"

### list-project-members

List all members of a Redmine project. Use this to find user IDs for assigning issues.

**Parameters:**

| Parameter   | Type   | Required | Description                                          |
| ----------- | ------ | -------- | ---------------------------------------------------- |
| `projectId` | string | Yes      | Project ID or identifier (e.g., `my-project` or `1`) |
| `limit`     | number | No       | Maximum number of members to return (default 25)     |
| `offset`    | number | No       | Number of members to skip for pagination             |

**Example usage in Claude:**

> "Who can I assign issues to in project 'my-project'?"

### list-issue-statuses

List all available issue statuses. Use this to find valid status IDs when updating issues.

**Parameters:** None

**Example usage in Claude:**

> "What statuses can I set for issues?"

### list-trackers

List all available trackers (e.g., Bug, Feature, Support). Use this to find valid tracker IDs.

**Parameters:** None

**Example usage in Claude:**

> "What trackers are available?"

### list-issue-priorities

List all available issue priorities. Use this to find valid priority IDs.

**Parameters:** None

**Example usage in Claude:**

> "What priority levels can I set?"

### list-project-custom-fields

List the custom fields available for issues in a given project. Use this to discover custom field IDs before setting them on `create-issue` or `update-issue`.

**Parameters:**

| Parameter   | Type          | Required | Description                                    |
| ----------- | ------------- | -------- | ---------------------------------------------- |
| `projectId` | string/number | Yes      | Project identifier (string slug or numeric ID) |

**Example usage in Claude:**

> "What custom fields are available for project 'my-app'?"

### whoami

Get information about the currently authenticated Redmine user.

**Parameters:** None

**Example usage in Claude:**

> "Who am I logged in as in Redmine?"

### Custom Fields

The `customFields` parameter on `create-issue` and `update-issue` accepts an array of objects:

```json
[
    { "id": 1, "value": "Sprint 5" },
    { "id": 2, "value": ["option1", "option2"] }
]
```

Use `list-project-custom-fields` to discover available custom field IDs for a project. Multi-value fields accept an array of strings.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build
npm run build

# Lint
npm run lint
```

## License

ISC
