# @thelabnyc/redmine-mcp

An MCP (Model Context Protocol) server that allows AI agents like Claude to interact with Redmine project management data.

## Features

- Fetch issue details by ID, including subject, description, status, priority, and assignee
- Retrieve change history (journals) with every request
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

| Variable | Description | Example |
|----------|-------------|---------|
| `REDMINE_URL` | Base URL of your Redmine instance | `https://mycompany.plan.io` |
| `REDMINE_API_KEY` | Your Redmine API key | `abc123def456...` |

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

Add to `~/.claude/settings.json` to make available across all projects:

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `issueId` | string | Yes | Issue ID (e.g., `#12345` or `12345`) |
| `includeAttachments` | boolean | No | Include file attachments |
| `includeWatchers` | boolean | No | Include watchers list |
| `includeRelations` | boolean | No | Include related issues |
| `includeChildren` | boolean | No | Include child issues |

**Note:** Change history (journals) is always included by default.

**Example usage in Claude:**

> "Look up Redmine issue #12345 and summarize the recent activity"

> "What's the status of issue 6789? Include any attachments."

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
