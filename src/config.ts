import path from "node:path";

const DEFAULT_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export interface Config {
    redmineUrl: string;
    redmineApiKey: string;
    fileRoot: string;
    maxUploadBytes: number;
}

export function getConfig(): Config {
    const redmineUrl = process.env.REDMINE_URL;
    const redmineApiKey = process.env.REDMINE_API_KEY;
    const fileRoot = process.env.REDMINE_MCP_FILE_ROOT ?? process.cwd();
    const maxUploadBytesRaw = process.env.REDMINE_MCP_MAX_UPLOAD_BYTES;

    if (!redmineUrl) {
        throw new Error("REDMINE_URL environment variable is required");
    }
    if (!redmineApiKey) {
        throw new Error("REDMINE_API_KEY environment variable is required");
    }

    const maxUploadBytes =
        maxUploadBytesRaw === undefined
            ? DEFAULT_MAX_UPLOAD_BYTES
            : Number(maxUploadBytesRaw);
    if (!Number.isSafeInteger(maxUploadBytes) || maxUploadBytes <= 0) {
        throw new Error(
            "REDMINE_MCP_MAX_UPLOAD_BYTES must be a positive integer",
        );
    }

    // Remove trailing slash if present
    const normalizedUrl = redmineUrl.replace(/\/$/, "");

    return {
        redmineUrl: normalizedUrl,
        redmineApiKey,
        fileRoot: path.resolve(fileRoot),
        maxUploadBytes,
    };
}
