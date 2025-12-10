import type { Config } from "./config.js";

export interface RedmineUser {
    id: number;
    name: string;
}

export interface RedmineCustomField {
    id: number;
    name: string;
    value: string | string[];
}

export interface RedmineCurrentUser {
    id: number;
    login: string;
    firstname: string;
    lastname: string;
    mail: string;
    created_on: string;
    updated_on?: string;
    last_login_on?: string;
    passwd_changed_on?: string;
    avatar_url?: string;
    status: number;
    custom_fields?: RedmineCustomField[];
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

export interface RedmineIssueStatusDetail {
    id: number;
    name: string;
    is_closed: boolean;
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

// Update Issue types
export interface UpdateIssueData {
    subject?: string;
    description?: string;
    status_id?: number;
    priority_id?: number;
    assigned_to_id?: number; // Set to 0 to unassign
    tracker_id?: number;
    parent_issue_id?: number;
    start_date?: string; // YYYY-MM-DD
    due_date?: string; // YYYY-MM-DD
    done_ratio?: number; // 0-100
    estimated_hours?: number;
    notes?: string;
    private_notes?: boolean;
}

// Time Entry types
export interface CreateTimeEntryData {
    issue_id: number;
    hours: number;
    activity_id?: number;
    spent_on?: string; // YYYY-MM-DD
    comments?: string;
}

export interface RedmineTimeEntry {
    id: number;
    project: RedmineProject;
    issue?: { id: number };
    user: RedmineUser;
    activity: { id: number; name: string };
    hours: number;
    comments?: string;
    spent_on: string;
    created_on: string;
    updated_on: string;
}

export interface RedmineActivity {
    id: number;
    name: string;
    is_default: boolean;
}

// Project Membership types
export interface RedmineMembership {
    id: number;
    project: RedmineProject;
    user?: RedmineUser;
    group?: { id: number; name: string };
    roles: Array<{ id: number; name: string; inherited?: boolean }>;
}

export interface ListProjectMembersOptions {
    limit?: number;
    offset?: number;
}

// Internal response types
interface RedmineIssueResponse {
    issue: RedmineIssue;
}

interface RedmineTimeEntryResponse {
    time_entry: RedmineTimeEntry;
}

interface RedmineActivitiesResponse {
    time_entry_activities: RedmineActivity[];
}

interface RedmineMembershipsResponse {
    memberships: RedmineMembership[];
    total_count: number;
    offset: number;
    limit: number;
}

interface RedmineIssueStatusesResponse {
    issue_statuses: RedmineIssueStatusDetail[];
}

interface RedmineCurrentUserResponse {
    user: RedmineCurrentUser & { api_key?: string };
}

export class RedmineClient {
    private readonly config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    async getIssue(
        issueId: number,
        options: GetIssueOptions = {},
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
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(
                `Failed to fetch issue ${issueId}: ${response.status} ${response.statusText}`,
            );
        }

        const data = (await response.json()) as RedmineIssueResponse;
        return data.issue;
    }

    async updateIssue(
        issueId: number,
        data: UpdateIssueData,
    ): Promise<RedmineIssue> {
        const url = `${this.config.redmineUrl}/issues/${issueId}.json`;

        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ issue: data }),
        });

        if (!response.ok) {
            throw new Error(
                `Failed to update issue ${issueId}: ${response.status} ${response.statusText}`,
            );
        }

        // Redmine PUT returns empty body on success, so fetch the updated issue
        return this.getIssue(issueId);
    }

    async createTimeEntry(
        data: CreateTimeEntryData,
    ): Promise<RedmineTimeEntry> {
        const url = `${this.config.redmineUrl}/time_entries.json`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ time_entry: data }),
        });

        if (!response.ok) {
            throw new Error(
                `Failed to create time entry: ${response.status} ${response.statusText}`,
            );
        }

        const result = (await response.json()) as RedmineTimeEntryResponse;
        return result.time_entry;
    }

    async getTimeEntryActivities(): Promise<RedmineActivity[]> {
        const url = `${this.config.redmineUrl}/enumerations/time_entry_activities.json`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(
                `Failed to fetch time entry activities: ${response.status} ${response.statusText}`,
            );
        }

        const data = (await response.json()) as RedmineActivitiesResponse;
        return data.time_entry_activities;
    }

    async listProjectMembers(
        projectId: string | number,
        options: ListProjectMembersOptions = {},
    ): Promise<{
        memberships: RedmineMembership[];
        total_count: number;
        offset: number;
        limit: number;
    }> {
        const params = new URLSearchParams();
        if (options.limit !== undefined) {
            params.set("limit", String(options.limit));
        }
        if (options.offset !== undefined) {
            params.set("offset", String(options.offset));
        }

        const queryString = params.toString();
        const url = `${this.config.redmineUrl}/projects/${projectId}/memberships.json${queryString ? `?${queryString}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(
                `Failed to fetch project members: ${response.status} ${response.statusText}`,
            );
        }

        const data = (await response.json()) as RedmineMembershipsResponse;
        return {
            memberships: data.memberships,
            total_count: data.total_count,
            offset: data.offset,
            limit: data.limit,
        };
    }

    async listIssueStatuses(): Promise<RedmineIssueStatusDetail[]> {
        const url = `${this.config.redmineUrl}/issue_statuses.json`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(
                `Failed to fetch issue statuses: ${response.status} ${response.statusText}`,
            );
        }

        const data = (await response.json()) as RedmineIssueStatusesResponse;
        return data.issue_statuses;
    }

    async getCurrentUser(): Promise<RedmineCurrentUser> {
        const url = `${this.config.redmineUrl}/users/current.json`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(
                `Failed to fetch current user: ${response.status} ${response.statusText}`,
            );
        }

        const data = (await response.json()) as RedmineCurrentUserResponse;
        // Exclude api_key from response - agent doesn't need it
        const { api_key: _, ...user } = data.user;
        return user;
    }
}
