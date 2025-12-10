import type { Config } from "./config.js";

export interface RedmineUser {
    id: number;
    name: string;
}

export interface RedmineProject {
    id: number;
    name: string;
}

export interface RedmineTracker {
    id: number;
    name: string;
}

export interface RedmineStatus {
    id: number;
    name: string;
}

export interface RedminePriority {
    id: number;
    name: string;
}

export interface RedmineJournalDetail {
    property: string;
    name: string;
    old_value?: string;
    new_value?: string;
}

export interface RedmineJournal {
    id: number;
    user: RedmineUser;
    notes: string;
    created_on: string;
    details: RedmineJournalDetail[];
}

export interface RedmineAttachment {
    id: number;
    filename: string;
    filesize: number;
    content_type: string;
    description?: string;
    author: RedmineUser;
    created_on: string;
}

export interface RedmineWatcher {
    id: number;
    name: string;
}

export interface RedmineRelation {
    id: number;
    issue_id: number;
    issue_to_id: number;
    relation_type: string;
    delay?: number;
}

export interface RedmineIssue {
    id: number;
    project: RedmineProject;
    tracker: RedmineTracker;
    status: RedmineStatus;
    priority: RedminePriority;
    author: RedmineUser;
    assigned_to?: RedmineUser;
    subject: string;
    description?: string;
    start_date?: string;
    due_date?: string;
    done_ratio: number;
    estimated_hours?: number;
    created_on: string;
    updated_on: string;
    journals?: RedmineJournal[];
    attachments?: RedmineAttachment[];
    watchers?: RedmineWatcher[];
    relations?: RedmineRelation[];
    children?: RedmineIssue[];
}

export interface GetIssueOptions {
    includeAttachments?: boolean;
    includeWatchers?: boolean;
    includeRelations?: boolean;
    includeChildren?: boolean;
}

interface RedmineIssueResponse {
    issue: RedmineIssue;
}

export class RedmineClient {
    private readonly config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    async getIssue(
        issueId: number,
        options: GetIssueOptions = {}
    ): Promise<RedmineIssue> {
        // Build include params - journals always included
        const includes = ["journals"];
        if (options.includeAttachments) includes.push("attachments");
        if (options.includeWatchers) includes.push("watchers");
        if (options.includeRelations) includes.push("relations");
        if (options.includeChildren) includes.push("children");

        const includeParam = includes.join(",");
        const url = `${this.config.redmineUrl}/issues/${issueId}.json?include=${includeParam}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(
                `Failed to fetch issue ${issueId}: ${response.status} ${response.statusText}`
            );
        }

        const data = (await response.json()) as RedmineIssueResponse;
        return data.issue;
    }
}
