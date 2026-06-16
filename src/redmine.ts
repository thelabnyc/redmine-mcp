import { isIP } from "node:net";

import type { Config } from "./config.js";

function encodePathSegment(value: string | number): string {
    return encodeURIComponent(String(value));
}

function isPrivateOrLocalHostname(hostname: string): boolean {
    const normalizedHostname = hostname.toLowerCase().replace(/^\[|\]$/g, "");

    if (
        normalizedHostname === "localhost" ||
        normalizedHostname.endsWith(".localhost")
    ) {
        return true;
    }

    const ipVersion = isIP(normalizedHostname);
    if (ipVersion === 4) {
        const octets = normalizedHostname
            .split(".")
            .map((part) => Number(part));
        return (
            octets[0] === 10 ||
            octets[0] === 127 ||
            (octets[0] === 169 && octets[1] === 254) ||
            (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
            (octets[0] === 192 && octets[1] === 168)
        );
    }

    if (ipVersion === 6) {
        if (normalizedHostname.startsWith("::ffff:")) {
            return isPrivateOrLocalHostname(
                normalizedHostname.slice("::ffff:".length),
            );
        }

        const firstSegment = Number.parseInt(
            normalizedHostname.split(":")[0] ?? "",
            16,
        );

        return (
            normalizedHostname === "::1" ||
            ((firstSegment & 0xffc0) === 0xfe80 ||
                (firstSegment & 0xfe00) === 0xfc00)
        );
    }

    return false;
}

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

export interface RedmineVersion {
    id: number;
    project: RedmineProject;
    name: string;
    description?: string;
    status: string;
    due_date?: string;
    sharing: string;
    created_on: string;
    updated_on: string;
    wiki_page_title?: string;
    estimated_hours?: number;
    spent_hours?: number;
}

export interface RedmineIssueCategory {
    id: number;
    project: RedmineProject;
    name: string;
    assigned_to?: RedmineUser;
}

export interface RedmineTracker {
    id: number;
    name: string;
}

export interface RedmineQuery {
    id: number;
    name: string;
    is_public: boolean;
    project_id?: number;
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

export interface RedmineTrackerDetail {
    id: number;
    name: string;
    default_status: { id: number; name: string };
    description?: string;
    enabled_standard_fields?: string[];
}

export interface RedminePriorityDetail {
    id: number;
    name: string;
    is_default: boolean;
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
    content_url?: string;
    author: RedmineUser;
    created_on: string;
}

export interface RedmineWatcher {
    id: number;
    name: string;
}

export const relationTypes = [
    "relates",
    "duplicates",
    "duplicated",
    "blocks",
    "blocked",
    "precedes",
    "follows",
    "copied_to",
    "copied_from",
] as const;

export type RedmineRelationType = (typeof relationTypes)[number];

export interface RedmineRelation {
    id: number;
    issue_id: number;
    issue_to_id: number;
    relation_type: RedmineRelationType;
    delay?: number | null;
}

/** Data from Redmine Agile plugin. Only present if plugin is installed. */
export interface RedmineAgileData {
    story_points?: number | null;
    position?: number | null;
}

export interface RedmineCustomFieldDefinition {
    id: number;
    name: string;
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
    custom_fields?: RedmineCustomField[];
    journals?: RedmineJournal[];
    attachments?: RedmineAttachment[];
    watchers?: RedmineWatcher[];
    relations?: RedmineRelation[];
    children?: RedmineIssue[];
    agile_data_attributes?: RedmineAgileData;
}

export interface GetIssueOptions {
    includeAttachments?: boolean;
    includeWatchers?: boolean;
    includeRelations?: boolean;
    includeChildren?: boolean;
    journalLimit?: number;
    journalOffset?: number;
}

export interface GetIssueResult {
    issue: RedmineIssue;
    journalPagination?: {
        total_count: number;
        offset: number;
        limit: number;
        hint?: string;
    };
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
    fixed_version_id?: number;
    category_id?: number;
    start_date?: string; // YYYY-MM-DD
    due_date?: string; // YYYY-MM-DD
    done_ratio?: number; // 0-100
    estimated_hours?: number;
    notes?: string;
    private_notes?: boolean;
    custom_fields?: Array<{ id: number; value: string | string[] }>;
}

// Create Issue types
export interface CreateIssueData {
    project_id: string | number;
    subject: string;
    description?: string;
    status_id?: number;
    priority_id?: number;
    assigned_to_id?: number;
    tracker_id?: number;
    parent_issue_id?: number;
    fixed_version_id?: number;
    category_id?: number;
    start_date?: string;
    due_date?: string;
    done_ratio?: number;
    estimated_hours?: number;
    is_private?: boolean;
    custom_fields?: Array<{ id: number; value: string | string[] }>;
}

// Issue relation types
export interface CreateIssueRelationData {
    issue_to_id: number;
    relation_type?: RedmineRelationType;
    delay?: number;
}

export interface TimeEntryMutationFields {
    hours: number;
    activity_id?: number;
    spent_on?: string; // YYYY-MM-DD
    comments?: string;
    custom_fields?: Array<{ id: number; value: string | string[] }>;
}

// Time Entry types
export type CreateTimeEntryData = TimeEntryMutationFields &
    (
        | { issue_id: number; project_id?: never }
        | { project_id: number; issue_id?: never }
    );

export type UpdateTimeEntryData = Partial<TimeEntryMutationFields>;

export interface RedmineAttachmentDetailResponse {
    attachment: RedmineAttachment;
}

export interface RedmineUploadResult {
    token: string;
}

export interface RedmineIssueUpload {
    token: string;
    filename: string;
    content_type?: string;
    description?: string;
}

export interface RedmineAttachFileResult {
    attached: true;
    issueId: number;
    upload: RedmineIssueUpload;
}

export interface RedmineDownloadAttachmentResult {
    attachment: RedmineAttachment;
    saved_path: string;
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
    custom_fields?: RedmineCustomField[];
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

export interface ListProjectVersionsResult {
    versions: RedmineVersion[];
    total_count: number;
}

export interface ListProjectIssueCategoriesResult {
    issue_categories: RedmineIssueCategory[];
    total_count: number;
}

// Internal response types
interface RedmineIssueResponse {
    issue: RedmineIssue;
}

interface RedmineRelationsResponse {
    relations: RedmineRelation[];
}

interface RedmineRelationResponse {
    relation: RedmineRelation;
}

interface RedmineTimeEntryResponse {
    time_entry: RedmineTimeEntry;
}

interface RedmineTimeEntriesListResponse {
    time_entries: RedmineTimeEntry[];
    total_count: number;
    offset: number;
    limit: number;
}

interface RedmineActivitiesResponse {
    time_entry_activities: RedmineActivity[];
}

interface RedmineUploadResponse {
    upload: RedmineUploadResult;
}

interface RedmineMembershipsResponse {
    memberships: RedmineMembership[];
    total_count: number;
    offset: number;
    limit: number;
}

interface RedmineVersionsResponse {
    versions: RedmineVersion[];
    total_count?: number;
}

interface RedmineIssueCategoriesResponse {
    issue_categories: RedmineIssueCategory[];
    total_count?: number;
}

interface RedmineIssueStatusesResponse {
    issue_statuses: RedmineIssueStatusDetail[];
}

interface RedmineTrackersResponse {
    trackers: RedmineTrackerDetail[];
}

interface RedminePrioritiesResponse {
    issue_priorities: RedminePriorityDetail[];
}

interface RedmineCreateIssueResponse {
    issue: { id: number };
}

interface RedmineProjectDetailResponse {
    project: {
        id: number;
        name: string;
        identifier: string;
        issue_custom_fields?: RedmineCustomFieldDefinition[];
    };
}

interface RedmineCurrentUserResponse {
    user: RedmineCurrentUser & { api_key?: string };
}

interface RedmineIssuesListResponse {
    issues: RedmineIssue[];
    total_count: number;
    offset: number;
    limit: number;
}

interface RedmineProjectFull {
    id: number;
    name: string;
    identifier: string;
    description?: string;
    status: number;
    is_public: boolean;
    created_on: string;
    updated_on: string;
}

interface RedmineProjectsListResponse {
    projects: RedmineProjectFull[];
    total_count: number;
    offset: number;
    limit: number;
}

interface RedmineQueriesListResponse {
    queries: RedmineQuery[];
    total_count: number;
    offset: number;
    limit: number;
}

export interface ListMyIssuesOptions {
    statusId?: number | "open" | "closed" | "*";
    projectId?: string | number;
    limit?: number;
    offset?: number;
    sort?: string;
}

export interface ListIssuesOptions {
    issueIds?: Array<string | number>;
    projectId?: string | number;
    trackerId?: number;
    statusId?: number | "open" | "closed" | "*";
    assignedToId?: number | "me";
    parentId?: number;
    createdOn?: string;
    updatedOn?: string;
    customFields?: Array<{ id: number; value: string }>;
    queryId?: number;
    includeAttachments?: boolean;
    includeRelations?: boolean;
    sort?: string;
    limit?: number;
    offset?: number;
}

export interface ListIssuesResult {
    issues: RedmineIssue[];
    total_count: number;
    offset: number;
    limit: number;
}

export interface ListTimeEntriesOptions {
    issueId?: string | number;
    projectId?: string | number;
    userId?: number | "me";
    spentOn?: string;
    from?: string;
    to?: string;
    activityId?: number;
    limit?: number;
    offset?: number;
}

export interface ListTimeEntriesResult {
    time_entries: RedmineTimeEntry[];
    total_count: number;
    offset: number;
    limit: number;
}

export interface RedmineIssueSummary {
    id: number;
    project: RedmineProject;
    tracker: RedmineTracker;
    status: RedmineStatus;
    priority: RedminePriority;
    subject: string;
    due_date?: string;
    done_ratio: number;
    updated_on: string;
    /** Board position from Redmine Agile plugin. Undefined if plugin not installed. */
    position?: number | null;
}

export interface RedmineProjectSummary {
    id: number;
    identifier: string;
    name: string;
}

export interface ListProjectsOptions {
    limit?: number;
    offset?: number;
}

export interface ListQueriesOptions {
    limit?: number;
    offset?: number;
}

export class RedmineClient {
    private readonly config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    /**
     * Extract error details from a failed response body
     */
    private async extractErrorDetails(response: Response): Promise<string> {
        try {
            const body = (await response.json()) as { errors?: string[] };
            if (body.errors && Array.isArray(body.errors)) {
                return ` - ${body.errors.join(", ")}`;
            }
            return "";
        } catch {
            // Response body is not JSON or couldn't be parsed
            return "";
        }
    }

    private validateAttachmentDownloadUrl(
        attachmentId: number,
        downloadUrl: URL,
        redmineOrigin: string,
    ): void {
        if (downloadUrl.protocol !== "http:" && downloadUrl.protocol !== "https:") {
            throw new Error(
                `Failed to download attachment ${attachmentId}: unsupported attachment URL protocol ${downloadUrl.protocol}`,
            );
        }

        if (
            downloadUrl.origin !== redmineOrigin &&
            isPrivateOrLocalHostname(downloadUrl.hostname)
        ) {
            throw new Error(
                `Failed to download attachment ${attachmentId}: refused unsafe attachment URL ${downloadUrl.toString()}`,
            );
        }
    }

    async listIssueRelations(issueId: number): Promise<RedmineRelation[]> {
        const url = `${this.config.redmineUrl}/issues/${issueId}/relations.json`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch issue relations for issue ${issueId}: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const data = (await response.json()) as RedmineRelationsResponse;
        return data.relations;
    }

    async getIssueRelation(relationId: number): Promise<RedmineRelation> {
        const url = `${this.config.redmineUrl}/relations/${relationId}.json`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch issue relation ${relationId}: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const data = (await response.json()) as RedmineRelationResponse;
        return data.relation;
    }

    async createIssueRelation(
        issueId: number,
        data: CreateIssueRelationData,
    ): Promise<RedmineRelation> {
        const url = `${this.config.redmineUrl}/issues/${issueId}/relations.json`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ relation: data }),
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to create issue relation for issue ${issueId}: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const result = (await response.json()) as RedmineRelationResponse;
        return result.relation;
    }

    async deleteIssueRelation(relationId: number): Promise<void> {
        const url = `${this.config.redmineUrl}/relations/${relationId}.json`;

        const response = await fetch(url, {
            method: "DELETE",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to delete issue relation ${relationId}: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }
    }

    async getAttachment(attachmentId: number): Promise<RedmineAttachment> {
        const url = `${this.config.redmineUrl}/attachments/${attachmentId}.json`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch attachment ${attachmentId}: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const data = (await response.json()) as RedmineAttachmentDetailResponse;
        return data.attachment;
    }

    async uploadAttachment(
        filename: string,
        fileBytes: Buffer,
    ): Promise<RedmineUploadResult> {
        const params = new URLSearchParams({ filename });
        const url = `${this.config.redmineUrl}/uploads.json?${params.toString()}`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
                "Content-Type": "application/octet-stream",
            },
            body: fileBytes,
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to upload attachment ${filename}: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const data = (await response.json()) as RedmineUploadResponse;
        return data.upload;
    }

    async attachUploadedFileToIssue(
        issueId: number,
        upload: RedmineIssueUpload,
        options: { notes?: string; privateNotes?: boolean } = {},
    ): Promise<RedmineAttachFileResult> {
        const url = `${this.config.redmineUrl}/issues/${issueId}.json`;
        const issue: {
            uploads: RedmineIssueUpload[];
            notes?: string;
            private_notes?: boolean;
        } = { uploads: [upload] };

        if (options.notes !== undefined) {
            issue.notes = options.notes;
        }
        if (options.privateNotes !== undefined) {
            issue.private_notes = options.privateNotes;
        }

        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ issue }),
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to attach file to issue ${issueId}: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        return { attached: true, issueId, upload };
    }

    async downloadAttachmentContent(
        attachmentId: number,
        contentUrl: string,
    ): Promise<ArrayBuffer> {
        const redmineOrigin = new URL(this.config.redmineUrl).origin;
        let downloadUrl = new URL(contentUrl, this.config.redmineUrl);

        for (let redirects = 0; redirects < 5; redirects += 1) {
            this.validateAttachmentDownloadUrl(
                attachmentId,
                downloadUrl,
                redmineOrigin,
            );

            const headers: Record<string, string> = {
                Accept: "application/octet-stream",
            };

            if (downloadUrl.origin === redmineOrigin) {
                headers["X-Redmine-API-Key"] = this.config.redmineApiKey;
            }

            const response = await fetch(downloadUrl.toString(), {
                method: "GET",
                headers,
                redirect: "manual",
            });

            if (
                response.status >= 300 &&
                response.status < 400 &&
                response.headers.get("location") !== null
            ) {
                const redirectUrl = new URL(
                    response.headers.get("location") ?? "",
                    downloadUrl,
                );

                if (
                    downloadUrl.origin === redmineOrigin &&
                    redirectUrl.origin !== redmineOrigin
                ) {
                    throw new Error(
                        `Failed to download attachment ${attachmentId}: refused cross-origin redirect to ${redirectUrl.toString()}`,
                    );
                }

                downloadUrl = redirectUrl;
                continue;
            }

            if (!response.ok) {
                const errorDetails = await this.extractErrorDetails(response);
                throw new Error(
                    `Failed to download attachment ${attachmentId}: ${response.status} ${response.statusText}${errorDetails}`,
                );
            }

            return response.arrayBuffer();
        }

        throw new Error(
            `Failed to download attachment ${attachmentId}: too many redirects`,
        );
    }

    async updateAttachment(
        attachmentId: number,
        description: string,
    ): Promise<void> {
        const url = `${this.config.redmineUrl}/attachments/${attachmentId}.json`;

        const response = await fetch(url, {
            method: "PATCH",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ attachment: { description } }),
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to update attachment ${attachmentId}: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }
    }

    async deleteAttachment(attachmentId: number): Promise<void> {
        const url = `${this.config.redmineUrl}/attachments/${attachmentId}.json`;

        const response = await fetch(url, {
            method: "DELETE",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to delete attachment ${attachmentId}: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }
    }

    async getIssue(
        issueId: number,
        options: GetIssueOptions = {},
    ): Promise<GetIssueResult> {
        const DEFAULT_JOURNAL_LIMIT = 5;

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
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch issue ${issueId}: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const data = (await response.json()) as RedmineIssueResponse;
        const issue = data.issue;

        // Apply journal pagination
        const allJournals = issue.journals ?? [];
        const totalCount = allJournals.length;
        const offset = options.journalOffset ?? 0;
        const limit = options.journalLimit ?? DEFAULT_JOURNAL_LIMIT;

        issue.journals = allJournals.slice(offset, offset + limit);

        const returnedCount = issue.journals.length;
        const hasMore = offset + returnedCount < totalCount;

        return {
            issue,
            journalPagination: {
                total_count: totalCount,
                offset,
                limit,
                ...(hasMore && {
                    hint: `Only ${returnedCount} of ${totalCount} journal entries returned. Fetch remaining entries before drawing conclusions about this issue's history.`,
                }),
            },
        };
    }

    async updateIssue(
        issueId: number,
        data: UpdateIssueData,
    ): Promise<GetIssueResult> {
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
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to update issue ${issueId}: ${response.status} ${response.statusText}${errorDetails}`,
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
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to create time entry: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const result = (await response.json()) as RedmineTimeEntryResponse;
        return result.time_entry;
    }

    async listTimeEntries(
        options: ListTimeEntriesOptions = {},
    ): Promise<ListTimeEntriesResult> {
        const params = new URLSearchParams();

        if (options.issueId !== undefined) {
            params.set("issue_id", String(options.issueId).replace(/^#/, ""));
        }
        if (options.projectId !== undefined) {
            params.set("project_id", String(options.projectId));
        }
        if (options.userId !== undefined) {
            params.set("user_id", String(options.userId));
        }
        if (options.spentOn !== undefined) {
            params.set("spent_on", options.spentOn);
        }
        if (options.from !== undefined) {
            params.set("from", options.from);
        }
        if (options.to !== undefined) {
            params.set("to", options.to);
        }
        if (options.activityId !== undefined) {
            params.set("activity_id", String(options.activityId));
        }
        if (options.limit !== undefined) {
            params.set("limit", String(options.limit));
        }
        if (options.offset !== undefined) {
            params.set("offset", String(options.offset));
        }

        const queryString = params.toString();
        const url = `${this.config.redmineUrl}/time_entries.json${queryString ? `?${queryString}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch time entries: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const data = (await response.json()) as RedmineTimeEntriesListResponse;
        return {
            time_entries: data.time_entries,
            total_count: data.total_count,
            offset: data.offset,
            limit: data.limit,
        };
    }

    async getTimeEntry(timeEntryId: number): Promise<RedmineTimeEntry> {
        const url = `${this.config.redmineUrl}/time_entries/${timeEntryId}.json`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch time entry ${timeEntryId}: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const data = (await response.json()) as RedmineTimeEntryResponse;
        return data.time_entry;
    }

    async updateTimeEntry(
        timeEntryId: number,
        data: UpdateTimeEntryData,
    ): Promise<RedmineTimeEntry> {
        const url = `${this.config.redmineUrl}/time_entries/${timeEntryId}.json`;

        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ time_entry: data }),
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to update time entry ${timeEntryId}: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        return this.getTimeEntry(timeEntryId);
    }

    async deleteTimeEntry(timeEntryId: number): Promise<void> {
        const url = `${this.config.redmineUrl}/time_entries/${timeEntryId}.json`;

        const response = await fetch(url, {
            method: "DELETE",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to delete time entry ${timeEntryId}: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }
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
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch time entry activities: ${response.status} ${response.statusText}${errorDetails}`,
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
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch project members: ${response.status} ${response.statusText}${errorDetails}`,
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

    async listProjectVersions(
        projectId: string | number,
    ): Promise<ListProjectVersionsResult> {
        const encodedProjectId = encodePathSegment(projectId);
        const url = `${this.config.redmineUrl}/projects/${encodedProjectId}/versions.json`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch project versions: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const data = (await response.json()) as RedmineVersionsResponse;
        return {
            versions: data.versions,
            total_count: data.total_count ?? data.versions.length,
        };
    }

    async listProjectIssueCategories(
        projectId: string | number,
    ): Promise<ListProjectIssueCategoriesResult> {
        const encodedProjectId = encodePathSegment(projectId);
        const url = `${this.config.redmineUrl}/projects/${encodedProjectId}/issue_categories.json`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch project issue categories: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const data = (await response.json()) as RedmineIssueCategoriesResponse;
        return {
            issue_categories: data.issue_categories,
            total_count: data.total_count ?? data.issue_categories.length,
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
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch issue statuses: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const data = (await response.json()) as RedmineIssueStatusesResponse;
        return data.issue_statuses;
    }

    async listTrackers(): Promise<RedmineTrackerDetail[]> {
        const url = `${this.config.redmineUrl}/trackers.json`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch trackers: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const data = (await response.json()) as RedmineTrackersResponse;
        return data.trackers;
    }

    async listIssuePriorities(): Promise<RedminePriorityDetail[]> {
        const url = `${this.config.redmineUrl}/enumerations/issue_priorities.json`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch issue priorities: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const data = (await response.json()) as RedminePrioritiesResponse;
        return data.issue_priorities;
    }

    async getProjectCustomFields(
        projectId: string | number,
    ): Promise<RedmineCustomFieldDefinition[]> {
        const url = `${this.config.redmineUrl}/projects/${projectId}.json?include=issue_custom_fields`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch project custom fields: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const data = (await response.json()) as RedmineProjectDetailResponse;
        return data.project.issue_custom_fields ?? [];
    }

    async createIssue(data: CreateIssueData): Promise<GetIssueResult> {
        const url = `${this.config.redmineUrl}/issues.json`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ issue: data }),
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to create issue: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const result = (await response.json()) as RedmineCreateIssueResponse;
        return this.getIssue(result.issue.id);
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
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch current user: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const data = (await response.json()) as RedmineCurrentUserResponse;
        // Exclude api_key from response - agent doesn't need it
        const { api_key: _, ...user } = data.user;
        return user;
    }

    async listIssues(
        options: ListIssuesOptions = {},
    ): Promise<ListIssuesResult> {
        const params = new URLSearchParams();

        if (options.issueIds !== undefined) {
            params.set(
                "issue_id",
                options.issueIds
                    .map((issueId) => String(issueId).replace(/^#/, ""))
                    .join(","),
            );
        }
        if (options.projectId !== undefined) {
            params.set("project_id", String(options.projectId));
        }
        if (options.trackerId !== undefined) {
            params.set("tracker_id", String(options.trackerId));
        }
        if (options.statusId !== undefined) {
            params.set("status_id", String(options.statusId));
        }
        if (options.assignedToId !== undefined) {
            params.set("assigned_to_id", String(options.assignedToId));
        }
        if (options.parentId !== undefined) {
            params.set("parent_id", String(options.parentId));
        }
        if (options.createdOn !== undefined) {
            params.set("created_on", options.createdOn);
        }
        if (options.updatedOn !== undefined) {
            params.set("updated_on", options.updatedOn);
        }
        for (const customField of options.customFields ?? []) {
            params.set(`cf_${customField.id}`, customField.value);
        }
        if (options.queryId !== undefined) {
            params.set("query_id", String(options.queryId));
        }

        const includes: string[] = [];
        if (options.includeAttachments) includes.push("attachments");
        if (options.includeRelations) includes.push("relations");
        if (includes.length > 0) {
            params.set("include", includes.join(","));
        }

        if (options.sort !== undefined) {
            params.set("sort", options.sort);
        }
        if (options.limit !== undefined) {
            params.set("limit", String(options.limit));
        }
        if (options.offset !== undefined) {
            params.set("offset", String(options.offset));
        }

        const queryString = params.toString();
        const url = `${this.config.redmineUrl}/issues.json${queryString ? `?${queryString}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch issues: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const data = (await response.json()) as RedmineIssuesListResponse;
        return {
            issues: data.issues,
            total_count: data.total_count,
            offset: data.offset,
            limit: data.limit,
        };
    }

    async listMyIssues(options: ListMyIssuesOptions = {}): Promise<{
        issues: RedmineIssueSummary[];
        total_count: number;
        offset: number;
        limit: number;
    }> {
        const DEFAULT_SORT = "priority:desc,updated_on:desc";

        const params = new URLSearchParams();
        params.set("assigned_to_id", "me");

        if (options.statusId !== undefined) {
            params.set("status_id", String(options.statusId));
        }
        if (options.projectId !== undefined) {
            params.set("project_id", String(options.projectId));
        }
        if (options.limit !== undefined) {
            params.set("limit", String(options.limit));
        }
        if (options.offset !== undefined) {
            params.set("offset", String(options.offset));
        }
        params.set("sort", options.sort ?? DEFAULT_SORT);

        const url = `${this.config.redmineUrl}/issues.json?${params.toString()}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch issues: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const data = (await response.json()) as RedmineIssuesListResponse;

        // Return slim summaries to reduce response size
        const summaries: RedmineIssueSummary[] = data.issues.map((issue) => ({
            id: issue.id,
            project: issue.project,
            tracker: issue.tracker,
            status: issue.status,
            priority: issue.priority,
            subject: issue.subject,
            due_date: issue.due_date,
            done_ratio: issue.done_ratio,
            updated_on: issue.updated_on,
            position: issue.agile_data_attributes?.position,
        }));

        return {
            issues: summaries,
            total_count: data.total_count,
            offset: data.offset,
            limit: data.limit,
        };
    }

    async listProjects(options: ListProjectsOptions = {}): Promise<{
        projects: RedmineProjectSummary[];
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
        const url = `${this.config.redmineUrl}/projects.json${queryString ? `?${queryString}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch projects: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const data = (await response.json()) as RedmineProjectsListResponse;

        // Return slim summaries
        const summaries: RedmineProjectSummary[] = data.projects.map(
            (project) => ({
                id: project.id,
                identifier: project.identifier,
                name: project.name,
            }),
        );

        return {
            projects: summaries,
            total_count: data.total_count,
            offset: data.offset,
            limit: data.limit,
        };
    }

    async listQueries(options: ListQueriesOptions = {}): Promise<{
        queries: RedmineQuery[];
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
        const url = `${this.config.redmineUrl}/queries.json${queryString ? `?${queryString}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Redmine-API-Key": this.config.redmineApiKey,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorDetails = await this.extractErrorDetails(response);
            throw new Error(
                `Failed to fetch queries: ${response.status} ${response.statusText}${errorDetails}`,
            );
        }

        const data = (await response.json()) as RedmineQueriesListResponse;

        return {
            queries: data.queries,
            total_count: data.total_count,
            offset: data.offset,
            limit: data.limit,
        };
    }
}
