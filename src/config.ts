export interface Config {
    redmineUrl: string;
    redmineApiKey: string;
}

export function getConfig(): Config {
    const redmineUrl = process.env.REDMINE_URL;
    const redmineApiKey = process.env.REDMINE_API_KEY;

    if (!redmineUrl) {
        throw new Error("REDMINE_URL environment variable is required");
    }
    if (!redmineApiKey) {
        throw new Error("REDMINE_API_KEY environment variable is required");
    }

    // Remove trailing slash if present
    const normalizedUrl = redmineUrl.replace(/\/$/, "");

    return {
        redmineUrl: normalizedUrl,
        redmineApiKey,
    };
}
